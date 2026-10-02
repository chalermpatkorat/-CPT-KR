import React, { useState } from 'react';
import { OilItem, StockTransaction } from '../types';
import { exportStockReportToExcel } from '../services/excelService';
import {
  Printer,
  FileSpreadsheet,
  Download,
  CheckCircle,
  Layers,
  Droplets,
} from 'lucide-react';

interface ReportTabProps {
  oils: OilItem[];
  transactions: StockTransaction[];
  userName: string;
  onSyncGoogleSheets: () => void;
  isSyncingSheets: boolean;
  sheetsUrl?: string | null;
}

export const ReportTab: React.FC<ReportTabProps> = ({
  oils,
  userName,
  onSyncGoogleSheets,
  isSyncingSheets,
  sheetsUrl,
}) => {
  const [printDate] = useState(() =>
    new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const totalStockLiters = oils.reduce((sum, o) => sum + (o.currentStock || 0), 0);
  const totalUsedLiters = oils.reduce((sum, o) => sum + (o.totalUsed || 0), 0);
  const totalReceivedLiters = oils.reduce((sum, o) => sum + (o.totalReceived || 0), 0);
  const outOfStockCount = oils.filter((o) => o.currentStock <= 0).length;
  const lowStockCount = oils.filter((o) => o.currentStock > 0 && o.currentStock <= o.minStockThreshold).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportStockReportToExcel(oils, `รายงานสต๊อกน้ำมันเครื่องและแอดบลู_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden on print) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                รายงานสต๊อกคงเหลือ
              </h2>
              <p className="text-xs text-slate-500">
                ข้อมูลสรุปสต๊อกปัจจุบัน (น้ำมันเครื่อง & น้ำยาแอดบลู) • พร้อมระบบสั่งพิมพ์เป็นทางการ และดาวน์โหลด Excel / Google Sheets
              </p>
            </div>
          </div>
        </div>

        {/* Buttons: Print, Excel, Google Sheets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>สั่งพิมพ์รายงาน (Print)</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={onSyncGoogleSheets}
            disabled={isSyncingSheets}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-4 h-4 text-emerald-600 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheets ? 'กำลังซิงค์ Sheets...' : 'ซิงค์ Google Sheets'}</span>
          </button>
        </div>
      </div>

      {sheetsUrl && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800 text-xs no-print">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>ข้อมูลซิงค์ลง Google Sheets สำเร็จแล้ว สามารถเข้าดูและแก้ไขใน Google Drive ได้</span>
          </div>
          <a
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline text-emerald-700 hover:text-emerald-900 flex-shrink-0"
          >
            เปิด Google Sheets ↗
          </a>
        </div>
      )}

      {/* Printable Report Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print-container">
        {/* Formal Report Header for Printing */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center relative">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <Droplets className="w-6 h-6 text-amber-600 inline" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              รายงานสรุปสต๊อกคงเหลือ (น้ำมันเครื่อง & น้ำยาแอดบลู)
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            ระบบบริหารจัดการคลังสินค้าและสารบำบัดไอเสีย (Inventory Balance Report)
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 mt-2">
            <span>พิมพ์เมื่อ: <strong>{printDate}</strong></span>
            <span>•</span>
            <span>ผู้พิมพ์รายงาน: <strong>{userName || 'สมาชิก'}</strong></span>
            <span>•</span>
            <span>สถานะระบบ: <strong>Real-time Live Sync</strong></span>
          </div>
        </div>

        {/* Summary Numbers Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 block">คงเหลือรวมทั้งสิ้น</span>
            <span className="text-xl sm:text-2xl font-black text-amber-600">
              {totalStockLiters.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500 font-bold ml-1">ลิตร</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 block">ใช้ไปแล้วสะสม</span>
            <span className="text-xl sm:text-2xl font-black text-orange-600">
              {totalUsedLiters.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500 font-bold ml-1">ลิตร</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 block">รับเข้าคลังสะสม</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600">
              {totalReceivedLiters.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500 font-bold ml-1">ลิตร</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 block">ต้องสั่งซื้อ / หมด</span>
            <span className={`text-xl sm:text-2xl font-black ${outOfStockCount + lowStockCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {outOfStockCount + lowStockCount}
            </span>
            <span className="text-xs text-slate-500 font-bold ml-1">รายการ</span>
          </div>
        </div>

        {/* Stock Report Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm print-table">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3 px-3">ชื่อสินค้า / รายการ</th>
                <th className="py-3 px-3">ยี่ห้อ (Brand)</th>
                <th className="py-3 px-3 text-center">เบอร์ความหนืด/เกรด</th>
                <th className="py-3 px-3">ประเภท</th>
                <th className="py-3 px-3 text-right">คงเหลือ (ลิตร)</th>
                <th className="py-3 px-3 text-right">ใช้ไปแล้ว (ลิตร)</th>
                <th className="py-3 px-3 text-center">จุดเตือน</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                <th className="py-3 px-3">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {oils.map((item, index) => {
                const isOut = item.currentStock <= 0;
                const isLow = !isOut && item.currentStock <= item.minStockThreshold;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-colors print-avoid-break ${
                      isOut ? 'bg-red-50/40' : isLow ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center text-slate-500 font-medium">{index + 1}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{item.brand}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-800 text-white rounded text-xs font-bold">
                        {item.viscosity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{item.oilType || '-'}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-black text-base ${
                          isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                        }`}
                      >
                        {item.currentStock.toLocaleString('th-TH')}
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal ml-1">ลิตร</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-semibold">
                      {(item.totalUsed || 0).toLocaleString('th-TH')} ลิตร
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 text-xs">
                      {item.minStockThreshold} ลิตร
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          หมดสต๊อก
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          ใกล้หมด
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          ปกติ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 max-w-xs truncate">
                      {item.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={5} className="py-3.5 px-3 text-right">
                  รวมปริมาณสินค้าคงเหลือทั้งหมด:
                </td>
                <td className="py-3.5 px-3 text-right text-amber-700 font-black text-base">
                  {totalStockLiters.toLocaleString('th-TH')} ลิตร
                </td>
                <td className="py-3.5 px-3 text-right text-orange-700 font-black">
                  {totalUsedLiters.toLocaleString('th-TH')} ลิตร
                </td>
                <td colSpan={3} className="py-3.5 px-3 text-center text-xs text-slate-500">
                  ทั้งหมด {oils.length} รายการสินค้า
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Formal Signature Section for Print Document */}
        <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600 print-avoid-break">
          <div>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto pb-8"></div>
            <p className="mt-2 font-bold text-slate-800">ลงชื่อ ผู้รายงาน / ผู้จัดทำสต๊อก</p>
            <p className="text-[11px] text-slate-500 mt-0.5">({userName || '...................................................'})</p>
            <p className="text-[10px] text-slate-400 mt-1">วันที่ ...... / ...... / ..........</p>
          </div>
          <div>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto pb-8"></div>
            <p className="mt-2 font-bold text-slate-800">ลงชื่อ ผู้จัดการฝ่าย / ผู้ตรวจสอบ</p>
            <p className="text-[11px] text-slate-500 mt-0.5">(...................................................)</p>
            <p className="text-[10px] text-slate-400 mt-1">วันที่ ...... / ...... / ..........</p>
          </div>
        </div>
      </div>
    </div>
  );
};
