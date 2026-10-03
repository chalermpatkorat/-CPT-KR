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
import { recordDispense, deleteTransactionRecord, getLocalTransactions } from './stockService';
import * as XLSX from 'xlsx';

const ADBLUE_COLLECTION = 'adblue_refills';
const LOCAL_ADBLUE_KEY = 'cpt_adblue_refills_data';
const DELETED_ADBLUE_KEY = 'cpt_deleted_adblue_ids';
const ADBLUE_INITIALIZED_KEY = 'cpt_adblue_initialized';

// Helper to remove undefined fields which Firestore strictly rejects with error
export const cleanForFirestore = <T extends Record<string, any>>(data: T): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
};

// Persistent tracker for deleted AdBlue record IDs to prevent them from reviving
export const getDeletedAdBlueIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_ADBLUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Ignore
  }
  return new Set();
};

export const markAdBlueIdDeleted = (id: string) => {
  const set = getDeletedAdBlueIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_ADBLUE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore
  }
};

export const unmarkAdBlueIdDeleted = (id: string) => {
  const set = getDeletedAdBlueIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_ADBLUE_KEY, JSON.stringify(Array.from(set)));
    } catch {
      // Ignore
    }
  }
};

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
  const deletedSet = getDeletedAdBlueIds();

  if (cachedAdBlueRefills) {
    return cachedAdBlueRefills.filter((r) => !deletedSet.has(r.id));
  }

  try {
    const raw = localStorage.getItem(LOCAL_ADBLUE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item: AdBlueRefillRecord) => !deletedSet.has(item.id));
        cachedAdBlueRefills = filtered;
        return filtered;
      }
    }
  } catch {
    // Ignore
  }

  // Only initialize default data if never initialized before and not cleared
  const isAlreadyInit = localStorage.getItem(ADBLUE_INITIALIZED_KEY) === 'true';
  if (isAlreadyInit) {
    cachedAdBlueRefills = [];
    return [];
  }

  const now = new Date().toISOString();
  const initRecords: AdBlueRefillRecord[] = INITIAL_ADBLUE_REFILLS
    .map((item, idx) => ({
      ...item,
      id: 'adblue_' + (idx + 1),
      createdAt: item.date ? new Date(item.date).toISOString() : now,
      updatedAt: now,
    }))
    .filter((item) => !deletedSet.has(item.id));

  cachedAdBlueRefills = initRecords;
  try {
    localStorage.setItem(LOCAL_ADBLUE_KEY, JSON.stringify(initRecords));
    localStorage.setItem(ADBLUE_INITIALIZED_KEY, 'true');
  } catch {
    // Ignore
  }
  return initRecords;
};

export const saveLocalAdBlueRefills = (records: AdBlueRefillRecord[]) => {
  const deletedSet = getDeletedAdBlueIds();
  const sanitized = records.filter((r) => !deletedSet.has(r.id));
  cachedAdBlueRefills = sanitized;
  try {
    localStorage.setItem(LOCAL_ADBLUE_KEY, JSON.stringify(sanitized));
    localStorage.setItem(ADBLUE_INITIALIZED_KEY, 'true');
  } catch {
    // Ignore
  }
  adBlueListeners.forEach((cb) => cb(sanitized));
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
        const isSeeded = localStorage.getItem(ADBLUE_INITIALIZED_KEY) === 'true';

        // Only seed initially if this is the very first time ever run on a clean database
        if (snapshot.empty && !isSeeded) {
          await seedInitialAdBlueRefills();
          localStorage.setItem(ADBLUE_INITIALIZED_KEY, 'true');
          return;
        }

        const deletedSet = getDeletedAdBlueIds();
        const firestoreItems: AdBlueRefillRecord[] = [];
        snapshot.forEach((docSnap) => {
          if (!deletedSet.has(docSnap.id)) {
            firestoreItems.push({
              ...(docSnap.data() as AdBlueRefillRecord),
              id: docSnap.id,
            });
          }
        });

        // Merge with any freshly added local items that haven't completed Firestore roundtrip yet
        const currentLocal = getLocalAdBlueRefills();
        const firestoreIds = new Set(firestoreItems.map((i) => i.id));
        const unsyncedLocal = currentLocal.filter(
          (l) => !firestoreIds.has(l.id) && !deletedSet.has(l.id)
        );

        // Sync pending local items to Firestore in background
        for (const localItem of unsyncedLocal) {
          runInBackground(async () => {
            const docRef = doc(collection(db, ADBLUE_COLLECTION), localItem.id);
            await setDoc(docRef, cleanForFirestore(localItem));
          });
        }

        const combined = [...firestoreItems, ...unsyncedLocal].sort((a, b) => {
          const tA = new Date(a.date || a.createdAt).getTime();
          const tB = new Date(b.date || b.createdAt).getTime();
          return tB - tA;
        });

        saveLocalAdBlueRefills(combined);
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
      batch.set(
        newRef,
        cleanForFirestore({
          ...item,
          id: newRef.id,
          createdAt: item.date ? new Date(item.date).toISOString() : now,
          updatedAt: now,
        })
      );
    }
    await batch.commit();
    setCloudSyncStatus('connected', null);
  } catch (err) {
    console.warn('Notice seeding AdBlue in Firestore:', err);
  }
};

// Add AdBlue Refill record with reliable local persistence and background cloud sync
export const addAdBlueRefill = async (
  params: {
    record: Omit<AdBlueRefillRecord, 'id' | 'createdAt' | 'updatedAt'>;
    adBlueOilItem?: OilItem | null;
  },
  userName: string
): Promise<string> => {
  const newId = 'adblue_' + Date.now();
  const now = new Date().toISOString();

  // If this ID was previously marked deleted, unmark it
  unmarkAdBlueIdDeleted(newId);

  let linkedTxId: string | undefined = undefined;

  // If user linked an AdBlue stock item, deduct from stock and get transaction ID
  if (params.record.deductedFromStock && params.adBlueOilItem) {
    try {
      linkedTxId = await recordDispense({
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

  const newRecord: AdBlueRefillRecord = {
    ...params.record,
    id: newId,
    dispenseTxId: linkedTxId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userName || 'สมาชิก',
  };

  const localItems = [newRecord, ...getLocalAdBlueRefills()];
  saveLocalAdBlueRefills(localItems);

  runInBackground(async () => {
    const docRef = doc(collection(db, ADBLUE_COLLECTION), newId);
    await setDoc(docRef, cleanForFirestore(newRecord));
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
    await setDoc(
      docRef,
      cleanForFirestore({ ...updates, updatedAt: now, updatedBy: userName }),
      { merge: true }
    );
  });
};

// Delete AdBlue Refill record permanently (with optional linked stock transaction cleanup)
export const deleteAdBlueRefill = async (id: string, userName?: string): Promise<void> => {
  // 1. Mark in permanent deleted set so Firestore onSnapshot will NEVER revive it
  markAdBlueIdDeleted(id);

  // 2. Find record to check if linked dispense transaction exists
  const targetRecord = getLocalAdBlueRefills().find((r) => r.id === id);

  // 3. Remove from local state immediately
  const filtered = getLocalAdBlueRefills().filter((r) => r.id !== id);
  saveLocalAdBlueRefills(filtered);

  // 4. If linked to a stock dispense transaction, restore the stock by deleting the transaction
  if (targetRecord?.dispenseTxId && userName) {
    try {
      const allTxs = getLocalTransactions();
      const linkedTx = allTxs.find((t) => t.id === targetRecord.dispenseTxId);
      if (linkedTx) {
        await deleteTransactionRecord(linkedTx, userName);
      }
    } catch (e: any) {
      console.warn('Could not reverse linked stock transaction:', e);
    }
  }

  // 5. Delete from Firestore in background
  runInBackground(async () => {
    const docRef = doc(db, ADBLUE_COLLECTION, id);
    await deleteDoc(docRef);
  });
};

// Delete all AdBlue refills for a specific vehicle in a given month (YYYY-MM)
export const deleteAdBlueRefillsForVehicleInMonth = async (
  licensePlate: string,
  yearMonth: string,
  userName?: string
): Promise<number> => {
  const cleanPlate = licensePlate.trim().toLowerCase();
  if (!cleanPlate || cleanPlate === 'อื่นๆ') return 0;
  const records = getLocalAdBlueRefills();

  const toDelete = records.filter((r) => {
    const m = (r.date || r.createdAt || '').slice(0, 7);
    if (m !== yearMonth) return false;
    const p = (r.licensePlate || '').trim().toLowerCase();
    return (
      p === cleanPlate ||
      p.includes(cleanPlate) ||
      (cleanPlate.length >= 3 && cleanPlate.includes(p))
    );
  });

  for (const r of toDelete) {
    await deleteAdBlueRefill(r.id, userName);
  }

  return toDelete.length;
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
