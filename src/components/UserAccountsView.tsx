import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  UserCog,
  Key,
  ShieldCheck,
  Plus,
  RefreshCw,
  Crown,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  User,
  ShieldAlert,
  Database,
  Terminal,
  Wrench,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AdminUser } from '../types';

interface UserAccountsViewProps {
  adminToken: string;
  currentUser: AdminUser | null;
}

export const UserAccountsView: React.FC<UserAccountsViewProps> = ({
  adminToken,
  currentUser,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // My Profile Edit State
  const [myEmail, setMyEmail] = useState<string>(currentUser?.email || '');
  const [myUsername, setMyUsername] = useState<string>(currentUser?.username || '');
  const [myNewPassword, setMyNewPassword] = useState<string>('');
  const [updatingProfile, setUpdatingProfile] = useState<boolean>(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(currentUser?.two_factor_enabled));
  const [toggling2FA, setToggling2FA] = useState<boolean>(false);

  // Password Reset Modal / State for Target User
  const [selectedUserToReset, setSelectedUserToReset] = useState<AdminUser | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState<string>('');
  const [resettingUserPass, setResettingUserPass] = useState<boolean>(false);

  // Create New Account Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'owner' | 'admin'>('admin');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  // 2FA Disablement Modal State
  const [isDisable2FaModalOpen, setIsDisable2FaModalOpen] = useState<boolean>(false);
  const [disable2FaPassword, setDisable2FaPassword] = useState<string>('');
  const [disable2FaOtp, setDisable2FaOtp] = useState<string>('');
  const [disable2FaRequiresOtp, setDisable2FaRequiresOtp] = useState<boolean>(false);
  const [disable2FaError, setDisable2FaError] = useState<string | null>(null);
  const [disabling2FaLoading, setDisabling2FaLoading] = useState<boolean>(false);

  // User Deletion Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [adminToken]);

  useEffect(() => {
    if (currentUser) {
      setMyEmail(currentUser.email || '');
      setMyUsername(currentUser.username || '');
      setTwoFactorEnabled(Boolean(currentUser.two_factor_enabled));
    }
  }, [currentUser]);

  // Google Authenticator 2FA Setup Modal State
  const [isSetup2FaModalOpen, setIsSetup2FaModalOpen] = useState<boolean>(false);
  const [setupQrUrl, setSetupQrUrl] = useState<string>('');
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [setupVerifyToken, setSetupVerifyToken] = useState<string>('');
  const [setup2FaLoading, setSetup2FaLoading] = useState<boolean>(false);
  const [setup2FaError, setSetup2FaError] = useState<string | null>(null);

  const handleToggle2FA = async () => {
    setToggling2FA(true);
    setMessage(null);
    try {
      const nextState = !twoFactorEnabled;
      const res = await fetch('/api/admin/2fa/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwoFactorEnabled(data.two_factor_enabled);
        if (data.two_factor_enabled && data.qrCodeUrl) {
          setSetupQrUrl(data.qrCodeUrl);
          setSetupSecret(data.secret || '');
          setSetupVerifyToken('');
          setIsSetup2FaModalOpen(true);
        }
        setMessage({
          type: 'success',
          text: data.message || `2FA በስኬት ${data.two_factor_enabled ? 'በርቷል (ON)' : 'ጠፍቷል (OFF)'}!`,
        });
        fetchUsers();
      } else if (data.needsSetup) {
        // Needs initial QR setup: fetch setup details
        const setupRes = await fetch('/api/admin/2fa/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
        });
        const setupData = await setupRes.json();
        if (setupRes.ok && setupData.qrCodeUrl) {
          setSetupQrUrl(setupData.qrCodeUrl);
          setSetupSecret(setupData.secret);
          setSetupVerifyToken('');
          setIsSetup2FaModalOpen(true);
        } else {
          setMessage({ type: 'error', text: setupData.error || 'የ 2FA QR ኮድ ማዘጋጀት አልተቻለም' });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'የ 2FA ሁኔታ መቀየር አልተቻለም' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'የኔትወርክ ስህተት አጋጥሟል' });
    } finally {
      setToggling2FA(false);
    }
  };

  const handleConfirmSetup2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetup2FaLoading(true);
    setSetup2FaError(null);

    try {
      const res = await fetch('/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          secret: setupSecret,
          token: setupVerifyToken,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTwoFactorEnabled(true);
        setIsSetup2FaModalOpen(false);
        setMessage({
          type: 'success',
          text: '✅ Google Authenticator ባለ 2-ደረጃ ማረጋገጫ (2FA) በስኬት ተገናኝቷል!',
        });
        fetchUsers();
      } else {
        setSetup2FaError(data.error || 'የተሳሳተ የ 2FA ኮድ!');
      }
    } catch (err: any) {
      setSetup2FaError('የኔትወርክ ስህተት አጋጥሟል');
    } finally {
      setSetup2FaLoading(false);
    }
  };

  const handleConfirmDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisabling2FaLoading(true);
    setDisable2FaError(null);

    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          currentPassword: disable2FaPassword,
          token: disable2FaOtp || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTwoFactorEnabled(false);
        setIsDisable2FaModalOpen(false);
        setMessage({
          type: 'success',
          text: 'ባለ 2-ደረጃ ማረጋገጫ (2FA) ጠፍቷል::',
        });
        fetchUsers();
      } else {
        setDisable2FaError(data.error || '2FA ማጥፋት አልተቻለም');
      }
    } catch (err: any) {
      setDisable2FaError('የኔትወርክ ስህተት አጋጥሟል');
    } finally {
      setDisabling2FaLoading(false);
    }
  };

  const handleUpdateMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setUpdatingProfile(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          email: myEmail,
          username: myUsername,
          password: myNewPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'የእርስዎ ፕሮፋይልና ፓስወርድ በስኬት ተቀይሯል!' });
        setMyNewPassword('');
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'ማስተካከል አልተቻለም' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'የኔትወርክ ስህተት' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToReset || !resetPasswordInput.trim()) return;

    setResettingUserPass(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedUserToReset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          password: resetPasswordInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `ለተጠቃሚ [${selectedUserToReset.email}] አዲስ ፓስወርድ በስኬት ተቀይሯል!`,
        });
        setSelectedUserToReset(null);
        setResetPasswordInput('');
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'ፓስወርዱን መቀየር አልተቻለም' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'የኔትወርክ ስህተት' });
    } finally {
      setResettingUserPass(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;

    setCreatingUser(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          email: newEmail,
          username: newUsername || newEmail.split('@')[0],
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `አዲስ [${newRole}] ተጠቃሚ በስኬት ተፈጠረ!` });
        setIsCreateModalOpen(false);
        setNewEmail('');
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'ተጠቃሚውን መፍጠር አልተቻለም' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'የኔትወርክ ስህተት' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = (targetUser: AdminUser) => {
    setUserToDelete(targetUser);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `ተጠቃሚ [${userToDelete.email}] በስኬት ተሰርዟል!` });
        setUserToDelete(null);
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'ተጠቃሚውን መሰረዝ አልተቻለም' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'የኔትወርክ ስህተት' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const isDeveloperOrOwner =
    currentUser?.role === 'developer' || currentUser?.role === 'owner';

  return (
    <div className="space-y-8">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 rounded-3xl border border-blue-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>የአካውንት እና የደህንነት ማስተዳደሪያ (Accounts & Security)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              የተጠቃሚዎች እና የአድሚኖች ፓነል
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              ፓስወርድ ሲጠፋ ማስተካከያ፣ አዲስ አድሚን መፍጠሪያ እና የራሶትን መረጃ ማሻሻያ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>አድስ (Refresh)</span>
            </button>

            {isDeveloperOrOwner && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all border border-amber-300"
              >
                <Plus className="w-4 h-4" />
                <span>አዲስ ተጠቃሚ ፍጠር</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Status Alert */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className={`grid grid-cols-1 ${isDeveloperOrOwner ? 'lg:grid-cols-3' : 'max-w-xl mx-auto'} gap-8`}>
        {/* Profile Settings (Visible to All) */}
        <div className={`${isDeveloperOrOwner ? 'lg:col-span-1' : 'w-full'} bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6`}>
          <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">የኔ መለያ ማስተካከያ (My Profile)</h2>
              <p className="text-[11px] text-slate-400">የግል መረጃዎንና ፓስወርድዎን እዚሁ ይለውጡ</p>
            </div>
          </div>

          <form onSubmit={handleUpdateMyProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                የተጠቃሚ ስም (Username)
              </label>
              <input
                type="text"
                value={myUsername}
                onChange={(e) => setMyUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                ኢሜይል አድራሻ (Email)
              </label>
              <input
                type="email"
                value={myEmail}
                onChange={(e) => setMyEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                አዲስ ፓስወርድ (New Password)
              </label>
              <input
                type="password"
                value={myNewPassword}
                onChange={(e) => setMyNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="ባዶ ከተው አይቀየርም (Leave blank to keep current)"
              />
            </div>

            {/* Two-Factor Authentication (2FA) Modern Toggle Switch */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 shadow-inner">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${twoFactorEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-xs font-black text-white">Google Authenticator (2FA)</span>
                  </div>
                  <p className="text-[11px] font-bold">
                    {twoFactorEnabled ? (
                      <span className="text-emerald-400">🟢 2FA በርቷል (ON / Active)</span>
                    ) : (
                      <span className="text-slate-400">⚪ 2FA ጠፍቷል (OFF / Disabled)</span>
                    )}
                  </p>
                </div>

                {/* Modern Interactive Switch Slider */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${twoFactorEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {twoFactorEnabled ? 'ON' : 'OFF'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggle2FA}
                    disabled={toggling2FA}
                    title={twoFactorEnabled ? '2FA አጥፋ (Turn OFF)' : '2FA አብራ (Turn ON)'}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${
                      twoFactorEnabled ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-slate-800 border border-slate-700'
                    }`}
                  >
                    <span className="sr-only">Toggle 2FA</span>
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                        twoFactorEnabled ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={updatingProfile}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {updatingProfile ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>መረጃዬን አዝምን (Save Profile Changes)</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: All Accounts Table (ONLY for Owner and Developer) */}
        {isDeveloperOrOwner && (
          <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">
                    የሲስተሙ የተጠቃሚዎች እና የአድሚኖች ዝርዝር
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    የባለቤቶች (Owners)፣ አድሚኖችና የደቨሎፐር አካውንቶች
                  </p>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">ተጠቃሚ / ኢሜይል</th>
                    <th className="py-3 px-3">ሚና (Role)</th>
                    <th className="py-3 px-3 text-right">ተግባር (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2 rounded-xl text-xs font-black ${
                              u.role === 'developer'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : u.role === 'owner'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {u.role === 'developer' ? (
                              <Laptop className="w-4 h-4" />
                            ) : u.role === 'owner' ? (
                              <Crown className="w-4 h-4" />
                            ) : (
                              <UserCog className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white block">
                              {u.username || u.email.split('@')[0]}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            u.role === 'developer'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : u.role === 'owner'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {u.role === 'developer' && '⚡ OPA Developer'}
                          {u.role === 'owner' && '👑 Owner / ባለቤት'}
                          {u.role === 'admin' && '🛡️ Admin / አድሚን'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {isDeveloperOrOwner && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserToReset(u);
                                setResetPasswordInput('');
                              }}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>ፓስወርድ ቀይር</span>
                            </button>

                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                title="ተጠቃሚውን ሰርዝ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>ሰርዝ</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Password Reset Modal for Target User */}
      {selectedUserToReset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center space-x-3 text-amber-400 border-b border-slate-800 pb-4">
              <Key className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-white">ፓስወርድ ማስተካከያ (Reset Password)</h3>
                <p className="text-xs text-slate-400">
                  ለተጠቃሚ: <span className="text-amber-300 font-bold">{selectedUserToReset.email}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleResetUserPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  አዲስ ፓስወርድ ያስገቡ (New Password)
                </label>
                <input
                  type="text"
                  required
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="ምሳሌ: NewPass@2026"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserToReset(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  ሰርዝ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={resettingUserPass}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {resettingUserPass && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>ቀይር (Update Password)</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create New Account Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center space-x-3 text-amber-400 border-b border-slate-800 pb-4">
              <Plus className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-white">አዲስ ተጠቃሚ/አድሚን ፍጠር</h3>
                <p className="text-xs text-slate-400">ለአዲስ ባለቤት ወይም አድሚን መግቢያ ይፍጠሩ</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  ኢሜይል አድራሻ *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. newadmin@dgc.gov.et"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  የተጠቃሚ ስም (Username)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. newadmin"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  የመግቢያ ፓስወርድ *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Password"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  የተጠቃሚው ሚና (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'owner' | 'admin')}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="admin">🛡️ Admin (መጠይቆችና አቤቱታዎች መስሪያ)</option>
                  <option value="owner">👑 Owner (ባለቤት - ሙሉ ስልጣን ያለው)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  ሰርዝ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {creatingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>ፍጠር (Create Account)</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Google Authenticator 2FA Setup Modal with QR Code Scanning */}
      {isSetup2FaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center space-x-3 text-emerald-400 border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Google Authenticator (2FA) ማገናኛ</h3>
                <p className="text-xs text-slate-400">የአካውንትዎን ደህንነት በ Google Authenticator አፕ ያጠናክሩ</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="font-bold text-slate-200">📌 ደረጃ 1፡ QR ኮዱን በስልክዎ ይቃኙ (Scan QR Code)</p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  በስልክዎ ላይ <strong>Google Authenticator</strong> ወይም <strong>Microsoft Authenticator</strong> አፕሊኬሽን በመክፈት <strong>"+"</strong> ምልክቱን ተጭነው ከታች ያለውን QR ኮድ ይቃኙ::
                </p>
              </div>

              {/* QR Code Presentation */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner border border-slate-700">
                {setupQrUrl ? (
                  <img
                    src={setupQrUrl}
                    alt="Google Authenticator QR Code"
                    className="w-48 h-48 rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-800 font-bold">
                    QR በማዘጋጀት ላይ...
                  </div>
                )}
                <div className="mt-3 text-center">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">Manual Setup Key (በእጅ ለማስገባት):</span>
                  <code className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded select-all border border-slate-300">
                    {setupSecret}
                  </code>
                </div>
              </div>

              <form onSubmit={handleConfirmSetup2FA} className="space-y-4">
                {setup2FaError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{setup2FaError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1.5">
                    📌 ደረጃ 2፡ ከ Google Authenticator አፕ የመጣውን ባለ 6-አሃዝ ኮድ ያስገቡ *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={setupVerifyToken}
                    onChange={(e) => setSetupVerifyToken(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-3 bg-slate-950 border border-emerald-500/60 rounded-xl text-center text-lg font-mono font-black text-emerald-300 tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="••••••"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSetup2FaModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    ተመለስ (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={setup2FaLoading || setupVerifyToken.length < 6}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {setup2FaLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>አረጋግጥና 2FA አብራ (Verify & Activate)</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Disable 2FA Security Confirmation Modal */}
      {isDisable2FaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center space-x-3 text-red-400 border-b border-slate-800 pb-4">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-white">2FA ማጥፊያ የደህንነት ማረጋገጫ</h3>
                <p className="text-xs text-slate-400">የአካውንትዎን ባለ 2-ደረጃ ጥበቃ ለማጥፋት ያረጋግጡ</p>
              </div>
            </div>

            <form onSubmit={handleConfirmDisable2FA} className="space-y-4">
              {disable2FaError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
                  {disable2FaError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  የአሁኑን ፓስወርድዎን ያስገቡ (Current Password) *
                </label>
                <input
                  type="password"
                  required
                  value={disable2FaPassword}
                  onChange={(e) => setDisable2FaPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  የ Google Authenticator ባለ 6-አሃዝ ኮድ (አስገዳጅ ካልሆነ ክፍት ይተዉት)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={disable2FaOtp}
                  onChange={(e) => setDisable2FaOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm font-mono font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="••••••"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisable2FaModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  ሰርዝ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={disabling2FaLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {disabling2FaLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>አረጋግጥና 2FA አጥፋ</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* User Deletion Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center space-x-3 text-red-400 border-b border-slate-800 pb-4">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">ተጠቃሚን መሰረዝ</h3>
                <p className="text-xs text-red-400">የአድሚን አካውንት የማጥፊያ ማረጋገጫ</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300">
                እርግጠኛ ነዎት ተጠቃሚ <strong className="text-white">[{userToDelete.email}]</strong> ከዳታቤዝ እንዲሰረዝ ይፈልጋሉ?
              </p>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>ሚና: <strong className="text-amber-400 uppercase">{userToDelete.role}</strong></span>
                <span>•</span>
                <span>Username: <strong className="text-slate-200">{userToDelete.username || 'N/A'}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                ተመለስ (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={confirmDeleteUser}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>አረጋግጥና ሰርዝ</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
