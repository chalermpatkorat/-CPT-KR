import * as XLSX from 'xlsx';
import { Vehicle, AdBlueRefillRecord, OilItem, StockTransaction } from '../types';

/**
 * Escapes a single cell value for CSV output according to RFC 4180.
 * Wraps with quotes if the value contains commas, double-quotes, or newlines.
 */
export const escapeCsvCell = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Converts array of rows into a CSV string.
 */
export const rowsToCsvString = (rows: (string | number | boolean | null | undefined)[][]): string => {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
};

/**
 * Downloads a CSV string as a file with UTF-8 BOM (\uFEFF)
 * so Microsoft Excel in Windows immediately opens Thai text properly.
 */
export const downloadCsvFile = (csvContent: string, filename: string): void => {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Robust CSV Line Parser that handles commas inside quotes and escaped quotes.
 */
export const parseCsvText = (text: string): string[][] => {
  // Remove BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Closing quote
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Handle CRLF or standalone CR
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field & row if remaining
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Universal file reader for .csv, .xlsx, or .xls.
 * Returns a 2D array of string cells.
 */
export const parseUploadedFile = async (file: File): Promise<string[][]> => {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    return rawData.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
  } else {
    // Treat as CSV / Text
    const text = await file.text();
    return parseCsvText(text);
  }
};

// =========================================================================
// 1. VEHICLES & OIL CHANGE CYCLES (ประวัติถ่ายน้ำมันเครื่อง & รอบเปลี่ยนถ่าย)
// =========================================================================

export const VEHICLE_CSV_HEADERS = [
  'ทะเบียนรถ',
  'โรงงาน',
  'เส้นทางวิ่ง',
  'ระยะทางต่อเที่ยว (กม.)',
  'เที่ยวต่อเดือน',
  'เลขไมล์ล่าสุด (กม.)',
  'เลขไมล์เปลี่ยนถ่ายล่าสุด (กม.)',
  'วันที่เปลี่ยนถ่ายล่าสุด (YYYY-MM-DD)',
  'ประเภทการตั้งรอบ (ระยะทาง หรือ เดือน)',
  'รอบระยะทาง (กม.)',
  'รอบเดือน',
  'วันที่ครบกำหนดนัดหมาย (YYYY-MM-DD)',
  'หมายเหตุ',
];

export const exportVehiclesToCsv = (vehicles: Vehicle[], filename?: string): void => {
  const rows: (string | number)[][] = [VEHICLE_CSV_HEADERS];

  vehicles.forEach((v) => {
    rows.push([
      v.licensePlate || '',
      v.factory || '',
      v.route || '',
      Number(v.distancePerTrip) || 0,
      Number(v.tripsPerMonth) || 0,
      Number(v.currentMileage) || 0,
      Number(v.lastOilChangeMileage) || Number(v.currentMileage) || 0,
      v.lastOilChangeDate ? v.lastOilChangeDate.slice(0, 10) : '',
      v.cycleType === 'month' ? 'เดือน' : 'ระยะทาง',
      Number(v.oilChangeIntervalKm) || 20000,
      Number(v.intervalMonths) || 6,
      v.nextOilChangeDueDate ? v.nextOilChangeDueDate.slice(0, 10) : '',
      v.notes || '',
    ]);
  });

  const name = filename || `ประวัติถ่ายน้ำมันเครื่อง_CPT_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(rowsToCsvString(rows), name);
};

export const downloadVehiclesTemplateCsv = (): void => {
  const sampleRows: (string | number)[][] = [
    VEHICLE_CSV_HEADERS,
    [
      '70-1122 กทม.',
      'โรงงาน 1',
      'สายบางนา - แหลมฉบัง',
      180,
      28,
      118500,
      100000,
      '2026-06-15',
      'ระยะทาง',
      20000,
      6,
      '2026-10-15',
      'รถหัวลาก Hino 380 แรงม้า ช่างสุรชัย',
    ],
    [
      '70-5566 อยุธยา',
      'โรงงาน 2',
      'สายอยุธยา - สระบุรี (ขนหิน/ปูน)',
      140,
      35,
      141200,
      120000,
      '2026-05-10',
      'เดือน',
      20000,
      3,
      '2026-09-28',
      'รถสิบล้อดั๊มพ์ Fuso Super Great',
    ],
  ];

  downloadCsvFile(rowsToCsvString(sampleRows), 'แบบฟอร์มนำเข้า_ข้อมูลรถและรอบเปลี่ยนถ่าย.csv');
};

export const parseVehiclesFromRows = (
  rawRows: string[][]
): { valid: Partial<Vehicle>[]; errors: string[]; warnings: string[] } => {
  const valid: Partial<Vehicle>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length < 2) {
    errors.push('ไฟล์ไม่มีข้อมูล (ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว)');
    return { valid, errors, warnings };
  }

  const headerRow = rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));
  };

  const colPlate = findCol(['ทะเบียน', 'license', 'plate']);
  const colFactory = findCol(['โรงงาน', 'factory']);
  const colRoute = findCol(['เส้นทาง', 'route']);
  const colDist = findCol(['ระยะทางต่อเที่ยว', 'distancepertrip', 'distance']);
  const colTrips = findCol(['เที่ยวต่อเดือน', 'trips']);
  const colCurrentKm = findCol(['เลขไมล์ล่าสุด', 'currentmileage', 'ไมล์ปัจจุบัน', 'mileage']);
  const colLastChangeKm = findCol(['เลขไมล์เปลี่ยนถ่าย', 'lastoilchangemileage', 'ไมล์ถ่ายล่าสุด']);
  const colLastChangeDate = findCol(['วันที่เปลี่ยนถ่าย', 'lastoilchangedate']);
  const colCycleType = findCol(['ประเภทการตั้งรอบ', 'cycletype', 'รูปแบบรอบ']);
  const colIntervalKm = findCol(['รอบระยะทาง', 'oilchangeintervalkm', '20000', 'intervalkm']);
  const colIntervalMonths = findCol(['รอบเดือน', 'intervalmonths']);
  const colDueDate = findCol(['วันที่ครบกำหนด', 'nextoilchangeduedate', 'นัดหมาย']);
  const colNotes = findCol(['หมายเหตุ', 'notes', 'note']);

  if (colPlate === -1) {
    errors.push('ไม่พบคอลัมน์ "ทะเบียนรถ" ในหัวตาราง กรุณาตรวจสอบหัวคอลัมน์');
    return { valid, errors, warnings };
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const plate = row[colPlate]?.trim();
    if (!plate) {
      warnings.push(`แถวที่ ${i + 1}: ข้ามเนื่องจากไม่มีข้อมูลทะเบียนรถ`);
      continue;
    }

    const factory = (colFactory !== -1 && row[colFactory]?.trim()) || 'โรงงาน 1';
    const route = colRoute !== -1 ? row[colRoute]?.trim() || '' : '';
    const dist = colDist !== -1 ? parseFloat(row[colDist]?.replace(/,/g, '')) || 0 : 0;
    const trips = colTrips !== -1 ? parseFloat(row[colTrips]?.replace(/,/g, '')) || 0 : 0;
    const currentKm = colCurrentKm !== -1 ? parseFloat(row[colCurrentKm]?.replace(/,/g, '')) || 0 : 0;
    const lastChangeKm =
      colLastChangeKm !== -1
        ? parseFloat(row[colLastChangeKm]?.replace(/,/g, '')) || currentKm
        : currentKm;
    const lastDate = colLastChangeDate !== -1 ? row[colLastChangeDate]?.trim() || '' : '';

    const cycleTypeRaw = colCycleType !== -1 ? row[colCycleType]?.toLowerCase() || '' : '';
    const cycleType: 'distance' | 'month' = cycleTypeRaw.includes('เดือน') || cycleTypeRaw.includes('month') ? 'month' : 'distance';

    const intervalKm = colIntervalKm !== -1 ? parseFloat(row[colIntervalKm]?.replace(/,/g, '')) || 20000 : 20000;
    const intervalMonths = colIntervalMonths !== -1 ? parseFloat(row[colIntervalMonths]?.replace(/,/g, '')) || 6 : 6;
    const dueDate = colDueDate !== -1 ? row[colDueDate]?.trim() || '' : '';
    const notes = colNotes !== -1 ? row[colNotes]?.trim() || '' : '';

    valid.push({
      licensePlate: plate,
      factory,
      route,
      distancePerTrip: dist,
      tripsPerMonth: trips,
      currentMileage: currentKm,
      lastOilChangeMileage: lastChangeKm,
      lastOilChangeDate: lastDate || undefined,
      cycleType,
      oilChangeIntervalKm: intervalKm,
      intervalMonths,
      nextOilChangeDueDate: dueDate || undefined,
      notes,
    });
  }

  return { valid, errors, warnings };
};

// =========================================================================
// 2. ADBLUE REFILL RECORDS (ประวัติรายงานการเติมน้ำยาบำบัดไอเสีย AdBlue)
// =========================================================================

export const ADBLUE_CSV_HEADERS = [
  'วัน-เวลา (YYYY-MM-DD HH:mm)',
  'ทะเบียนรถ',
  'โรงงาน',
  '% ก่อนเติม',
  '% หลังเติม',
  'จำนวนลิตรที่เติม (ลิตร)',
  'เลขไมล์ (กม.)',
  'ผู้เติม/ช่าง',
  'หักสต๊อกอัตโนมัติ (ใช่/ไม่ใช่)',
  'หมายเหตุ',
];

export const exportAdBlueToCsv = (refills: AdBlueRefillRecord[], filename?: string): void => {
  const rows: (string | number)[][] = [ADBLUE_CSV_HEADERS];

  refills.forEach((r) => {
    rows.push([
      r.date || '',
      r.licensePlate || '',
      r.factory || '',
      Number(r.percentBefore) || 0,
      Number(r.percentAfter) || 0,
      Number(r.litersFilled) || 0,
      Number(r.currentMileage) || 0,
      r.filledBy || '',
      r.deductedFromStock ? 'ใช่' : 'ไม่ใช่',
      r.notes || '',
    ]);
  });

  const name = filename || `ประวัติเติมAdBlue_CPT_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(rowsToCsvString(rows), name);
};

export const downloadAdBlueTemplateCsv = (): void => {
  const sampleRows: (string | number)[][] = [
    ADBLUE_CSV_HEADERS,
    [
      '2026-10-01 09:30',
      '70-1122 กทม.',
      'โรงงาน 1',
      18,
      100,
      22,
      118450,
      'ช่างสุรชัย',
      'ใช่',
      'เติมเต็มถังก่อนออกวิ่งสายบางนา-แหลมฉบัง',
    ],
    [
      '2026-09-28 14:15',
      '70-5566 อยุธยา',
      'โรงงาน 2',
      12,
      95,
      25,
      140800,
      'ช่างประสิทธิ์',
      'ใช่',
      'ไฟเตือนระดับ AdBlue โชว์หน้าปัด',
    ],
  ];

  downloadCsvFile(rowsToCsvString(sampleRows), 'แบบฟอร์มนำเข้า_ประวัติเติมAdBlue.csv');
};

export const parseAdBlueFromRows = (
  rawRows: string[][]
): { valid: Partial<AdBlueRefillRecord>[]; errors: string[]; warnings: string[] } => {
  const valid: Partial<AdBlueRefillRecord>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length < 2) {
    errors.push('ไฟล์ไม่มีข้อมูล (ต้องมีหัวตารางและแถวข้อมูลอย่างน้อย 1 แถว)');
    return { valid, errors, warnings };
  }

  const headerRow = rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));
  };

  const colDate = findCol(['วัน-เวลา', 'วันที่', 'date', 'datetime']);
  const colPlate = findCol(['ทะเบียน', 'license', 'plate']);
  const colFactory = findCol(['โรงงาน', 'factory']);
  const colBefore = findCol(['% ก่อนเติม', 'ก่อนเติม', 'percentbefore']);
  const colAfter = findCol(['% หลังเติม', 'หลังเติม', 'percentafter']);
  const colLiters = findCol(['จำนวนลิตร', 'ลิตร', 'liters', 'litersfilled', 'จำนวน']);
  const colMileage = findCol(['เลขไมล์', 'mileage', 'currentmileage']);
  const colFilledBy = findCol(['ผู้เติม', 'ช่าง', 'filledby']);
  const colDeduct = findCol(['หักสต๊อก', 'deductedfromstock']);
  const colNotes = findCol(['หมายเหตุ', 'notes', 'note']);

  if (colPlate === -1 || colLiters === -1) {
    errors.push('ไม่พบคอลัมน์ "ทะเบียนรถ" หรือ "จำนวนลิตรที่เติม" กรุณาตรวจสอบหัวคอลัมน์');
    return { valid, errors, warnings };
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const plate = row[colPlate]?.trim();
    const liters = parseFloat(row[colLiters]?.replace(/,/g, ''));

    if (!plate || isNaN(liters) || liters <= 0) {
      warnings.push(`แถวที่ ${i + 1}: ข้ามเนื่องจากทะเบียนรถไม่ถูกต้องหรือจำนวนลิตร <= 0`);
      continue;
    }

    const dateVal = colDate !== -1 ? row[colDate]?.trim() : '';
    const date = dateVal || new Date().toISOString();
    const factory = colFactory !== -1 ? row[colFactory]?.trim() || 'โรงงาน 1' : 'โรงงาน 1';
    const percentBefore = colBefore !== -1 ? parseFloat(row[colBefore]?.replace(/,/g, '')) || 0 : 0;
    const percentAfter = colAfter !== -1 ? parseFloat(row[colAfter]?.replace(/,/g, '')) || 100 : 100;
    const currentMileage = colMileage !== -1 ? parseFloat(row[colMileage]?.replace(/,/g, '')) || 0 : 0;
    const filledBy = colFilledBy !== -1 ? row[colFilledBy]?.trim() || 'ช่างประจำคลัง' : 'ช่างประจำคลัง';
    const deductRaw = colDeduct !== -1 ? row[colDeduct]?.trim()?.toLowerCase() || '' : '';
    const deductedFromStock = !deductRaw.includes('ไม่') && !deductRaw.includes('false') && !deductRaw.includes('no');
    const notes = colNotes !== -1 ? row[colNotes]?.trim() || '' : '';

    valid.push({
      date,
      licensePlate: plate,
      factory,
      percentBefore,
      percentAfter,
      litersFilled: liters,
      currentMileage,
      filledBy,
      deductedFromStock,
      notes,
    });
  }

  return { valid, errors, warnings };
};

// =========================================================================
// 3. STOCK INVENTORY / OILS (หน้ารายงานคงเหลือ)
// =========================================================================

export const STOCK_CSV_HEADERS = [
  'ชื่อสินค้า',
  'ยี่ห้อ (Brand)',
  'เบอร์ความหนืด/เกรด',
  'ประเภทน้ำมัน/น้ำยา',
  'คงเหลือ (ลิตร)',
  'ใช้ไปแล้ว (ลิตร)',
  'รับเข้ารวม (ลิตร)',
  'จุดเตือนขั้นต่ำ (ลิตร)',
  'หน่วยนับ',
  'หมายเหตุ',
];

export const exportStockReportToCsv = (oils: OilItem[], filename?: string): void => {
  const rows: (string | number)[][] = [STOCK_CSV_HEADERS];

  oils.forEach((item) => {
    rows.push([
      item.name || '',
      item.brand || '',
      item.viscosity || '',
      item.oilType || 'สังเคราะห์แท้',
      Number(item.currentStock) || 0,
      Number(item.totalUsed) || 0,
      Number(item.totalReceived) || 0,
      Number(item.minStockThreshold) || 20,
      item.unit || 'ลิตร',
      item.notes || '',
    ]);
  });

  const name = filename || `รายงานสต๊อกคงเหลือ_CPT_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(rowsToCsvString(rows), name);
};

export const downloadStockTemplateCsv = (): void => {
  const sampleRows: (string | number)[][] = [
    STOCK_CSV_HEADERS,
    [
      'Castrol EDGE Professional',
      'Castrol',
      '5W-30',
      'สังเคราะห์แท้ (Fully Synthetic)',
      120,
      80,
      200,
      30,
      'ลิตร',
      'สำหรับเครื่องยนต์สมรรถนะสูง',
    ],
    [
      'น้ำยาบำบัดไอเสีย AdBlue (DEF ถัง 1,000 ลิตร)',
      'AdBlue มาตรฐาน ISO 22241',
      'AdBlue 32.5%',
      'น้ำยาบำบัดไอเสีย AdBlue',
      750,
      250,
      1000,
      200,
      'ลิตร',
      'สำหรับรถบรรทุกดีเซล EURO 5 / EURO 6',
    ],
  ];

  downloadCsvFile(rowsToCsvString(sampleRows), 'แบบฟอร์มนำเข้า_สต๊อกคงเหลือ.csv');
};

export const parseStockFromRows = (
  rawRows: string[][]
): { valid: Partial<OilItem>[]; errors: string[]; warnings: string[] } => {
  const valid: Partial<OilItem>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length < 2) {
    errors.push('ไฟล์ไม่มีข้อมูล (ต้องมีหัวตารางและแถวข้อมูลอย่างน้อย 1 แถว)');
    return { valid, errors, warnings };
  }

  const headerRow = rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));
  };

  const colName = findCol(['ชื่อสินค้า', 'name', 'รายการ']);
  const colBrand = findCol(['ยี่ห้อ', 'brand']);
  const colViscosity = findCol(['เบอร์ความหนืด', 'ความหนืด', 'เกรด', 'viscosity']);
  const colType = findCol(['ประเภท', 'oiltype', 'type']);
  const colStock = findCol(['คงเหลือ', 'currentstock', 'stock']);
  const colUsed = findCol(['ใช้ไปแล้ว', 'totalused', 'used']);
  const colReceived = findCol(['รับเข้ารวม', 'totalreceived', 'received']);
  const colMin = findCol(['จุดเตือน', 'minstockthreshold', 'threshold', 'ขั้นต่ำ']);
  const colUnit = findCol(['หน่วย', 'unit']);
  const colNotes = findCol(['หมายเหตุ', 'notes', 'note']);

  if (colName === -1) {
    errors.push('ไม่พบคอลัมน์ "ชื่อสินค้า" กรุณาตรวจสอบหัวคอลัมน์');
    return { valid, errors, warnings };
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const name = row[colName]?.trim();
    if (!name) {
      warnings.push(`แถวที่ ${i + 1}: ข้ามเนื่องจากไม่มีชื่อสินค้า`);
      continue;
    }

    const brand = colBrand !== -1 ? row[colBrand]?.trim() || '-' : '-';
    const viscosity = colViscosity !== -1 ? row[colViscosity]?.trim() || '-' : '-';
    const oilType = colType !== -1 ? row[colType]?.trim() || 'สังเคราะห์' : 'สังเคราะห์';
    const currentStock = colStock !== -1 ? parseFloat(row[colStock]?.replace(/,/g, '')) || 0 : 0;
    const totalUsed = colUsed !== -1 ? parseFloat(row[colUsed]?.replace(/,/g, '')) || 0 : 0;
    const totalReceived =
      colReceived !== -1
        ? parseFloat(row[colReceived]?.replace(/,/g, '')) || currentStock + totalUsed
        : currentStock + totalUsed;
    const minStockThreshold = colMin !== -1 ? parseFloat(row[colMin]?.replace(/,/g, '')) || 20 : 20;
    const unit = colUnit !== -1 ? row[colUnit]?.trim() || 'ลิตร' : 'ลิตร';
    const notes = colNotes !== -1 ? row[colNotes]?.trim() || '' : '';

    valid.push({
      name,
      brand,
      viscosity,
      oilType,
      currentStock,
      totalUsed,
      totalReceived,
      minStockThreshold,
      unit,
      notes,
    });
  }

  return { valid, errors, warnings };
};

// =========================================================================
// 4. MONTHLY USAGE SUMMARY (สรุปการใช้รายเดือน)
// =========================================================================

export const MONTHLY_SUMMARY_CSV_HEADERS = [
  'ประจำเดือน (YYYY-MM)',
  'ทะเบียนรถ',
  'โรงงาน',
  'จำนวนครั้งถ่ายน้ำมันเครื่อง (ครั้ง)',
  'ปริมาณน้ำมันเครื่องที่ใช้ (ลิตร)',
  'จำนวนครั้งเติม AdBlue (ครั้ง)',
  'ปริมาณ AdBlue ที่ใช้ (ลิตร)',
  'รวมปริมาณทั้งหมด (ลิตร)',
  'เลขไมล์ล่าสุด (กม.)',
  'หมายเหตุ',
];

export const exportMonthlySummaryToCsv = (
  summaryRows: Array<{
    month: string;
    licensePlate: string;
    factory: string;
    engineOilCount: number;
    engineOilLiters: number;
    adBlueCount: number;
    adBlueLiters: number;
    totalLiters: number;
    latestMileage: number;
    notes?: string;
  }>,
  monthLabel?: string,
  filename?: string
): void => {
  const rows: (string | number)[][] = [MONTHLY_SUMMARY_CSV_HEADERS];

  summaryRows.forEach((r) => {
    rows.push([
      r.month || monthLabel || '',
      r.licensePlate || '',
      r.factory || '',
      r.engineOilCount || 0,
      r.engineOilLiters || 0,
      r.adBlueCount || 0,
      r.adBlueLiters || 0,
      r.totalLiters || 0,
      r.latestMileage || 0,
      r.notes || '',
    ]);
  });

  const name =
    filename ||
    `สรุปการใช้รายเดือน_CPT_${(monthLabel || new Date().toISOString().slice(0, 7)).replace(/[^0-9a-zA-Z-]/g, '_')}.csv`;
  downloadCsvFile(rowsToCsvString(rows), name);
};

export const downloadMonthlySummaryTemplateCsv = (): void => {
  const sampleRows: (string | number)[][] = [
    MONTHLY_SUMMARY_CSV_HEADERS,
    [
      '2026-10',
      '70-1122 กทม.',
      'โรงงาน 1',
      1,
      25,
      2,
      44,
      69,
      118500,
      'วิ่งสายบางนา-แหลมฉบัง มีการถ่ายน้ำมันเครื่องรอบใหญ่',
    ],
    [
      '2026-10',
      '70-5566 อยุธยา',
      'โรงงาน 2',
      0,
      0,
      1,
      25,
      25,
      141200,
      'เติม AdBlue ประจำเดือน',
    ],
  ];

  downloadCsvFile(rowsToCsvString(sampleRows), 'แบบฟอร์มนำเข้า_สรุปการใช้รายเดือน.csv');
};

export const parseMonthlySummaryFromRows = (
  rawRows: string[][]
): {
  valid: Array<{
    month: string;
    licensePlate: string;
    factory: string;
    engineOilCount: number;
    engineOilLiters: number;
    adBlueCount: number;
    adBlueLiters: number;
    totalLiters: number;
    latestMileage: number;
    notes: string;
  }>;
  errors: string[];
  warnings: string[];
} => {
  const valid: any[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length < 2) {
    errors.push('ไฟล์ไม่มีข้อมูล (ต้องมีหัวตารางและแถวข้อมูลอย่างน้อย 1 แถว)');
    return { valid, errors, warnings };
  }

  const headerRow = rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));
  };

  const colMonth = findCol(['ประจำเดือน', 'เดือน', 'month']);
  const colPlate = findCol(['ทะเบียน', 'license', 'plate']);
  const colFactory = findCol(['โรงงาน', 'factory']);
  const colOilCount = findCol(['ครั้งถ่ายน้ำมันเครื่อง', 'oilcount', 'จำนวนครั้งถ่าย']);
  const colOilLiters = findCol(['ปริมาณน้ำมันเครื่อง', 'oilliters', 'น้ำมันเครื่องที่ใช้']);
  const colAdBlueCount = findCol(['ครั้งเติม adblue', 'adbluecount', 'ครั้งเติม']);
  const colAdBlueLiters = findCol(['ปริมาณ adblue', 'adblueliters', 'adblueที่ใช้']);
  const colMileage = findCol(['เลขไมล์ล่าสุด', 'mileage', 'latestmileage']);
  const colNotes = findCol(['หมายเหตุ', 'notes', 'note']);

  if (colPlate === -1) {
    errors.push('ไม่พบคอลัมน์ "ทะเบียนรถ" ในหัวตาราง กรุณาตรวจสอบหัวคอลัมน์');
    return { valid, errors, warnings };
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const plate = row[colPlate]?.trim();
    if (!plate) {
      warnings.push(`แถวที่ ${i + 1}: ข้ามเนื่องจากไม่มีข้อมูลทะเบียนรถ`);
      continue;
    }

    const month = colMonth !== -1 ? row[colMonth]?.trim() || new Date().toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
    const factory = colFactory !== -1 ? row[colFactory]?.trim() || 'โรงงาน 1' : 'โรงงาน 1';
    const engineOilCount = colOilCount !== -1 ? parseFloat(row[colOilCount]?.replace(/,/g, '')) || 0 : 0;
    const engineOilLiters = colOilLiters !== -1 ? parseFloat(row[colOilLiters]?.replace(/,/g, '')) || 0 : 0;
    const adBlueCount = colAdBlueCount !== -1 ? parseFloat(row[colAdBlueCount]?.replace(/,/g, '')) || 0 : 0;
    const adBlueLiters = colAdBlueLiters !== -1 ? parseFloat(row[colAdBlueLiters]?.replace(/,/g, '')) || 0 : 0;
    const latestMileage = colMileage !== -1 ? parseFloat(row[colMileage]?.replace(/,/g, '')) || 0 : 0;
    const notes = colNotes !== -1 ? row[colNotes]?.trim() || '' : '';

    valid.push({
      month,
      licensePlate: plate,
      factory,
      engineOilCount,
      engineOilLiters,
      adBlueCount,
      adBlueLiters,
      totalLiters: engineOilLiters + adBlueLiters,
      latestMileage,
      notes,
    });
  }

  return { valid, errors, warnings };
};

// =========================================================================
// 5. TRANSACTIONS / HISTORY (ประวัติเบิกจ่ายและรับเข้า)
// =========================================================================

export const TRANSACTION_CSV_HEADERS = [
  'วัน-เวลา (YYYY-MM-DD HH:mm)',
  'ประเภทรายการ (เบิกจ่าย หรือ รับเข้า)',
  'รายการสินค้า/น้ำมัน',
  'เบอร์ความหนืด/เกรด',
  'จำนวน (ลิตร)',
  'สต๊อกก่อนทำ (ลิตร)',
  'สต๊อกหลังทำ (ลิตร)',
  'ผู้เบิก / ทะเบียนรถ / ซัพพลายเออร์',
  'เลขไมล์ (กม.)',
  'ผู้บันทึกรายการ',
  'หมายเหตุ',
];

export const exportTransactionsToCsv = (
  transactions: StockTransaction[],
  filename?: string
): void => {
  const rows: (string | number)[][] = [TRANSACTION_CSV_HEADERS];

  transactions.forEach((tx) => {
    rows.push([
      tx.date || '',
      tx.type === 'dispense' ? 'เบิกจ่าย' : 'รับเข้า',
      tx.oilName || '',
      tx.viscosity || '',
      Number(tx.amount) || 0,
      Number(tx.stockBefore) || 0,
      Number(tx.stockAfter) || 0,
      tx.recipientOrVehicle || '',
      tx.currentMileage !== undefined && tx.currentMileage !== null ? tx.currentMileage : '',
      tx.performedBy || '',
      tx.referenceNote || '',
    ]);
  });

  const name = filename || `ประวัติเบิกจ่ายและรับเข้า_CPT_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(rowsToCsvString(rows), name);
};

export const downloadTransactionsTemplateCsv = (): void => {
  const sampleRows: (string | number)[][] = [
    TRANSACTION_CSV_HEADERS,
    [
      '2026-10-15 08:30',
      'เบิกจ่าย',
      'Castrol EDGE Professional',
      '5W-30',
      25,
      120,
      95,
      '70-1122 กทม.',
      118500,
      'ช่างสุรชัย',
      'ถ่ายน้ำมันเครื่องตามรอบ 20,000 กม.',
    ],
    [
      '2026-10-10 13:00',
      'รับเข้า',
      'น้ำยาบำบัดไอเสีย AdBlue (DEF ถัง 1,000 ลิตร)',
      'AdBlue 32.5%',
      1000,
      0,
      1000,
      'บริษัท ซัพพลายเออร์เคมีภัณฑ์ จำกัด',
      '',
      'ผู้ดูแลระบบ',
      'รับเข้าล็อตประจำเดือน',
    ],
  ];

  downloadCsvFile(rowsToCsvString(sampleRows), 'แบบฟอร์มนำเข้า_ประวัติเบิกจ่ายและรับเข้า.csv');
};

export const parseTransactionsFromRows = (
  rawRows: string[][]
): { valid: Partial<StockTransaction>[]; errors: string[]; warnings: string[] } => {
  const valid: Partial<StockTransaction>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawRows.length < 2) {
    errors.push('ไฟล์ไม่มีข้อมูล (ต้องมีหัวตารางและแถวข้อมูลอย่างน้อย 1 แถว)');
    return { valid, errors, warnings };
  }

  const headerRow = rawRows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));
  };

  const colDate = findCol(['วัน-เวลา', 'วันที่', 'date']);
  const colType = findCol(['ประเภทรายการ', 'ประเภท', 'type']);
  const colName = findCol(['รายการสินค้า', 'ชื่อสินค้า', 'oilname', 'สินค้า']);
  const colViscosity = findCol(['เบอร์ความหนืด', 'ความหนืด', 'viscosity']);
  const colAmount = findCol(['จำนวน', 'amount', 'ลิตร']);
  const colBefore = findCol(['สต๊อกก่อนทำ', 'stockbefore']);
  const colAfter = findCol(['สต๊อกหลังทำ', 'stockafter']);
  const colRecipient = findCol(['ผู้เบิก', 'ทะเบียนรถ', 'recipientorvehicle', 'ผู้รับ']);
  const colMileage = findCol(['เลขไมล์', 'mileage', 'currentmileage']);
  const colPerformed = findCol(['ผู้บันทึก', 'performedby']);
  const colNote = findCol(['หมายเหตุ', 'referencenote', 'note']);

  if (colName === -1 || colAmount === -1) {
    errors.push('ไม่พบคอลัมน์ "รายการสินค้า/น้ำมัน" หรือ "จำนวน (ลิตร)" กรุณาตรวจสอบหัวคอลัมน์');
    return { valid, errors, warnings };
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const oilName = row[colName]?.trim();
    const amount = parseFloat(row[colAmount]?.replace(/,/g, ''));

    if (!oilName || isNaN(amount) || amount <= 0) {
      warnings.push(`แถวที่ ${i + 1}: ข้ามเนื่องจากชื่อสินค้าว่างหรือจำนวนลิตร <= 0`);
      continue;
    }

    const dateVal = colDate !== -1 ? row[colDate]?.trim() : '';
    const date = dateVal || new Date().toISOString();
    const typeRaw = colType !== -1 ? row[colType]?.trim()?.toLowerCase() || '' : '';
    const type: 'dispense' | 'receive' =
      typeRaw.includes('รับ') || typeRaw.includes('receive') || typeRaw.includes('in')
        ? 'receive'
        : 'dispense';

    const viscosity = colViscosity !== -1 ? row[colViscosity]?.trim() || '-' : '-';
    const stockBefore = colBefore !== -1 ? parseFloat(row[colBefore]?.replace(/,/g, '')) || 0 : 0;
    const stockAfter =
      colAfter !== -1
        ? parseFloat(row[colAfter]?.replace(/,/g, '')) || (type === 'dispense' ? stockBefore - amount : stockBefore + amount)
        : (type === 'dispense' ? stockBefore - amount : stockBefore + amount);

    const recipientOrVehicle = colRecipient !== -1 ? row[colRecipient]?.trim() || '-' : '-';
    const currentMileage = colMileage !== -1 ? parseFloat(row[colMileage]?.replace(/,/g, '')) || undefined : undefined;
    const performedBy = colPerformed !== -1 ? row[colPerformed]?.trim() || 'ผู้ดูแลระบบ' : 'ผู้ดูแลระบบ';
    const referenceNote = colNote !== -1 ? row[colNote]?.trim() || '' : '';

    valid.push({
      date,
      type,
      oilName,
      viscosity,
      amount,
      stockBefore,
      stockAfter,
      recipientOrVehicle,
      currentMileage,
      performedBy,
      referenceNote,
    });
  }

  return { valid, errors, warnings };
};
