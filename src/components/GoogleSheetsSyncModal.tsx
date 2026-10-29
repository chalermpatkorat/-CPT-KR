import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Layers,
  Truck,
  Droplets,
  History,
  Calendar,
  Settings,
  ShieldCheck,
  Sparkles,
  Link2,
  Download
} from 'lucide-react';
import {
  GoogleSheetsConfig,
  SyncToSheetsResult,
  getStoredGoogleSheetsConfig,
  saveStoredGoogleSheetsConfig,
  syncAllDataToGoogleSheets,
  extractSpreadsheetId,
  SHEET_NAMES
} from '../services/googleSheetsService';
import { exportAll5SheetsToExcel } from '../services/excelService';
import { OilItem, StockTransaction, Vehicle, AdBlueRefillRecord } from '../types';
import { signInWithGoogle, hasValidGoogleToken, AppUserSession } from '../lib/firebase';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUserSession | null;
  oils: OilItem[];
  transactions: StockTransaction[];
  vehicles: Vehicle[];
  adBlueRefills: AdBlueRefillRecord[];
  onSyncSuccess?: (result: SyncToSheetsResult) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  oils,
  transactions,
  vehicles,
  adBlueRefills,
  onSyncSuccess,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    autoSync: false,
    lastSyncAt: null,
    lastSyncSuccess: true,
    lastErrorMessage: null,
  });

  const [targetMode, setTargetMode] = useState<'existing' | 'custom' | 'new'>('existing');
  const [customInput, setCustomInput] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncToSheetsResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getStoredGoogleSheetsConfig().then((cfg) => {
        setConfig(cfg);
        setAutoSyncEnabled(cfg.autoSync);
        if (cfg.spreadsheetId) {
          setTargetMode('existing');
          setCustomInput(cfg.spreadsheetUrl || cfg.spreadsheetId);
        } else {
          setTargetMode('new');
        }
      });
      setSyncResult(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnectedWithGoogle = hasValidGoogleToken() || Boolean(user?.email && user.email.includes('@'));

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMessage(`เข้าสู่ระบบ Google ไม่สำเร็จ: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleExecuteSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSyncResult(null);

    let targetId: string | null = null;
    if (targetMode === 'existing' && config.spreadsheetId) {
      targetId = config.spreadsheetId;
    } else if (targetMode === 'custom') {
      const extracted = extractSpreadsheetId(customInput);
      if (!extracted) {
        setErrorMessage('กรุณาระบุ URL หรือรหัส Spreadsheet ID ที่ถูกต้อง');
        setIsSyncing(false);
        return;
      }
      targetId = extracted;
    } else {
      // 'new' mode: pass null to force new spreadsheet creation
      targetId = null;
    }

    try {
      const res = await syncAllDataToGoogleSheets({
        oils,
        transactions,
        vehicles,
        adBlueRefills,
        targetSpreadsheetId: targetId,
        interactive: true,
      });

      // Update autoSync preference
      await saveStoredGoogleSheetsConfig({
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        autoSync: autoSyncEnabled,
        lastSyncAt: res.updatedAt,
      });

      setConfig((prev) => ({
        ...prev,
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        autoSync: autoSyncEnabled,
        lastSyncAt: res.updatedAt,
        lastSyncSuccess: true,
        lastErrorMessage: null,
      }));

      setSyncResult(res);
      if (onSyncSuccess) {
        onSyncSuccess(res);
      }
    } catch (err: any) {
      console.error('Sync execution error:', err);
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลไปยัง Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    await saveStoredGoogleSheetsConfig({ autoSync: enabled });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'ยังไม่มีประวัติการซิงค์';
    try {
      return new Date(iso).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl backdrop-blur-xs border border-emerald-400/30 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ซิงค์ข้อมูลไปยัง Google Sheets
              </h3>
              <p className="text-xs text-emerald-200/80">
                อัปเดตข้อมูลแบบเรียลไทม์ครบ 5 ชีต (สต๊อก, ประวัติ, ข้อมูลรถ, AdBlue, สรุปรายเดือน)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Success Banner */}
          {syncResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 animate-in fade-in space-y-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-emerald-950">
                      ซิงค์ข้อมูลลง Google Sheets สำเร็จเรียบร้อยและเป็นปัจจุบัน 100%!
                    </h4>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      {formatDateTime(syncResult.updatedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    อัปเดตครบทั้ง 5 ชีต: สต๊อกคงเหลือ ({syncResult.counts.oilsCount} รายการ) • 
                    ประวัติเบิกจ่าย ({syncResult.counts.txCount} รายการ) • 
                    ข้อมูลรถและรอบถ่าย ({syncResult.counts.vehiclesCount} คัน) • 
                    ประวัติ AdBlue ({syncResult.counts.adBlueCount} รายการ) • 
                    สรุปการใช้รายเดือน ({syncResult.counts.monthlyCount} แถว)
                  </p>
                  <div className="pt-2">
                    <a
                      href={syncResult.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      เปิดดู Google Sheets ใน Google Drive ทันที
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner / API Guidance */}
          {errorMessage && (
            <>
              {errorMessage.includes('sheets.googleapis.com') ||
              errorMessage.includes('Google Sheets API has not been used') ||
              errorMessage.includes('disabled') ||
              errorMessage.includes('293294422668') ? (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl text-amber-950 space-y-3.5 shadow-sm animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-amber-200/90 rounded-xl text-amber-900 shrink-0 mt-0.5 shadow-2xs">
                      <AlertTriangle className="w-5 h-5 text-amber-800" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                        <span>ต้องเปิดใช้งาน Google Sheets API ใน Google Cloud ก่อน</span>
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[10px] font-black uppercase">
                          ทำเพียงครั้งเดียว 1 นาที
                        </span>
                      </h4>
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        เนื่องจากโปรเจกต์ Google Cloud ของบริษัท (รหัส: <code className="bg-amber-200/60 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">293294422668</code> หรือ <code className="bg-amber-200/60 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">engine-oil---adblue-cptkorat</code>) ยังไม่ได้กดเปิดใช้งานบริการ Google Sheets API ทาง Google จึงบล็อกการเขียนข้อมูลอัตโนมัติ
                      </p>
                    </div>
                  </div>

                  {/* 3-Step Guide */}
                  <div className="bg-white/90 p-4 rounded-xl border border-amber-300 space-y-3">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-black">
                        ✓
                      </span>
                      วิธีเปิดใช้งานใน 3 ขั้นตอนง่ายๆ:
                    </p>
                    <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-5 leading-relaxed">
                      <li>
                        คลิกปุ่มสีน้ำเงินด้านล่างเพื่อเปิดหน้า <strong>Google Cloud Console</strong> โดยตรง (ลงชื่อเข้าใช้ด้วยบัญชีเจ้าของโปรเจกต์หรือ <strong className="text-indigo-700">chalermpat.korat1499@gmail.com</strong>)
                      </li>
                      <li>
                        ในหน้าต่าง Google Cloud ให้กดปุ่มสีน้ำเงินคำว่า <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">"ENABLE"</strong> หรือ <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">"เปิดใช้งาน"</strong>
                      </li>
                      <li>
                        รอประมาณ 1 - 2 นาที เพื่อให้ระบบ Google อัปเดตสิทธิ์ จากนั้นกลับมากดปุ่ม <strong className="text-emerald-700">"ซิงค์ข้อมูลทั้งหมดเดี๋ยวนี้ (Sync Now)"</strong> ข้อมูลทั้ง 5 ชีตจะถูกสร้างและเขียนลง Google Sheets ทันที!
                      </li>
                    </ol>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <a
                        href="https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=engine-oil---adblue-cptkorat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>1. คลิกเปิดใช้งาน Google Sheets API (ลิงก์ตรง)</span>
                      </a>

                      <a
                        href="https://console.cloud.google.com/apis/library/drive.googleapis.com?project=engine-oil---adblue-cptkorat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>2. คลิกเปิด Google Drive API (สำรอง)</span>
                      </a>
                    </div>
                  </div>

                  {/* Fallback instant export button */}
                  <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-amber-200">
                    <span className="text-[11px] text-amber-900 font-medium">
                      ต้องการนำข้อมูลไปเปิดใน Google Sheets ทันทีระหว่างรอเปิด API?
                    </span>
                    <button
                      type="button"
                      onClick={() => exportAll5SheetsToExcel({ oils, transactions, vehicles, adBlueRefills })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดไฟล์ Excel (.xlsx) ครบ 5 ชีตทันที</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition shrink-0 cursor-pointer"
                  >
                    เข้าสู่ระบบ Google ใหม่
                  </button>
                </div>
              )}
            </>
          )}

          {/* Google Account Connection Status */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  บัญชี Google ที่เชื่อมต่อ: <span className="text-emerald-700">{user?.email || 'เข้าสู่ระบบด้วย Google'}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  มีสิทธิ์เขียนและอัปเดตไฟล์ Google Sheets ใน Google Drive โดยตรง
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={isConnectingGoogle}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isConnectingGoogle ? 'animate-spin' : ''}`} />
              <span>สลับบัญชี Google</span>
            </button>
          </div>

          {/* Target Spreadsheet Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. เลือก Google Spreadsheet ปลายทาง
            </label>

            <div className="space-y-2">
              {/* Option 1: Existing connected spreadsheet */}
              {config.spreadsheetId && (
                <div
                  onClick={() => setTargetMode('existing')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    targetMode === 'existing'
                      ? 'border-emerald-600 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="sheetTarget"
                        checked={targetMode === 'existing'}
                        onChange={() => setTargetMode('existing')}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Google Sheets ที่ใช้งานปัจจุบัน (แนะนำ)</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                            เชื่อมต่ออยู่
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-sm sm:max-w-md">
                          {config.spreadsheetUrl || config.spreadsheetId}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          ซิงค์ล่าสุด: {formatDateTime(config.lastSyncAt)}
                        </p>
                      </div>
                    </div>
                    {config.spreadsheetUrl && (
                      <a
                        href={config.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                        title="เปิดในแท็บใหม่"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Option 2: Enter custom URL or ID */}
              <div
                onClick={() => setTargetMode('custom')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  targetMode === 'custom'
                    ? 'border-emerald-600 bg-emerald-50/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sheetTarget"
                    checked={targetMode === 'custom'}
                    onChange={() => setTargetMode('custom')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="w-full">
                    <div className="text-xs font-bold text-slate-900">
                      ระบุลิงก์ (URL) หรือรหัส Spreadsheet ID ที่มีอยู่แล้ว
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      หากคุณมี Google Sheets ของบริษัทที่แชร์ไว้แล้ว สามารถวางลิงก์เพื่อซิงค์ข้อมูลลงชีตนั้นได้ทันที
                    </p>
                    {targetMode === 'custom' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="วางลิงก์ Google Sheets เช่น https://docs.google.com/spreadsheets/d/1BxiMVs0..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 3: Create Brand New Spreadsheet */}
              <div
                onClick={() => setTargetMode('new')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  targetMode === 'new'
                    ? 'border-emerald-600 bg-emerald-50/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sheetTarget"
                    checked={targetMode === 'new'}
                    onChange={() => setTargetMode('new')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      สร้าง Google Sheets เล่มใหม่ใน Google Drive
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ระบบจะสร้างไฟล์สเปรดชีตเล่มใหม่ชื่อ "CPT Korat - ระบบจัดการน้ำมันเครื่อง&น้ำยา AdBlue" พร้อมตั้งค่าหัวตารางและสูตรคำนวณครบทั้ง 5 ชีต
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Sheets Sync Scope Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. โครงสร้างชีตที่จะถูกอัปเดตให้เป็นปัจจุบัน (5 ชีต)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">1. {SHEET_NAMES.OILS}</p>
                  <p className="text-[10px] text-slate-500">{oils.length} รายการน้ำมันและน้ำยา</p>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">2. {SHEET_NAMES.TRANSACTIONS}</p>
                  <p className="text-[10px] text-slate-500">{transactions.length} ประวัติเบิกจ่ายและรับเข้า</p>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">3. {SHEET_NAMES.VEHICLES}</p>
                  <p className="text-[10px] text-slate-500">{vehicles.length} คันพร้อมคำนวณรอบ 20,000 กม.</p>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                <Droplets className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">4. {SHEET_NAMES.ADBLUE}</p>
                  <p className="text-[10px] text-slate-500">{adBlueRefills.length} ประวัติการเติม AdBlue</p>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 sm:col-span-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">5. {SHEET_NAMES.MONTHLY}</p>
                  <p className="text-[10px] text-slate-500">สรุปการใช้น้ำมันเครื่องและ AdBlue รายคันทุกเดือน</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Sync Toggle Card */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                ซิงค์อัตโนมัติในเบื้องหลัง (Auto-Sync)
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                เมื่อเปิดใช้งาน ทุกครั้งที่มีการเบิกจ่าย, เติม AdBlue, หรืออัปเดตข้อมูลรถ ระบบจะส่งข้อมูลไปอัปเดต Google Sheets ให้โดยอัตโนมัติ
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {config.lastSyncAt ? (
              <span>ซิงค์ล่าสุด: {formatDateTime(config.lastSyncAt)}</span>
            ) : (
              <span>ยังไม่มีการซิงค์</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl border border-slate-200 bg-white transition cursor-pointer"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleExecuteSync}
              disabled={isSyncing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังอัปเดต Google Sheets...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ซิงค์ข้อมูลทั้งหมดเดี๋ยวนี้ (Sync Now)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
