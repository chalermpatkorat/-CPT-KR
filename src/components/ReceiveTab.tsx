import React, { useState, useEffect } from 'react';
import { OilItem } from '../types';
import { recordReceive } from '../services/stockService';
import {
  ArrowDownLeft,
  Droplets,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Truck,
  Plus
} from 'lucide-react';

interface ReceiveTabProps {
  oils: OilItem[];
  userName: string;
  preselectedOilId?: string | null;
  onOpenAddNewOil: () => void;
}

export const ReceiveTab: React.FC<ReceiveTabProps> = ({
  oils,
  userName,
  preselectedOilId,
  onOpenAddNewOil,
}) => {
  const [selectedOilId, setSelectedOilId] = useState<string>('');
  const [amount, setAmount] = useState<string>('50');
  const [supplier, setSupplier] = useState<string>('');
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [receiveDate, setReceiveDate] = useState<string>(() => {
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
      setSelectedOilId(oils[0].id);
    }
  }, [preselectedOilId, oils]);

  const selectedOil = oils.find((o) => o.id === selectedOilId);
  const amountNumber = parseFloat(amount) || 0;
  const stockAfterReceive = selectedOil
    ? Math.round((selectedOil.currentStock + amountNumber) * 100) / 100
    : 0;

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedOil) {
      setErrorMsg('กรุณาเลือกชนิดสินค้าที่รับเข้า');
      return;
    }

    if (amountNumber <= 0) {
      setErrorMsg('กรุณาระบุจำนวนลิตรที่รับเข้ามากกว่า 0');
      return;
    }

    if (!supplier.trim()) {
      setErrorMsg('กรุณาระบุผู้รับของ ซัพพลายเออร์ หรือร้านค้าที่นำส่ง');
      return;
    }

    setLoading(true);
    try {
      await recordReceive({
        oil: selectedOil,
        amount: amountNumber,
        supplierOrSource: supplier.trim(),
        referenceNote: referenceNote.trim(),
        date: new Date(receiveDate).toISOString(),
        performedBy: userName || 'สมาชิก',
      });

      setSuccessMsg(
        `รับเข้าสินค้า ${selectedOil.name} (${selectedOil.viscosity}) จำนวน ${amountNumber} ลิตร สำเร็จเรียบร้อย! สต๊อกใหม่คงเหลือ ${stockAfterReceive} ลิตร`
      );

      setSupplier('');
      setReferenceNote('');
      setAmount('50');
    } catch (err: any) {
      console.error('Error receiving item:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกการรับเข้าสินค้า');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 rounded-2xl p-6 text-white shadow-md shadow-emerald-500/10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <ArrowDownLeft className="w-4 h-4" />
            <span>รับเข้าสินค้า (น้ำมันเครื่อง & น้ำยาแอดบลู)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            บันทึกการรับเข้าสินค้า
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1">
            บันทึกยอดน้ำมันเครื่องหรือน้ำยาแอดบลูที่สั่งซื้อหรือรับเข้าคลัง เพื่อเพิ่มยอดคงเหลือและซิงค์ข้อมูลให้ทั้งทีม
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md hidden sm:flex items-center justify-center">
          <Droplets className="w-8 h-8 text-white" />
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-emerald-800 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">บันทึกการรับเข้าสำเร็จ!</h4>
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                เลือกสินค้าที่รับเข้า <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={onOpenAddNewOil}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มชนิดสินค้าใหม่</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {oils.map((oil) => {
                const isSelected = selectedOilId === oil.id;
                return (
                  <button
                    key={oil.id}
                    type="button"
                    onClick={() => {
                      setSelectedOilId(oil.id);
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
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
                      <span className="text-slate-500">คงเหลือเดิม:</span>
                      <span className="font-black text-slate-800">{oil.currentStock} ลิตร</span>
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
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                    {selectedOil.viscosity}
                  </span>
                  {selectedOil.oilType && (
                    <span className="text-xs text-slate-500">({selectedOil.oilType})</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  สต๊อกปัจจุบัน: <strong className="text-slate-800">{selectedOil.currentStock} ลิตร</strong> • รับเข้าสะสมเดิม: {selectedOil.totalReceived || 0} ลิตร
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">คงเหลือเดิม</span>
                  <span className="text-sm font-bold text-slate-700">{selectedOil.currentStock} ลิตร</span>
                </div>
                <div className="text-emerald-500 font-bold">+</div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">รับเข้า</span>
                  <span className="text-sm font-bold text-emerald-600">+{amountNumber} ลิตร</span>
                </div>
                <div className="text-slate-300 font-bold">=</div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">สต๊อกใหม่</span>
                  <span className="text-sm font-extrabold text-emerald-700">{stockAfterReceive} ลิตร</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              จำนวนลิตรที่รับเข้า <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q.toString())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    amountNumber === q
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  +{q} ลิตร
                </button>
              ))}
            </div>

            <div className="relative max-w-xs">
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ระบุจำนวนลิตร เช่น 200 (ถังดรัม)"
                className="w-full px-3.5 py-2.5 text-base font-bold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ลิตร
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ผู้รับของ / ซัพพลายเออร์ / ร้านค้าที่นำส่ง <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="เช่น บจก.ไทยออยล์ซัพพลาย หรือ คลังสินค้าศูนย์ใหญ่"
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                วันและเวลาที่รับเข้า <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมายเหตุ / เลขที่ล็อตผลิต / รายละเอียดเพิ่มเติม
            </label>
            <input
              type="text"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              placeholder="เช่น บรรจุถังดรัม 200 ลิตร ล็อตผลิต LOT-2026/09"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ผู้บันทึก: <strong>{userName || 'สมาชิก'}</strong></span>
            </div>

            <button
              type="submit"
              disabled={loading || amountNumber <= 0}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังบันทึกรับเข้า...</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>บันทึกรับเข้าสินค้า (+{amountNumber} ลิตร)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
