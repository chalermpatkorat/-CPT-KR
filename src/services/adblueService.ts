import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, setCloudSyncStatus } from '../lib/firebase';
import { AdBlueRefillRecord, OilItem } from '../types';
import { recordDispense } from './stockService';
import * as XLSX from 'xlsx';

const ADBLUE_COLLECTION = 'adblue_refills';
const LOCAL_ADBLUE_KEY = 'cpt_adblue_refills_data';

const runInBackground = (task: () => Promise<any>) => {
  queueMicrotask(() => {
    task()
      .then(() => {
        setCloudSyncStatus('connected', null);
      })
      .catch((err) => {
        console.warn('Background sync note (adblue):', err?.message || err);
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', msg);
        } else if (msg.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', msg);
        }
      });
  });
};

// Initial realistic AdBlue refill records across recent months
export const INITIAL_ADBLUE_REFILLS: Array<Omit<AdBlueRefillRecord, 'id' | 'updatedAt' | 'createdAt'>> = [
  {
    licensePlate: '70-1122 กทม.',
    factory: 'โรงงาน 1',
    date: '2026-10-01T09:30',
    percentBefore: 18,
    percentAfter: 100,
    litersFilled: 22,
    filledBy: 'ช่างสุรชัย',
    currentMileage: 118450,
    notes: 'เติมเต็มถังก่อนออกวิ่งสายบางนา-แหลมฉบัง',
    deductedFromStock: true,
    updatedBy: 'ช่างสุรชัย',
  },
  {
    licensePlate: '70-5566 อยุธยา',
    factory: 'โรงงาน 2',
    date: '2026-09-28T14:15',
    percentBefore: 12,
    percentAfter: 95,
    litersFilled: 25,
    filledBy: 'ช่างประสิทธิ์',
    currentMileage: 140800,
    notes: 'ไฟเตือนระดับ AdBlue โชว์หน้าปัด',
    deductedFromStock: true,
    updatedBy: 'ช่างประสิทธิ์',
  },
  {
    licensePlate: '70-7788 สระบุรี',
    factory: 'โรงงาน 2',
    date: '2026-09-22T08:00',
    percentBefore: 25,
    percentAfter: 100,
    litersFilled: 20,
    filledBy: 'ช่างประสิทธิ์',
    currentMileage: 94600,
    notes: 'เติมเตรียมวิ่งสระบุรี-โคราช',
    deductedFromStock: true,
    updatedBy: 'ช่างประสิทธิ์',
  },
  {
    licensePlate: '70-9900 ระยอง',
    factory: 'โรงงาน 3',
    date: '2026-09-15T11:45',
    percentBefore: 20,
    percentAfter: 100,
    litersFilled: 24,
    filledBy: 'ช่างวิเชียร',
    currentMileage: 157200,
    notes: 'เติมประจำสัปดาห์ สายมาบตาพุด',
    deductedFromStock: true,
    updatedBy: 'ช่างวิเชียร',
  },
  {
    licensePlate: '71-4455 สมุทรปราการ',
    factory: 'โรงงาน 4',
    date: '2026-09-10T16:20',
    percentBefore: 15,
    percentAfter: 100,
    litersFilled: 18,
    filledBy: 'ช่างเอกชัย',
    currentMileage: 125600,
    notes: 'เติมถัง 20 ลิตรประจำรถ',
    deductedFromStock: true,
    updatedBy: 'ช่างเอกชัย',
  },
  {
    licensePlate: '72-6677 สมุทรปราการ',
    factory: 'โรงงาน 4',
    date: '2026-08-25T10:10',
    percentBefore: 10,
    percentAfter: 100,
    litersFilled: 26,
    filledBy: 'ช่างเอกชัย',
    currentMileage: 87900,
    notes: 'เติมก่อนเข้าท่าเรือมหาชัย',
    deductedFromStock: true,
    updatedBy: 'ช่างเอกชัย',
  },
  {
    licensePlate: '70-1122 กทม.',
    factory: 'โรงงาน 1',
    date: '2026-08-12T13:30',
    percentBefore: 22,
    percentAfter: 100,
    litersFilled: 20,
    filledBy: 'ช่างสุรชัย',
    currentMileage: 114200,
    notes: 'เติมเต็มถังหลังวิ่งระยะยาว',
    deductedFromStock: true,
    updatedBy: 'ช่างสุรชัย',
  }
];

let cachedAdBlueRefills: AdBlueRefillRecord[] | null = null;
const adBlueListeners: Array<(records: AdBlueRefillRecord[]) => void> = [];

export const getLocalAdBlueRefills = (): AdBlueRefillRecord[] => {
  if (cachedAdBlueRefills) {
    return cachedAdBlueRefills;
  }
  try {
    const raw = localStorage.getItem(LOCAL_ADBLUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedAdBlueRefills = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  const now = new Date().toISOString();
  const initRecords: AdBlueRefillRecord[] = INITIAL_ADBLUE_REFILLS.map((item, idx) => ({
    ...item,
    id: 'adblue_' + (idx + 1),
    createdAt: item.date ? new Date(item.date).toISOString() : now,
    updatedAt: now,
  }));
  cachedAdBlueRefills = initRecords;
  try {
    localStorage.setItem(LOCAL_ADBLUE_KEY, JSON.stringify(initRecords));
  } catch {
    // Ignore
  }
  return initRecords;
};

export const saveLocalAdBlueRefills = (records: AdBlueRefillRecord[]) => {
  cachedAdBlueRefills = records;
  try {
    localStorage.setItem(LOCAL_ADBLUE_KEY, JSON.stringify(records));
  } catch {
    // Ignore
  }
  adBlueListeners.forEach((cb) => cb(records));
};

export const subscribeAdBlueRefills = (
  onData: (records: AdBlueRefillRecord[]) => void,
  onError?: (err: Error) => void
) => {
  const localItems = getLocalAdBlueRefills();
  onData(localItems);
  adBlueListeners.push(onData);

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, ADBLUE_COLLECTION), orderBy('date', 'desc'));
    unsubFirestore = onSnapshot(
      q,
      async (snapshot) => {
        setCloudSyncStatus('connected', null);
        if (snapshot.empty) {
          await seedInitialAdBlueRefills();
          return;
        }
        const items: AdBlueRefillRecord[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            ...(docSnap.data() as AdBlueRefillRecord),
            id: docSnap.id,
          });
        });
        if (items.length > 0) {
          saveLocalAdBlueRefills(items);
        }
      },
      (error) => {
        console.warn('Firestore AdBlue notice:', error.message);
        if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', error.message);
        } else if (error.message.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', error.message);
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Subscribe AdBlue notice:', err?.message || err);
  }

  return () => {
    unsubFirestore();
    const idx = adBlueListeners.indexOf(onData);
    if (idx !== -1) adBlueListeners.splice(idx, 1);
  };
};

export const seedInitialAdBlueRefills = async () => {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (let i = 0; i < INITIAL_ADBLUE_REFILLS.length; i++) {
      const item = INITIAL_ADBLUE_REFILLS[i];
      const newRef = doc(collection(db, ADBLUE_COLLECTION), 'adblue_' + (i + 1));
      batch.set(newRef, {
        ...item,
        id: newRef.id,
        createdAt: item.date ? new Date(item.date).toISOString() : now,
        updatedAt: now,
      });
    }
    await batch.commit();
    setCloudSyncStatus('connected', null);
  } catch (err) {
    console.warn('Notice seeding AdBlue in Firestore:', err);
  }
};

// Add AdBlue Refill record with optional automatic stock deduction
export const addAdBlueRefill = async (
  params: {
    record: Omit<AdBlueRefillRecord, 'id' | 'createdAt' | 'updatedAt'>;
    adBlueOilItem?: OilItem | null;
  },
  userName: string
): Promise<string> => {
  const newId = 'adblue_' + Date.now();
  const now = new Date().toISOString();

  const newRecord: AdBlueRefillRecord = {
    ...params.record,
    id: newId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userName || 'สมาชิก',
  };

  const localItems = [newRecord, ...getLocalAdBlueRefills()];
  saveLocalAdBlueRefills(localItems);

  // If user linked an AdBlue stock item, deduct from stock
  if (params.record.deductedFromStock && params.adBlueOilItem) {
    try {
      await recordDispense({
        oil: params.adBlueOilItem,
        amount: params.record.litersFilled,
        recipientOrVehicle: `${params.record.licensePlate} (${params.record.factory})`,
        currentMileage: params.record.currentMileage,
        referenceNote: `เติม AdBlue จาก ${params.record.percentBefore}% เป็น ${params.record.percentAfter}% (${params.record.notes || '-'})`,
        date: params.record.date ? new Date(params.record.date).toISOString() : now,
        performedBy: params.record.filledBy || userName,
        vehicleId: params.record.vehicleId,
      });
    } catch (e: any) {
      console.warn('Stock deduction for AdBlue notice:', e?.message || e);
    }
  }

  runInBackground(async () => {
    const docRef = doc(collection(db, ADBLUE_COLLECTION), newId);
    await setDoc(docRef, newRecord);
  });

  return newId;
};

// Update AdBlue Refill record
export const updateAdBlueRefill = async (
  id: string,
  updates: Partial<AdBlueRefillRecord>,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const updatedList = getLocalAdBlueRefills().map((r) =>
    r.id === id ? { ...r, ...updates, updatedAt: now, updatedBy: userName } : r
  );
  saveLocalAdBlueRefills(updatedList);

  runInBackground(async () => {
    const docRef = doc(db, ADBLUE_COLLECTION, id);
    await setDoc(docRef, { ...updates, updatedAt: now, updatedBy: userName }, { merge: true });
  });
};

// Delete AdBlue Refill record
export const deleteAdBlueRefill = async (id: string): Promise<void> => {
  const filtered = getLocalAdBlueRefills().filter((r) => r.id !== id);
  saveLocalAdBlueRefills(filtered);

  runInBackground(async () => {
    const docRef = doc(db, ADBLUE_COLLECTION, id);
    await deleteDoc(docRef);
  });
};

// Export AdBlue Refills to Excel
export const exportAdBlueRefillsToExcel = (
  records: AdBlueRefillRecord[],
  filename = 'ประวัติการเติมน้ำยาแอดบลู.xlsx'
) => {
  const data = records.map((r, idx) => ({
    'ลำดับ': idx + 1,
    'วัน/เดือน/ปี ที่เติม': new Date(r.date).toLocaleString('th-TH'),
    'ทะเบียนรถ': r.licensePlate,
    'โรงงาน': r.factory,
    '%ก่อนเติม': `${r.percentBefore}%`,
    '%หลังเติม': `${r.percentAfter}%`,
    'จำนวนลิตรที่เติม': r.litersFilled,
    'ผู้เติม': r.filledBy,
    'เลขไมล์ (กม.)': r.currentMileage || '-',
    'หมายเหตุ': r.notes || '-',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ประวัติเติม AdBlue');
  XLSX.writeFile(wb, filename);
};
