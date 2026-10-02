import React, { useState } from 'react';
import { OilItem } from '../types';
import { addOilItem, updateOilItem, deleteOilItem } from '../services/stockService';
import {
  Droplets,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  TrendingDown,
  TrendingUp,
  Boxes
} from 'lucide-react';

interface StockListTabProps {
  oils: OilItem[];
  userName: string;
  onQuickDispense: (oil: OilItem) => void;
  onQuickReceive: (oil: OilItem) => void;
}

export const StockListTab: React.FC<StockListTabProps> = ({
  oils,
  userName,
  onQuickDispense,
  onQuickReceive,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'low' | 'out'>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOil, setEditingOil] = useState<OilItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formViscosity, setFormViscosity] = useState('5W-30');
  const [formStock, setFormStock] = useState('50');
  const [formMinThreshold, setFormMinThreshold] = useState('20');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation State
  const [oilToDelete, setOilToDelete] = useState<OilItem | null>(null);

  // Unique Brands for Filter
  const uniqueBrands = Array.from(new Set(oils.map((o) => o.brand).filter(Boolean)));

  // Summary Metrics
  const totalStockLiters = oils.reduce((sum, o) => sum + (o.currentStock || 0), 0);
  const totalUsedLiters = oils.reduce((sum, o) => sum + (o.totalUsed || 0), 0);
  const totalReceivedLiters = oils.reduce((sum, o) => sum + (o.totalReceived || 0), 0);
  const lowOrOutCount = oils.filter((o) => o.currentStock <= o.minStockThreshold).length;

  // Filtered List
  const filteredOils = oils.filter((oil) => {
    const matchesSearch =
      oil.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      oil.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      oil.viscosity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (oil.notes && oil.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesBrand =
      brandFilter === 'all' || oil.brand === brandFilter;

    let matchesStatus = true;
    if (statusFilter === 'normal') {
      matchesStatus = oil.currentStock > oil.minStockThreshold;
    } else if (statusFilter === 'low') {
      matchesStatus = oil.currentStock > 0 && oil.currentStock <= oil.minStockThreshold;
    } else if (statusFilter === 'out') {
      matchesStatus = oil.currentStock <= 0;
    }

    return matchesSearch && matchesBrand && matchesStatus;
  });

  const openAddModal = () => {
    setEditingOil(null);
    setFormName('');
    setFormBrand('');
    setFormViscosity('5W-30');
    setFormStock('50');
    setFormMinThreshold('20');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (oil: OilItem) => {
    setEditingOil(oil);
    setFormName(oil.name);
    setFormBrand(oil.brand);
    setFormViscosity(oil.viscosity);
    setFormStock(oil.currentStock.toString());
    setFormMinThreshold(oil.minStockThreshold.toString());
    setFormNotes(oil.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveOil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBrand.trim()) {
      setFormError('กรุณากรอกชื่อน้ำมันเครื่องและยี่ห้อ');
      return;
    }

    const currentStockNum = parseFloat(formStock);
    const minThresholdNum = parseFloat(formMinThreshold);

    if (isNaN(currentStockNum) || currentStockNum < 0) {
      setFormError('จำนวนสต๊อกต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingOil) {
        await updateOilItem(
          editingOil.id,
          {
            name: formName.trim(),
            brand: formBrand.trim(),
            viscosity: formViscosity.trim(),
            currentStock: currentStockNum,
            minStockThreshold: isNaN(minThresholdNum) ? 10 : minThresholdNum,
            notes: formNotes.trim(),
          },
          userName
        );
      } else {
        await addOilItem(
          {
            name: formName.trim(),
            brand: formBrand.trim(),
            viscosity: formViscosity.trim(),
            currentStock: currentStockNum,
            totalUsed: 0,
            totalReceived: currentStockNum,
            minStockThreshold: isNaN(minThresholdNum) ? 10 : minThresholdNum,
            unit: 'ลิตร',
            notes: formNotes.trim(),
            updatedBy: userName,
          },
          userName
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving oil:', err);
      setFormError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!oilToDelete) return;
    try {
      await deleteOilItem(oilToDelete.id);
      setOilToDelete(null);
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              สต๊อกคงเหลือรวมทั้งหมด
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                {totalStockLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-semibold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">จากทั้งหมด {oils.length} รายการสินค้า</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Total Used */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ใช้ไปแล้วสะสม (เบิกจ่าย)
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-orange-600">
                {totalUsedLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-semibold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-orange-500 font-medium mt-1 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>เบิกใช้งานไปแล้ว</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Total Received */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              รับเข้าสะสม
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {totalReceivedLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-semibold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>ยอดนำเข้าทั้งหมด</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ต้องสั่งซื้อเพิ่ม / หมดสต๊อก
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span
                className={`text-2xl sm:text-3xl font-extrabold ${
                  lowOrOutCount > 0 ? 'text-red-600' : 'text-slate-800'
                }`}
              >
                {lowOrOutCount}
              </span>
              <span className="text-sm font-semibold text-slate-600">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {lowOrOutCount > 0 ? 'ต่ำกว่าจุดเตือนขั้นต่ำ' : 'สต๊อกอยู่ในเกณฑ์ปกติ'}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              lowOrOutCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Add Button */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า, ยี่ห้อ, ความหนืด/เกรด (เช่น 5W-30, AdBlue)..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
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

          {/* Brand Filter */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">ทุกยี่ห้อ (Brand)</option>
            {uniqueBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="normal">สต๊อกปกติ</option>
            <option value="low">ใกล้หมดสต๊อก</option>
            <option value="out">หมดสต๊อก (0 ลิตร)</option>
          </select>
        </div>

        {/* Add New Product Button */}
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-amber-500/20 transition cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มข้อมูลสินค้าใหม่</span>
        </button>
      </div>

      {/* Stock Cards Grid */}
      {filteredOils.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
          <Droplets className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-700">ไม่พบรายการสินค้า</h4>
          <p className="text-xs text-slate-500 mt-1">
            ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มข้อมูลสินค้าใหม่" เพื่อสร้างรายการใหม่
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOils.map((oil) => {
            const isOut = oil.currentStock <= 0;
            const isLow = !isOut && oil.currentStock <= oil.minStockThreshold;

            const maxRef = Math.max(oil.totalReceived || 100, oil.currentStock * 1.5, 100);
            const stockPercent = Math.min(100, Math.round((oil.currentStock / maxRef) * 100));

            return (
              <div
                key={oil.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isOut
                    ? 'border-red-300 ring-1 ring-red-100'
                    : isLow
                    ? 'border-amber-300 ring-1 ring-amber-100'
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar: Brand, Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                        {oil.brand}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                        {oil.name}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        หมดสต๊อก
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        ใกล้หมด
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        ปกติ
                      </span>
                    )}
                  </div>

                  {/* Viscosity Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-extrabold tracking-wide shadow-xs">
                      {oil.viscosity}
                    </span>
                    {oil.oilType && (
                      <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                        {oil.oilType}
                      </span>
                    )}
                  </div>

                  {/* Stock Quantity Gauge Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">คงเหลือปัจจุบัน</span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {oil.currentStock.toLocaleString('th-TH')}
                        </span>
                        <span className="text-xs font-bold text-slate-500">ลิตร</span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOut ? 'bg-red-500 w-0' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(4, stockPercent)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>ใช้ไปแล้ว: <strong className="text-slate-700">{oil.totalUsed || 0} ลิตร</strong></span>
                      <span>จุดเตือน: <strong className="text-amber-700">{oil.minStockThreshold} ลิตร</strong></span>
                    </div>
                  </div>

                  {oil.notes && (
                    <p className="text-xs text-slate-500 line-clamp-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      "{oil.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onQuickDispense(oil)}
                      disabled={isOut}
                      title="เบิกน้ำมันชนิดนี้ทันที"
                      className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>เบิก</span>
                    </button>
                    <button
                      onClick={() => onQuickReceive(oil)}
                      title="รับเข้าน้ำมันชนิดนี้ทันที"
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>รับเข้า</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(oil)}
                      title="แก้ไขข้อมูลน้ำมันเครื่อง"
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-white rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setOilToDelete(oil)}
                      title="ลบข้อมูล"
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Oil Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Droplets className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingOil ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มข้อมูลสินค้าใหม่ (น้ำมันเครื่อง / AdBlue)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOil} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อสินค้า / รุ่น <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น EDGE Professional, Helix Ultra หรือ AdBlue ถัง 1,000L"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยี่ห้อ (Brand) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="เช่น Castrol, Shell, PTT, AdBlue ISO 22241"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์ความหนืด / เกรด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formViscosity}
                    onChange={(e) => setFormViscosity(e.target.value)}
                    placeholder="เช่น 5W-30, 10W-40, AdBlue 32.5%"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนสต๊อกคงเหลือ (ลิตร) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จุดเตือนใกล้หมด (ลิตร) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    placeholder="เช่น 20"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / คุณสมบัติการใช้งาน
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="เช่น เหมาะสำหรับเครื่องยนต์ดีเซลคอมมอนเรล หรือ รถยนต์อีโคคาร์"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? 'กำลังบันทึก...' : editingOil ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {oilToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">ยืนยันการลบรายการสินค้า?</h4>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบ <strong>{oilToDelete.name} ({oilToDelete.viscosity})</strong> ออกจากระบบสต๊อก
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOilToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
