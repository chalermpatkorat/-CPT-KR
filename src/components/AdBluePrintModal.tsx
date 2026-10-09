import React, { useState } from 'react';
import { AdBlueRefillRecord } from '../types';
import { PrintControlBar } from './PrintControlBar';
import { PrintOrientation, triggerPrint } from '../utils/printManager';
import { X, Printer, Filter, Building2, Droplets } from 'lucide-react';

interface AdBluePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AdBlueRefillRecord[];
  factoryList: string[];
  initialFactory?: string;
  userName: string;
}

export const AdBluePrintModal: React.FC<AdBluePrintModalProps> = ({
  isOpen,
  onClose,
  records,
  factoryList,
  initialFactory = 'all',
  userName,
}) => {
  const [selectedFactory, setSelectedFactory] = useState<string>(initialFactory);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Print Settings: Orientation & Copies / Page Range
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [copies, setCopies] = useState<number>(1);
  const [pageRange, setPageRange] = useState<'all' | '1' | '2'>('all');

  if (!isOpen) return null;

  // Extract available Year-Months from records
  const availableMonths = Array.from(
    new Set(
      records.map((r) => {
        try {
          return r.date.slice(0, 7); // YYYY-MM
        } catch {
          return '';
        }
      }).filter(Boolean)
    )
  ).sort().reverse();

  // Filter records
  const rawFilteredRecords = records.filter((r) => {
    const matchFactory = selectedFactory === 'all' || r.factory === selectedFactory;
    const matchMonth = selectedMonth === 'all' || r.date.startsWith(selectedMonth);
    return matchFactory && matchMonth;
  });

  const itemsPerPage = orientation === 'landscape' ? 18 : 22;
  const filteredRecords =
    pageRange === '1'
      ? rawFilteredRecords.slice(0, itemsPerPage)
      : pageRange === '2'
      ? rawFilteredRecords.slice(0, itemsPerPage * 2)
      : rawFilteredRecords;

  const totalLiters = rawFilteredRecords.reduce((sum, r) => sum + (r.litersFilled || 0), 0);
  const totalRefills = rawFilteredRecords.length;
  const avgLiters = totalRefills > 0 ? Math.round((totalLiters / totalRefills) * 10) / 10 : 0;

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

  const formatMonthTitle = (ym: string) => {
    if (ym === 'all') return 'ทุกช่วงเวลา';
    const [y, m] = ym.split('-');
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const mIdx = parseInt(m, 10) - 1;
    const thaiYear = parseInt(y, 10) + 543;
    return `${monthNames[mIdx] || m} ${thaiYear}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in print-modal-overlay print:p-0 print:static print:block">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print-modal-container print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:static print:block">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-900 p-4 sm:p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-300">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานประวัติการเติมน้ำยาบำบัดไอเสีย AdBlue
              </h3>
              <p className="text-xs text-teal-200 mt-0.5">
                เลือกการวางกระดาษแนวนอน / แนวตั้ง • สั่งพิมพ์ระบุจำนวนใบ/ชุด หรือเลือกหน้า • สรุปยอดเติมรวม
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

        {/* Unified Print Control Bar */}
        <PrintControlBar
          orientation={orientation}
          setOrientation={setOrientation}
          copies={copies}
          setCopies={setCopies}
          pageRange={pageRange}
          setPageRange={setPageRange}
          onPrint={handlePrint}
          accentColor="teal"
        >
          {/* Factory Selector */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <select
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
            >
              <option value="all">ทุกโรงงาน ({records.length} รายการ)</option>
              {factoryList.map((f) => {
                const count = records.filter((r) => r.factory === f).length;
                return (
                  <option key={f} value={f}>
                    {f} ({count} รายการ)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-teal-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
            >
              <option value="all">ทุกช่วงเวลา</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthTitle(ym)}
                </option>
              ))}
            </select>
          </div>

          {/* Include Signatures Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none text-xs">
            <input
              type="checkbox"
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
            <span>รวมช่องลงนาม</span>
          </label>
        </PrintControlBar>

        {/* Live Print Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible print-modal-scroll">
          <div
            className={`mx-auto bg-white p-5 sm:p-7 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 space-y-4 print-container print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:rounded-none transition-all ${
              orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
            }`}
          >
            {/* Copies repetition */}
            {Array.from({ length: copies }).map((_, copyIndex) => (
              <div
                key={copyIndex}
                className={`${
                  copyIndex > 0 ? 'break-before-page pt-8 border-t-2 border-dashed border-slate-300 print:pt-0 print:border-none' : ''
                }`}
              >
                {copies > 1 && (
                  <div className="text-[10px] text-right font-bold text-slate-400 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-teal-700">
                      [ รายงาน AdBlue • พิมพ์{orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'} • ขนาด A4 ]
                    </span>
                    <span>
                      สำเนาชุดที่ {copyIndex + 1} จาก {copies} ชุด
                    </span>
                  </div>
                )}

                {/* Report Header */}
                <div className="border-b-2 border-slate-800 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        บริษัท เฉลิมภัทรทรานสปอร์ต จำกัด (สาขานครราชสีมา)
                      </h1>
                      <h2 className="text-xs sm:text-sm font-bold text-teal-900 mt-0.5">
                        รายงานประวัติการเติมน้ำยาบำบัดไอเสีย AdBlue (ไอเสียสะอาด Euro 5 / 6)
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-700 mt-1">
                        สังกัด: <strong>{selectedFactory === 'all' ? 'ทุกโรงงาน' : selectedFactory}</strong>
                        <span className="ml-2">
                          • ช่วงเวลา: <strong>{formatMonthTitle(selectedMonth)}</strong>
                        </span>
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

                  {/* Summary KPI Cards */}
                  <div className="mt-2.5 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-teal-50 p-2 rounded border border-teal-200">
                      <span className="text-[10px] text-teal-700 font-bold block">ยอดเติมรวมทั้งหมด</span>
                      <span className="text-base font-black text-teal-900">
                        {totalLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">จำนวนครั้งที่เติม</span>
                      <span className="text-base font-black text-slate-800">
                        {totalRefills} ครั้ง
                      </span>
                    </div>
                    <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 block">เฉลี่ยต่อครั้ง</span>
                      <span className="text-base font-black text-indigo-900">
                        {avgLiters} ลิตร/ครั้ง
                      </span>
                    </div>
                  </div>
                </div>

                {/* Records Table */}
                {filteredRecords.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-bold">ไม่พบประวัติการเติม AdBlue ตามเงื่อนไขที่เลือก</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                          <th className="p-1 text-center border border-slate-300 w-7">ลำดับ</th>
                          <th className="p-1 border border-slate-300">วัน-เวลาที่เติม</th>
                          <th className="p-1 border border-slate-300">ทะเบียนรถ</th>
                          <th className="p-1 border border-slate-300">โรงงาน</th>
                          <th className="p-1 text-right border border-slate-300 font-black bg-teal-50">
                            ปริมาณที่เติม (ลิตร)
                          </th>
                          <th className="p-1 text-center border border-slate-300">ก่อนเติม (%)</th>
                          <th className="p-1 text-center border border-slate-300">หลังเติม (%)</th>
                          <th className="p-1 text-right border border-slate-300">ไมล์รถ (กม.)</th>
                          <th className="p-1 border border-slate-300">ผู้เติม / คนขับ</th>
                          <th className="p-1 border border-slate-300">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredRecords.map((r, idx) => (
                          <tr
                            key={`${r.id}-${copyIndex}`}
                            className={`print-avoid-break ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="p-1 text-center border border-slate-300 font-bold text-slate-600">
                              {idx + 1}
                            </td>
                            <td className="p-1 border border-slate-300 whitespace-nowrap text-slate-700">
                              {formatThaiDateTime(r.date)}
                            </td>
                            <td className="p-1 border border-slate-300 font-black text-slate-900 whitespace-nowrap">
                              {r.licensePlate}
                            </td>
                            <td className="p-1 border border-slate-300 whitespace-nowrap">
                              {r.factory}
                            </td>
                            <td className="p-1 text-right border border-slate-300 font-black text-teal-900 bg-teal-50/40">
                              {r.litersFilled.toLocaleString('th-TH')} ลิตร
                            </td>
                            <td className="p-1 text-center border border-slate-300 font-medium">
                              {r.percentBefore != null ? `${r.percentBefore}%` : '-'}
                            </td>
                            <td className="p-1 text-center border border-slate-300 font-bold text-teal-800">
                              {r.percentAfter != null ? `${r.percentAfter}%` : '-'}
                            </td>
                            <td className="p-1 text-right border border-slate-300 font-mono text-[10px]">
                              {r.currentMileage ? r.currentMileage.toLocaleString('th-TH') : '-'}
                            </td>
                            <td className="p-1 border border-slate-300 font-medium text-slate-800 whitespace-nowrap">
                              {r.filledBy}
                            </td>
                            <td className="p-1 border border-slate-300 text-slate-500 text-[10px] truncate max-w-[150px]">
                              {r.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures */}
                {includeSignatures && (
                  <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ผู้เติม / เจ้าหน้าที่บันทึก</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                          ( {userName || '....................................................'} )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ {currentDateThai}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">หัวหน้าฝ่ายขนส่ง / ผู้ตรวจสอบ</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                          ( .................................................... )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ผู้จัดการฝ่ายซ่อมบำรุง / ผู้อนุมัติ</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                          ( .................................................... )
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
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
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
