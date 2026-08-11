import React, { useState, useEffect } from 'react';
import { Send, Key, MessageSquare, Check, Save, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

interface TelegramSettingsProps {
  adminToken: string;
}

export const TelegramSettings: React.FC<TelegramSettingsProps> = ({ adminToken }) => {
  const [botToken, setBotToken] = useState('8731468553:AAFk8GM8EKAnt1-_Q8iRjS1ZV7isiBqOFpU');
  const [chatId, setChatId] = useState('-1002746235318');
  const [formattedChatId, setFormattedChatId] = useState('-1002746235318');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current Telegram configuration
  useEffect(() => {
    fetchConfig();
  }, [adminToken]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/telegram-config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.botToken) setBotToken(data.botToken);
        if (data.chatId) setChatId(data.chatId);
        if (data.formattedChatId) setFormattedChatId(data.formattedChatId);
      }
    } catch (err) {
      console.error('Failed to load telegram config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/telegram-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ botToken, chatId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormattedChatId(data.formattedChatId);
        setStatusMsg({
          type: 'success',
          text: 'የቴሌግራም ቦት ሴቲንግ በስኬት ተቀምጧል! (Telegram Settings Saved Successfully)',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.message || 'ሴቲንጉን ለማስቀመጥ አልተቻለም::',
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'የኔትወርክ ስህተት አጋጥሟል::' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestBot = async () => {
    setIsTesting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/telegram-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ botToken, chatId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          type: 'success',
          text: 'የሙከራ መልዕክት ወደ Telegram Channel/Chat በስኬት ተልኳል! 🎉',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.message || 'መልዕክቱን መላክ አልተቻለም:: ቦቱን Admin ማድረጎትን ያረጋግጡ::',
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'የኔትወርክ ስህተት አጋጥሟል::' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl border border-blue-900/50 shadow-xl space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-2xl flex items-center justify-center font-bold border border-sky-500/20 shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>የቴሌግራም ቦት እና ቻናል ማስተካከያ (Telegram Bot Settings)</span>
              <span className="bg-sky-500/20 text-sky-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-sky-400/30">
                Live Channel Bot
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              የድሬዳዋ አስተዳደር ኮሙዩኒኬሽን የቴሌግራም ቻናል ID እና Bot Token እዚህ ማስተካከል ይችላሉ::
            </p>
          </div>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 border shadow-md transition-all ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* Telegram Bot Token Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Telegram Bot Token:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">BotFather የሰጠዎትን Token ያስገቡ</span>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 8731468553:AAFk8GM8EKAnt1-_Q8iRjS1ZV7isiBqOFpU"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              required
            />
          </div>

          {/* Telegram Chat ID / Channel ID Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>Telegram Chat ID / Channel ID:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">ለምሳሌ፡ -1002746235318</span>
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1002746235318"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              required
            />
            {formattedChatId && (
              <p className="text-[11px] text-slate-400 font-mono">
                የተረጋገጠ ቻናል ID: <strong className="text-sky-300">{formattedChatId}</strong>
              </p>
            )}
          </div>

          {/* Action Buttons: Save & Test */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleTestBot}
              disabled={isTesting}
              className="px-5 py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50"
            >
              <Send className={`w-4 h-4 text-sky-400 ${isTesting ? 'animate-bounce' : ''}`} />
              <span>{isTesting ? 'በመላክ ላይ...' : 'የሙከራ መልዕክት ላክ (Test Connection)'}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 border border-blue-400/30"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>{isSaving ? 'በማስቀመጥ ላይ...' : 'ሴቲንጉን አስቀምጥ (Save Settings)'}</span>
            </button>
          </div>
        </form>

        {/* Quick Help Box */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ጠቃሚ መመሪያ (Telegram Setup Guide)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
            <li>ቦቱ ወደ Telegram ቻናልዎ ሪፖርት መላክ እንዲችል ቻናሉ ውስጥ <strong>Admin</strong> መደረግ አለበት::</li>
            <li>Channel ID ቁጥር ሲያስገቡ የሱፐር ግሩፕ / ቻናል ቅድመ-ቁጥር <code>-100</code> በራሱ ይስተካከላል::</li>
            <li>የተደረጉ ማስተካከያዎች በሙሉ ቀጥታ በሳይቱ ላይ ተፈጻሚ ይሆናሉ::</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
