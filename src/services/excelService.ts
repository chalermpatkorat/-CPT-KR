import * as XLSX from 'xlsx';
import { OilItem, StockTransaction } from '../types';

/**
 * Export full stock inventory and transactions to an .xlsx Excel workbook
 */
export const exportAllToExcel = (oils: OilItem[], transactions: StockTransaction[], filename = 'stock_and_transactions_data.xlsx') => {
  // 1. Stock Sheet Data
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
      'จุดเตือนใกล้หมด (ลิตร)': item.minStockThreshold,
      'สถานะ': status,
      'หมายเหตุ': item.notes || '',
      'อัปเดตล่าสุด': new Date(item.updatedAt).toLocaleString('th-TH'),
    };
  });

  // 2. Transaction Sheet Data
  const txData = transactions.map((tx, index) => ({
    'ลำดับ': index + 1,
    'วัน-เวลา': new Date(tx.date).toLocaleString('th-TH'),
    'ประเภท': tx.type === 'dispense' ? 'เบิกจ่าย' : 'รับเข้า',
    'รายการสินค้า': tx.oilName,
    'เบอร์ความหนืด/เกรด': tx.viscosity,
    'จำนวน (ลิตร)': tx.amount,
    'สต๊อกก่อนทำ (ลิตร)': tx.stockBefore,
    'สต๊อกหลังทำ (ลิตร)': tx.stockAfter,
    'ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์': tx.recipientOrVehicle || '',
    'เลขไมล์ (กม.)': tx.currentMileage || '-',
    'ผู้บันทึกรายการ': tx.performedBy || '',
    'หมายเหตุ': tx.referenceNote || '',
  }));

  const wb = XLSX.utils.book_new();
  const wsStock = XLSX.utils.json_to_sheet(stockData);
  const wsTx = XLSX.utils.json_to_sheet(txData);

  wsStock['!cols'] = [
    { wch: 8 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 },
    { wch: 30 }, { wch: 22 }
  ];

  wsTx['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 16 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 16 },
    { wch: 20 }, { wch: 25 }
  ];

  XLSX.utils.book_append_sheet(wb, wsStock, 'สต๊อกสินค้าคงเหลือ');
  XLSX.utils.book_append_sheet(wb, wsTx, 'ประวัติเบิกจ่าย-รับเข้า');

  XLSX.writeFile(wb, filename);
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
