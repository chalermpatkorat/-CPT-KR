import * as XLSX from 'xlsx';
import { OilItem, StockTransaction, Vehicle, AdBlueRefillRecord } from '../types';
import { calculateVehicleCycle, formatThaiDate } from './vehicleService';

/**
 * Export all 5 domains into a single .xlsx Excel workbook
 * Exactly mirrors the structure of Google Sheets
 */
export const exportAll5SheetsToExcel = (params: {
  oils: OilItem[];
  transactions: StockTransaction[];
  vehicles: Vehicle[];
  adBlueRefills: AdBlueRefillRecord[];
  filename?: string;
}) => {
  const {
    oils,
    transactions,
    vehicles,
    adBlueRefills,
    filename = `CPT_Korat_ข้อมูลครบ5หมวด_${new Date().toISOString().slice(0, 10)}.xlsx`,
  } = params;

  const wb = XLSX.utils.book_new();

  // Sheet 1: สต๊อกคงเหลือ
  const stockData = oils.map((item, index) => {
    let status = 'ปกติ';
    if (item.currentStock <= 0) status = 'หมดสต๊อก';
    else if (item.currentStock <= item.minStockThreshold) status = 'ใกล้หมด';

    return {
      'ลำดับ': index + 1,
      'ชื่อสินค้า': item.name,
      'ยี่ห้อ (Brand)': item.brand,
      'เบอร์ความหนืด/เกรด': item.viscosity,
      'ประเภท': item.oilType || '-',
      'คงเหลือ (ลิตร)': item.currentStock,
      'ใช้ไปแล้ว (ลิตร)': item.totalUsed || 0,
      'รับเข้ารวม (ลิตร)': item.totalReceived || 0,
      'จุดเตือนขั้นต่ำ (ลิตร)': item.minStockThreshold,
      'สถานะ': status,
      'หมายเหตุ': item.notes || '',
      'อัปเดตล่าสุด': item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-',
    };
  });
  const wsStock = XLSX.utils.json_to_sheet(stockData);
  wsStock['!cols'] = [
    { wch: 8 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 },
    { wch: 30 }, { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, wsStock, 'สต๊อกคงเหลือ');

  // Sheet 2: ประวัติเบิกจ่ายและรับเข้า
  const txData = transactions.map((tx, index) => ({
    'ลำดับ': index + 1,
    'วัน-เวลา': tx.date ? new Date(tx.date).toLocaleString('th-TH') : '-',
    'ประเภท': tx.type === 'dispense' ? 'เบิกจ่าย' : 'รับเข้า',
    'รายการสินค้า': tx.oilName,
    'เบอร์ความหนืด/เกรด': tx.viscosity,
    'จำนวน (ลิตร)': tx.amount,
    'สต๊อกก่อนทำ': tx.stockBefore,
    'สต๊อกหลังทำ': tx.stockAfter,
    'ผู้เบิก / ทะเบียนรถ / ปลายทาง': tx.recipientOrVehicle || '-',
    'เลขไมล์ (กม.)': tx.currentMileage ? tx.currentMileage.toLocaleString('th-TH') : '-',
    'ผู้บันทึก': tx.performedBy || '-',
    'หมายเหตุ': tx.referenceNote || '',
  }));
  const wsTx = XLSX.utils.json_to_sheet(txData);
  wsTx['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
    { wch: 20 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'ประวัติเบิกจ่ายและรับเข้า');

  // Sheet 3: ข้อมูลรถและรอบเปลี่ยนถ่าย
  const vehicleData = vehicles.map((v, index) => {
    const cycle = calculateVehicleCycle(v);
    const cycleLabel =
      v.cycleType === 'month'
        ? `ตามรอบเดือน (${cycle.cycleDescription})`
        : `ตามระยะทาง (${cycle.cycleDescription})`;

    const nextTargetDesc =
      v.cycleType === 'month'
        ? `${cycle.formattedDueDate} (ประมาณ ${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.)`
        : `${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.`;

    return {
      'ลำดับ': index + 1,
      'ทะเบียนรถ': v.licensePlate || '-',
      'โรงงาน': v.factory || '-',
      'สายรถ / เส้นทาง': v.route || '-',
      'ระยะทางต่อเที่ยว (กม.)': Number(v.distancePerTrip) || 0,
      'เที่ยววิ่งต่อเดือน': Number(v.tripsPerMonth) || 0,
      'เลขไมล์ปัจจุบัน (กม.)': Number(v.currentMileage) || 0,
      'ไมล์ที่ถ่ายล่าสุด (กม.)': Number(v.lastOilChangeMileage) || Number(v.currentMileage) || 0,
      'วันที่เปลี่ยนล่าสุด': v.lastOilChangeDate ? formatThaiDate(v.lastOilChangeDate) : '-',
      'การตั้งค่ารอบ': cycleLabel,
      'เป้าหมายรอบถัดไป': nextTargetDesc,
      'ระยะที่วิ่งไปแล้ว (กม.)': cycle.kmSinceLastChange,
      'ระยะคงเหลือก่อนถึงรอบ (กม.)': cycle.kmRemaining,
      'วันนัดหมายเรียกรถเข้า': cycle.formattedDueDate,
      'สถานะรอบการตรวจเช็ค': cycle.statusText,
      'หมายเหตุ': v.notes || '-',
      'อัปเดตล่าสุด': v.updatedAt ? new Date(v.updatedAt).toLocaleString('th-TH') : '-',
    };
  });
  const wsVehicles = XLSX.utils.json_to_sheet(vehicleData);
  wsVehicles['!cols'] = [
    { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 20 },
    { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 24 },
    { wch: 26 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 22 },
    { wch: 20 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsVehicles, 'ข้อมูลรถและรอบเปลี่ยนถ่าย');

  // Sheet 4: ประวัติเติม AdBlue
  const adBlueData = adBlueRefills.map((refill, index) => ({
    'ลำดับ': index + 1,
    'วัน-เวลาเติม': refill.date ? new Date(refill.date).toLocaleString('th-TH') : '-',
    'ทะเบียนรถ': refill.licensePlate || '-',
    'โรงงาน': refill.factory || '-',
    '% ก่อนเติม': `${refill.percentBefore}%`,
    '% หลังเติม': `${refill.percentAfter}%`,
    'ปริมาณที่เติม (ลิตร)': Number(refill.litersFilled) || 0,
    'เลขไมล์ขณะเติม (กม.)': refill.currentMileage ? refill.currentMileage.toLocaleString('th-TH') : '-',
    'ผู้เติม / ช่าง': refill.filledBy || '-',
    'หักสต๊อกอัตโนมัติ': refill.deductedFromStock ? 'ใช่' : 'ไม่ใช่',
    'หมายเหตุ': refill.notes || '-',
  }));
  const wsAdBlue = XLSX.utils.json_to_sheet(adBlueData);
  wsAdBlue['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAdBlue, 'ประวัติเติม AdBlue');

  // Sheet 5: สรุปการใช้รายเดือน
  const monthlyAggMap = new Map<string, {
    month: string;
    licensePlate: string;
    factory: string;
    oilCount: number;
    oilLiters: number;
    adBlueCount: number;
    adBlueLiters: number;
    latestMileage: number;
  }>();

  transactions
    .filter((tx) => tx.type === 'dispense')
    .forEach((tx) => {
      const month = (tx.date || tx.createdAt || '').slice(0, 7) || 'ไม่ระบุ';
      const plate = (tx.recipientOrVehicle || '-').trim();
      const key = `${month}_${plate}`;
      const isAdBlue = (tx.oilName || '').toLowerCase().includes('adblue') || (tx.viscosity || '').toLowerCase().includes('adblue');

      if (!monthlyAggMap.has(key)) {
        monthlyAggMap.set(key, {
          month,
          licensePlate: plate,
          factory: '-',
          oilCount: 0,
          oilLiters: 0,
          adBlueCount: 0,
          adBlueLiters: 0,
          latestMileage: tx.currentMileage || 0,
        });
      }

      const rec = monthlyAggMap.get(key)!;
      if (isAdBlue) {
        rec.adBlueCount += 1;
        rec.adBlueLiters += Number(tx.amount) || 0;
      } else {
        rec.oilCount += 1;
        rec.oilLiters += Number(tx.amount) || 0;
      }
      if (tx.currentMileage && tx.currentMileage > rec.latestMileage) {
        rec.latestMileage = tx.currentMileage;
      }
    });

  adBlueRefills.forEach((r) => {
    const month = (r.date || r.createdAt || '').slice(0, 7) || 'ไม่ระบุ';
    const plate = (r.licensePlate || '-').trim();
    const key = `${month}_${plate}`;

    if (!monthlyAggMap.has(key)) {
      monthlyAggMap.set(key, {
        month,
        licensePlate: plate,
        factory: r.factory || '-',
        oilCount: 0,
        oilLiters: 0,
        adBlueCount: 0,
        adBlueLiters: 0,
        latestMileage: r.currentMileage || 0,
      });
    }

    const rec = monthlyAggMap.get(key)!;
    if (rec.adBlueLiters === 0) {
      rec.adBlueCount += 1;
      rec.adBlueLiters += Number(r.litersFilled) || 0;
    }
    if (r.currentMileage && r.currentMileage > rec.latestMileage) {
      rec.latestMileage = r.currentMileage;
    }
  });

  const monthlyData = Array.from(monthlyAggMap.values())
    .sort((a, b) => b.month.localeCompare(a.month) || a.licensePlate.localeCompare(b.licensePlate))
    .map((m, index) => ({
      'ลำดับ': index + 1,
      'เดือน (ปี-เดือน)': m.month,
      'ทะเบียนรถ': m.licensePlate,
      'โรงงาน': m.factory,
      'จำนวนครั้งเบิกน้ำมัน': m.oilCount,
      'ปริมาณน้ำมัน (ลิตร)': Math.round(m.oilLiters * 10) / 10,
      'จำนวนครั้งเติม AdBlue': m.adBlueCount,
      'ปริมาณ AdBlue (ลิตร)': Math.round(m.adBlueLiters * 10) / 10,
      'รวมของเหลวทั้งหมด (ลิตร)': Math.round((m.oilLiters + m.adBlueLiters) * 10) / 10,
      'เลขไมล์ล่าสุด (กม.)': m.latestMileage ? m.latestMileage.toLocaleString('th-TH') : '-',
    }));

  const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
  wsMonthly['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'สรุปการใช้รายเดือน');

  XLSX.writeFile(wb, filename);
};

/**
 * Legacy export for stock and transactions
 */
export const exportAllToExcel = (
  oils: OilItem[],
  transactions: StockTransaction[],
  filename = 'stock_and_transactions_data.xlsx'
) => {
  exportAll5SheetsToExcel({
    oils,
    transactions,
    vehicles: [],
    adBlueRefills: [],
    filename,
  });
};

/**
 * Export only current stock report to Excel
 */
export const exportStockReportToExcel = (oils: OilItem[], filename = 'stock_report.xlsx') => {
  const stockData = oils.map((item, index) => {
    let status = 'ปกติ';
    if (item.currentStock <= 0) status = 'หมดสต๊อก';
    else if (item.currentStock <= item.minStockThreshold) status = 'ใกล้หมด';

    return {
      'ลำดับ': index + 1,
      'ชื่อสินค้า': item.name,
      'ยี่ห้อ': item.brand,
      'เบอร์ความหนืด/เกรด': item.viscosity,
      'ประเภท': item.oilType || '-',
      'คงเหลือ (ลิตร)': item.currentStock,
      'ใช้ไปแล้ว (ลิตร)': item.totalUsed || 0,
      'จุดเตือนขั้นต่ำ (ลิตร)': item.minStockThreshold,
      'สถานะ': status,
      'หมายเหตุ': item.notes || '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(stockData);
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานสต๊อกคงเหลือ');
  XLSX.writeFile(wb, filename);
};

