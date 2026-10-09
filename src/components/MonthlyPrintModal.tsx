import React, { useState } from 'react';
import { PrintControlBar } from './PrintControlBar';
import { PrintOrientation, triggerPrint } from '../utils/printManager';
import { X, Printer, Calendar, Filter } from 'lucide-react';

export interface MonthSummaryItem {
  monthKey: string;
  monthName: string;
  engineOilLiters: number;
  engineOilTxCount: number;
  adBlueLiters: number;
  adBlueRefillCount: number;
}

export interface VehicleUsageItem {
  licensePlate: string;
  factory: string;
  engineOilLiters: number;
  engineOilCount: number;
  adBlueLiters: number;
  adBlueCount: number;
}

interface MonthlyPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonthName: string;
  monthsData: MonthSummaryItem[];
  currentMonthVehicles: VehicleUsageItem[];
  annualEngineOilLiters: number;
  annualAdBlueLiters: number;
  annualTotalLiters: number;
  userName: string;
}

export const MonthlyPrintModal: React.FC<MonthlyPrintModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  selectedMonthName,
  monthsData,
  currentMonthVehicles,
  annualEngineOilLiters,
  annualAdBlueLiters,
  annualTotalLiters,
  userName,
}) => {
  const [printSection, setPrintSection] = useState<'both' | 'monthly' | 'vehicles'>('both');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Print Settings
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [copies, setCopies] = useState<number>(1);
  const [pageRange, setPageRange] = useState<'all' | '1' | '2'>('all');

  if (!isOpen) return null;

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

  const displayVehicles =
    pageRange === '1'
      ? currentMonthVehicles.slice(0, 16)
      : pageRange === '2'
      ? currentMonthVehicles.slice(0, 32)
      : currentMonthVehicles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานสรุปยอดประจำเดือน (น้ำมันเครื่อง & AdBlue)
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                เลือกการวางกระดาษแนวนอน / แนวตั้ง • สั่งพิมพ์ระบุจำนวนใบ/ชุด หรือเลือกหน้า • ปี พ.ศ. {selectedYear + 543}
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
          accentColor="indigo"
        >
          {/* Section Selector */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={printSection}
              onChange={(e) => setPrintSection(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
            >
              <option value="both">พิมพ์ทั้ง 2 ส่วน (สรุปปี + จำแนกตามรถ)</option>
              <option value="monthly">เฉพาะสรุปรายเดือน 12 เดือน</option>
              <option value="vehicles">เฉพาะสรุปจำแนกตามรถ (เดือน{selectedMonthName})</option>
            </select>
          </div>

          {/* Signatures */}
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none text-xs">
            <input
              type="checkbox"
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>รวมช่องลงนาม</span>
          </label>
        </PrintControlBar>

        {/* Live Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible">
          <div
            className={`mx-auto bg-white p-5 sm:p-7 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 space-y-4 print-container print:shadow-none print:border-none print:p-0 transition-all ${
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
                    <span className="text-indigo-600">
                      [ รายงานสรุปประจำเดือน • พิมพ์{orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'} • ขนาด A4 ]
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
                        บริษัท ซีพีที โคราช จำกัด (CPT KORAT CO., LTD.)
                      </h1>
                      <h2 className="text-xs sm:text-sm font-bold text-indigo-900 mt-0.5">
                        รายงานสรุปการใช้น้ำมันเครื่องและน้ำยาบำบัดไอเสีย AdBlue ประจำปี พ.ศ. {selectedYear + 543}
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-700 mt-1">
                        ข้อมูลเดือนปัจจุบัน: <strong>เดือน{selectedMonthName}</strong>
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

                  {/* Annual Highlights */}
                  <div className="mt-2.5 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-amber-50 p-1.5 rounded border border-amber-200">
                      <span className="text-[10px] text-amber-700 block">น้ำมันเครื่องทั้งปี</span>
                      <span className="text-sm sm:text-base font-black text-amber-900">
                        {annualEngineOilLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                    <div className="bg-teal-50 p-1.5 rounded border border-teal-200">
                      <span className="text-[10px] text-teal-700 block">น้ำยา AdBlue ทั้งปี</span>
                      <span className="text-sm sm:text-base font-black text-teal-900">
                        {annualAdBlueLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                    <div className="bg-indigo-50 p-1.5 rounded border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 block">รวมปริมาณทั้งหมด</span>
                      <span className="text-sm sm:text-base font-black text-indigo-950">
                        {annualTotalLiters.toLocaleString('th-TH')} ลิตร
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Monthly 12-Month Table */}
                {(printSection === 'both' || printSection === 'monthly') && (
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>สรุปยอดการใช้งานจำแนกรายเดือน 12 เดือน (ปี {selectedYear + 543})</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                            <th className="p-1 border border-slate-300">เดือน</th>
                            <th className="p-1 text-right border border-slate-300">น้ำมันเครื่อง (ลิตร)</th>
                            <th className="p-1 text-center border border-slate-300">ครั้งที่เบิก</th>
                            <th className="p-1 text-right border border-slate-300">น้ำยา AdBlue (ลิตร)</th>
                            <th className="p-1 text-center border border-slate-300">ครั้งที่เติม</th>
                            <th className="p-1 text-right border border-slate-300 font-black">รวมทั้งหมด (ลิตร)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthsData.map((m) => (
                            <tr key={`${m.monthKey}-${copyIndex}`} className="bg-white">
                              <td className="p-1 border border-slate-300 font-bold text-slate-800">{m.monthName}</td>
                              <td className="p-1 border border-slate-300 text-right">{m.engineOilLiters.toLocaleString('th-TH')}</td>
                              <td className="p-1 border border-slate-300 text-center">{m.engineOilTxCount}</td>
                              <td className="p-1 border border-slate-300 text-right">{m.adBlueLiters.toLocaleString('th-TH')}</td>
                              <td className="p-1 border border-slate-300 text-center">{m.adBlueRefillCount}</td>
                              <td className="p-1 border border-slate-300 text-right font-black text-indigo-900">
                                {(m.engineOilLiters + m.adBlueLiters).toLocaleString('th-TH')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[10px]">
                            <td className="p-1 border border-slate-300">รวมทั้งปี พ.ศ. {selectedYear + 543}</td>
                            <td className="p-1 border border-slate-300 text-right text-amber-800">
                              {annualEngineOilLiters.toLocaleString('th-TH')} ลิตร
                            </td>
                            <td className="p-1 border border-slate-300 text-center">-</td>
                            <td className="p-1 border border-slate-300 text-right text-teal-800">
                              {annualAdBlueLiters.toLocaleString('th-TH')} ลิตร
                            </td>
                            <td className="p-1 border border-slate-300 text-center">-</td>
                            <td className="p-1 border border-slate-300 text-right font-black text-indigo-950">
                              {annualTotalLiters.toLocaleString('th-TH')} ลิตร
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 2: Vehicle Breakdown Table */}
                {(printSection === 'both' || printSection === 'vehicles') && (
                  <div className={`mt-4 ${printSection === 'both' ? 'break-before-page print:mt-6' : ''}`}>
                    <h3 className="text-xs font-bold text-slate-800 mb-1.5">
                      <span>ยอดการใช้งานจำแนกตามรถยนต์ (ประจำเดือน{selectedMonthName})</span>
                    </h3>
                    {displayVehicles.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">ไม่มีข้อมูลการเบิกใช้ในเดือนนี้</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                          <thead>
                            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                              <th className="p-1 text-center border border-slate-300 w-7">ลำดับ</th>
                              <th className="p-1 border border-slate-300">ทะเบียนรถ</th>
                              <th className="p-1 border border-slate-300">โรงงาน</th>
                              <th className="p-1 text-right border border-slate-300">น้ำมันเครื่อง (ลิตร)</th>
                              <th className="p-1 text-center border border-slate-300">เบิก (ครั้ง)</th>
                              <th className="p-1 text-right border border-slate-300">น้ำยา AdBlue (ลิตร)</th>
                              <th className="p-1 text-center border border-slate-300">เติม (ครั้ง)</th>
                              <th className="p-1 text-right border border-slate-300 font-black">รวมทั้งหมด (ลิตร)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayVehicles.map((v, idx) => (
                              <tr key={`${v.licensePlate}-${copyIndex}`} className="bg-white">
                                <td className="p-1 text-center border border-slate-300 font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-1 border border-slate-300 font-black text-slate-900">{v.licensePlate}</td>
                                <td className="p-1 border border-slate-300">{v.factory}</td>
                                <td className="p-1 border border-slate-300 text-right">{v.engineOilLiters.toLocaleString('th-TH')}</td>
                                <td className="p-1 border border-slate-300 text-center">{v.engineOilCount}</td>
                                <td className="p-1 border border-slate-300 text-right">{v.adBlueLiters.toLocaleString('th-TH')}</td>
                                <td className="p-1 border border-slate-300 text-center">{v.adBlueCount}</td>
                                <td className="p-1 border border-slate-300 text-right font-black">
                                  {(v.engineOilLiters + v.adBlueLiters).toLocaleString('th-TH')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Signatures */}
                {includeSignatures && (
                  <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ลงชื่อ ผู้รายงาน / ผู้จัดทำสต๊อก</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-48 mx-auto text-slate-400">
                          ( {userName || '...................................................'} )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ {currentDateThai}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ลงชื่อ ผู้จัดการฝ่าย / ผู้อนุมัติ</p>
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
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
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
