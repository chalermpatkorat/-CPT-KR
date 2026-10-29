import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Layers,
  ShieldAlert,
  ChevronRight,
  Database
} from 'lucide-react';
import { parseUploadedFile } from '../services/csvService';

export interface CsvDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  domainName: string; // e.g. "ประวัติถ่ายน้ำมันเครื่อง"
  isAdmin: boolean;
  currentUserName: string;
  onExportCurrentCsv: () => void;
  onDownloadTemplateCsv: () => void;
  parseRows: (rawRows: string[][]) => { valid: any[]; errors: string[]; warnings: string[] };
  onExecuteImport: (data: any[], mode: 'merge' | 'replace') => Promise<{ added: number; updated: number; total: number }>;
  onSuccessNotification?: (msg: string) => void;
}

export const CsvDataModal: React.FC<CsvDataModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  domainName,
  isAdmin,
  onExportCurrentCsv,
  onDownloadTemplateCsv,
  parseRows,
  onExecuteImport,
  onSuccessNotification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawPreviewRows, setRawPreviewRows] = useState<string[][]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<{ added: number; updated: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setParsedData(null);
    setRawHeaders([]);
    setRawPreviewRows([]);
    setErrors([]);
    setWarnings([]);
    setSuccessResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (selectedFile: File) => {
    resetState();
    setFile(selectedFile);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const rows = await parseUploadedFile(selectedFile);
      if (rows.length === 0) {
        setErrors(['ไฟล์ว่างเปล่าหรือไม่พบข้อมูล']);
        setIsProcessing(false);
        return;
      }

      setRawHeaders(rows[0] || []);
      setRawPreviewRows(rows.slice(1, 7)); // Preview first 6 rows

      const result = parseRows(rows);
      setParsedData(result.valid);
      setErrors(result.errors);
      setWarnings(result.warnings);
    } catch (err: any) {
      setErrorMessage(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err?.message || 'ไฟล์รูปแบบไม่ถูกต้อง'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    if (importMode === 'replace' && !isAdmin) {
      setErrorMessage('โหมดกู้คืนข้อมูลทั้งหมด (Replace) สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await onExecuteImport(parsedData, importMode);
      setSuccessResult(res);
      if (onSuccessNotification) {
        const actionText = importMode === 'replace' ? 'กู้คืนข้อมูลสำเร็จ' : 'นำเข้าข้อมูลสำเร็จ';
        onSuccessNotification(`${actionText}: เพิ่มใหม่ ${res.added} รายการ, อัปเดต ${res.updated} รายการ (รวม ${res.total} รายการ)`);
      }
    } catch (err: any) {
      setErrorMessage(`เกิดข้อผิดพลาดขณะนำเข้าข้อมูล: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {title}
              </h3>
              <p className="text-xs text-slate-300">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Top Quick Actions: Export & Download Template */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={onExportCurrentCsv}
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all shadow-xs cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 text-left">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition-transform">
                  <Download className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold">ส่งออก CSV ปัจจุบัน</div>
                  <div className="text-[11px] text-slate-500">ดาวน์โหลดข้อมูลทั้งหมดพร้อมเปิดใน Excel</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onDownloadTemplateCsv}
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl transition-all shadow-xs cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 text-left">
                <span className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold">ดาวน์โหลดฟอร์มตัวอย่าง CSV</div>
                  <div className="text-[11px] text-slate-500">แบบฟอร์มหัวคอลัมน์มาตรฐานสำหรับกรอกข้อมูล</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Success Banner */}
          {successResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 animate-in fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-950">
                    {importMode === 'replace' ? 'กู้คืนข้อมูลสำเร็จเรียบร้อย!' : 'นำเข้าข้อมูลสำเร็จเรียบร้อย!'}
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    เพิ่มรายการใหม่: <span className="font-bold">{successResult.added}</span> รายการ • 
                    อัปเดตรายการเดิม: <span className="font-bold">{successResult.updated}</span> รายการ • 
                    ยอดรวมทั้งหมดในระบบ: <span className="font-bold">{successResult.total}</span> รายการ
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      ปิดหน้าต่าง
                    </button>
                    <button
                      type="button"
                      onClick={resetState}
                      className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      นำเข้าไฟล์อื่นเพิ่มเติม
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!successResult && (
            <>
              {/* File Upload Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลือกไฟล์ CSV หรือ Excel (.xlsx / .xls) สำหรับนำเข้าหรือกู้คืน
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    file
                      ? 'border-indigo-400 bg-indigo-50/40'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-white rounded-full shadow-xs border border-slate-200 text-indigo-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    {file ? (
                      <div>
                        <p className="text-sm font-bold text-slate-800">{file.name}</p>
                        <p className="text-xs text-slate-500">
                          ขนาด {(file.size / 1024).toFixed(1)} KB • คลิกหรือลากไฟล์ใหม่มาวางเพื่อเปลี่ยนไฟล์
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                        </p>
                        <p className="text-xs text-slate-500">
                          รองรับไฟล์ .csv (UTF-8) หรือ .xlsx จาก Excel
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Parsing Warnings / Errors */}
              {errors.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    พบข้อผิดพลาดที่ไม่สามารถนำเข้าได้:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-800 pl-1">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    การแจ้งเตือนบางแถว ({warnings.length} รายการ):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 max-h-24 overflow-y-auto pl-1">
                    {warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {warnings.length > 5 && (
                      <li className="font-medium text-amber-600">และอีก {warnings.length - 5} รายการ...</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Data Preview Table */}
              {parsedData && parsedData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        ตัวอย่างข้อมูลที่ตรวจพบ ({parsedData.length} รายการพร้อมนำเข้า)
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md">
                        สมบูรณ์
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      แสดงตัวอย่างแถวเริ่มต้น
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                    <div className="max-h-52 overflow-x-auto overflow-y-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-200 sticky top-0 text-slate-700 font-bold">
                            <th className="py-2 px-3 text-center w-12">#</th>
                            {rawHeaders.slice(0, 8).map((h, i) => (
                              <th key={i} className="py-2 px-3 whitespace-nowrap">
                                {h || `คอลัมน์ ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {rawPreviewRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/70">
                              <td className="py-1.5 px-3 text-center text-slate-400 font-mono">
                                {rIdx + 1}
                              </td>
                              {row.slice(0, 8).map((cell, cIdx) => (
                                <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap">
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              {parsedData && parsedData.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    เลือกรูปแบบการนำเข้าข้อมูล
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Merge Option */}
                    <div
                      onClick={() => setImportMode('merge')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        importMode === 'merge'
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                            นำเข้าเพิ่มเติม (Merge & Update)
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-medium">แนะนำ</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            รวมข้อมูลใหม่เข้ากับข้อมูลเดิม หากพบรายการซ้ำ (เช่น ทะเบียนรถหรือรายการเดิม) จะอัปเดตข้อมูลให้ทันสมัย หากเป็นรายการใหม่จะเพิ่มต่อท้าย
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Replace Option */}
                    <div
                      onClick={() => {
                        if (isAdmin) setImportMode('replace');
                      }}
                      className={`p-3.5 rounded-xl border-2 transition-all ${
                        !isAdmin
                          ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50'
                          : importMode === 'replace'
                          ? 'border-rose-600 bg-rose-50/30 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="importMode"
                          disabled={!isAdmin}
                          checked={importMode === 'replace'}
                          onChange={() => {
                            if (isAdmin) setImportMode('replace');
                          }}
                          className="mt-1 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-rose-600" />
                            กู้คืนข้อมูลทั้งหมด (Replace / Restore)
                            {!isAdmin ? (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-amber-600" /> เฉพาะ Admin
                              </span>
                            ) : (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-medium">เขียนทับทั้งชุด</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            แทนที่ข้อมูล {domainName} ทั้งหมดในระบบด้วยข้อมูลจากไฟล์นี้ เหมาะสำหรับการกู้คืนระบบจากไฟล์ Backup สำรอง
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {parsedData && parsedData.length > 0 && (
              <span>
                พร้อมนำเข้า <strong className="text-slate-800">{parsedData.length}</strong> รายการ
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl border border-slate-200 bg-white transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            {parsedData && parsedData.length > 0 && !successResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยัน{importMode === 'replace' ? 'กู้คืนข้อมูล' : 'นำเข้าข้อมูล'} ({parsedData.length} รายการ)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
