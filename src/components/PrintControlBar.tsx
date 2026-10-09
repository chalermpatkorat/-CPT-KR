import React from 'react';
import { PrintOrientation } from '../utils/printManager';
import { Printer, LayoutList, Layers, FileText, ChevronDown, Plus, Minus } from 'lucide-react';

export interface PrintControlBarProps {
  orientation: PrintOrientation;
  setOrientation: (val: PrintOrientation) => void;
  copies: number;
  setCopies: (val: number) => void;
  pageRange: 'all' | '1' | '2';
  setPageRange: (val: 'all' | '1' | '2') => void;
  onPrint: () => void;
  accentColor?: 'indigo' | 'teal' | 'slate' | 'amber';
  children?: React.ReactNode;
}

export const PrintControlBar: React.FC<PrintControlBarProps> = ({
  orientation,
  setOrientation,
  copies,
  setCopies,
  pageRange,
  setPageRange,
  onPrint,
  accentColor = 'indigo',
  children,
}) => {
  const getButtonStyles = () => {
    switch (accentColor) {
      case 'teal':
        return 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-700/20';
      case 'amber':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-700/20';
      case 'slate':
        return 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-700/20';
    }
  };

  const getActiveTabStyles = () => {
    switch (accentColor) {
      case 'teal':
        return 'bg-teal-600 text-white shadow-sm';
      case 'amber':
        return 'bg-amber-600 text-white shadow-sm';
      case 'slate':
        return 'bg-slate-900 text-white shadow-sm';
      default:
        return 'bg-indigo-600 text-white shadow-sm';
    }
  };

  return (
    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm no-print">
      {/* Settings Group */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Custom filters / children passed in */}
        {children}

        {/* 1. Page Orientation (การวางแนวกระดาษ) */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
          <span className="text-[11px] font-bold text-slate-700 px-2 flex items-center gap-1">
            <LayoutList className="w-3.5 h-3.5" />
            <span>การวางแนว:</span>
          </span>
          <button
            type="button"
            onClick={() => setOrientation('landscape')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              orientation === 'landscape'
                ? getActiveTabStyles()
                : 'bg-transparent text-slate-700 hover:bg-slate-300/60'
            }`}
            title="วางกระดาษแนวนอน (เหมาะกับตารางกว้างหลายคอลัมน์)"
          >
            <span className="inline-block w-3.5 h-2.5 border border-current rounded-xs"></span>
            <span>แนวนอน (Landscape)</span>
          </button>
          <button
            type="button"
            onClick={() => setOrientation('portrait')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              orientation === 'portrait'
                ? getActiveTabStyles()
                : 'bg-transparent text-slate-700 hover:bg-slate-300/60'
            }`}
            title="วางกระดาษแนวตั้ง"
          >
            <span className="inline-block w-2.5 h-3.5 border border-current rounded-xs"></span>
            <span>แนวตั้ง (Portrait)</span>
          </button>
        </div>

        {/* 2. Number of Copies (สั่งปริ้นกี่ใบ / กี่ชุด) */}
        <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
          <label className="font-bold text-slate-700 flex items-center gap-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>จำนวนใบ:</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={copies <= 1}
              onClick={() => setCopies(Math.max(1, copies - 1))}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="ลดจำนวนใบ"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-extrabold text-slate-900 min-w-[20px] text-center text-xs">
              {copies}
            </span>
            <button
              type="button"
              disabled={copies >= 10}
              onClick={() => setCopies(Math.min(10, copies + 1))}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="เพิ่มจำนวนใบ"
            >
              <Plus className="w-3 h-3" />
            </button>
            <span className="text-[11px] text-slate-500 font-medium">ใบ (ชุด)</span>
          </div>
        </div>

        {/* 3. Page Range (กี่หน้า / ขอบเขตหน้า) */}
        <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
          <label className="font-bold text-slate-700 flex items-center gap-1 text-xs">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>ขอบเขตหน้า:</span>
          </label>
          <select
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value as any)}
            className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
          >
            <option value="all">พิมพ์ทุกหน้า (ทั้งหมด)</option>
            <option value="1">เฉพาะหน้าแรก (1 ใบ)</option>
            <option value="2">2 หน้าแรก</option>
          </select>
        </div>
      </div>

      {/* Quick Print Button */}
      <button
        type="button"
        onClick={onPrint}
        className={`flex items-center gap-2 px-5 py-2 font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer ${getButtonStyles()}`}
      >
        <Printer className="w-4 h-4" />
        <span>
          สั่งพิมพ์ {copies > 1 ? `(${copies} ใบ)` : ''} [{orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}]
        </span>
      </button>
    </div>
  );
};
