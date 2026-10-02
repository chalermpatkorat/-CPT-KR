import React, { useState, useEffect } from 'react';
import { OilItem, Vehicle } from '../types';
import { recordDispense } from '../services/stockService';
import { recordOilChange, updateVehicle } from '../services/vehicleService';
import { addAdBlueRefill } from '../services/adblueService';
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
  Truck,
  Droplets,
  Percent,
  Wrench,
  ShieldAlert,
  Info
} from 'lucide-react';

interface DispenseTabProps {
  oils: OilItem[];
  vehicles: Vehicle[];
  userName: string;
  isAdmin: boolean;
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
  isAdmin,
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

  // Engine Oil Specific: Mark as full oil change cycle
  const [isFullOilChange, setIsFullOilChange] = useState<boolean>(true);

  // Category filter: 'all' | 'oil' | 'adblue'
  const [filterCategory, setFilterCategory] = useState<'all' | 'oil' | 'adblue'>('all');

  // AdBlue Specific Fields (%ก่อนเติม, %หลังเติม)
  const [adBluePercentBefore, setAdBluePercentBefore] = useState<string>('20');
  const [adBluePercentAfter, setAdBluePercentAfter] = useState<string>('100');

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

  // Check if selected product is AdBlue
  const isAdBlueItem = selectedOil
    ? selectedOil.name.toLowerCase().includes('adblue') ||
      selectedOil.name.includes('แอดบลู') ||
      selectedOil.viscosity.toLowerCase().includes('adblue') ||
      selectedOil.brand.toLowerCase().includes('adblue')
    : false;

  const quickAmounts = isAdBlueItem ? [10, 20, 25, 50, 100] : [1, 3.5, 4, 5, 10, 20, 50];

  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    if (!vId) return;

    const v = vehicles.find((item) => item.id === vId);
    if (v) {
      setRecipient(v.licensePlate);
      setCurrentMileage(v.currentMileage.toString());
      if (!referenceNote) {
        setReferenceNote(`${v.factory} (สาย ${v.route || '-'})`);
      }
    }
  };

  const selectedVehicleObj = vehicles.find(
    (v) => v.id === selectedVehicleId || (recipient && v.licensePlate === recipient.trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isAdmin) {
      setErrorMsg('คุณไม่มีสิทธิ์บันทึกการเบิก (สิทธิ์การบันทึก/แก้ไขจำกัดเฉพาะ chalermpat.korat1499@gmail.com เท่านั้น)');
      return;
    }

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
      setErrorMsg('กรุณาระบุทะเบียนรถ หรือผู้เบิก');
      return;
    }

    const mileageNum = currentMileage ? parseFloat(currentMileage) : undefined;
    const vehicleToLink = selectedVehicleObj;
    const finalPlate = vehicleToLink ? vehicleToLink.licensePlate : recipient.trim();
    const finalFactory = vehicleToLink ? vehicleToLink.factory : 'คลังส่วนกลาง';

    setLoading(true);
    try {
      // 1. Record Dispense Transaction in Stock System
      await recordDispense({
        oil: selectedOil,
        amount: amountNumber,
        recipientOrVehicle: `${finalPlate} (${finalFactory})`,
        currentMileage: mileageNum,
        referenceNote: isAdBlueItem
          ? `เติม AdBlue จาก ${adBluePercentBefore}% เป็น ${adBluePercentAfter}% | ${referenceNote || '-'}`
          : `${isFullOilChange && vehicleToLink ? '[เปลี่ยนถ่ายรอบใหม่ +20,000 กม.]' : '[เติมพร่อง/เบิกใช้งาน]'} ${referenceNote || ''}`,
        date: new Date(dispenseDate).toISOString(),
        performedBy: userName || 'ผู้ดูแลระบบ',
        vehicleId: vehicleToLink?.id,
      });

      // 2. LINK TO VEHICLE: If AdBlue, automatically create AdBlueRefillRecord
      if (isAdBlueItem) {
        await addAdBlueRefill(
          {
            record: {
              vehicleId: vehicleToLink?.id,
              licensePlate: finalPlate,
              factory: finalFactory,
              date: new Date(dispenseDate).toISOString(),
              percentBefore: parseFloat(adBluePercentBefore) || 0,
              percentAfter: parseFloat(adBluePercentAfter) || 100,
              litersFilled: amountNumber,
              filledBy: userName || 'ผู้ดูแลระบบ',
              currentMileage: mileageNum,
              notes: referenceNote || 'เบิกเติมผ่านหน้าเบิกสินค้า',
              deductedFromStock: false, // Already deducted above in recordDispense
              oilId: selectedOil.id,
              updatedBy: userName,
            },
            adBlueOilItem: null,
          },
          userName
        );

        // Update vehicle current mileage if provided and higher
        if (vehicleToLink && mileageNum && mileageNum > (vehicleToLink.currentMileage || 0)) {
          await updateVehicle(vehicleToLink.id, { currentMileage: mileageNum }, userName);
        }
      }

      // 3. LINK TO VEHICLE: If Engine Oil and user marked as full oil change, update vehicle service cycle
      if (!isAdBlueItem && vehicleToLink) {
        if (isFullOilChange && mileageNum && mileageNum > 0) {
          await recordOilChange(
            vehicleToLink.id,
            mileageNum,
            dispenseDate.slice(0, 10),
            userName
          );
        } else if (mileageNum && mileageNum > (vehicleToLink.currentMileage || 0)) {
          await updateVehicle(vehicleToLink.id, { currentMileage: mileageNum }, userName);
        }
      }

      setSuccessMsg(
        `เบิก ${selectedOil.name} (${selectedOil.viscosity}) จำนวน ${amountNumber} ลิตร ให้รถ ${finalPlate} เรียบร้อยแล้ว! ` +
        (isAdBlueItem
          ? `(บันทึกลงประวัติเติม AdBlue: ${adBluePercentBefore}% ➔ ${adBluePercentAfter}%)`
          : vehicleToLink && isFullOilChange
          ? `(อัปเดตรอบถ่ายน้ำมันเครื่องเป้าหมายใหม่เป็น ${(mileageNum! + 20000).toLocaleString('th-TH')} กม.)`
          : '')
      );

      // Reset
      setRecipient('');
      setSelectedVehicleId('');
      setCurrentMileage('');
      setReferenceNote('');
      setAmount(isAdBlueItem ? '20' : '4');
    } catch (err: any) {
      console.error('Error dispensing item:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกการเบิกสินค้า');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 rounded-2xl p-6 text-white shadow-md shadow-orange-500/10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-200 text-xs font-bold uppercase tracking-wider">
            <ArrowUpRight className="w-4 h-4" />
            <span>เบิกจ่ายสินค้า (ลิงก์เข้าประวัติถ่ายน้ำมันเครื่อง & AdBlue อัตโนมัติ)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            บันทึกการเบิกจ่ายสินค้า
          </h2>
          <p className="text-orange-100 text-xs sm:text-sm mt-1">
            เมื่อเบิกน้ำมันเครื่องสามารถอัปเดตรอบถ่าย 20,000 กม. ทันที และเมื่อเบิก AdBlue จะลงประวัติ %ก่อน/หลังเติม เข้าตารางรถอัตโนมัติ
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md hidden sm:flex items-center justify-center">
          <Package className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Permission Warning for Non-Admins */}
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">โหมดดูข้อมูลเท่านั้น (Read-Only)</p>
            <p className="text-xs text-amber-800 mt-0.5">
              คุณไม่ได้เข้าสู่ระบบด้วย <strong>chalermpat.korat1499@gmail.com</strong> จึงสามารถดูข้อมูลและสั่งพิมพ์รายงานได้เท่านั้น แต่ไม่สามารถบันทึกการเบิกจ่ายหรือแก้ไขข้อมูลได้
            </p>
          </div>
        </div>
      )}

      {/* Success Notification */}
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

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">ไม่สามารถทำรายการได้</h4>
            <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Choose Item (Oil or AdBlue) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-bold text-slate-700">
                เลือกสินค้าที่ต้องการเบิก <span className="text-red-500">*</span>
              </label>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterCategory === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({oils.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('oil');
                    const firstOil = oils.find(
                      (o) =>
                        !o.name.toLowerCase().includes('adblue') &&
                        !o.name.includes('แอดบลู') &&
                        !o.viscosity.toLowerCase().includes('adblue')
                    );
                    if (firstOil) setSelectedOilId(firstOil.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    filterCategory === 'oil'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🛢️ น้ำมันเครื่อง</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('adblue');
                    const firstAdBlue = oils.find(
                      (o) =>
                        o.name.toLowerCase().includes('adblue') ||
                        o.name.includes('แอดบลู') ||
                        o.viscosity.toLowerCase().includes('adblue')
                    );
                    if (firstAdBlue) {
                      setSelectedOilId(firstAdBlue.id);
                      setAmount('20');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    filterCategory === 'adblue'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>น้ำยา AdBlue</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {oils
                .filter((oil) => {
                  const isAdBlue =
                    oil.name.toLowerCase().includes('adblue') ||
                    oil.name.includes('แอดบลู') ||
                    oil.viscosity.toLowerCase().includes('adblue') ||
                    oil.brand.toLowerCase().includes('adblue');
                  if (filterCategory === 'oil') return !isAdBlue;
                  if (filterCategory === 'adblue') return isAdBlue;
                  return true;
                })
                .map((oil) => {
                const isSelected = selectedOilId === oil.id;
                const isOut = oil.currentStock <= 0;
                const isAdBlue =
                  oil.name.toLowerCase().includes('adblue') ||
                  oil.name.includes('แอดบลู') ||
                  oil.viscosity.toLowerCase().includes('adblue') ||
                  oil.brand.toLowerCase().includes('adblue');

                return (
                  <button
                    key={oil.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => {
                      setSelectedOilId(oil.id);
                      setErrorMsg(null);
                      if (isAdBlue && amountNumber < 10) {
                        setAmount('20');
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? isAdBlue
                          ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                          : 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20 shadow-xs'
                        : isOut
                        ? 'border-slate-200 bg-slate-50 opacity-40 cursor-not-allowed'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] font-bold text-slate-500">{oil.brand}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                        isAdBlue ? 'bg-teal-700 text-white' : 'bg-slate-900 text-white'
                      }`}>
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

          {/* Section 2: Selected Item Summary Box */}
          {selectedOil && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{selectedOil.name}</span>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                    isAdBlueItem ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedOil.viscosity}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  สต๊อกปัจจุบัน: <strong className="text-slate-800">{selectedOil.currentStock} ลิตร</strong> • ใช้ไปสะสม: {selectedOil.totalUsed || 0} ลิตร
                </p>
              </div>

              {/* Stock Preview */}
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

          {/* Section 3: Amount to Dispense */}
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

          {/* Section 4: Vehicle Selector (Linked directly to Fleet) */}
          <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-700" />
                <span>เลือกรถประจำโรงงาน (ดึงและซิงค์ข้อมูลกับหน้าประวัติถ่ายน้ำมันเครื่อง & AdBlue)</span>
              </label>
              {selectedVehicleId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVehicleId('');
                    setRecipient('');
                    setCurrentMileage('');
                  }}
                  className="text-[11px] text-indigo-700 underline font-medium cursor-pointer"
                >
                  ล้างการเลือก
                </button>
              )}
            </div>

            <select
              value={selectedVehicleId}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-indigo-300 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="">-- เลือกรถจากรายชื่อในระบบ หรือ กรอกทะเบียนเองด้านล่าง --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} ({v.factory} - {v.route || 'ทั่วไป'}) [ไมล์ปัจจุบัน: {v.currentMileage.toLocaleString('th-TH')} กม.]
                </option>
              ))}
            </select>
          </div>

          {/* Section 5: AdBlue Special Fields OR Engine Oil Service Cycle Option */}
          {isAdBlueItem ? (
            <div className="p-4 bg-teal-50/70 border border-teal-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                <Percent className="w-4 h-4 text-teal-700" />
                <span>ข้อมูลเฉพาะน้ำยา AdBlue (จะบันทึกลงชีตประวัติเติม AdBlue ให้โดยอัตโนมัติ)</span>
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
                      required={isAdBlueItem}
                      value={adBluePercentBefore}
                      onChange={(e) => setAdBluePercentBefore(e.target.value)}
                      placeholder="เช่น 15"
                      className="w-full px-3 py-2 text-sm font-bold border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white"
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
                      required={isAdBlueItem}
                      value={adBluePercentAfter}
                      onChange={(e) => setAdBluePercentAfter(e.target.value)}
                      placeholder="เช่น 100"
                      className="w-full px-3 py-2 text-sm font-bold border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedVehicleObj ? (
            <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-950">
                <input
                  type="checkbox"
                  checked={isFullOilChange}
                  onChange={(e) => setIsFullOilChange(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-700" />
                  <span>บันทึกเป็นการเปลี่ยนถ่ายน้ำมันเครื่องรอบใหม่ (+20,000 กม.) ของรถ {selectedVehicleObj.licensePlate}</span>
                </span>
              </label>
              <p className="text-[11px] text-amber-800 pl-6 leading-relaxed">
                {isFullOilChange && currentMileage && Number(currentMileage) > 0
                  ? `ระบบจะรีเซ็ตรอบถ่ายและตั้งเป้าหมายรอบถัดไปเป็น ${(Number(currentMileage) + 20000).toLocaleString('th-TH')} กม. ในหน้า "ประวัติถ่ายน้ำมันเครื่อง" อัตโนมัติ`
                  : 'หากไม่ได้ติ๊ก จะบันทึกเป็นการเติมพร่องระหว่างทาง โดยไม่รีเซ็ตรอบถ่าย 20,000 กม.'}
              </p>
            </div>
          ) : null}

          {/* Section 6: Recipient/Plate, Mileage, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ทะเบียนรถ / ผู้เบิก <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Car className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="เช่น 70-1122 กทม."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold"
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
                * ซิงค์กับเลขไมล์ในหน้าประวัติถ่ายน้ำมันเครื่อง
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
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              placeholder="เช่น เติมก่อนออกวิ่งระยะยาว หรือ เปลี่ยนถ่ายตามระยะประจำเดือน"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ผู้บันทึก: <strong>{userName || 'ผู้ดูแลระบบ'}</strong></span>
            </div>

            <button
              type="submit"
              disabled={loading || !isAdmin || !isStockSufficient || amountNumber <= 0}
              className={`px-6 py-2.5 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm ${
                !isAdmin
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-500/20 cursor-pointer disabled:opacity-50'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังตัดสต๊อกและอัปเดตข้อมูลรถ...</span>
                </>
              ) : !isAdmin ? (
                <span>เฉพาะ chalermpat.korat1499@gmail.com เท่านั้นที่บันทึกได้</span>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>ยืนยันการเบิก ({amountNumber} ลิตร) & อัปเดตข้อมูลรถ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
