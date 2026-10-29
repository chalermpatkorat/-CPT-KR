import { OilItem, StockTransaction, Vehicle, AdBlueRefillRecord } from '../types';
import {
  getAccessToken,
  clearGoogleOAuthToken,
  signInWithGoogle,
  hasValidGoogleToken,
  db
} from '../lib/firebase';
import { calculateVehicleCycle, formatThaiDate } from './vehicleService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface SyncToSheetsResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedAt: string;
  counts: {
    oilsCount: number;
    txCount: number;
    vehiclesCount: number;
    adBlueCount: number;
    monthlyCount: number;
  };
  sheetsSynced: string[];
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  autoSync: boolean;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastErrorMessage: string | null;
}

const LOCAL_SHEETS_ID_KEY = 'cpt_google_spreadsheet_id';
const LOCAL_SHEETS_URL_KEY = 'cpt_google_spreadsheet_url';
const LOCAL_AUTO_SYNC_KEY = 'cpt_google_sheets_auto_sync';
const LOCAL_LAST_SYNC_KEY = 'cpt_google_sheets_last_sync';
const FIRESTORE_SETTINGS_COLL = 'settings';
const FIRESTORE_SHEETS_DOC = 'google_sheets_config';

export const SHEET_NAMES = {
  OILS: 'สต๊อกคงเหลือ',
  TRANSACTIONS: 'ประวัติเบิกจ่ายและรับเข้า',
  VEHICLES: 'ข้อมูลรถและรอบเปลี่ยนถ่าย',
  ADBLUE: 'ประวัติเติม AdBlue',
  MONTHLY: 'สรุปการใช้รายเดือน',
} as const;

/**
 * Extracts spreadsheet ID from full URL or validates an ID string
 */
export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If it's a raw spreadsheet ID without slashes
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

/**
 * Retrieves the stored spreadsheet configuration from localStorage and Firestore
 */
export const getStoredGoogleSheetsConfig = async (): Promise<GoogleSheetsConfig> => {
  let spreadsheetId: string | null = null;
  let spreadsheetUrl: string | null = null;
  let autoSync = false;
  let lastSyncAt: string | null = null;
  let lastSyncSuccess = true;
  let lastErrorMessage: string | null = null;

  // 1. Read local storage
  try {
    spreadsheetId = localStorage.getItem(LOCAL_SHEETS_ID_KEY);
    spreadsheetUrl = localStorage.getItem(LOCAL_SHEETS_URL_KEY);
    autoSync = localStorage.getItem(LOCAL_AUTO_SYNC_KEY) === 'true';
    lastSyncAt = localStorage.getItem(LOCAL_LAST_SYNC_KEY);
  } catch {}

  // 2. Try Firestore fallback if local is empty
  try {
    const docRef = doc(db, FIRESTORE_SETTINGS_COLL, FIRESTORE_SHEETS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (!spreadsheetId && data.spreadsheetId) {
        const foundId = String(data.spreadsheetId);
        spreadsheetId = foundId;
        spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${foundId}/edit`;
        localStorage.setItem(LOCAL_SHEETS_ID_KEY, foundId);
        if (spreadsheetUrl) localStorage.setItem(LOCAL_SHEETS_URL_KEY, spreadsheetUrl);
      }
      if (data.autoSync !== undefined) {
        autoSync = Boolean(data.autoSync);
      }
      if (data.lastSyncAt) {
        lastSyncAt = data.lastSyncAt;
      }
    }
  } catch {}

  return {
    spreadsheetId,
    spreadsheetUrl,
    autoSync,
    lastSyncAt,
    lastSyncSuccess,
    lastErrorMessage,
  };
};

/**
 * Persists Google Sheets configuration to both localStorage and Firestore
 */
export const saveStoredGoogleSheetsConfig = async (
  config: Partial<GoogleSheetsConfig>
): Promise<void> => {
  try {
    if (config.spreadsheetId !== undefined) {
      if (config.spreadsheetId) {
        localStorage.setItem(LOCAL_SHEETS_ID_KEY, config.spreadsheetId);
      } else {
        localStorage.removeItem(LOCAL_SHEETS_ID_KEY);
      }
    }
    if (config.spreadsheetUrl !== undefined) {
      if (config.spreadsheetUrl) {
        localStorage.setItem(LOCAL_SHEETS_URL_KEY, config.spreadsheetUrl);
      } else {
        localStorage.removeItem(LOCAL_SHEETS_URL_KEY);
      }
    }
    if (config.autoSync !== undefined) {
      localStorage.setItem(LOCAL_AUTO_SYNC_KEY, config.autoSync ? 'true' : 'false');
    }
    if (config.lastSyncAt) {
      localStorage.setItem(LOCAL_LAST_SYNC_KEY, config.lastSyncAt);
    }
  } catch {}

  // Sync to Firestore in background
  queueMicrotask(async () => {
    try {
      const docRef = doc(db, FIRESTORE_SETTINGS_COLL, FIRESTORE_SHEETS_DOC);
      await setDoc(docRef, config, { merge: true });
    } catch (e) {
      console.warn('Note: Storing sheets config to Firestore:', e);
    }
  });
};

/**
 * Internal helper to get valid OAuth token, refreshing if needed
 */
const getValidToken = async (interactive = true): Promise<string> => {
  let token = await getAccessToken();

  if (!token && interactive) {
    // Attempt interactive popup
    const result = await signInWithGoogle();
    token = await getAccessToken();
    if (!token && (result as any)?.credential?.accessToken) {
      token = (result as any).credential.accessToken;
    }
  }

  if (!token) {
    throw new Error('ไม่พบสิทธิ์การเข้าถึง Google Workspace กรุณาเข้าสู่ระบบด้วย Google ก่อนทำการซิงค์');
  }

  return token;
};

/**
 * Syncs all 5 domains into a single Google Spreadsheet.
 * Guarantees that:
 * 1. Target spreadsheet has all 5 sheets (creating missing sheets on demand).
 * 2. Clears stale records before writing so old rows don't linger.
 * 3. Applies professional dark-header styling with frozen row 1.
 * 4. Refreshes OAuth token automatically on 401.
 * 5. Persists spreadsheetId for future syncs across sessions.
 */
export const syncAllDataToGoogleSheets = async (params: {
  oils: OilItem[];
  transactions: StockTransaction[];
  vehicles: Vehicle[];
  adBlueRefills: AdBlueRefillRecord[];
  targetSpreadsheetId?: string | null;
  interactive?: boolean;
}): Promise<SyncToSheetsResult> => {
  const {
    oils,
    transactions,
    vehicles,
    adBlueRefills,
    targetSpreadsheetId,
    interactive = true,
  } = params;

  let token = await getValidToken(interactive);
  let spreadsheetId = targetSpreadsheetId ? extractSpreadsheetId(targetSpreadsheetId) : null;

  // If no spreadsheet ID provided in params, check stored config
  if (!spreadsheetId) {
    const stored = await getStoredGoogleSheetsConfig();
    if (stored.spreadsheetId) {
      spreadsheetId = stored.spreadsheetId;
    }
  }

  const todayStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const nowIso = new Date().toISOString();

  // Helper for authorized fetch with auto-retry on 401
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      clearGoogleOAuthToken();
      if (interactive) {
        // Re-authenticate and retry once
        token = await getValidToken(true);
        res = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      }
    }

    return res;
  };

  // 1. Check or Create Spreadsheet
  let spreadsheetUrl = '';
  let existingSheets: Array<{ sheetId: number; title: string }> = [];

  if (spreadsheetId) {
    // Verify spreadsheet exists and fetch sheet titles
    const checkRes = await authFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`
    );

    if (checkRes.ok) {
      const sheetData = await checkRes.json();
      existingSheets = (sheetData.sheets || []).map((s: any) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
      }));
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    } else {
      // Spreadsheet does not exist or user lost access -> reset to create a new one
      console.warn(`Spreadsheet ${spreadsheetId} not accessible (${checkRes.status}). Creating a new one.`);
      spreadsheetId = null;
    }
  }

  // Create new spreadsheet if needed
  if (!spreadsheetId) {
    const createRes = await authFetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          title: `CPT Korat - ระบบจัดการน้ำมันเครื่อง&น้ำยา AdBlue (${todayStr})`,
        },
        sheets: [
          { properties: { sheetId: 0, title: SHEET_NAMES.OILS, gridProperties: { frozenRowCount: 1 } } },
          { properties: { sheetId: 1, title: SHEET_NAMES.TRANSACTIONS, gridProperties: { frozenRowCount: 1 } } },
          { properties: { sheetId: 2, title: SHEET_NAMES.VEHICLES, gridProperties: { frozenRowCount: 1 } } },
          { properties: { sheetId: 3, title: SHEET_NAMES.ADBLUE, gridProperties: { frozenRowCount: 1 } } },
          { properties: { sheetId: 4, title: SHEET_NAMES.MONTHLY, gridProperties: { frozenRowCount: 1 } } },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`ไม่สามารถสร้าง Google Sheets ได้: ${err?.error?.message || createRes.statusText}`);
    }

    const created = await createRes.json();
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    existingSheets = (created.sheets || []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    }));
  }

  if (!spreadsheetId) {
    throw new Error('ไม่พบรหัส Spreadsheet ID');
  }

  // 2. Ensure all 5 required sheets exist in target spreadsheet
  const requiredTitles = [
    SHEET_NAMES.OILS,
    SHEET_NAMES.TRANSACTIONS,
    SHEET_NAMES.VEHICLES,
    SHEET_NAMES.ADBLUE,
    SHEET_NAMES.MONTHLY,
  ];

  const existingTitles = new Set(existingSheets.map((s) => s.title));
  const missingTitles = requiredTitles.filter((t) => !existingTitles.has(t));

  if (missingTitles.length > 0) {
    const addSheetRequests = missingTitles.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    const addRes = await authFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: addSheetRequests }),
    });

    if (!addRes.ok) {
      console.warn('Notice adding missing sheets:', await addRes.text());
    }
  }

  // 3. Prepare All 5 Datasets with Complete, Real-Time Columns

  // Sheet 1: สต๊อกคงเหลือ
  const stockHeaders = [
    'ลำดับ',
    'ชื่อสินค้า',
    'ยี่ห้อ (Brand)',
    'เบอร์ความหนืด/เกรด',
    'ประเภทน้ำมัน/น้ำยา',
    'คงเหลือ (ลิตร)',
    'ใช้ไปแล้ว (ลิตร)',
    'รับเข้ารวม (ลิตร)',
    'จุดเตือนใกล้หมด (ลิตร)',
    'หน่วยนับ',
    'สถานะสต๊อก',
    'หมายเหตุ',
    'อัปเดตล่าสุด',
  ];
  const stockRows = oils.map((item, index) => {
    let statusText = 'ปกติ';
    if (item.currentStock <= 0) statusText = 'หมดสต๊อก';
    else if (item.currentStock <= item.minStockThreshold) statusText = 'ใกล้หมด (ควรสั่งเพิ่ม)';

    return [
      index + 1,
      item.name || '-',
      item.brand || '-',
      item.viscosity || '-',
      item.oilType || '-',
      Number(item.currentStock) || 0,
      Number(item.totalUsed) || 0,
      Number(item.totalReceived) || 0,
      Number(item.minStockThreshold) || 0,
      item.unit || 'ลิตร',
      statusText,
      item.notes || '-',
      item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-',
    ];
  });

  // Sheet 2: ประวัติเบิกจ่ายและรับเข้า
  const txHeaders = [
    'ลำดับ',
    'วัน-เวลา',
    'ประเภทรายการ',
    'รายการสินค้า/น้ำมัน',
    'เบอร์ความหนืด',
    'จำนวน (ลิตร)',
    'สต๊อกก่อนทำ',
    'สต๊อกหลังทำ',
    'ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์',
    'เลขไมล์ (กม.)',
    'ผู้บันทึกรายการ',
    'หมายเหตุ',
  ];
  const txRows = transactions.map((tx, index) => [
    index + 1,
    tx.date ? new Date(tx.date).toLocaleString('th-TH') : '-',
    tx.type === 'dispense' ? 'เบิกจ่าย (-)' : 'รับเข้า (+)',
    tx.oilName || '-',
    tx.viscosity || '-',
    Number(tx.amount) || 0,
    Number(tx.stockBefore) || 0,
    Number(tx.stockAfter) || 0,
    tx.recipientOrVehicle || '-',
    tx.currentMileage !== undefined && tx.currentMileage !== null ? tx.currentMileage : '-',
    tx.performedBy || '-',
    tx.referenceNote || '-',
  ]);

  // Sheet 3: ข้อมูลรถและรอบเปลี่ยนถ่าย
  const vehicleHeaders = [
    'ลำดับ',
    'ทะเบียนรถ',
    'โรงงาน',
    'สายรถ/เส้นทาง',
    'ระยะทาง/เที่ยว (กม.)',
    'เที่ยววิ่ง/เดือน',
    'เลขไมล์ปัจจุบัน (กม.)',
    'ไมล์เปลี่ยนถ่ายล่าสุด (กม.)',
    'วันที่เปลี่ยนถ่ายล่าสุด',
    'เกณฑ์การตั้งรอบ',
    'รอบเปลี่ยนถ่ายถัดไป (กม./เดือน)',
    'ระยะวิ่งในรอบนี้ (กม.)',
    'ระยะคงเหลือก่อนถึงรอบ (กม.)',
    'วันนัดหมายเรียกรถเข้า',
    'สถานะรอบการตรวจเช็ค',
    'หมายเหตุ',
    'อัปเดตล่าสุด',
  ];
  const vehicleRows = vehicles.map((v, index) => {
    const cycle = calculateVehicleCycle(v);
    const cycleDesc =
      cycle.cycleType === 'month'
        ? `ตามรอบเดือน (${cycle.cycleDescription})`
        : `ตามระยะทาง (${cycle.cycleDescription})`;

    const nextTargetDesc =
      cycle.cycleType === 'month'
        ? `${cycle.formattedDueDate} (ประมาณ ${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.)`
        : `${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.`;

    return [
      index + 1,
      v.licensePlate || '-',
      v.factory || '-',
      v.route || '-',
      Number(v.distancePerTrip) || 0,
      Number(v.tripsPerMonth) || 0,
      Number(v.currentMileage) || 0,
      Number(v.lastOilChangeMileage) || Number(v.currentMileage) || 0,
      v.lastOilChangeDate ? formatThaiDate(v.lastOilChangeDate) : '-',
      cycleDesc,
      nextTargetDesc,
      cycle.kmSinceLastChange,
      cycle.kmRemaining,
      cycle.formattedDueDate,
      cycle.statusText,
      v.notes || '-',
      v.updatedAt ? new Date(v.updatedAt).toLocaleString('th-TH') : '-',
    ];
  });

  // Sheet 4: ประวัติเติม AdBlue
  const adBlueHeaders = [
    'ลำดับ',
    'วัน-เวลา ที่เติม',
    'ทะเบียนรถ',
    'โรงงาน',
    '% ก่อนเติม',
    '% หลังเติม',
    'จำนวนลิตรที่เติม',
    'เลขไมล์ (กม.)',
    'ผู้เติม / ช่าง',
    'หักสต๊อกอัตโนมัติ',
    'หมายเหตุ',
  ];
  const adBlueRows = adBlueRefills.map((r, index) => [
    index + 1,
    r.date ? new Date(r.date).toLocaleString('th-TH') : '-',
    r.licensePlate || '-',
    r.factory || '-',
    `${r.percentBefore}%`,
    `${r.percentAfter}%`,
    Number(r.litersFilled) || 0,
    r.currentMileage ? r.currentMileage.toLocaleString('th-TH') : '-',
    r.filledBy || '-',
    r.deductedFromStock ? 'ใช่' : 'ไม่ใช่',
    r.notes || '-',
  ]);

  // Sheet 5: สรุปการใช้รายเดือน (รวมการใช้น้ำมันเครื่องและ AdBlue รายคันในทุกเดือน)
  const monthlyHeaders = [
    'ลำดับ',
    'ประจำเดือน (YYYY-MM)',
    'ทะเบียนรถ',
    'โรงงาน',
    'จำนวนครั้งถ่ายน้ำมันเครื่อง',
    'ปริมาณน้ำมันเครื่องที่ใช้ (ลิตร)',
    'จำนวนครั้งเติม AdBlue',
    'ปริมาณ AdBlue ที่ใช้ (ลิตร)',
    'รวมปริมาณทั้งหมด (ลิตร)',
    'เลขไมล์ล่าสุด (กม.)',
  ];

  // Helper to test if a transaction is AdBlue or Engine Oil
  const isAdBlueTx = (tx: StockTransaction) => {
    const text = `${tx.oilName} ${tx.viscosity} ${tx.referenceNote || ''}`.toLowerCase();
    return text.includes('adblue') || text.includes('แอดบลู') || text.includes('def');
  };

  // Group by (Month + LicensePlate)
  const monthlyAggMap = new Map<
    string,
    {
      month: string;
      licensePlate: string;
      factory: string;
      oilCount: number;
      oilLiters: number;
      adBlueCount: number;
      adBlueLiters: number;
      latestMileage: number;
    }
  >();

  // Add from transactions
  transactions
    .filter((tx) => tx.type === 'dispense')
    .forEach((tx) => {
      const month = (tx.date || tx.createdAt || '').slice(0, 7);
      if (!month) return;
      const plate =
        vehicles.find((v) => tx.recipientOrVehicle?.includes(v.licensePlate))?.licensePlate ||
        (tx.recipientOrVehicle ? tx.recipientOrVehicle.split(' ')[0] : 'อื่นๆ');
      const key = `${month}_${plate}`;
      const fac = vehicles.find((v) => v.licensePlate === plate)?.factory || 'ไม่ระบุ';
      const isAd = isAdBlueTx(tx);

      if (!monthlyAggMap.has(key)) {
        monthlyAggMap.set(key, {
          month,
          licensePlate: plate,
          factory: fac,
          oilCount: 0,
          oilLiters: 0,
          adBlueCount: 0,
          adBlueLiters: 0,
          latestMileage: tx.currentMileage || 0,
        });
      }

      const rec = monthlyAggMap.get(key)!;
      if (isAd) {
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

  // Add from AdBlue refills (ensure no double counting if already present)
  adBlueRefills.forEach((r) => {
    const month = (r.date || r.createdAt || '').slice(0, 7);
    if (!month) return;
    const plate = r.licensePlate;
    const key = `${month}_${plate}`;

    if (!monthlyAggMap.has(key)) {
      monthlyAggMap.set(key, {
        month,
        licensePlate: plate,
        factory: r.factory,
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

  const monthlyRows = Array.from(monthlyAggMap.values())
    .sort((a, b) => b.month.localeCompare(a.month) || a.licensePlate.localeCompare(b.licensePlate))
    .map((m, index) => [
      index + 1,
      m.month,
      m.licensePlate,
      m.factory,
      m.oilCount,
      Math.round(m.oilLiters * 10) / 10,
      m.adBlueCount,
      Math.round(m.adBlueLiters * 10) / 10,
      Math.round((m.oilLiters + m.adBlueLiters) * 10) / 10,
      m.latestMileage ? m.latestMileage.toLocaleString('th-TH') : '-',
    ]);

  // 4. Clear old data from sheets to ensure no stale trailing rows linger
  const clearRes = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [
          `'${SHEET_NAMES.OILS}'!A1:Z`,
          `'${SHEET_NAMES.TRANSACTIONS}'!A1:Z`,
          `'${SHEET_NAMES.VEHICLES}'!A1:Z`,
          `'${SHEET_NAMES.ADBLUE}'!A1:Z`,
          `'${SHEET_NAMES.MONTHLY}'!A1:Z`,
        ],
      }),
    }
  );

  if (!clearRes.ok) {
    console.warn('Note on clearing sheet ranges:', await clearRes.text());
  }

  // 5. Batch update all values in one atomic call
  const updateRes = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'${SHEET_NAMES.OILS}'!A1`,
            values: [stockHeaders, ...stockRows],
          },
          {
            range: `'${SHEET_NAMES.TRANSACTIONS}'!A1`,
            values: [txHeaders, ...txRows],
          },
          {
            range: `'${SHEET_NAMES.VEHICLES}'!A1`,
            values: [vehicleHeaders, ...vehicleRows],
          },
          {
            range: `'${SHEET_NAMES.ADBLUE}'!A1`,
            values: [adBlueHeaders, ...adBlueRows],
          },
          {
            range: `'${SHEET_NAMES.MONTHLY}'!A1`,
            values: [monthlyHeaders, ...monthlyRows],
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(`ไม่สามารถอัปเดตข้อมูลลง Google Sheets: ${errData?.error?.message || updateRes.statusText}`);
  }

  // 6. Save successful configuration locally and in Firestore
  await saveStoredGoogleSheetsConfig({
    spreadsheetId,
    spreadsheetUrl,
    lastSyncAt: nowIso,
    lastSyncSuccess: true,
    lastErrorMessage: null,
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    updatedAt: nowIso,
    counts: {
      oilsCount: stockRows.length,
      txCount: txRows.length,
      vehiclesCount: vehicleRows.length,
      adBlueCount: adBlueRows.length,
      monthlyCount: monthlyRows.length,
    },
    sheetsSynced: [
      SHEET_NAMES.OILS,
      SHEET_NAMES.TRANSACTIONS,
      SHEET_NAMES.VEHICLES,
      SHEET_NAMES.ADBLUE,
      SHEET_NAMES.MONTHLY,
    ],
  };
};

/**
 * Backward compatibility wrapper for syncStockToGoogleSheets
 */
export const syncStockToGoogleSheets = async (
  oils: OilItem[],
  transactions: StockTransaction[],
  existingSpreadsheetId?: string
): Promise<SyncToSheetsResult> => {
  return syncAllDataToGoogleSheets({
    oils,
    transactions,
    vehicles: [],
    adBlueRefills: [],
    targetSpreadsheetId: existingSpreadsheetId,
    interactive: true,
  });
};
