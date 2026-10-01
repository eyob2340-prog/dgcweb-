import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Mail, KeyRound, AlertCircle, ArrowLeft, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
  const [step, setStep] = useState<'login' | '2fa' | 'setup_2fa' | 'force_password_change'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempToken, setTempToken] = useState<string>('');
  const [tempAuthData, setTempAuthData] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [setupCode, setSetupCode] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setStep('login');
      setEmail('');
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setTempToken('');
      setTempAuthData(null);
      setError(null);
      setSuccessMsg(null);
      setSetupToken('');
      setQrCodeUrl('');
      setSetupSecret('');
      setSetupCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startTwoFactorSetup = async (token: string) => {
    setSetupToken(token);
    const res = await fetch('/api/admin/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.qrCodeUrl) {
      setError(data.error || '2FA ማዘጋጀት አልተቻለም');
      return;
    }
    setQrCodeUrl(data.qrCodeUrl);
    setSetupSecret(data.secret || '');
    setSetupCode('');
    setError(null);
    setSuccessMsg(null);
    setStep('setup_2fa');
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setupToken}` },
        credentials: 'include',
        body: JSON.stringify({ secret: setupSecret, token: setupCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.admin) {
        setError(data.error || 'ማረጋገጥ አልተቻለም');
        return;
      }
      setSetupToken('');
      setQrCodeUrl('');
      setSetupSecret('');
      if (data.mustChangePassword) {
        setTempAuthData(data);
        setStep('force_password_change');
      } else {
        onLoginSuccess(data);
        onClose();
      }
    } catch {
      setError('የኔትወርክ ስህተት ተከስቷል::');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, otp: step === '2fa' ? otp : undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'የመግባት ሂደት አልተሳካም');
      } else if (data.require2FASetup && data.setupToken) {
        // 2FA is mandatory but not enrolled yet: show QR code enrolment step
        await startTwoFactorSetup(data.setupToken);
      } else if (data.require2FA) {
        setStep('2fa');
        setError(null);
        setSuccessMsg('እባክዎ በ Google Authenticator አፕ ላይ የሚታየውን ባለ 6-አሃዝ ኮድ ያስገቡ::');
      } else {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_token'); // Clean up any stale legacy token storage

        if (data.mustChangePassword) {
          setTempAuthData(data);
          setStep('force_password_change');
          setError(null);
        } else {
          onLoginSuccess(data);
          onClose();
        }
      }
    } catch (err) {
      setError('የኔትወርክ ስህተት ተከስቷል::');
    } finally {
      setLoading(false);
    }
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('አዲሱ ፓስወርድ ቢያንስ 8 ፊደላት፣ ቁጥሮች እና ምልክቶች ማካተት አለበት::');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('አዲሱ ፓስወርድ እና ማረጋገጫው አይመሳሰሉም!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: password,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ፓስወርድ መቀየር አልተቻለም');
      } else {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_token');
        if (tempAuthData) {
          onLoginSuccess(tempAuthData);
        }
        onClose();
      }
    } catch (err) {
      setError('ፓስወርድ በሚቀየርበት ወቅት ስህተት ተከስቷል::');
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
            {step === 'force_password_change' ? (
              <Lock className="w-8 h-8 text-amber-400 animate-bounce" />
            ) : step === '2fa' || step === 'setup_2fa' ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
            )}
          </div>

          <h2 className="text-xl font-black text-red-400">
            {step === 'force_password_change'
              ? 'ቀዳሚ ፓስወርድ መቀየሪያ (Mandatory Password Setup)'
              : step === 'setup_2fa'
              ? 'Google Authenticator ማዘጋጀት (2FA Setup)'
              : step === '2fa'
              ? 'ባለ 2-ደረጃ ማረጋገጫ (Two-Factor OTP)'
              : 'የተፈቀደላቸው ባለሙያዎች ብቻ (Admin Login)'}
          </h2>
          <p className="text-xs text-red-200/90 mt-1.5 leading-relaxed">
            {step === 'force_password_change'
              ? 'ለደህንነት ጥበቃ ሲባል በመጀመሪያው መግቢያ ጊዜ ጊዜያዊ ፓስወርድዎን መቀየር ግዴታ ነው::'
              : step === 'setup_2fa'
              ? 'ለደህንነት ሲባል ባለ 2-ደረጃ ማረጋገጫ ግዴታ ነው:: QR ኮዱን በ Authenticator አፕ ስካን ያድርጉ::'
              : step === '2fa'
              ? 'እባክዎ ባለ 6-አሃዝ የደህንነት ማረጋገጫ ኮድ (OTP) ያስገቡ::'
              : 'ይህ ገፅ ለድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የተፈቀደላቸው ባለሙያዎች ብቻ የተዘጋጀ ነው::'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-slate-900">
          {/* Escape Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>ወደ ዋናው ገጽ ተመለስ (Back to Public Portal)</span>
          </button>

          {error && (
            <div className="p-3 bg-red-900/60 border border-red-500 rounded-xl text-xs text-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'setup_2fa' ? (
            <form onSubmit={handleVerifySetup} className="space-y-4" autoComplete="off">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 text-xs text-slate-300 space-y-3">
                <span className="font-bold text-emerald-400 block">📱 ደረጃ 1፦ QR ኮዱን ስካን ያድርጉ</span>
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="2FA QR code" className="mx-auto w-48 h-48 rounded-xl bg-white p-2" />
                )}
                <p>
                  በስልክዎ <strong>Google Authenticator</strong> ወይም <strong>Microsoft Authenticator</strong> ይክፈቱ፣ "+" ይጫኑ እና ኮዱን ስካን ያድርጉ::
                </p>
                {setupSecret && (
                  <p className="break-all">
                    ስካን ማድረግ ካልተቻለ ይህን ቁልፍ በእጅ ያስገቡ፦ <code className="text-emerald-300 font-mono">{setupSecret}</code>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ደረጃ 2፦ አፑ የሚያሳየውን ባለ 6-አሃዝ ኮድ ያስገቡ</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  placeholder="••••••"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-950 border border-emerald-500/60 rounded-xl text-lg font-mono font-black tracking-widest text-center text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || setupCode.length < 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-950 disabled:opacity-50"
              >
                {loading ? 'በማረጋገጥ ላይ...' : 'አረጋግጥና ግባ (Verify & Login)'}
              </button>
            </form>
          ) : step === 'force_password_change' ? (
            <form onSubmit={handleForcePasswordChange} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">አዲስ ጠንካራ ፓስወርድ (New Password)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="ቢያንስ 8 ፊደላትና ቁጥሮች"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-amber-500/60 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">አዲሱን ፓስወርድ ያረጋግጡ (Confirm New Password)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="ፓስወርዱን በድጋሚ ያስገቡ"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-amber-500/60 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2"
              >
                {loading ? <span>በማስቀመጥ ላይ...</span> : <span>ፓስወርዱን አድስና ወደ ሲስተም ግባ (Update & Proceed)</span>}
              </button>
            </form>
          ) : step === '2fa' ? (
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 text-xs text-slate-300">
                <span className="font-bold text-emerald-400 block mb-1">📱 Google Authenticator ማረጋገጫ</span>
                በስልክዎ ባለው <strong>Google Authenticator</strong> ወይም <strong>Microsoft Authenticator</strong> አፕ ላይ የሚታየውን ባለ 6-አሃዝ ኮድ ያስገቡ::
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ባለ 6-አሃዝ የደህንነት ኮድ (Google Authenticator Code)</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-emerald-500/60 rounded-xl text-lg font-mono font-black tracking-widest text-center text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  ተመለስ
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? <span>በማረጋገጥ ላይ...</span> : <span>አረጋግጥና ግባ (Verify 2FA)</span>}
                </button>
              </div>
            </form>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};
