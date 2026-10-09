import React, { useState } from 'react';
import { Vehicle } from '../types';
import { calculateVehicleCycle, formatThaiDate } from '../services/vehicleService';
import { PrintControlBar } from './PrintControlBar';
import { PrintOrientation, triggerPrint } from '../utils/printManager';
import { X, Printer, Filter, Building2, Car } from 'lucide-react';

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'normal'>('all');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Print Settings: Orientation & Copies / Page Range
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [copies, setCopies] = useState<number>(1);
  const [pageRange, setPageRange] = useState<'all' | '1' | '2'>('all');

  if (!isOpen) return null;

  // Filter vehicles for print report
  const rawFilteredVehicles = vehicles
    .filter((v) => {
      const matchFactory = selectedFactory === 'all' || v.factory === selectedFactory;
      const matchVehicle = selectedVehicleId === 'all' || v.id === selectedVehicleId;
      const cycle = calculateVehicleCycle(v);
      let matchStatus = true;
      if (statusFilter === 'due') {
        matchStatus = cycle.status === 'due_soon' || cycle.status === 'overdue';
      } else if (statusFilter === 'normal') {
        matchStatus = cycle.status === 'normal';
      }
      return matchFactory && matchVehicle && matchStatus;
    })
    .map((v) => ({ vehicle: v, cycle: calculateVehicleCycle(v) }));

  // Apply page range restriction if requested
  const itemsPerPage = orientation === 'landscape' ? 18 : 22;
  const filteredVehicles =
    pageRange === '1'
      ? rawFilteredVehicles.slice(0, itemsPerPage)
      : pageRange === '2'
      ? rawFilteredVehicles.slice(0, itemsPerPage * 2)
      : rawFilteredVehicles;

  const overdueCount = rawFilteredVehicles.filter((i) => i.cycle.status === 'overdue').length;
  const dueSoonCount = rawFilteredVehicles.filter((i) => i.cycle.status === 'due_soon').length;
  const normalCount = rawFilteredVehicles.filter((i) => i.cycle.status === 'normal').length;

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

  const availableVehiclesForSelect =
    selectedFactory === 'all'
      ? vehicles
      : vehicles.filter((v) => v.factory === selectedFactory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in print-modal-overlay print:p-0 print:static print:block">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print-modal-container print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:static print:block">
        {/* Modal Header (Hidden on print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                พิมพ์รายงานประวัติถ่ายน้ำมันเครื่องและข้อมูลรถ
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                เลือกการวางกระดาษแนวนอน / แนวตั้ง • กำหนดจำนวนชุด (ใบ) และหน้าที่จะพิมพ์ • รอบเปลี่ยนถ่าย 20,000 กม.
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

        {/* Unified Print Control Bar (Orientation, Copies, Page Range, Print Trigger) */}
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
          {/* Factory Selector */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedFactory}
              onChange={(e) => {
                setSelectedFactory(e.target.value);
                setSelectedVehicleId('all');
              }}
              className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
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

          {/* Vehicle Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Car className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer max-w-[130px]"
            >
              <option value="all">ทุกคัน</option>
              {availableVehiclesForSelect.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} ({v.factory})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
            >
              <option value="all">ทุกสถานะรอบถ่าย</option>
              <option value="due">ใกล้ถึงรอบ & เกินรอบ</option>
              <option value="normal">สถานะปกติ</option>
            </select>
          </div>

          {/* Include Signatures Checkbox */}
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

        {/* Live Print Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible print-modal-scroll">
          {/* Container size adapts according to orientation */}
          <div
            className={`mx-auto bg-white p-5 sm:p-7 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 space-y-4 print-container print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:rounded-none transition-all ${
              orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
            }`}
          >
            {/* Repeat content for copies if copies > 1 */}
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
                      [ เอกสารพิมพ์ {orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'} • ขนาด A4 ]
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
                      <h2 className="text-xs sm:text-sm font-bold text-indigo-900 mt-0.5">
                        รายงานประวัติถ่ายน้ำมันเครื่องและข้อมูลรถประจำโรงงาน (รอบเปลี่ยนถ่าย 20,000 กม.)
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-700 mt-1">
                        สังกัด: <strong>{selectedFactory === 'all' ? 'ทุกโรงงานในระบบ' : selectedFactory}</strong>
                        {selectedVehicleId !== 'all' && (
                          <span className="ml-2 text-indigo-800">
                            • ทะเบียน: {vehicles.find((v) => v.id === selectedVehicleId)?.licensePlate}
                          </span>
                        )}
                        <span className="ml-2 text-slate-500 font-normal">
                          (การจัดวาง: {orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'})
                        </span>
                      </p>
                    </div>
                    <div className="text-right text-[10px] sm:text-[11px] text-slate-500 flex-shrink-0">
                      <p>
                        วันที่พิมพ์: <strong>{currentDateThai}</strong>
                      </p>
                      <p>
                        เวลา: <strong>{currentTimeThai} น.</strong>
                      </p>
                      <p>
                        ผู้พิมพ์: <strong>{userName}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Summary KPIs */}
                  <div className="mt-2.5 grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">ทั้งหมด</span>
                      <span className="text-sm font-black text-slate-800">
                        {rawFilteredVehicles.length} คัน
                      </span>
                    </div>
                    <div className="bg-red-50 p-1.5 rounded border border-red-200">
                      <span className="text-[10px] text-red-600 font-bold block">เกินรอบ (ด่วน)</span>
                      <span className="text-sm font-black text-red-700">{overdueCount} คัน</span>
                    </div>
                    <div className="bg-amber-50 p-1.5 rounded border border-amber-200">
                      <span className="text-[10px] text-amber-600 font-bold block">ใกล้ถึงรอบ</span>
                      <span className="text-sm font-black text-amber-700">{dueSoonCount} คัน</span>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200">
                      <span className="text-[10px] text-emerald-600 font-bold block">สถานะปกติ</span>
                      <span className="text-sm font-black text-emerald-800">{normalCount} คัน</span>
                    </div>
                  </div>
                </div>

                {/* Table */}
                {filteredVehicles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-bold">ไม่พบข้อมูลรถตามเงื่อนไขที่เลือก</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[10px]">
                          <th className="p-1 text-center border border-slate-300 w-7">ลำดับ</th>
                          <th className="p-1 border border-slate-300">ทะเบียนรถ</th>
                          <th className="p-1 border border-slate-300">โรงงาน</th>
                          {orientation === 'landscape' && (
                            <th className="p-1 border border-slate-300">สายรถ / เส้นทาง</th>
                          )}
                          <th className="p-1 text-right border border-slate-300">กม./เที่ยว</th>
                          <th className="p-1 text-center border border-slate-300">เที่ยว/ด.</th>
                          <th className="p-1 text-right border border-slate-300">ไมล์ปัจจุบัน</th>
                          <th className="p-1 text-right border border-slate-300 font-black">
                            <div>รอบถัดไป</div>
                            <div className="text-[8.5px] font-normal text-slate-600">
                              (ไมล์ล่าสุด + 20,000)
                            </div>
                          </th>
                          <th className="p-1 text-right border border-slate-300">ระยะคงเหลือ</th>
                          <th className="p-1 text-center border border-slate-300 bg-indigo-50/50">
                            วันเรียกรถเข้า
                          </th>
                          <th className="p-1 text-center border border-slate-300">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredVehicles.map(({ vehicle, cycle }, idx) => {
                          const isOverdue = cycle.status === 'overdue';
                          const isDueSoon = cycle.status === 'due_soon';

                          return (
                            <tr
                              key={`${vehicle.id}-${copyIndex}`}
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
                              <td className="p-1 text-center border border-slate-300 font-bold text-slate-600">
                                {idx + 1}
                              </td>
                              <td className="p-1 border border-slate-300 font-black text-slate-900 whitespace-nowrap">
                                {vehicle.licensePlate}
                              </td>
                              <td className="p-1 border border-slate-300 whitespace-nowrap">
                                {vehicle.factory}
                              </td>
                              {orientation === 'landscape' && (
                                <td className="p-1 border border-slate-300 truncate max-w-[120px]">
                                  {vehicle.route || '-'}
                                </td>
                              )}
                              <td className="p-1 text-right border border-slate-300">
                                {vehicle.distancePerTrip.toLocaleString('th-TH')}
                              </td>
                              <td className="p-1 text-center border border-slate-300">
                                {vehicle.tripsPerMonth}
                              </td>
                              <td className="p-1 text-right border border-slate-300 font-bold">
                                <div>{vehicle.currentMileage.toLocaleString('th-TH')}</div>
                                {vehicle.lastOilChangeDate && (
                                  <div className="text-[9px] text-emerald-800 font-medium">
                                    ถ่าย: {formatThaiDate(vehicle.lastOilChangeDate)}
                                  </div>
                                )}
                              </td>
                              <td className="p-1 text-right border border-slate-300 font-black text-slate-900">
                                <div>{cycle.nextTargetMileage.toLocaleString('th-TH')}</div>
                                {vehicle.lastOilChangeMileage ? (
                                  <div className="text-[8.5px] text-slate-500 font-normal">
                                    (จากไมล์ {vehicle.lastOilChangeMileage.toLocaleString('th-TH')} + 20,000)
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-1 text-right border border-slate-300 font-semibold whitespace-nowrap">
                                {isOverdue ? (
                                  <span className="text-red-700 font-bold">
                                    -{Math.abs(cycle.kmRemaining).toLocaleString('th-TH')} กม.
                                  </span>
                                ) : (
                                  <span>{cycle.kmRemaining.toLocaleString('th-TH')} กม.</span>
                                )}
                              </td>
                              <td className="p-1 text-center border border-slate-300 font-extrabold whitespace-nowrap bg-indigo-50/40">
                                <div>
                                  <span>{cycle.formattedDueDate}</span>
                                  <span className="block text-[8.5px] text-slate-500 font-normal">
                                    {cycle.isManualDueDate ? '(นัดหมาย)' : '(คำนวณ)'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-1 text-center border border-slate-300 whitespace-nowrap font-bold text-[10px]">
                                {isOverdue ? (
                                  <span className="text-red-700">เกินรอบ!</span>
                                ) : isDueSoon ? (
                                  <span className="text-amber-700">ใกล้ถึงรอบ</span>
                                ) : (
                                  <span className="text-emerald-700">ปกติ</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures */}
                {includeSignatures && (
                  <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">ผู้จัดทำรายงาน / เจ้าหน้าที่บันทึก</p>
                      <div>
                        <p className="border-b border-dotted border-slate-400 pb-1 w-3/4 mx-auto text-slate-400">
                          ( {userName || '....................................................'} )
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">วันที่ {currentDateThai}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="font-semibold text-slate-700">หัวหน้าฝ่ายขนส่ง / ตรวจสอบ</p>
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

        {/* Modal Footer (Hidden on print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <p className="text-xs text-slate-500">
            * สั่งพิมพ์ {copies} ใบ • กระดาษ A4 {orientation === 'landscape' ? 'แนวนอน (Landscape)' : 'แนวตั้ง (Portrait)'} • กำหนดรอบคำนวณจาก ไมล์ถ่ายล่าสุด + 20,000 กม.
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
