import React, { useState } from 'react';
import {
  signInWithGoogle,
  signInWithFacebook,
  loginWithEmail,
  registerWithEmail,
  loginAsLocalMember,
} from '../lib/firebase';
import {
  ShieldCheck,
  LogIn,
  UserPlus,
  AlertCircle,
  Droplets,
  ArrowRight,
  Sparkles,
  X,
  ExternalLink,
  UserCheck
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);

  const [teamMemberName, setTeamMemberName] = useState('ช่างเฉลิมพัฒน์ (ผู้ดูแลระบบ CPT KR)');

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setIsConfigError(false);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.warn('Google Sign-in status:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('หน้าต่างเข้าสู่ระบบถูกปิด กรุณาลองใหม่อีกครั้ง');
      } else if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/operation-not-allowed' ||
        (err.message && err.message.includes('configuration-not-found'))
      ) {
        setIsConfigError(true);
        setErrorMsg(
          'โปรเจกต์ Firebase ยังไม่ได้เปิดใช้งาน Authentication ใน Firebase Console ท่านสามารถกดปุ่ม "เข้าใช้งานในฐานะทีมงาน CPT" ด้านล่างเพื่อเริ่มจัดการสต๊อกได้ทันที'
        );
      } else {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setIsConfigError(false);
    try {
      await signInWithFacebook();
      onSuccess();
    } catch (err: any) {
      console.warn('Facebook Sign-in status:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('หน้าต่างเข้าสู่ระบบถูกปิด กรุณาลองใหม่อีกครั้ง');
      } else if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/operation-not-allowed' ||
        (err.message && err.message.includes('configuration-not-found'))
      ) {
        setIsConfigError(true);
        setErrorMsg('โปรเจกต์ Firebase ยังไม่ได้เปิดใช้งาน Authentication ใน Firebase Console');
      } else {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Facebook');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setIsConfigError(false);
    try {
      if (isRegister) {
        if (!displayName) {
          setErrorMsg('กรุณาระบุชื่อ-นามสกุล หรือชื่อสมาชิก');
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.warn('Email auth status:', err);
      let msg = err.message || 'เข้าสู่ระบบไม่สำเร็จ';

      if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/operation-not-allowed' ||
        (err.message && err.message.includes('configuration-not-found'))
      ) {
        setIsConfigError(true);
        msg =
          'โปรเจกต์ Firebase ยังไม่ได้เปิดใช้งาน Authentication (Sign-in method) ใน Firebase Console ท่านสามารถกด "เข้าใช้งานในฐานะทีมงาน CPT" ด้านล่างเพื่อเริ่มจัดการสต๊อกได้ทันที';
      } else if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'อีเมลนี้ถูกใช้งานแล้วในระบบ กรุณาเข้าสู่ระบบ';
      } else if (err.code === 'auth/weak-password') {
        msg = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTeamLogin = (nameToUse?: string) => {
    const finalName = (nameToUse || teamMemberName || 'ช่างเฉลิมพัฒน์ (CPT KR)').trim();
    loginAsLocalMember(finalName);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] flex flex-col">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-1.5 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-5 text-white text-center relative flex-shrink-0">
          <div className="mx-auto w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-2 shadow-inner">
            <Droplets className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">ระบบจัดการสต๊อกน้ำมันเครื่อง&แอดบลู CPT KR</h2>
          <p className="text-amber-100 text-xs mt-0.5">
            เข้าสู่ระบบเพื่อใช้งาน บันทึกเบิกจ่าย และตรวจสอบรอบเปลี่ยนถ่าย 20,000 กม.
          </p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-900 text-xs sm:text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {isConfigError && (
                <div className="pt-1.5 border-t border-amber-200/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleQuickTeamLogin()}
                    className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>เข้าใช้งานทันทีในฐานะทีมงาน CPT (แนะนำ)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href="https://console.firebase.google.com/project/engine-oil---adblue-cptkorat/authentication"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-700 hover:underline flex items-center justify-center gap-1 font-medium"
                  >
                    <span>เปิดตั้งค่าใน Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Quick 1-Click Access for Team Members */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-amber-950 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>เข้าใช้งานด่วนสำหรับทีมงาน CPT</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                พร้อมใช้งานทันที
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={teamMemberName}
                onChange={(e) => setTeamMemberName(e.target.value)}
                placeholder="ระบุชื่อช่าง หรือชื่อสมาชิก"
                className="flex-1 px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-800"
              />
              <button
                type="button"
                onClick={() => handleQuickTeamLogin()}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer flex-shrink-0 flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>เข้าใช้งาน</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider absolute">
              หรือเข้าสู่ระบบผ่านคลาวด์
            </span>
          </div>

          {/* Social Sign In Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition shadow-2xs font-semibold text-slate-700 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>เข้าสู่ระบบด้วย Google (Gmail)</span>
            </button>

            <button
              type="button"
              onClick={handleFacebookLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl transition shadow-2xs font-medium disabled:opacity-50 cursor-pointer text-xs"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>เข้าสู่ระบบด้วย Facebook</span>
            </button>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3 pt-1">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล / ชื่อช่างผู้ใช้งาน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อีเมล (Email)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่าน (Password)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isRegister ? (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>สมัครสมาชิกด้วยอีเมล</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>เข้าสู่ระบบด้วยอีเมล</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            {isRegister ? (
              <p>
                มีบัญชีอยู่แล้ว?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                    setIsConfigError(false);
                  }}
                  className="font-semibold text-amber-600 hover:underline cursor-pointer ml-1"
                >
                  เข้าสู่ระบบที่นี่
                </button>
              </p>
            ) : (
              <p>
                ยังไม่มีบัญชี?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                    setIsConfigError(false);
                  }}
                  className="font-semibold text-amber-600 hover:underline cursor-pointer ml-1"
                >
                  สมัครสมาชิก
                </button>
              </p>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                เข้าดูแบบ Guest
              </button>
            )}
          </div>

          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/60 flex items-center gap-2 text-[11px] text-amber-800">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>ระบบบันทึกและซิงค์ข้อมูลสต๊อกคงเหลือแบบ Real-time พร้อมใช้งาน</span>
          </div>
        </div>
      </div>
    </div>
  );
};
