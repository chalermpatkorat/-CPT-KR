import React, { useState } from 'react';
import { StockTransaction, OilItem } from '../types';
import { PrintControlBar } from './PrintControlBar';
import { PrintOrientation, triggerPrint } from '../utils/printManager';
import { X, Printer, Filter, History } from 'lucide-react';

interface HistoryPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: StockTransaction[];
  oils: OilItem[];
  userName: string;
}

export const HistoryPrintModal: React.FC<HistoryPrintModalProps> = ({
  isOpen,
  onClose,
  transactions,
  oils,
  userName,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'dispense' | 'receive'>('all');
  const [selectedOilId, setSelectedOilId] = useState<string>('all');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Print Settings
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [copies, setCopies] = useState<number>(1);
  const [pageRange, setPageRange] = useState<'all' | '1' | '2'>('all');

  if (!isOpen) return null;

  const rawFilteredTxs = transactions.filter((tx) => {
    const matchType = typeFilter === 'all' || tx.type === typeFilter;
    const matchOil = selectedOilId === 'all' || tx.oilId === selectedOilId;
    return matchType && matchOil;
  });

  const itemsPerPage = orientation === 'landscape' ? 18 : 22;
  const filteredTxs =
    pageRange === '1'
      ? rawFilteredTxs.slice(0, itemsPerPage)
      : pageRange === '2'
      ? rawFilteredTxs.slice(0, itemsPerPage * 2)
      : rawFilteredTxs;

  const totalDispenseLiters = rawFilteredTxs
    .filter((tx) => tx.type === 'dispense')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalReceiveLiters = rawFilteredTxs
    .filter((tx) => tx.type === 'receive')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const handlePrint = () => {
    triggerPrint(orientation);
  };

  const currentDateThai = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const currentTimeThai = new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatThaiDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in print-modal-overlay print:p-0 print:static print:block">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print-modal-container print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:static print:block">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-900 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานประวัติการเบิกจ่ายและรับเข้าสต๊อก
              </h3>
              <p className="text-xs text-amber-200 mt-0.5">
                เลือกการวางกระดาษแนวนอน / แนวตั้ง • สั่งพิมพ์ระบุจำนวนใบ/ชุด หรือเลือกหน้า • สรุปยอดเบิกจ่ายและรับเข้า
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

        {/* Print Control Bar */}
        <PrintControlBar
          orientation={orientation}
          setOrientation={setOrientation}
          copies={copies}
          setCopies={setCopies}
          pageRange={pageRange}
          setPageRange={setPageRange}
          onPrint={handlePrint}
          accentColor="amber"
        >
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
            >
              <option value="all">ทุกประเภท ({transactions.length})</option>
              <option value="dispense">เฉพาะเบิกจ่ายออก</option>
              <option value="receive">เฉพาะรับเข้าสต๊อก</option>
            </select>
          </div>

          {/* Oil Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <select
              value={selectedOilId}
              onChange={(e) => setSelectedOilId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer max-w-[140px]"
            >
              <option value="all">ทุกชนิดสินค้า</option>
              {oils.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.viscosity})
                </option>
              ))}
            </select>
          </div>

          {/* Include Signatures */}
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none text-xs">
            <input
              type="checkbox"
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span>รวมช่องลงนาม</span>
          </label>
        </PrintControlBar>

        {/* Live Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible print-modal-scroll">
          <div
            className={`mx-auto bg-white p-5 sm:p-7 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 space-y-4 print-container print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:rounded-none transition-all ${
              orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
            }`}
          >
            {Array.from({ length: copies }).map((_, copyIndex) => (
              <div
                key={copyIndex}
                className={`${
                  copyIndex > 0 ? 'break-before-page pt-8 border-t-2 border-dashed border-slate-300 print:pt-0 print:border-none' : ''
                }`}
              >
                {copies > 1 && (
                  <div className="text-[10px] text-right font-bold text-slate-400 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-amber-700">
                      [ รายงานประวัติสต๊อก • พิมพ์{orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'} • ขนาด A4 ]
                    </span>
                    <span>
                      สำเนาชุดที่ {copyIndex + 1} จาก {copies} ชุด
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="border-b-2 border-slate-800 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        บริษัท เฉลิมภัทรทรานสปอร์ต จำกัด (สาขานครราชสีมา)
                      </h1>
                      <h2 className="text-xs sm:text-sm font-bold text-amber-900 mt-0.5">
                        รายงานประวัติการเบิกจ่ายและรับเข้าสต๊อกสินค้า (สารหล่อลื่น & AdBlue)
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-700 mt-1">
                        ประเภท: <strong>{typeFilter === 'all' ? 'ทุกประเภทรายการ' : typeFilter === 'dispense' ? 'เฉพาะเบิกจ่าย' : 'เฉพาะรับเข้า'}</strong>
                        <span className="ml-2 text-slate-500 font-normal">
                          (การจัดวาง: {orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'})
                        </span>
                      </p>
                    </div>
                    <div className="text-right text-[10px] sm:text-[11px] text-slate-500 flex-shrink-0">
                      <p>วันที่พิมพ์: <strong>{currentDateThai}</strong></p>
                      <p>เวลา: <strong>{currentTimeThai} น.</strong></p>
                      <p>ผู้พิมพ์: <strong>{userName}</strong></p>
                    </div>
                  </div>

                  {/* KPI Summary */}
                  <div className="mt-2.5 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">จำนวนรายการ</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">
                        {rawFilteredTxs.length} รายการ
                      </span>
                    </div>
                    <div className="bg-orange-50 p-1.5 rounded border border-orange-200">
                      <span className="text-[10px] text-orange-700 block">ยอดเบิกจ่ายสะสม</span>
                      <span className="text-sm sm:text-base font-black text-orange-900">
                        {totalDispenseLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 block">ยอดรับเข้าสะสม</span>
                      <span className="text-sm sm:text-base font-black text-emerald-900">
                        {totalReceiveLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table */}
                {filteredTxs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-bold">ไม่พบประวัติรายการตามเงื่อนไขที่เลือก</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                          <th className="p-1 text-center border border-slate-300 w-7">ลำดับ</th>
                          <th className="p-1 border border-slate-300">วัน-เวลา</th>
                          <th className="p-1 text-center border border-slate-300">ประเภท</th>
                          <th className="p-1 border border-slate-300">สินค้า / รายการ</th>
                          <th className="p-1 text-center border border-slate-300">เบอร์ความหนืด</th>
                          <th className="p-1 text-right border border-slate-300 font-black">
                            จำนวน (ลิตร)
                          </th>
                          <th className="p-1 border border-slate-300">ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์</th>
                          <th className="p-1 border border-slate-300">ผู้บันทึก</th>
                          <th className="p-1 border border-slate-300">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredTxs.map((tx, idx) => (
                          <tr
                            key={`${tx.id}-${copyIndex}`}
                            className={`print-avoid-break ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="p-1 text-center border border-slate-300 font-bold text-slate-600">
                              {idx + 1}
                            </td>
                            <td className="p-1 border border-slate-300 whitespace-nowrap text-slate-700">
                              {formatThaiDateTime(tx.date)}
                            </td>
                            <td className="p-1 text-center border border-slate-300 whitespace-nowrap font-bold text-[10px]">
                              {tx.type === 'dispense' ? (
                                <span className="text-orange-700">เบิกจ่าย</span>
                              ) : (
                                <span className="text-emerald-700">รับเข้า</span>
                              )}
                            </td>
                            <td className="p-1 border border-slate-300 font-bold text-slate-900">
                              {tx.oilName}
                            </td>
                            <td className="p-1 text-center border border-slate-300 text-slate-600">
                              {tx.viscosity}
                            </td>
                            <td
                              className={`p-1 text-right border border-slate-300 font-black ${
                                tx.type === 'dispense' ? 'text-orange-800' : 'text-emerald-800'
                              }`}
                            >
                              {tx.type === 'dispense' ? '-' : '+'}
                              {tx.amount.toLocaleString('th-TH')} ลิตร
                            </td>
                            <td className="p-1 border border-slate-300 font-semibold text-slate-800">
                              {tx.recipientOrVehicle}
                              {tx.currentMileage ? (
                                <span className="block text-[9px] text-slate-500 font-normal">
                                  ไมล์: {tx.currentMileage.toLocaleString('th-TH')} กม.
                                </span>
                              ) : null}
                            </td>
                            <td className="p-1 border border-slate-300 text-slate-600 whitespace-nowrap">
                              {tx.performedBy}
                            </td>
                            <td className="p-1 border border-slate-300 text-slate-500 text-[10px] truncate max-w-[150px]">
                              {tx.referenceNote || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures */}
                {includeSignatures && (
                  <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ลงชื่อ ผู้รายงาน / เจ้าหน้าที่สต๊อก</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-48 mx-auto text-slate-400">
                          ( {userName || '...................................................'} )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ {currentDateThai}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ลงชื่อ ผู้ตรวจสอบ / ผู้อนุมัติ</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-48 mx-auto text-slate-400">
                          ( ................................................... )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <p className="text-xs text-slate-500">
            * สั่งพิมพ์ {copies} ใบ • กระดาษ A4 {orientation === 'landscape' ? 'แนวนอน (Landscape)' : 'แนวตั้ง (Portrait)'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์รายงาน (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
