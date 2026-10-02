import React, { useState } from 'react';
import { StockTransaction, OilItem } from '../types';
import {
  updateTransactionRecord,
  deleteTransactionRecord
} from '../services/stockService';
import { exportAllToExcel } from '../services/excelService';
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface HistoryTabProps {
  transactions: StockTransaction[];
  oils: OilItem[];
  userName: string;
  isAdmin?: boolean;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  transactions,
  oils,
  userName,
  isAdmin = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dispense' | 'receive'>('all');
  const [selectedOilFilter, setSelectedOilFilter] = useState<string>('all');

  // Edit Modal State
  const [editingTx, setEditingTx] = useState<StockTransaction | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editRecipient, setEditRecipient] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation State
  const [txToDelete, setTxToDelete] = useState<StockTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success Feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filtered transactions
  const filteredTxs = transactions.filter((tx) => {
    const matchesSearch =
      tx.oilName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.viscosity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.recipientOrVehicle && tx.recipientOrVehicle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.performedBy && tx.performedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.referenceNote && tx.referenceNote.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    const matchesOil = selectedOilFilter === 'all' || tx.oilId === selectedOilFilter;

    return matchesSearch && matchesType && matchesOil;
  });

  const handleOpenEdit = (tx: StockTransaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount.toString());
    setEditRecipient(tx.recipientOrVehicle || '');
    setEditNote(tx.referenceNote || '');
    setEditDate(() => {
      try {
        const d = new Date(tx.date);
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      } catch {
        return new Date().toISOString().slice(0, 16);
      }
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setEditError('จำนวนต้องเป็นตัวเลขมากกว่า 0 ลิตร');
      return;
    }

    if (!editRecipient.trim()) {
      setEditError('กรุณาระบุผู้เบิก / ทะเบียนรถ หรือ ซัพพลายเออร์');
      return;
    }

    setIsEditing(true);
    setEditError(null);

    try {
      await updateTransactionRecord(
        editingTx,
        {
          amount: amountNum,
          recipientOrVehicle: editRecipient.trim(),
          referenceNote: editNote.trim(),
          date: new Date(editDate).toISOString(),
          performedBy: userName || editingTx.performedBy,
        },
        userName
      );

      setFeedbackMsg(`แก้ไขรายการสำเร็จ และปรับสต๊อกน้ำมันเครื่องให้อัตโนมัติเรียบร้อย`);
      setEditingTx(null);
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      setEditError(err.message || 'บันทึกการแก้ไขไม่สำเร็จ');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTransactionRecord(txToDelete, userName);
      setFeedbackMsg(`ลบประวัติรายการสำเร็จ และคืน/ปรับยอดสต๊อกเรียบร้อยแล้ว`);
      setTxToDelete(null);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      setDeleteError(err.message || 'ลบรายการไม่สำเร็จ');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportExcel = () => {
    exportAllToExcel(oils, transactions, `ประวัติการเบิกจ่ายและรับเข้า_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Notice for Non-Admins */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-950 no-print text-xs sm:text-sm shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-bold">โหมดดูข้อมูลประวัติ (Read-Only)</p>
              <p className="text-xs text-amber-800">
                สิทธิ์การแก้ไขหรือลบประวัติสงวนสิทธิ์เฉพาะ <strong>chalermpat.korat1499@gmail.com</strong> เท่านั้น (ท่านสามารถค้นหา กรอง และส่งออก Excel ได้ตามปกติ)
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg font-bold text-xs whitespace-nowrap">
            ส่งออก Excel ได้
          </span>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              ประวัติการเบิกจ่ายและรับเข้า
            </h2>
            <p className="text-xs text-slate-500">
              ตรวจสอบย้อนหลังแบบละเอียด (น้ำมันเครื่อง & น้ำยาแอดบลู) • สามารถแก้ไขหรือลบรายการได้ พร้อมคำนวณปรับสต๊อกให้อัตโนมัติ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>ดาวน์โหลดประวัติเป็น Excel (.xlsx)</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาผู้เบิก, ทะเบียนรถ, ชื่อสินค้า, หมายเหตุ..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({transactions.length})
            </button>
            <button
              onClick={() => setTypeFilter('dispense')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'dispense'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-orange-700 hover:bg-orange-50'
              }`}
            >
              เฉพาะเบิกจ่าย
            </button>
            <button
              onClick={() => setTypeFilter('receive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'receive'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              เฉพาะรับเข้า
            </button>
          </div>

          <select
            value={selectedOilFilter}
            onChange={(e) => setSelectedOilFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">ทุกชนิดสินค้า</option>
            {oils.map((o) => (
              <option key={o.id} value={o.id}>
                {o.brand} {o.name} ({o.viscosity})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTxs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">ไม่พบประวัติการทำรายการ</p>
            <p className="text-xs text-slate-400 mt-0.5">ไม่มีข้อมูลที่ตรงกับตัวกรองที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3.5 px-4">วัน-เวลา</th>
                  <th className="py-3.5 px-3">ประเภท</th>
                  <th className="py-3.5 px-3">รายการสินค้า</th>
                  <th className="py-3.5 px-3 text-center">ความหนืด/เกรด</th>
                  <th className="py-3.5 px-3 text-right">จำนวน</th>
                  <th className="py-3.5 px-3 text-center">สต๊อกก่อน → หลัง</th>
                  <th className="py-3.5 px-3">ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์</th>
                  <th className="py-3.5 px-3 text-right">เลขไมล์ (กม.)</th>
                  <th className="py-3.5 px-3">ผู้บันทึก</th>
                  <th className="py-3.5 px-3">หมายเหตุ</th>
                  {isAdmin && <th className="py-3.5 px-4 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxs.map((tx) => {
                  const isDispense = tx.type === 'dispense';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                        {new Date(tx.date).toLocaleString('th-TH', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isDispense ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            เบิกจ่าย
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            รับเข้า
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {tx.oilName}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-slate-800 text-white rounded text-xs font-bold">
                          {tx.viscosity}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isDispense ? 'text-orange-600' : 'text-emerald-600'
                          }`}
                        >
                          {isDispense ? '-' : '+'}{tx.amount.toLocaleString('th-TH')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal ml-1">ลิตร</span>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap text-slate-500 text-xs">
                        <span>{tx.stockBefore}</span>
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-bold text-slate-800">{tx.stockAfter}</span> ลิตร
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-800 max-w-xs">
                        {tx.recipientOrVehicle || '-'}
                      </td>

                      <td className="py-3.5 px-3 text-right text-xs whitespace-nowrap font-bold text-slate-700">
                        {tx.currentMileage ? `${tx.currentMileage.toLocaleString('th-TH')} กม.` : '-'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 text-xs">
                        {tx.performedBy || '-'}
                      </td>

                      <td className="py-3.5 px-3 text-xs text-slate-500 max-w-xs truncate">
                        {tx.referenceNote || '-'}
                      </td>

                      {isAdmin && (
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(tx)}
                              title="แก้ไขข้อมูลรายการนี้"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTxToDelete(tx);
                                setDeleteError(null);
                              }}
                              title="ลบรายการนี้ (ระบบจะคืน/หักยอดสต๊อกให้อัตโนมัติ)"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                <h3 className="font-bold text-base">แก้ไขประวัติการทำรายการ</h3>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block font-semibold">สินค้า:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {editingTx.oilName} ({editingTx.viscosity})
                </span>
                <span className="block text-slate-500 mt-0.5">
                  ประเภท: <strong>{editingTx.type === 'dispense' ? 'เบิกจ่าย (-)' : 'รับเข้า (+)'}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  จำนวนลิตร (Liters) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * เมื่อแก้ไขจำนวน ระบบจะคำนวณปรับยอดคงเหลือในคลังให้อัตโนมัติ
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  วันและเวลา <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isEditing ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">ยืนยันการลบประวัติรายการ?</h4>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบรายการ{' '}
                <strong>
                  {txToDelete.type === 'dispense' ? 'เบิกจ่าย' : 'รับเข้า'} {txToDelete.amount} ลิตร
                </strong>{' '}
                ของสินค้า <strong>{txToDelete.oilName}</strong>
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 text-left mt-3">
                {txToDelete.type === 'dispense' ? (
                  <span>
                    ℹ️ การลบรายการเบิกจ่ายนี้ ระบบจะ<strong>คืนยอด {txToDelete.amount} ลิตร กลับเข้าสู่สต๊อก</strong>คงเหลืออัตโนมัติ
                  </span>
                ) : (
                  <span>
                    ⚠️ การลบรายการรับเข้านี้ ระบบจะ<strong>หักยอด {txToDelete.amount} ลิตร ออกจากสต๊อก</strong>คงเหลืออัตโนมัติ
                  </span>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบรายการ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
