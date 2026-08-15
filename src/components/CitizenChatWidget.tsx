import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  Building2,
  Phone,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Bell,
  BellOff,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface CitizenChatWidgetProps {
  isDarkMode?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'አቤቱታ እንዴት ማስገባት እችላለሁ?',
  'የጥያቄዬን ሁኔታ እንዴት መከታተል እችላለሁ?',
  'የቢሮው አድራሻ እና ስልክ ቁጥር?',
  'የሕዝብ መጠይቆች ዓላማ ምንድን ነው?',
];

// Helper to strip markdown asterisks and formatting for display and speech
function stripAsterisks(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove **bold**
    .replace(/\*(.*?)\*/g, '$1')     // remove *italic*
    .replace(/[\*\_`#]/g, '')        // remove asterisks and backticks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Play pleasant web audio chime
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Tone 2 (Higher friendly pitch)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {
    // AudioContext autoplay might be restricted before interaction
  }
}

export const CitizenChatWidget: React.FC<CitizenChatWidgetProps> = ({ isDarkMode = true }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sound notification chime state (no TTS)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dgc_chat_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('dgc_chat_sound_enabled', String(next));
      return next;
    });
  };

  const initialGreeting: ChatMessage = {
    id: 'msg-welcome',
    role: 'model',
    text: 'እንኳን ወደ ድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የደንበኞች አገልግሎት ረዳት በደህና መጡ! እኔ የቢሮው ረዳት ነኝ። ስለ አቤቱታ አቀራረብ፣ ስለ መጠይቆች፣ የቢሮው የሥራ ሰዓት ወይም አድራሻ ማንኛውንም ጥያቄ መጠየቅ ይችላሉ። ዛሬ በምን ልርዳዎት?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('dgc_citizen_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // fallback
    }
    return [initialGreeting];
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Persist conversation in session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('dgc_citizen_chat_history', JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  // Cleanup speech synthesis on unmount or close
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = stripAsterisks(textToSend || inputMessage).trim();
    if (!text || loading) return;

    setErrorMsg(null);
    setInputMessage('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Format chat history for backend (excluding welcome message if needed)
      const historyPayload = newMessages
        .filter((m) => m.id !== 'msg-welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: stripAsterisks(m.text),
        }));

      const res = await fetch('/api/public/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'መልዕክት መላክ አልተቻለም');
      }

      const cleanReply = stripAsterisks(data.reply || 'ይቅርታ፣ ምላሽ ማግኘት አልተቻለም።');
      const botMsgId = `bot-${Date.now()}`;

      const botMsg: ChatMessage = {
        id: botMsgId,
        role: 'model',
        text: cleanReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Play Sound Chime if sound enabled
      if (soundEnabled) {
        playNotificationChime();
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMsg(err.message || 'የቻት አገልግሎት ለጊዜው አልተሳካም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።');
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([initialGreeting]);
    sessionStorage.removeItem('dgc_citizen_chat_history');
    setErrorMsg(null);
  };

  return (
    <>
      {/* Floating Action Chat Button (Bottom-Right Corner) */}
      <div id="dgc-floating-chat-container" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              id="dgc-open-chat-button"
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsOpen(true)}
              className="relative p-4 rounded-full bg-gradient-to-tr from-amber-500 via-amber-600 to-orange-600 text-slate-950 font-black shadow-2xl shadow-amber-500/40 border-2 border-amber-300 flex items-center justify-center group cursor-pointer"
              title="የቢሮ ረዳት (Customer Assistant)"
              aria-label="Open Citizen Chat Assistant"
            >
              {/* Online Pulsing Indicator Dot */}
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-slate-900"></span>
              </span>

              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-slate-950 fill-slate-950/20" />
                <span className="hidden sm:inline-block pr-1 text-xs font-black tracking-tight text-slate-950">
                  የቢሮ ረዳት
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Floating Chat Modal / Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="dgc-citizen-chat-window"
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.92 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[85vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden backdrop-blur-2xl ${
                isDarkMode
                  ? 'bg-slate-900/95 border-amber-500/40 text-slate-100'
                  : 'bg-white/95 border-amber-400/50 text-slate-900'
              }`}
            >
              {/* Chat Header */}
              <div className="p-4 bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-950 border-b border-amber-500/30 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-inner">
                    <Bot className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black text-white">የቢሮ ረዳት</h3>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/20 border border-green-500/40 text-green-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Online
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-400/80 font-medium truncate max-w-[210px]">
                      የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-1">
                  {/* Sound / Chime Toggle Button */}
                  <button
                    id="chat-sound-toggle-btn"
                    onClick={toggleSound}
                    title={soundEnabled ? 'የማሳወቂያ ደውል አጥፋ (Mute Chime)' : 'የማሳወቂያ ደውል አብራ (Enable Chime)'}
                    className={`p-2 rounded-xl transition-colors ${
                      soundEnabled
                        ? 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>

                  {/* Reset Chat Button */}
                  <button
                    id="chat-reset-button"
                    onClick={handleResetChat}
                    title="ቻቱን አጽዳ (Reset Chat)"
                    className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Close Window */}
                  <button
                    id="chat-close-button"
                    onClick={() => setIsOpen(false)}
                    title="ዝጋ (Minimize)"
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
                {/* Security & Official Badge Banner */}
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-[11px] text-amber-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>ኦፊሴላዊ የደንበኞች መረጃ ረዳት • 100% ሚስጥራዊ</span>
                  </div>
                  {soundEnabled && (
                    <span className="text-[10px] text-amber-400/90 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded-md">
                      ደውል የበራ
                    </span>
                  )}
                </div>

                {/* Message Bubbles */}
                {messages.map((msg) => {
                  const isModel = msg.role === 'model';
                  const cleanText = stripAsterisks(msg.text);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isModel ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-end gap-2 max-w-[88%]">
                        {isModel && (
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 mb-1 text-amber-400">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div
                          className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                            isModel
                              ? isDarkMode
                                ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-sm'
                                : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-bl-sm shadow-sm'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-br-sm shadow-md'
                          }`}
                        >
                          {cleanText}
                        </div>
                      </div>

                      {/* Message Footer: Timestamp */}
                      <div className="flex items-center gap-2 px-8 mt-1">
                        <span className="text-[9px] text-slate-400">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Loading / Typing indicator */}
                {loading && (
                  <div className="flex items-center space-x-2 max-w-[80%]">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 bg-slate-800/80 rounded-2xl rounded-bl-sm border border-slate-700 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Quick Question Prompts (Shown if only welcome message exists or on idle) */}
                {messages.length <= 2 && !loading && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[10px] text-slate-400 font-semibold px-1 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-amber-400" /> ፈጣን ጥያቄዎች:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          id={`suggested-q-${idx}`}
                          onClick={() => handleSendMessage(q)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 text-[11px] text-slate-300 hover:text-amber-300 transition-all text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    id="citizen-chat-input-field"
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="ጥያቄዎን እዚህ ይጻፉ..."
                    disabled={loading}
                    className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
                  />

                  <button
                    id="citizen-chat-send-btn"
                    type="submit"
                    disabled={!inputMessage.trim() || loading}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 shrink-0"
                    title="ላክ (Send)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <p className="text-[9px] text-center text-slate-500 mt-1.5 font-medium">
                  የደንበኞች አገልግሎት ረዳት • 20 ጥያቄ በ15 ደቂቃ ገደብ
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
