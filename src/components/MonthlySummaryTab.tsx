import React, { useState } from 'react';
import { OilItem, StockTransaction, AdBlueRefillRecord, Vehicle, FactoryItem } from '../types';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Droplets,
  Printer,
  Download,
  Building2,
  TrendingDown,
  BarChart3,
  Truck,
  Sparkles,
  ArrowUpRight,
  Percent,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { deleteTransactionsForVehicleInMonth } from '../services/stockService';
import { deleteAdBlueRefillsForVehicleInMonth } from '../services/adblueService';

interface MonthlySummaryTabProps {
  oils: OilItem[];
  transactions: StockTransaction[];
  adBlueRefills: AdBlueRefillRecord[];
  vehicles: Vehicle[];
  factories: FactoryItem[];
  userName: string;
  isAdmin?: boolean;
}

const CLEARED_VEHICLE_MONTHS_KEY = 'cpt_cleared_vehicle_months';

export const MonthlySummaryTab: React.FC<MonthlySummaryTabProps> = ({
  transactions,
  adBlueRefills,
  vehicles,
  userName,
  isAdmin = false,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
  );
  const [factoryFilter, setFactoryFilter] = useState<string>('all');

  // Deletion modal state for vehicle usage in this month
  const [vehicleToDeleteUsage, setVehicleToDeleteUsage] = useState<{
    licensePlate: string;
    factory: string;
    engineOilLiters: number;
    engineOilCount: number;
    adBlueLiters: number;
    adBlueCount: number;
  } | null>(null);
  const [isDeletingUsage, setIsDeletingUsage] = useState(false);
  const [deleteUsageError, setDeleteUsageError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Cleared vehicles set
  const [clearedVehicleMonths, setClearedVehicleMonths] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(CLEARED_VEHICLE_MONTHS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // Ignore
    }
    return new Set();
  });

  const monthNamesThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Helper to test if a transaction is AdBlue or Engine Oil
  const isAdBlueTransaction = (tx: StockTransaction) => {
    const text = `${tx.oilName} ${tx.viscosity} ${tx.referenceNote || ''}`.toLowerCase();
    return text.includes('adblue') || text.includes('แอดบลู') || text.includes('def');
  };

  // Helper to extract YYYY-MM from transaction or refill date
  const getYearMonth = (dateStr: string) => {
    try {
      return dateStr.slice(0, 7);
    } catch {
      return '';
    }
  };

  // 1. Calculate Monthly Breakdown for the selected Year (All 12 Months)
  const monthsData = monthNamesThai.map((monthName, idx) => {
    const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;

    // Dispense transactions in this month
    const monthTxs = transactions.filter(
      (tx) => tx.type === 'dispense' && getYearMonth(tx.date) === monthKey
    );

    // Engine oil dispenses (excluding AdBlue)
    const engineOilTxs = monthTxs.filter((tx) => !isAdBlueTransaction(tx));
    const engineOilLiters = engineOilTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // AdBlue refills in this month from adBlueRefills dataset
    const monthAdBlueRefills = adBlueRefills.filter(
      (r) => getYearMonth(r.date) === monthKey
    );
    const adBlueRefillLiters = monthAdBlueRefills.reduce((sum, r) => sum + (r.litersFilled || 0), 0);

    // Also check if any AdBlue dispenses in stock transactions not in adBlueRefills
    const adBlueTxLiters = monthTxs
      .filter((tx) => isAdBlueTransaction(tx))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Take max or combine to ensure complete reporting
    const finalAdBlueLiters = Math.max(adBlueRefillLiters, adBlueTxLiters);

    return {
      monthKey,
      monthName,
      monthNumber: idx + 1,
      engineOilLiters: Math.round(engineOilLiters * 10) / 10,
      engineOilTxCount: engineOilTxs.length,
      adBlueLiters: Math.round(finalAdBlueLiters * 10) / 10,
      adBlueRefillCount: Math.max(monthAdBlueRefills.length, monthTxs.filter((tx) => isAdBlueTransaction(tx)).length),
    };
  });

  // Annual Totals
  const annualEngineOilLiters = monthsData.reduce((sum, m) => sum + m.engineOilLiters, 0);
  const annualAdBlueLiters = monthsData.reduce((sum, m) => sum + m.adBlueLiters, 0);
  const annualTotalLiters = annualEngineOilLiters + annualAdBlueLiters;

  // 2. Data for the specifically selected Month
  const currentMonthData = monthsData.find((m) => m.monthKey === selectedMonth) || {
    monthKey: selectedMonth,
    monthName: monthNamesThai[parseInt(selectedMonth.slice(5, 7), 10) - 1] || selectedMonth,
    engineOilLiters: 0,
    engineOilTxCount: 0,
    adBlueLiters: 0,
    adBlueRefillCount: 0,
  };

  // 3. Vehicle Usage Breakdown for the selected Month
  const vehicleUsageMap: {
    [licensePlate: string]: {
      licensePlate: string;
      factory: string;
      engineOilLiters: number;
      engineOilCount: number;
      adBlueLiters: number;
      adBlueCount: number;
    };
  } = {};

  // Populate from vehicles list
  vehicles.forEach((v) => {
    vehicleUsageMap[v.licensePlate] = {
      licensePlate: v.licensePlate,
      factory: v.factory,
      engineOilLiters: 0,
      engineOilCount: 0,
      adBlueLiters: 0,
      adBlueCount: 0,
    };
  });

  // Add Engine oil dispenses for selected month
  transactions
    .filter((tx) => tx.type === 'dispense' && getYearMonth(tx.date) === selectedMonth)
    .forEach((tx) => {
      const isAdBlue = isAdBlueTransaction(tx);
      // match plate in recipientOrVehicle
      const plate = vehicles.find((v) => tx.recipientOrVehicle?.includes(v.licensePlate))?.licensePlate ||
        (tx.recipientOrVehicle ? tx.recipientOrVehicle.split(' ')[0] : 'อื่นๆ');

      if (!vehicleUsageMap[plate]) {
        vehicleUsageMap[plate] = {
          licensePlate: plate,
          factory: 'ไม่ระบุ',
          engineOilLiters: 0,
          engineOilCount: 0,
          adBlueLiters: 0,
          adBlueCount: 0,
        };
      }

      if (isAdBlue) {
        vehicleUsageMap[plate].adBlueLiters += tx.amount || 0;
        vehicleUsageMap[plate].adBlueCount += 1;
      } else {
        vehicleUsageMap[plate].engineOilLiters += tx.amount || 0;
        vehicleUsageMap[plate].engineOilCount += 1;
      }
    });

  // Add AdBlue refills for selected month
  adBlueRefills
    .filter((r) => getYearMonth(r.date) === selectedMonth)
    .forEach((r) => {
      const plate = r.licensePlate;
      if (!vehicleUsageMap[plate]) {
        vehicleUsageMap[plate] = {
          licensePlate: plate,
          factory: r.factory,
          engineOilLiters: 0,
          engineOilCount: 0,
          adBlueLiters: 0,
          adBlueCount: 0,
        };
      }
      // Avoid double counting if already added from transaction
      if (vehicleUsageMap[plate].adBlueLiters === 0) {
        vehicleUsageMap[plate].adBlueLiters += r.litersFilled || 0;
        vehicleUsageMap[plate].adBlueCount += 1;
      }
    });

  // Filter vehicle breakdown by factory and exclude cleared records
  const vehicleList = Object.values(vehicleUsageMap)
    .filter((item) => {
      const key = `${selectedMonth}_${item.licensePlate.trim().toLowerCase()}`;
      return !clearedVehicleMonths.has(key);
    })
    .filter((item) => factoryFilter === 'all' || item.factory === factoryFilter)
    .filter((item) => item.engineOilLiters > 0 || item.adBlueLiters > 0)
    .sort((a, b) => b.engineOilLiters + b.adBlueLiters - (a.engineOilLiters + a.adBlueLiters));

  // Confirm delete vehicle usage for the selected month
  const handleConfirmDeleteVehicleUsage = async () => {
    if (!vehicleToDeleteUsage) return;
    setIsDeletingUsage(true);
    setDeleteUsageError(null);

    const plate = vehicleToDeleteUsage.licensePlate;

    try {
      // 1. Delete all dispense transactions for this vehicle in this month (restoring stock)
      const deletedTxsCount = await deleteTransactionsForVehicleInMonth(plate, selectedMonth, userName);

      // 2. Delete all AdBlue refills for this vehicle in this month
      const deletedAdBlueCount = await deleteAdBlueRefillsForVehicleInMonth(plate, selectedMonth, userName);

      // 3. Persist in clearedVehicleMonths
      const key = `${selectedMonth}_${plate.trim().toLowerCase()}`;
      const updatedCleared = new Set(clearedVehicleMonths);
      updatedCleared.add(key);
      setClearedVehicleMonths(updatedCleared);
      try {
        localStorage.setItem(CLEARED_VEHICLE_MONTHS_KEY, JSON.stringify(Array.from(updatedCleared)));
      } catch {
        // Ignore
      }

      setSuccessToast(
        `ลบประวัติยอดการใช้ของรถ ${plate} ประจำเดือน ${currentMonthData.monthName} เรียบร้อยแล้ว ` +
        (deletedTxsCount > 0 ? `(ลบรายการเบิก ${deletedTxsCount} รายการ และปรับคืนสต๊อกเข้าคลังอัตโนมัติ)` : '') +
        (deletedAdBlueCount > 0 ? ` [ลบบันทึก AdBlue ${deletedAdBlueCount} รายการ]` : '')
      );
      setVehicleToDeleteUsage(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Error deleting vehicle usage in month:', err);
      setDeleteUsageError(err.message || 'ไม่สามารถลบประวัติการใช้ได้');
    } finally {
      setIsDeletingUsage(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    // 1. Sheet: Monthly Breakdown 12 months
    const monthlySheetData = monthsData.map((m) => ({
      'เดือน': m.monthName,
      'ปี พ.ศ.': selectedYear + 543,
      'การใช้น้ำมันเครื่อง (ลิตร)': m.engineOilLiters,
      'จำนวนครั้งที่เบิกน้ำมันเครื่อง': m.engineOilTxCount,
      'การใช้น้ำยาบำบัดไอเสีย AdBlue (ลิตร)': m.adBlueLiters,
      'จำนวนครั้งที่เติม AdBlue': m.adBlueRefillCount,
      'รวมปริมาณทั้งหมด (ลิตร)': Math.round((m.engineOilLiters + m.adBlueLiters) * 10) / 10,
    }));

    // 2. Sheet: Vehicle Breakdown for the selected month
    const vehicleSheetData = vehicleList.map((v, idx) => ({
      'ลำดับ': idx + 1,
      'ทะเบียนรถ': v.licensePlate,
      'โรงงาน': v.factory,
      'น้ำมันเครื่องที่ใช้ (ลิตร)': v.engineOilLiters,
      'จำนวนครั้งเบิกน้ำมัน': v.engineOilCount,
      'น้ำยา AdBlue ที่เติม (ลิตร)': v.adBlueLiters,
      'จำนวนครั้งเติม AdBlue': v.adBlueCount,
      'รวมทั้งหมด (ลิตร)': Math.round((v.engineOilLiters + v.adBlueLiters) * 10) / 10,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(monthlySheetData);
    const ws2 = XLSX.utils.json_to_sheet(vehicleSheetData);

    XLSX.utils.book_append_sheet(wb, ws1, `สรุปรายเดือน_${selectedYear + 543}`);
    XLSX.utils.book_append_sheet(wb, ws2, `จำแนกตามรถ_${currentMonthData.monthName}`);

    XLSX.writeFile(wb, `รายงานสรุปการใช้น้ำมันเครื่องและAdBlue_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 no-print text-xs sm:text-sm font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner with Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>รายงานสรุปรายเดือน • น้ำยาบำบัดไอเสีย AdBlue และ น้ำมันเครื่อง</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            สรุปการใช้น้ำมันเครื่อง & น้ำยาแอดบลู ทุกเดือน
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            เปรียบเทียบการเบิกจ่ายน้ำมันเครื่องและการเติมน้ำยาบำบัดไอเสีย AdBlue ของทุกเดือน พร้อมส่งออก Excel และสั่งพิมพ์รายงาน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              setSelectedYear(y);
              setSelectedMonth(`${y}-${selectedMonth.slice(5, 7)}`);
            }}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs sm:text-sm border border-white/20 outline-none cursor-pointer"
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y} className="text-slate-900">
                ปี พ.ศ. {y + 543} ({y})
              </option>
            ))}
          </select>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs sm:text-sm border border-white/20 outline-none cursor-pointer"
          >
            {monthNamesThai.map((name, idx) => {
              const key = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
              return (
                <option key={key} value={key} className="text-slate-900">
                  เดือน {name}
                </option>
              );
            })}
          </select>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์รายงาน (Print)</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Highlights for the Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Card 1: Engine Oil for this month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              การใช้น้ำมันเครื่อง (เดือน{currentMonthData.monthName})
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-600">
                {currentMonthData.engineOilLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-bold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              เบิกใช้งาน {currentMonthData.engineOilTxCount} ครั้ง
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Droplets className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: AdBlue for this month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              การใช้ AdBlue (เดือน{currentMonthData.monthName})
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-black text-teal-600">
                {currentMonthData.adBlueLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-bold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-teal-600 font-medium mt-1">
              เติมสารบำบัด {currentMonthData.adBlueRefillCount} ครั้ง
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Annual Engine Oil Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              น้ำมันเครื่องรวมทั้งปี ({selectedYear + 543})
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-orange-600">
                {annualEngineOilLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-bold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">สะสม 12 เดือน</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Annual AdBlue Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              AdBlue รวมทั้งปี ({selectedYear + 543})
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {annualAdBlueLiters.toLocaleString('th-TH')}
              </span>
              <span className="text-sm font-bold text-slate-600">ลิตร</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">สะสม 12 เดือน</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SECTION 1: 12-Month Table Breakdown for the Year */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>ตารางเปรียบเทียบการใช้งานทุกเดือน ประจำปี พ.ศ. {selectedYear + 543}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              สรุปยอดการใช้น้ำมันเครื่อง vs น้ำยาบำบัดไอเสีย AdBlue รายเดือน (มกราคม - ธันวาคม)
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">
            ยอดใช้รวมทั้งปี: {annualTotalLiters.toLocaleString('th-TH')} ลิตร
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-3 px-4">เดือน</th>
                <th className="py-3 px-3 text-right text-amber-700 bg-amber-50/40">น้ำมันเครื่อง (ลิตร)</th>
                <th className="py-3 px-3 text-center">ครั้งที่เบิก</th>
                <th className="py-3 px-3 text-right text-teal-700 bg-teal-50/40">น้ำยา AdBlue (ลิตร)</th>
                <th className="py-3 px-3 text-center">ครั้งที่เติม</th>
                <th className="py-3 px-3 text-right">รวมปริมาณทั้งสิ้น (ลิตร)</th>
                <th className="py-3 px-4 text-center">สัดส่วนการใช้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthsData.map((m) => {
                const totalMonth = m.engineOilLiters + m.adBlueLiters;
                const isSelected = m.monthKey === selectedMonth;

                return (
                  <tr
                    key={m.monthKey}
                    onClick={() => setSelectedMonth(m.monthKey)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 font-bold ring-1 ring-indigo-200'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                      {m.monthName}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-amber-700 bg-amber-50/20 whitespace-nowrap">
                      {m.engineOilLiters > 0 ? `${m.engineOilLiters.toLocaleString('th-TH')} ลิตร` : '-'}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-600 font-medium">
                      {m.engineOilTxCount > 0 ? `${m.engineOilTxCount} ครั้ง` : '-'}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-teal-700 bg-teal-50/20 whitespace-nowrap">
                      {m.adBlueLiters > 0 ? `${m.adBlueLiters.toLocaleString('th-TH')} ลิตร` : '-'}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-600 font-medium">
                      {m.adBlueRefillCount > 0 ? `${m.adBlueRefillCount} ครั้ง` : '-'}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                      {totalMonth > 0 ? `${totalMonth.toLocaleString('th-TH')} ลิตร` : '-'}
                    </td>

                    {/* Progress Ratio Bar */}
                    <td className="py-3 px-4">
                      {totalMonth > 0 ? (
                        <div className="w-28 mx-auto space-y-1">
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                            <div
                              className="bg-amber-500 h-full"
                              style={{ width: `${(m.engineOilLiters / totalMonth) * 100}%` }}
                              title={`น้ำมันเครื่อง: ${Math.round((m.engineOilLiters / totalMonth) * 100)}%`}
                            ></div>
                            <div
                              className="bg-teal-500 h-full"
                              style={{ width: `${(m.adBlueLiters / totalMonth) * 100}%` }}
                              title={`AdBlue: ${Math.round((m.adBlueLiters / totalMonth) * 100)}%`}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400">
                            <span className="text-amber-600">น้ำมัน</span>
                            <span className="text-teal-600">AdBlue</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 block text-center">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td className="py-3.5 px-4 font-black">
                  รวมทั้งปี พ.ศ. {selectedYear + 543}:
                </td>
                <td className="py-3.5 px-3 text-right font-black text-amber-800">
                  {annualEngineOilLiters.toLocaleString('th-TH')} ลิตร
                </td>
                <td className="py-3.5 px-3 text-center text-xs text-slate-500">
                  {monthsData.reduce((sum, m) => sum + m.engineOilTxCount, 0)} ครั้ง
                </td>
                <td className="py-3.5 px-3 text-right font-black text-teal-800">
                  {annualAdBlueLiters.toLocaleString('th-TH')} ลิตร
                </td>
                <td className="py-3.5 px-3 text-center text-xs text-slate-500">
                  {monthsData.reduce((sum, m) => sum + m.adBlueRefillCount, 0)} ครั้ง
                </td>
                <td className="py-3.5 px-3 text-right font-black text-slate-900">
                  {annualTotalLiters.toLocaleString('th-TH')} ลิตร
                </td>
                <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                  ครบทั้ง 12 เดือน
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 2: Vehicle Usage Breakdown for Selected Month */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <span>ยอดการใช้จำแนกตามรถ ประจำเดือน {currentMonthData.monthName}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบและจัดการปริมาณน้ำมันเครื่องและ AdBlue ที่รถแต่ละคันเบิกใช้ในเดือนนี้ • สามารถลบประวัติการใช้รายคันได้
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">กรองโรงงาน:</span>
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 outline-none"
            >
              <option value="all">ทุกโรงงาน</option>
              {Array.from(new Set(vehicles.map((v) => v.factory))).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {vehicleList.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-bold">ไม่มีรายการเบิกน้ำมันเครื่องหรือ AdBlue ในเดือน {currentMonthData.monthName}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                  <th className="py-3 px-3">ทะเบียนรถ</th>
                  <th className="py-3 px-3">โรงงาน</th>
                  <th className="py-3 px-3 text-right text-amber-700 bg-amber-50/40">น้ำมันเครื่อง (ลิตร)</th>
                  <th className="py-3 px-3 text-center">จำนวนครั้ง</th>
                  <th className="py-3 px-3 text-right text-teal-700 bg-teal-50/40">น้ำยา AdBlue (ลิตร)</th>
                  <th className="py-3 px-3 text-center">จำนวนครั้ง</th>
                  <th className="py-3 px-4 text-right">รวมที่ใช้ (ลิตร)</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleList.map((v, idx) => {
                  const total = v.engineOilLiters + v.adBlueLiters;
                  return (
                    <tr key={v.licensePlate} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">{v.licensePlate}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">{v.factory}</td>
                      <td className="py-3 px-3 text-right font-black text-amber-700 bg-amber-50/20">
                        {v.engineOilLiters > 0 ? `${v.engineOilLiters.toLocaleString('th-TH')} ลิตร` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">
                        {v.engineOilCount > 0 ? `${v.engineOilCount} ครั้ง` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-teal-700 bg-teal-50/20">
                        {v.adBlueLiters > 0 ? `${v.adBlueLiters.toLocaleString('th-TH')} ลิตร` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">
                        {v.adBlueCount > 0 ? `${v.adBlueCount} ครั้ง` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {total > 0 ? `${total.toLocaleString('th-TH')} ลิตร` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setVehicleToDeleteUsage(v);
                            setDeleteUsageError(null);
                          }}
                          title={`ลบประวัติยอดการใช้ของรถ ${v.licensePlate} ประจำเดือน ${currentMonthData.monthName}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Vehicle Month Usage Confirmation Modal */}
      {vehicleToDeleteUsage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">
                ยืนยันการลบประวัติยอดการใช้ประจำเดือน?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบประวัติการใช้ของรถ{' '}
                <strong className="text-slate-900 font-extrabold">{vehicleToDeleteUsage.licensePlate}</strong>{' '}
                ({vehicleToDeleteUsage.factory}) ประจำเดือน{' '}
                <strong className="text-indigo-700">{currentMonthData.monthName} {selectedYear + 543}</strong>
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700">
                <span>น้ำมันเครื่องที่ใช้:</span>
                <span className="font-bold text-amber-700">
                  {vehicleToDeleteUsage.engineOilLiters} ลิตร ({vehicleToDeleteUsage.engineOilCount} ครั้ง)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>น้ำยา AdBlue ที่เติม:</span>
                <span className="font-bold text-teal-700">
                  {vehicleToDeleteUsage.adBlueLiters} ลิตร ({vehicleToDeleteUsage.adBlueCount} ครั้ง)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>รวมทั้งหมด:</span>
                <span className="text-sm">
                  {vehicleToDeleteUsage.engineOilLiters + vehicleToDeleteUsage.adBlueLiters} ลิตร
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>ผลกระทบของการลบ:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                • ระบบจะลบรายการเบิกและเติมทั้งหมดของรถคันนี้ในเดือนนี้
                <br />
                • <strong>คืนยอดน้ำมันเครื่อง {vehicleToDeleteUsage.engineOilLiters} ลิตร</strong> กลับเข้าสู่สต๊อกคลังอัตโนมัติ
                <br />
                • รถคันนี้จะไม่แสดงในตารางสรุปยอดการใช้ประจำเดือนนี้อีกต่อไป
              </p>
            </div>

            {deleteUsageError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {deleteUsageError}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVehicleToDeleteUsage(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingUsage}
                onClick={handleConfirmDeleteVehicleUsage}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeletingUsage ? 'กำลังลบและปรับสต๊อก...' : 'ยืนยันลบประวัติการใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY FORMAL REPORT */}
      <div className="hidden print:block print-container font-sans text-slate-900 p-6 space-y-4">
        <div className="border-b-2 border-slate-900 pb-3 text-center">
          <h1 className="text-xl font-black">บริษัท ซีพีที โคราช จำกัด (CPT KORAT CO., LTD.)</h1>
          <h2 className="text-base font-bold text-slate-800 mt-1">
            รายงานสรุปการใช้น้ำมันเครื่องและน้ำยาบำบัดไอเสีย AdBlue ประจำปี พ.ศ. {selectedYear + 543}
          </h2>
          <div className="flex justify-center gap-6 text-xs text-slate-600 mt-1">
            <span>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')}</span>
            <span>ผู้จัดทำ: {userName}</span>
          </div>
        </div>

        <table className="w-full text-left text-[11px] border-collapse border border-slate-300 print-table">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-300">
              <th className="p-2 border border-slate-300">เดือน</th>
              <th className="p-2 text-right border border-slate-300">น้ำมันเครื่อง (ลิตร)</th>
              <th className="p-2 text-center border border-slate-300">ครั้งที่เบิก</th>
              <th className="p-2 text-right border border-slate-300">น้ำยา AdBlue (ลิตร)</th>
              <th className="p-2 text-center border border-slate-300">ครั้งที่เติม</th>
              <th className="p-2 text-right border border-slate-300">รวมทั้งหมด (ลิตร)</th>
            </tr>
          </thead>
          <tbody>
            {monthsData.map((m) => (
              <tr key={m.monthKey}>
                <td className="p-1.5 border border-slate-300 font-bold">{m.monthName}</td>
                <td className="p-1.5 border border-slate-300 text-right">{m.engineOilLiters.toLocaleString('th-TH')}</td>
                <td className="p-1.5 border border-slate-300 text-center">{m.engineOilTxCount}</td>
                <td className="p-1.5 border border-slate-300 text-right">{m.adBlueLiters.toLocaleString('th-TH')}</td>
                <td className="p-1.5 border border-slate-300 text-center">{m.adBlueRefillCount}</td>
                <td className="p-1.5 border border-slate-300 text-right font-bold">
                  {(m.engineOilLiters + m.adBlueLiters).toLocaleString('th-TH')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
              <td className="p-2 border border-slate-300">รวมทั้งปี พ.ศ. {selectedYear + 543}</td>
              <td className="p-2 border border-slate-300 text-right">{annualEngineOilLiters.toLocaleString('th-TH')} ลิตร</td>
              <td className="p-2 border border-slate-300 text-center">-</td>
              <td className="p-2 border border-slate-300 text-right">{annualAdBlueLiters.toLocaleString('th-TH')} ลิตร</td>
              <td className="p-2 border border-slate-300 text-center">-</td>
              <td className="p-2 border border-slate-300 text-right font-black">{annualTotalLiters.toLocaleString('th-TH')} ลิตร</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
          <div>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto pb-8"></div>
            <p className="mt-2 font-bold text-slate-800">ลงชื่อ ผู้รายงาน / ผู้จัดทำสต๊อก</p>
            <p className="text-[11px] text-slate-500">({userName})</p>
          </div>
          <div>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto pb-8"></div>
            <p className="mt-2 font-bold text-slate-800">ลงชื่อ ผู้จัดการฝ่าย / ผู้อนุมัติ</p>
            <p className="text-[11px] text-slate-500">(...................................................)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
