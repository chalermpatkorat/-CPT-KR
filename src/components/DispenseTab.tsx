import React, { useState, useEffect } from 'react';
import { OilItem, Vehicle } from '../types';
import { recordDispense } from '../services/stockService';
import {
  ArrowUpRight,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Car,
  Gauge,
  AlertTriangle,
  Truck
} from 'lucide-react';

interface DispenseTabProps {
  oils: OilItem[];
  vehicles: Vehicle[];
  userName: string;
  preselectedOilId?: string | null;
  prefilledVehiclePlate?: string | null;
  prefilledMileage?: number | null;
  prefilledVehicleId?: string | null;
  onSuccessNavigate?: () => void;
}

export const DispenseTab: React.FC<DispenseTabProps> = ({
  oils,
  vehicles,
  userName,
  preselectedOilId,
  prefilledVehiclePlate,
  prefilledMileage,
  prefilledVehicleId,
}) => {
  const [selectedOilId, setSelectedOilId] = useState<string>('');
  const [amount, setAmount] = useState<string>('4');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [currentMileage, setCurrentMileage] = useState<string>('');
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [dispenseDate, setDispenseDate] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedOilId) {
      setSelectedOilId(preselectedOilId);
    } else if (oils.length > 0 && !selectedOilId) {
      const available = oils.find((o) => o.currentStock > 0);
      setSelectedOilId(available ? available.id : oils[0].id);
    }
  }, [preselectedOilId, oils]);

  useEffect(() => {
    if (prefilledVehiclePlate) {
      setRecipient(prefilledVehiclePlate);
    }
    if (prefilledMileage) {
      setCurrentMileage(prefilledMileage.toString());
    }
    if (prefilledVehicleId) {
      setSelectedVehicleId(prefilledVehicleId);
    }
  }, [prefilledVehiclePlate, prefilledMileage, prefilledVehicleId]);

  const selectedOil = oils.find((o) => o.id === selectedOilId);
  const amountNumber = parseFloat(amount) || 0;
  const isStockSufficient = selectedOil ? selectedOil.currentStock >= amountNumber : false;
  const stockAfterDispense = selectedOil
    ? Math.max(0, Math.round((selectedOil.currentStock - amountNumber) * 100) / 100)
    : 0;

  const quickAmounts = [1, 3.5, 4, 5, 10, 20, 50];

  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    if (!vId) return;

    const v = vehicles.find((item) => item.id === vId);
    if (v) {
      setRecipient(`${v.licensePlate} (${v.factory} - ${v.route})`);
      setCurrentMileage(v.currentMileage.toString());
      setReferenceNote((prev) => (prev ? prev : `สาย ${v.route}`));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedOil) {
      setErrorMsg('กรุณาเลือกชนิดสินค้าที่ต้องการเบิก');
      return;
    }

    if (amountNumber <= 0) {
      setErrorMsg('กรุณาระบุจำนวนลิตรที่ต้องการเบิกมากกว่า 0');
      return;
    }

    if (selectedOil.currentStock < amountNumber) {
      setErrorMsg(
        `สต๊อกไม่เพียงพอ: สต๊อกคงเหลือปัจจุบันมี ${selectedOil.currentStock} ลิตร แต่ต้องการเบิก ${amountNumber} ลิตร`
      );
      return;
    }

    if (!recipient.trim()) {
      setErrorMsg('กรุณาระบุผู้เบิก หรือทะเบียนรถ');
      return;
    }

    const mileageNum = currentMileage ? parseFloat(currentMileage) : undefined;

    setLoading(true);
    try {
      await recordDispense({
        oil: selectedOil,
        amount: amountNumber,
        recipientOrVehicle: recipient.trim(),
        currentMileage: mileageNum,
        referenceNote: referenceNote.trim(),
        date: new Date(dispenseDate).toISOString(),
        performedBy: userName || 'สมาชิก',
        vehicleId: selectedVehicleId || undefined,
      });

      setSuccessMsg(
        `เบิกสินค้า ${selectedOil.name} จำนวน ${amountNumber} ลิตร สำเร็จเรียบร้อย! คงเหลือ ${stockAfterDispense} ลิตร${
          mileageNum ? ` (บันทึกเลขไมล์ ${mileageNum.toLocaleString('th-TH')} กม.)` : ''
        }`
      );

      setRecipient('');
      setSelectedVehicleId('');
      setCurrentMileage('');
      setReferenceNote('');
      setAmount('4');
    } catch (err: any) {
      console.error('Error dispensing item:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกการเบิกสินค้า');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 rounded-2xl p-6 text-white shadow-md shadow-orange-500/10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-200 text-xs font-bold uppercase tracking-wider">
            <ArrowUpRight className="w-4 h-4" />
            <span>เบิกจ่ายสินค้า (น้ำมันเครื่อง & น้ำยาแอดบลู)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            บันทึกการเบิกจ่ายสินค้า
          </h2>
          <p className="text-orange-100 text-xs sm:text-sm mt-1">
            บันทึกการเบิกน้ำมันเครื่องหรือน้ำยาแอดบลู พร้อมระบุเลขไมล์รถเพื่ออัปเดตรอบเปลี่ยนถ่ายอัตโนมัติ
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md hidden sm:flex items-center justify-center">
          <Package className="w-8 h-8 text-white" />
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-emerald-800 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">บันทึกการเบิกจ่ายสำเร็จ!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-emerald-600 hover:underline cursor-pointer font-medium"
          >
            ปิด
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">ไม่สามารถทำรายการได้</h4>
            <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              เลือกสินค้าที่ต้องการเบิก (น้ำมันเครื่อง / น้ำยาแอดบลู) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {oils.map((oil) => {
                const isSelected = selectedOilId === oil.id;
                const isOut = oil.currentStock <= 0;
                return (
                  <button
                    key={oil.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => {
                      setSelectedOilId(oil.id);
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20 shadow-xs'
                        : isOut
                        ? 'border-slate-200 bg-slate-50 opacity-40 cursor-not-allowed'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] font-bold text-slate-500">{oil.brand}</span>
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] font-extrabold">
                        {oil.viscosity}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 mt-1 line-clamp-1">
                      {oil.name}
                    </h4>
                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-500">คงเหลือ:</span>
                      <span
                        className={`font-black ${
                          isOut ? 'text-red-500' : oil.currentStock <= oil.minStockThreshold ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {oil.currentStock} ลิตร
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedOil && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{selectedOil.name}</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                    {selectedOil.viscosity}
                  </span>
                  {selectedOil.oilType && (
                    <span className="text-xs text-slate-500">({selectedOil.oilType})</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  สต๊อกปัจจุบัน: <strong className="text-slate-800">{selectedOil.currentStock} ลิตร</strong> • ใช้ไปสะสม: {selectedOil.totalUsed || 0} ลิตร
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">คงเหลือเดิม</span>
                  <span className="text-sm font-bold text-slate-700">{selectedOil.currentStock} ลิตร</span>
                </div>
                <div className="text-orange-500 font-bold">→</div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">เบิกออก</span>
                  <span className="text-sm font-bold text-orange-600">-{amountNumber} ลิตร</span>
                </div>
                <div className="text-slate-300 font-bold">=</div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">จะคงเหลือ</span>
                  <span
                    className={`text-sm font-extrabold ${
                      stockAfterDispense < 0
                        ? 'text-red-600'
                        : stockAfterDispense <= selectedOil.minStockThreshold
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {stockAfterDispense} ลิตร
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              จำนวนลิตรที่ต้องการเบิก <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q.toString())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    amountNumber === q
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {q} ลิตร
                </button>
              ))}
            </div>

            <div className="relative max-w-xs">
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ระบุจำนวนลิตร เช่น 4.5"
                className={`w-full px-3.5 py-2.5 text-base font-bold border rounded-xl outline-none focus:ring-2 transition ${
                  !isStockSufficient && amountNumber > 0
                    ? 'border-red-400 text-red-700 focus:ring-red-400 bg-red-50/30'
                    : 'border-slate-300 text-slate-900 focus:ring-orange-500 focus:border-orange-500'
                }`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ลิตร
              </span>
            </div>

            {!isStockSufficient && amountNumber > 0 && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>จำนวนที่ต้องการเบิกเกินกว่าสต๊อกที่มีอยู่ในปัจจุบัน</span>
              </p>
            )}
          </div>

          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>เลือกรถประจำโรงงานเพื่อดึงและบันทึกเลขไมล์อัตโนมัติ</span>
              </label>
              {selectedVehicleId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVehicleId('');
                    setRecipient('');
                    setCurrentMileage('');
                  }}
                  className="text-[11px] text-amber-700 underline font-medium cursor-pointer"
                >
                  ล้างการเลือก
                </button>
              )}
            </div>

            <select
              value={selectedVehicleId}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-amber-300 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">-- เลือกรถจากรายชื่อในระบบ หรือ กรอกข้อมูลด้วยตนเองด้านล่าง --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} ({v.factory} - {v.route}) [ไมล์ปัจจุบัน: {v.currentMileage.toLocaleString('th-TH')} กม.]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ผู้เบิก / ทะเบียนรถ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Car className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="เช่น 70-1122 กทม. หรือ ช่างประสิทธิ์"
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เลขไมล์ปัจจุบัน (กิโลเมตร)
              </label>
              <div className="relative">
                <Gauge className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(e.target.value)}
                  placeholder="เช่น 118500"
                  className="w-full pl-9 pr-3.5 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                * สำหรับคำนวณรอบถ่าย 20,000 กม.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                วันและเวลาที่เบิก <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={dispenseDate}
                  onChange={(e) => setDispenseDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมายเหตุเพิ่มเติม (ถ้ามี)
            </label>
            <input
              type="text"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              placeholder="เช่น เติม AdBlue ประจำสัปดาห์ หรือ เปลี่ยนถ่ายน้ำมันเครื่องรอบ 20,000 กม."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ผู้บันทึก: <strong>{userName || 'สมาชิก'}</strong></span>
            </div>

            <button
              type="submit"
              disabled={loading || !isStockSufficient || amountNumber <= 0}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังตัดสต๊อก...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>ยืนยันการเบิกสินค้า ({amountNumber} ลิตร)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
