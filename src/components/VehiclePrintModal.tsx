import React, { useState } from 'react';
import { Vehicle } from '../types';
import { calculateVehicleCycle } from '../services/vehicleService';
import { X, Printer, Filter, Building2 } from 'lucide-react';

interface VehiclePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  factoryList: string[];
  initialFactory?: string;
  userName: string;
}

export const VehiclePrintModal: React.FC<VehiclePrintModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  factoryList,
  initialFactory = 'all',
  userName,
}) => {
  const [selectedFactory, setSelectedFactory] = useState<string>(initialFactory);
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'normal'>('all');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  if (!isOpen) return null;

  // Filter vehicles for print report
  const filteredVehicles = vehicles
    .filter((v) => {
      const matchFactory = selectedFactory === 'all' || v.factory === selectedFactory;
      const cycle = calculateVehicleCycle(v);
      let matchStatus = true;
      if (statusFilter === 'due') {
        matchStatus = cycle.status === 'due_soon' || cycle.status === 'overdue';
      } else if (statusFilter === 'normal') {
        matchStatus = cycle.status === 'normal';
      }
      return matchFactory && matchStatus;
    })
    .map((v) => ({ vehicle: v, cycle: calculateVehicleCycle(v) }));

  const overdueCount = filteredVehicles.filter((i) => i.cycle.status === 'overdue').length;
  const dueSoonCount = filteredVehicles.filter((i) => i.cycle.status === 'due_soon').length;
  const normalCount = filteredVehicles.filter((i) => i.cycle.status === 'normal').length;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header (Hidden on print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานข้อมูลรถและรอบเปลี่ยนถ่ายน้ำมันเครื่อง
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                พิมพ์รายงานแยกตามโรงงาน หรือพิมพ์ภาพรวมทุกโรงงาน (รองรับกระดาษ A4 แนวนอน / บันทึกเป็น PDF)
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

        {/* Filter Controls Bar (Hidden on print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm no-print">
          <div className="flex flex-wrap items-center gap-3">
            {/* Factory Selector */}
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>เลือกโรงงาน:</span>
              </label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="all">ทุกโรงงาน ({vehicles.length} คัน)</option>
                {factoryList.map((f) => {
                  const count = vehicles.filter((v) => v.factory === f).length;
                  return (
                    <option key={f} value={f}>
                      {f} ({count} คัน)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span>สถานะ:</span>
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="all">ทุกสถานะรอบถ่าย</option>
                <option value="due">เฉพาะใกล้ถึงรอบ & เกินรอบ</option>
                <option value="normal">เฉพาะสถานะปกติ</option>
              </select>
            </div>

            {/* Checkbox: Include Signatures */}
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>รวมช่องลงนามผู้มีอำนาจ</span>
            </label>
          </div>

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์รายงานทันที (Print / PDF)</span>
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
                  <h2 className="text-sm sm:text-base font-bold text-indigo-900 mt-0.5">
                    รายงานข้อมูลรถและกำหนดการรอบเปลี่ยนถ่ายน้ำมันเครื่อง (+20,000 กม.)
                  </h2>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    สังกัด: <strong>{selectedFactory === 'all' ? 'ทุกโรงงานในระบบ' : selectedFactory}</strong>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>วันที่พิมพ์: <strong>{currentDateThai}</strong></p>
                  <p>เวลา: <strong>{currentTimeThai} น.</strong></p>
                  <p>ผู้พิมพ์: <strong>{userName}</strong></p>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-100 rounded-lg border border-slate-300">
                  <span className="block text-[10px] text-slate-500 font-semibold">รถทั้งหมดในรายงาน</span>
                  <span className="text-base font-black text-slate-900">{filteredVehicles.length} คัน</span>
                </div>
                <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                  <span className="block text-[10px] text-red-600 font-semibold">เกินรอบเปลี่ยนถ่าย (ด่วน)</span>
                  <span className="text-base font-black text-red-700">{overdueCount} คัน</span>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="block text-[10px] text-amber-700 font-semibold">ใกล้ถึงรอบ (ล่วงหน้า 1 ด.)</span>
                  <span className="text-base font-black text-amber-800">{dueSoonCount} คัน</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="block text-[10px] text-emerald-700 font-semibold">สถานะปกติ</span>
                  <span className="text-base font-black text-emerald-800">{normalCount} คัน</span>
                </div>
              </div>
            </div>

            {/* Table */}
            {filteredVehicles.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="font-bold">ไม่พบข้อมูลรถตามเงื่อนไขที่เลือก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                      <th className="p-1.5 text-center border border-slate-300 w-8">ลำดับ</th>
                      <th className="p-1.5 border border-slate-300">ทะเบียนรถ</th>
                      <th className="p-1.5 border border-slate-300">โรงงาน</th>
                      <th className="p-1.5 border border-slate-300">สายรถ / เส้นทาง</th>
                      <th className="p-1.5 text-right border border-slate-300">กม./เที่ยว</th>
                      <th className="p-1.5 text-center border border-slate-300">เที่ยว/ด.</th>
                      <th className="p-1.5 text-right border border-slate-300">ไมล์ปัจจุบัน</th>
                      <th className="p-1.5 text-right border border-slate-300 font-black">รอบถัดไป (+20,000)</th>
                      <th className="p-1.5 text-right border border-slate-300">ระยะคงเหลือ</th>
                      <th className="p-1.5 text-center border border-slate-300 bg-indigo-50/50">วันเรียกรถเข้า</th>
                      <th className="p-1.5 text-center border border-slate-300">สถานะ</th>
                      <th className="p-1.5 border border-slate-300">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredVehicles.map(({ vehicle, cycle }, idx) => {
                      const isOverdue = cycle.status === 'overdue';
                      const isDueSoon = cycle.status === 'due_soon';

                      return (
                        <tr
                          key={vehicle.id}
                          className={`print-avoid-break ${
                            isOverdue
                              ? 'bg-red-50/60 font-medium'
                              : isDueSoon
                              ? 'bg-amber-50/40'
                              : idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="p-1.5 text-center border border-slate-300 font-bold text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="p-1.5 border border-slate-300 font-black text-slate-900 whitespace-nowrap">
                            {vehicle.licensePlate}
                          </td>
                          <td className="p-1.5 border border-slate-300 whitespace-nowrap">
                            {vehicle.factory}
                          </td>
                          <td className="p-1.5 border border-slate-300 truncate max-w-[130px]">
                            {vehicle.route || '-'}
                          </td>
                          <td className="p-1.5 text-right border border-slate-300">
                            {vehicle.distancePerTrip.toLocaleString('th-TH')}
                          </td>
                          <td className="p-1.5 text-center border border-slate-300">
                            {vehicle.tripsPerMonth}
                          </td>
                          <td className="p-1.5 text-right border border-slate-300 font-bold">
                            {vehicle.currentMileage.toLocaleString('th-TH')}
                          </td>
                          <td className="p-1.5 text-right border border-slate-300 font-black text-slate-900">
                            {cycle.nextTargetMileage.toLocaleString('th-TH')}
                          </td>
                          <td className="p-1.5 text-right border border-slate-300 font-semibold whitespace-nowrap">
                            {isOverdue ? (
                              <span className="text-red-700 font-bold">
                                -{Math.abs(cycle.kmRemaining).toLocaleString('th-TH')} กม.
                              </span>
                            ) : (
                              <span>{cycle.kmRemaining.toLocaleString('th-TH')} กม.</span>
                            )}
                          </td>
                          <td className="p-1.5 text-center border border-slate-300 font-extrabold whitespace-nowrap bg-indigo-50/40">
                            <div>
                              <span>{cycle.formattedDueDate}</span>
                              <span className="block text-[9px] text-slate-500 font-normal">
                                {cycle.isManualDueDate ? '(นัดหมาย)' : '(คำนวณ)'}
                              </span>
                            </div>
                          </td>
                          <td className="p-1.5 text-center border border-slate-300 whitespace-nowrap font-bold text-[10px]">
                            {isOverdue ? (
                              <span className="text-red-700">เกินรอบ</span>
                            ) : isDueSoon ? (
                              <span className="text-amber-700">ใกล้ถึงรอบ</span>
                            ) : (
                              <span className="text-emerald-700">ปกติ</span>
                            )}
                          </td>
                          <td className="p-1.5 border border-slate-300 text-slate-600 text-[10px] truncate max-w-[100px]">
                            {vehicle.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signature Block */}
            {includeSignatures && (
              <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                <div className="space-y-8">
                  <p className="font-semibold text-slate-700">ผู้จัดทำรายงาน / เจ้าหน้าที่บันทึก</p>
                  <div>
                    <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-800 font-medium">
                      ({userName})
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <p className="font-semibold text-slate-700">ช่างเทคนิค / ผู้ตรวจสอบสภาพรถ</p>
                  <div>
                    <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                      ( .................................................... )
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">วันที่ ......./......./.......</p>
                  </div>
                </div>

                <div className="space-y-8">
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
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <p className="text-xs text-slate-500">
            * คำแนะนำ: ในหน้าต่างสั่งพิมพ์ของบราวเซอร์ ให้เลือกขนาดกระดาษ <strong>A4</strong> และจัดวางใน <strong>แนวนอน (Landscape)</strong>
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
