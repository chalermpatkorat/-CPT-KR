import React from 'react';
import { OilItem, Vehicle } from '../types';
import { calculateVehicleCycle } from '../services/vehicleService';
import {
  AlertTriangle,
  AlertOctagon,
  X,
  PackagePlus,
  Truck,
  ArrowUpRight,
  Clock,
  Calendar
} from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  oils: OilItem[];
  vehicles?: Vehicle[];
  onGoToReceive: (oil: OilItem) => void;
  onGoToVehicles?: () => void;
  onDispenseForVehicle?: (licensePlate: string, currentMileage: number, vehicleId: string) => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  oils,
  vehicles = [],
  onGoToReceive,
  onGoToVehicles,
  onDispenseForVehicle,
}) => {
  if (!isOpen) return null;

  const outOfStockOils = oils.filter((o) => o.currentStock <= 0);
  const lowStockOils = oils.filter((o) => o.currentStock > 0 && o.currentStock <= o.minStockThreshold);

  const vehicleStats = vehicles.map((v) => ({
    vehicle: v,
    cycle: calculateVehicleCycle(v),
  }));

  const overdueVehicles = vehicleStats.filter((s) => s.cycle.status === 'overdue');
  const dueSoonVehicles = vehicleStats.filter((s) => s.cycle.status === 'due_soon');

  const totalAlerts =
    outOfStockOils.length +
    lowStockOils.length +
    overdueVehicles.length +
    dueSoonVehicles.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ศูนย์แจ้งเตือนระบบ (สต๊อก & รอบเปลี่ยนถ่ายรถ)</h3>
              <p className="text-xs text-orange-100">
                พบ {totalAlerts} รายการที่ต้องติดตาม (สินค้าใกล้หมดสต๊อก หรือ รถใกล้ถึงรอบเปลี่ยนถ่าย +20,000 กม.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {overdueVehicles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-red-600 font-bold text-sm">
                <AlertOctagon className="w-4 h-4 flex-shrink-0" />
                <span>รถที่วิ่งเกินรอบเปลี่ยนถ่าย (+20,000 กม.) แล้ว (ด่วนที่สุด!) ({overdueVehicles.length} คัน)</span>
              </div>
              <div className="space-y-2.5">
                {overdueVehicles.map(({ vehicle, cycle }) => (
                  <div
                    key={vehicle.id}
                    className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl flex items-center justify-between gap-3 hover:bg-red-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-red-600" />
                        <span className="font-extrabold text-slate-900 text-sm">{vehicle.licensePlate}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                          {vehicle.factory}
                        </span>
                        <span className="text-xs text-slate-500">สาย: {vehicle.route}</span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">
                        ไมล์ปัจจุบัน: <strong>{vehicle.currentMileage.toLocaleString('th-TH')} กม.</strong> (วิ่งเกินเป้าหมาย {cycle.nextTargetMileage.toLocaleString('th-TH')} กม. ไปแล้ว{' '}
                        <strong>{Math.abs(cycle.kmRemaining).toLocaleString('th-TH')} กม.</strong>)
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-red-800">
                        <Calendar className="w-3.5 h-3.5 text-red-600" />
                        <span>วันที่ต้องเรียกรถเข้า: <strong>{cycle.formattedDueDate}</strong> ({cycle.isManualDueDate ? '📌 นัดหมายไว้' : '⚡ ประมาณการ'} • เกินกำหนดแล้ว)</span>
                      </div>
                    </div>
                    {onDispenseForVehicle && (
                      <button
                        onClick={() => {
                          onDispenseForVehicle(vehicle.licensePlate, vehicle.currentMileage, vehicle.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer flex-shrink-0"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>เบิกน้ำมันเครื่อง</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dueSoonVehicles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-sm">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>รถที่ใกล้ถึงรอบเปลี่ยนถ่าย (เตือนล่วงหน้า 1 เดือน / เหลือ &lt; 2,000 กม.) ({dueSoonVehicles.length} คัน)</span>
              </div>
              <div className="space-y-2.5">
                {dueSoonVehicles.map(({ vehicle, cycle }) => (
                  <div
                    key={vehicle.id}
                    className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-3 hover:bg-amber-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-700" />
                        <span className="font-extrabold text-slate-900 text-sm">{vehicle.licensePlate}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                          {vehicle.factory}
                        </span>
                        <span className="text-xs text-slate-500">สาย: {vehicle.route}</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-1">
                        เหลือระยะอีก: <strong>{cycle.kmRemaining.toLocaleString('th-TH')} กม.</strong> (ก่อนถึงเป้าหมาย{' '}
                        <strong>{cycle.nextTargetMileage.toLocaleString('th-TH')} กม.</strong> • ประมาณ{' '}
                        <strong>{cycle.estimatedDaysRemaining} วัน</strong>)
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>วันที่ต้องเรียกรถเข้า: <strong>{cycle.formattedDueDate}</strong> ({cycle.isManualDueDate ? '📌 วันนัดหมาย' : '⚡ วันที่คำนวณอัตโนมัติ'} • อีก {cycle.estimatedDaysRemaining} วัน)</span>
                      </div>
                    </div>
                    {onDispenseForVehicle && (
                      <button
                        onClick={() => {
                          onDispenseForVehicle(vehicle.licensePlate, vehicle.currentMileage, vehicle.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer flex-shrink-0"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>เตรียมเบิก</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {outOfStockOils.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-red-600 font-semibold text-sm">
                <AlertOctagon className="w-4 h-4 flex-shrink-0" />
                <span>สินค้าหมดสต๊อก (0 ลิตร) - ด่วนที่สุด ({outOfStockOils.length} รายการ)</span>
              </div>
              <div className="space-y-2.5">
                {outOfStockOils.map((oil) => (
                  <div
                    key={oil.id}
                    className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center justify-between gap-3 hover:bg-red-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{oil.name}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                          {oil.viscosity}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">({oil.brand})</span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        คงเหลือ: <span className="font-bold">0 ลิตร</span> (จุดสั่งซื้อขั้นต่ำ:{' '}
                        {oil.minStockThreshold} ลิตร)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onGoToReceive(oil);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer flex-shrink-0"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>รับเข้าสต๊อก</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowStockOils.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-amber-600 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>สินค้าใกล้หมดสต๊อก ({lowStockOils.length} รายการ)</span>
              </div>
              <div className="space-y-2.5">
                {lowStockOils.map((oil) => (
                  <div
                    key={oil.id}
                    className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 hover:bg-amber-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{oil.name}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                          {oil.viscosity}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">({oil.brand})</span>
                      </div>
                      <p className="text-xs text-amber-700 mt-1">
                        คงเหลือเพียง:{' '}
                        <span className="font-bold text-amber-900">{oil.currentStock} ลิตร</span>{' '}
                        (จุดแจ้งเตือน: {oil.minStockThreshold} ลิตร)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onGoToReceive(oil);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer flex-shrink-0"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>รับเข้าสต๊อก</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalAlerts === 0 && (
            <div className="py-8 text-center text-slate-500">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                ✓
              </div>
              <p className="font-bold text-slate-700">ระบบอยู่ในเกณฑ์ปกติทุกรายการ</p>
              <p className="text-xs text-slate-400 mt-0.5">
                ไม่มีสินค้าใกล้หมดสต๊อก และรถยังไม่ถึงรอบเตือน 1 เดือน
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {onGoToVehicles ? (
            <button
              onClick={() => {
                onGoToVehicles();
                onClose();
              }}
              className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>ดูข้อมูลรถทั้งหมด</span>
            </button>
          ) : <div />}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl text-xs transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
