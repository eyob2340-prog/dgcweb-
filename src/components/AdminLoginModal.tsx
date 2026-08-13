import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Mail, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { AuthResponse } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (authData: AuthResponse) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'የመግባት ሂደት አልተሳካም');
      } else {
        localStorage.setItem('admin_token', data.token);
        onLoginSuccess(data);
        onClose();
      }
    } catch (err) {
      setError('የኔትወርክ ስህተት ተከስቷል::');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-red-950/85 backdrop-blur-md animate-fade-in text-left">
      <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-red-600/80 overflow-hidden relative shadow-red-900/50">
        {/* Red Warning Banner Bar */}
        <div className="bg-red-600 text-white px-4 py-2 text-[11px] font-bold tracking-widest uppercase flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 animate-ping" />
            ⚠️ RESTRICTED ACCESS SYSTEM
          </span>
          <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">INTERNAL ONLY</span>
        </div>

        {/* Modal Header */}
        <div className="bg-gradient-to-b from-red-950 to-slate-900 p-6 relative border-b border-red-900/50">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-red-300 hover:text-white rounded-lg hover:bg-red-900/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 bg-red-600/20 border-2 border-red-500/50 rounded-2xl flex items-center justify-center text-red-400 mb-3 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>

          <h2 className="text-xl font-black text-red-400">
            የተፈቀደላቸው ባለሙያዎች ብቻ (Admin Login)
          </h2>
          <p className="text-xs text-red-200/90 mt-1.5 leading-relaxed">
            ይህ ገፅ ለድሬዳዋ አስተዳደር የመንግስት ኮሙዩኒኬሽን ጉዳዮች ቢሮ የተፈቀደላቸው ባለሙያዎች ብቻ የተዘጋጀ ነው::
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-slate-900">
          {/* Escape Button for Unintended Users */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>ወደ ዋናው ገጽ ተመለስ (Back to Survey)</span>
          </button>

          {error && (
            <div className="p-3 bg-red-900/60 border border-red-500 rounded-xl text-xs text-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">የባለሙያ ኢሜይል (Official Email)</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-red-900/60 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">ፓስወርድ (Password)</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-red-900/60 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-red-950 flex items-center justify-center space-x-2"
              >
                {loading ? <span>በመግባት ላይ...</span> : <span>ወደ አድሚን ሲስተም ይግቡ (Login)</span>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
