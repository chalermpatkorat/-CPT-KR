import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, ShieldCheck, Database, Info, RefreshCw } from 'lucide-react';

interface FirebaseRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export const FirebaseRulesModal: React.FC<FirebaseRulesModalProps> = ({
  isOpen,
  onClose,
  projectId = 'engine-oil---adblue-cptkorat'
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore/rules`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(rulesCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                วิธีเปิดสิทธิ์ Firebase ให้ทุกเครื่องซิงค์ข้อมูลชุดเดียวกัน (Real-time)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                โปรเจกต์: <strong className="text-amber-300">{projectId}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Why this is needed explanation */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>ทำไมผู้ใช้งานแต่ละคนถึงยังไม่เห็นข้อมูลเป็นชุดเดียวกัน?</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              ระบบของท่านได้เชื่อมต่อกับฐานข้อมูลคลาวด์ Firebase เรียบร้อยแล้ว แต่เนื่องจากระบบความปลอดภัยเริ่มต้นของ Firebase ใน Firebase Console จะปิดกั้นการเข้าถึงจากภายนอก (Permission Denied) จนกว่าผู้ดูแลระบบ (Admin) จะกดเผยแพร่สิทธิ์ (Publish Rules) เพียงตั้งค่าตาม 2 ขั้นตอนด้านล่างนี้ ข้อมูลรถ สต๊อก และประวัติทั้งหมดจะซิงค์หากันแบบ Real-time ทันทีในทุกเครื่อง!
            </p>
          </div>

          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>เปิดหน้า Firebase Console เมนู Firestore Rules</span>
            </div>
            <p className="text-xs text-slate-600 pl-8">
              คลิกปุ่มด้านล่างเพื่อเปิดหน้าตั้งค่ากฎความปลอดภัยของโปรเจกต์ในแท็บใหม่:
            </p>
            <div className="pl-8">
              <a
                href={consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shadow-2xs"
              >
                <span>เปิด Firebase Console: {projectId} ➔ Firestore ➔ Rules</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                2
              </span>
              <span>คัดลอก Rules ด้านล่างนี้ ไปวางแทนที่ของเดิม แล้วกด "Publish"</span>
            </div>
            <div className="pl-8 space-y-2">
              <div className="relative bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
                <button
                  type="button"
                  onClick={handleCopyRules}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'คัดลอกเรียบร้อยแล้ว!' : 'คัดลอกโค้ด Rules'}</span>
                </button>
                <pre>{rulesCode}</pre>
              </div>
              <p className="text-[11px] text-slate-500">
                * เมื่อวางโค้ดเสร็จ ให้กดปุ่มสีฟ้า <strong className="text-slate-800">"Publish" (เผยแพร่)</strong> ที่มุมบนขวาในหน้า Firebase Console
              </p>
            </div>
          </div>

          {/* Success Result Box */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ผลลัพธ์หลังเปิดสิทธิ์</span>
            </div>
            <p className="text-xs text-emerald-800">
              เมื่อกด Publish เรียบร้อยแล้ว สมาชิกทุกคนในทีมที่เข้าผ่านลิงก์แอปจะมองเห็นข้อมูลรถทุกโรงงาน สต๊อกน้ำมันเครื่อง และประวัติการเบิกจ่ายตรงกันทั้งหมด 100% และเมื่อเครื่องใดเครื่องหนึ่งแก้ไข ข้อมูลจะอัปเดตไปขึ้นที่หน้าจอของทุกคนแบบ Real-time ทันทีครับ
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>รีโหลดหน้าเพื่อตรวจสอบการเชื่อมต่อใหม่</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            เข้าใจแล้ว / ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
