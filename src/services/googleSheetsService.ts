import { OilItem, StockTransaction } from '../types';
import { getAccessToken } from '../lib/firebase';

export interface SyncToSheetsResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedAt: string;
}

/**
 * Creates or updates a Google Spreadsheet containing:
 * 1. Sheet "สต๊อกคงเหลือ" (Oil stock balance, used, status)
 * 2. Sheet "ประวัติการเบิก-รับเข้า" (Transaction history)
 */
export const syncStockToGoogleSheets = async (
  oils: OilItem[],
  transactions: StockTransaction[],
  existingSpreadsheetId?: string
): Promise<SyncToSheetsResult> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('ไม่พบสิทธิ์การเข้าถึง Google Workspace กรุณาเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง');
  }

  let spreadsheetId = existingSpreadsheetId;
  let spreadsheetUrl = '';

  // 1. If no existing spreadsheet, create a new one
  if (!spreadsheetId) {
    const todayStr = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `รายงานสต๊อกน้ำมันเครื่อง (${todayStr})`,
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'สต๊อกคงเหลือ',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
          {
            properties: {
              sheetId: 1,
              title: 'ประวัติเบิกจ่ายและรับเข้า',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      throw new Error(`ไม่สามารถสร้าง Google Sheets ได้: ${errData?.error?.message || createRes.statusText}`);
    }

    const sheetData = await createRes.json();
    if (!sheetData?.spreadsheetId) {
      throw new Error('ไม่ได้รับ spreadsheetId จาก Google Sheets API');
    }
    spreadsheetId = sheetData.spreadsheetId;
    spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  if (!spreadsheetId) {
    throw new Error('ไม่พบรหัส Spreadsheet ID');
  }

  // 2. Prepare Data for "สต๊อกคงเหลือ"
  const stockHeaders = [
    'ลำดับ',
    'ชื่อน้ำมันเครื่อง',
    'ยี่ห้อ (Brand)',
    'เบอร์ความหนืด',
    'ประเภทน้ำมัน',
    'คงเหลือ (ลิตร)',
    'ใช้ไปแล้ว (ลิตร)',
    'รับเข้ารวม (ลิตร)',
    'จุดเตือนใกล้หมด (ลิตร)',
    'สถานะสต๊อก',
    'หมายเหตุ',
    'อัปเดตล่าสุด',
  ];

  const stockRows = oils.map((item, index) => {
    let statusText = 'ปกติ';
    if (item.currentStock <= 0) {
      statusText = 'หมดสต๊อก';
    } else if (item.currentStock <= item.minStockThreshold) {
      statusText = 'ใกล้หมด (ควรสั่งเพิ่ม)';
    }

    return [
      index + 1,
      item.name,
      item.brand,
      item.viscosity,
      item.oilType,
      item.currentStock,
      item.totalUsed || 0,
      item.totalReceived || 0,
      item.minStockThreshold,
      statusText,
      item.notes || '-',
      new Date(item.updatedAt).toLocaleString('th-TH'),
    ];
  });

  // 3. Prepare Data for "ประวัติเบิกจ่ายและรับเข้า"
  const txHeaders = [
    'ลำดับ',
    'วัน-เวลา',
    'ประเภทรายการ',
    'ชื่อน้ำมันเครื่อง',
    'เบอร์ความหนืด',
    'จำนวน (ลิตร)',
    'สต๊อกก่อนทำ',
    'สต๊อกหลังทำ',
    'ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์',
    'ผู้บันทึกรายการ',
    'หมายเหตุ',
  ];

  const txRows = transactions.map((tx, index) => {
    const typeLabel = tx.type === 'dispense' ? 'เบิกจ่าย (-)' : 'รับเข้า (+)';
    return [
      index + 1,
      new Date(tx.date).toLocaleString('th-TH'),
      typeLabel,
      tx.oilName,
      tx.viscosity,
      tx.amount,
      tx.stockBefore,
      tx.stockAfter,
      tx.recipientOrVehicle || '-',
      tx.performedBy || '-',
      tx.referenceNote || '-',
    ];
  });

  // 4. Batch update values to Google Sheets
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'สต๊อกคงเหลือ!A1:L' + (stockRows.length + 1),
            values: [stockHeaders, ...stockRows],
          },
          {
            range: 'ประวัติเบิกจ่ายและรับเข้า!A1:K' + (txRows.length + 1),
            values: [txHeaders, ...txRows],
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(`ไม่สามารถอัปเดตข้อมูลลง Google Sheets: ${errData?.error?.message || updateRes.statusText}`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    updatedAt: new Date().toISOString(),
  };
};
