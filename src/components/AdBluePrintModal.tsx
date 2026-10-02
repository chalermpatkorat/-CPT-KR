import React, { useState } from 'react';
import { AdBlueRefillRecord } from '../types';
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
  const filteredRecords = records.filter((r) => {
    const matchFactory = selectedFactory === 'all' || r.factory === selectedFactory;
    const matchMonth = selectedMonth === 'all' || r.date.startsWith(selectedMonth);
    return matchFactory && matchMonth;
  });

  const totalLiters = filteredRecords.reduce((sum, r) => sum + (r.litersFilled || 0), 0);
  const totalRefills = filteredRecords.length;
  const avgLiters = totalRefills > 0 ? Math.round((totalLiters / totalRefills) * 10) / 10 : 0;

  const handlePrint = () => {
    window.print();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-900 p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-300">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานประวัติการเติมน้ำยาบำบัดไอเสีย AdBlue
              </h3>
              <p className="text-xs text-teal-200 mt-0.5">
                รายงานเฉพาะน้ำยา AdBlue แยกตามโรงงาน / ประจำเดือน (A4 แนวนอน / PDF)
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

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm no-print">
          <div className="flex flex-wrap items-center gap-3">
            {/* Factory Selector */}
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>เลือกโรงงาน:</span>
              </label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
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
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-teal-600" />
                <span>ประจำเดือน:</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
              >
                <option value="all">ทุกช่วงเวลา</option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthTitle(ym)}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox: Include Signatures */}
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span>รวมช่องลงนาม</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์รายงาน (Print / PDF)</span>
          </button>
        </div>

        {/* Live A4 Print Preview Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 space-y-4 print-container print:shadow-none print:border-none print:p-0">
            {/* Report Header */}
            <div className="border-b-2 border-slate-800 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    บริษัท ซีพีที โคราช จำกัด (CPT KORAT CO., LTD.)
                  </h1>
                  <h2 className="text-sm sm:text-base font-bold text-teal-900 mt-0.5">
                    รายงานประวัติการเบิกและเติมน้ำยาบำบัดไอเสีย AdBlue (DEF)
                  </h2>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    สังกัด: <strong>{selectedFactory === 'all' ? 'ทุกโรงงาน' : selectedFactory}</strong> • ประจำงวด: <strong>{formatMonthTitle(selectedMonth)}</strong>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>วันที่พิมพ์: <strong>{currentDateThai}</strong></p>
                  <p>เวลา: <strong>{currentTimeThai} น.</strong></p>
                  <p>ผู้พิมพ์: <strong>{userName}</strong></p>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-100 rounded-lg border border-slate-300">
                  <span className="block text-[10px] text-slate-500 font-semibold">จำนวนครั้งที่เติม</span>
                  <span className="text-base font-black text-slate-900">{totalRefills} ครั้ง</span>
                </div>
                <div className="p-2 bg-teal-50 rounded-lg border border-teal-200">
                  <span className="block text-[10px] text-teal-700 font-semibold">ปริมาณ AdBlue ที่เติมรวม</span>
                  <span className="text-base font-black text-teal-800">{totalLiters.toLocaleString('th-TH')} ลิตร</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="block text-[10px] text-emerald-700 font-semibold">เฉลี่ยต่อครั้ง</span>
                  <span className="text-base font-black text-emerald-800">{avgLiters} ลิตร/ครั้ง</span>
                </div>
              </div>
            </div>

            {/* Table */}
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="font-bold">ไม่พบประวัติการเติม AdBlue ตามเงื่อนไขที่เลือก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                      <th className="p-1.5 text-center border border-slate-300 w-8">ลำดับ</th>
                      <th className="p-1.5 border border-slate-300">วัน/เดือน/ปี ที่เติม</th>
                      <th className="p-1.5 border border-slate-300">ทะเบียนรถ</th>
                      <th className="p-1.5 border border-slate-300">โรงงาน</th>
                      <th className="p-1.5 text-center border border-slate-300 bg-amber-50">% ก่อนเติม</th>
                      <th className="p-1.5 text-center border border-slate-300 bg-teal-50">% หลังเติม</th>
                      <th className="p-1.5 text-right border border-slate-300 font-black">จำนวนลิตรที่เติม</th>
                      <th className="p-1.5 border border-slate-300">ผู้เติม</th>
                      <th className="p-1.5 text-right border border-slate-300">เลขไมล์ (กม.)</th>
                      <th className="p-1.5 border border-slate-300">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRecords.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={`print-avoid-break ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      >
                        <td className="p-1.5 text-center border border-slate-300 font-bold text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="p-1.5 border border-slate-300 whitespace-nowrap">
                          {formatThaiDateTime(r.date)}
                        </td>
                        <td className="p-1.5 border border-slate-300 font-black text-slate-900 whitespace-nowrap">
                          {r.licensePlate}
                        </td>
                        <td className="p-1.5 border border-slate-300 whitespace-nowrap">
                          {r.factory}
                        </td>
                        <td className="p-1.5 text-center border border-slate-300 font-bold text-amber-700 bg-amber-50/40">
                          {r.percentBefore}%
                        </td>
                        <td className="p-1.5 text-center border border-slate-300 font-bold text-teal-700 bg-teal-50/40">
                          {r.percentAfter}%
                        </td>
                        <td className="p-1.5 text-right border border-slate-300 font-black text-teal-800 whitespace-nowrap">
                          {r.litersFilled.toLocaleString('th-TH')} ลิตร
                        </td>
                        <td className="p-1.5 border border-slate-300 whitespace-nowrap font-medium text-slate-800">
                          {r.filledBy}
                        </td>
                        <td className="p-1.5 text-right border border-slate-300 text-slate-600">
                          {r.currentMileage ? r.currentMileage.toLocaleString('th-TH') : '-'}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-slate-600 truncate max-w-[140px]">
                          {r.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={6} className="p-2 text-right">
                        รวมปริมาณน้ำยา AdBlue ที่เติมทั้งหมด:
                      </td>
                      <td className="p-2 text-right text-teal-800 font-black">
                        {totalLiters.toLocaleString('th-TH')} ลิตร
                      </td>
                      <td colSpan={3} className="p-2 text-xs text-slate-500">
                        ({totalRefills} รายการ)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Signature Block */}
            {includeSignatures && (
              <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                <div className="space-y-8">
                  <p className="font-semibold text-slate-700">ผู้บันทึก / เจ้าหน้าที่เติมสาร</p>
                  <div>
                    <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-800 font-medium">
                      ({userName})
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <p className="font-semibold text-slate-700">ผู้ตรวจสอบ / หัวหน้าช่าง</p>
                  <div>
                    <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                      ( .................................................... )
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <p className="font-semibold text-slate-700">ผู้จัดการฝ่ายขนส่ง / ผู้อนุมัติ</p>
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <p className="text-xs text-slate-500">
            * คำแนะนำ: เลือกขนาดกระดาษ <strong>A4 แนวนอน (Landscape)</strong> ในการพิมพ์
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
