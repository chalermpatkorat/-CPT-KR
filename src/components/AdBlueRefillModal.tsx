import React, { useState, useEffect } from 'react';
import { Vehicle, OilItem, AdBlueRefillRecord } from '../types';
import { addAdBlueRefill, updateAdBlueRefill } from '../services/adblueService';
import {
  Droplets,
  X,
  Truck,
  Calendar,
  Percent,
  User,
  Gauge,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AdBlueRefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  adBlueOils: OilItem[];
  userName: string;
  preselectedVehicle?: Vehicle | null;
  editingRecord?: AdBlueRefillRecord | null;
  onSuccess?: () => void;
}

export const AdBlueRefillModal: React.FC<AdBlueRefillModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  adBlueOils,
  userName,
  preselectedVehicle,
  editingRecord,
  onSuccess,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [factory, setFactory] = useState<string>('โรงงาน 1');
  const [date, setDate] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [percentBefore, setPercentBefore] = useState<string>('20');
  const [percentAfter, setPercentAfter] = useState<string>('100');
  const [litersFilled, setLitersFilled] = useState<string>('20');
  const [filledBy, setFilledBy] = useState<string>(userName || 'ช่างเฉลิมพัฒน์');
  const [currentMileage, setCurrentMileage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [deductStock, setDeductStock] = useState<boolean>(true);
  const [selectedOilId, setSelectedOilId] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or update fields when modal opens
  useEffect(() => {
    if (editingRecord) {
      setSelectedVehicleId(editingRecord.vehicleId || '');
      setLicensePlate(editingRecord.licensePlate);
      setFactory(editingRecord.factory);
      setDate(() => {
        try {
          const d = new Date(editingRecord.date);
          const tzOffset = d.getTimezoneOffset() * 60000;
          return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        } catch {
          return editingRecord.date;
        }
      });
      setPercentBefore(editingRecord.percentBefore.toString());
      setPercentAfter(editingRecord.percentAfter.toString());
      setLitersFilled(editingRecord.litersFilled.toString());
      setFilledBy(editingRecord.filledBy);
      setCurrentMileage(editingRecord.currentMileage?.toString() || '');
      setNotes(editingRecord.notes || '');
      setDeductStock(false);
    } else if (preselectedVehicle) {
      setSelectedVehicleId(preselectedVehicle.id);
      setLicensePlate(preselectedVehicle.licensePlate);
      setFactory(preselectedVehicle.factory);
      setCurrentMileage(preselectedVehicle.currentMileage?.toString() || '');
      setPercentBefore('20');
      setPercentAfter('100');
      setLitersFilled('20');
      setFilledBy(userName || 'ช่างเฉลิมพัฒน์');
      setNotes(`เติมที่ ${preselectedVehicle.factory} (${preselectedVehicle.route || '-'})`);
    } else {
      setLicensePlate('');
      setSelectedVehicleId('');
      setPercentBefore('20');
      setPercentAfter('100');
      setLitersFilled('20');
      setFilledBy(userName || 'ช่างเฉลิมพัฒน์');
      setCurrentMileage('');
      setNotes('');
    }

    if (adBlueOils.length > 0 && !selectedOilId) {
      setSelectedOilId(adBlueOils[0].id);
    }
  }, [editingRecord, preselectedVehicle, isOpen, userName, adBlueOils]);

  if (!isOpen) return null;

  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    if (!vId) return;
    const v = vehicles.find((item) => item.id === vId);
    if (v) {
      setLicensePlate(v.licensePlate);
      setFactory(v.factory);
      setCurrentMileage(v.currentMileage.toString());
      if (!notes) {
        setNotes(`สาย ${v.route || '-'}`);
      }
    }
  };

  const selectedAdBlueOil = adBlueOils.find((o) => o.id === selectedOilId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pBefore = parseFloat(percentBefore);
    const pAfter = parseFloat(percentAfter);
    const liters = parseFloat(litersFilled);

    if (!licensePlate.trim()) {
      setErrorMsg('กรุณาระบุทะเบียนรถ');
      return;
    }
    if (isNaN(pBefore) || pBefore < 0 || pBefore > 100) {
      setErrorMsg('กรุณากรอก %ก่อนเติม ระหว่าง 0 - 100%');
      return;
    }
    if (isNaN(pAfter) || pAfter < 0 || pAfter > 100) {
      setErrorMsg('กรุณากรอก %หลังเติม ระหว่าง 0 - 100%');
      return;
    }
    if (isNaN(liters) || liters <= 0) {
      setErrorMsg('กรุณาระบุจำนวนลิตรที่เติมมากกว่า 0');
      return;
    }
    if (!filledBy.trim()) {
      setErrorMsg('กรุณาระบุชื่อผู้เติม');
      return;
    }

    setLoading(true);

    try {
      if (editingRecord) {
        await updateAdBlueRefill(
          editingRecord.id,
          {
            vehicleId: selectedVehicleId || undefined,
            licensePlate: licensePlate.trim(),
            factory,
            date: new Date(date).toISOString(),
            percentBefore: pBefore,
            percentAfter: pAfter,
            litersFilled: liters,
            filledBy: filledBy.trim(),
            currentMileage: currentMileage ? parseFloat(currentMileage) : undefined,
            notes: notes.trim(),
          },
          userName
        );
      } else {
        await addAdBlueRefill(
          {
            record: {
              vehicleId: selectedVehicleId || undefined,
              licensePlate: licensePlate.trim(),
              factory,
              date: new Date(date).toISOString(),
              percentBefore: pBefore,
              percentAfter: pAfter,
              litersFilled: liters,
              filledBy: filledBy.trim(),
              currentMileage: currentMileage ? parseFloat(currentMileage) : undefined,
              notes: notes.trim(),
              deductedFromStock: deductStock && !!selectedAdBlueOil,
              oilId: deductStock && selectedAdBlueOil ? selectedAdBlueOil.id : undefined,
              updatedBy: userName,
            },
            adBlueOilItem: deductStock ? selectedAdBlueOil : null,
          },
          userName
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving AdBlue refill:', err);
      setErrorMsg(err.message || 'บันทึกการเติม AdBlue ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Droplets className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {editingRecord ? 'แก้ไขบันทึกการเติมน้ำยา AdBlue' : 'บันทึกการเติมน้ำยาบำบัดไอเสีย AdBlue'}
              </h3>
              <p className="text-xs text-teal-100 mt-0.5">
                บันทึกประวัติเฉพาะน้ำยา AdBlue (%ก่อนเติม, %หลังเติม, จำนวนลิตร, ผู้เติม)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Vehicle Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เลือกรถประจำโรงงาน (หรือกรอกทะเบียนด้านล่าง)
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
            >
              <option value="">-- เลือกรถจากรายชื่อในระบบ --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} ({v.factory} - {v.route}) [ไมล์: {v.currentMileage.toLocaleString('th-TH')} กม.]
                </option>
              ))}
            </select>
          </div>

          {/* License Plate & Factory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ทะเบียนรถ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="เช่น 70-1122 กทม."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                โรงงานสังกัด <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                placeholder="เช่น โรงงาน 1, โรงงาน 2"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วัน/เดือน/ปี และเวลาที่เติม <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white font-medium"
              />
            </div>
          </div>

          {/* Percent Before & Percent After */}
          <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
              <Percent className="w-4 h-4 text-teal-700" />
              <span>ระดับน้ำยาแอดบลูหน้าปัดรถ (%ก่อนเติม และ %หลังเติม)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  % ก่อนเติม <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={percentBefore}
                    onChange={(e) => setPercentBefore(e.target.value)}
                    placeholder="เช่น 15"
                    className="w-full px-3.5 py-2 text-sm font-bold border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  % หลังเติม <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={percentAfter}
                    onChange={(e) => setPercentAfter(e.target.value)}
                    placeholder="เช่น 100"
                    className="w-full px-3.5 py-2 text-sm font-bold border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            </div>

            {/* Visual Gauge Preview */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-teal-800">
                <span>ก่อน: {percentBefore || 0}%</span>
                <span>เติมเพิ่ม: +{Math.max(0, (parseFloat(percentAfter) || 0) - (parseFloat(percentBefore) || 0))}%</span>
                <span>หลัง: {percentAfter || 0}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(percentBefore) || 0))}%` }}
                ></div>
                <div
                  className="bg-teal-500 h-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, (parseFloat(percentAfter) || 0) - (parseFloat(percentBefore) || 0)))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Liters Filled & Filled By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                จำนวนลิตรที่เติม <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={litersFilled}
                  onChange={(e) => setLitersFilled(e.target.value)}
                  placeholder="เช่น 20"
                  className="w-full px-3.5 py-2 text-sm font-black border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-teal-800"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ลิตร</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ผู้เติม <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={filledBy}
                  onChange={(e) => setFilledBy(e.target.value)}
                  placeholder="เช่น ช่างสุรชัย"
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Current Mileage (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เลขไมล์ ณ เวลาที่เติม (กม.)
              </label>
              <div className="relative">
                <Gauge className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(e.target.value)}
                  placeholder="เช่น 118450"
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น เติมก่อนออกวิ่งสายยาว"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Optional Stock Deduction */}
          {!editingRecord && adBlueOils.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>ตัดยอดจำนวน {litersFilled || 0} ลิตร ออกจากสต๊อกน้ำยา AdBlue อัตโนมัติ</span>
              </label>

              {deductStock && (
                <div className="pl-6 pt-1">
                  <select
                    value={selectedOilId}
                    onChange={(e) => setSelectedOilId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {adBlueOils.map((o) => (
                      <option key={o.id} value={o.id}>
                        ตัดจาก: {o.name} (คงเหลือ: {o.currentStock} ลิตร)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกการเติม AdBlue'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
