import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, setCloudSyncStatus } from '../lib/firebase';
import { OilItem, StockTransaction } from '../types';
import { getLocalVehicles, saveLocalVehicles } from './vehicleService';

const OILS_COLLECTION = 'oils';
const TRANSACTIONS_COLLECTION = 'transactions';
const LOCAL_OILS_KEY = 'cpt_stock_oils_data';
const LOCAL_TXS_KEY = 'cpt_stock_txs_data';

// Helper to run background tasks safely and report sync errors
const runInBackground = (task: () => Promise<any>) => {
  queueMicrotask(() => {
    task()
      .then(() => {
        setCloudSyncStatus('connected', null);
      })
      .catch((err) => {
        console.warn('Background sync note (stock):', err?.message || err);
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', msg);
        } else if (msg.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', msg);
        }
      });
  });
};

// Sample initial stock items to seed when database is clean
export const INITIAL_OILS: Array<Omit<OilItem, 'id' | 'updatedAt'>> = [
  {
    name: 'Castrol EDGE Professional',
    brand: 'Castrol',
    viscosity: '5W-30',
    oilType: 'สังเคราะห์แท้ (Fully Synthetic)',
    currentStock: 120,
    totalUsed: 80,
    totalReceived: 200,
    minStockThreshold: 30,
    unit: 'ลิตร',
    notes: 'สำหรับเครื่องยนต์เบนซินและดีเซลสมรรถนะสูง มาตรฐาน ACEA C3, API SP',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'Shell Helix Ultra Eco',
    brand: 'Shell',
    viscosity: '0W-20',
    oilType: 'สังเคราะห์แท้ (Fully Synthetic)',
    currentStock: 15,
    totalUsed: 145,
    totalReceived: 160,
    minStockThreshold: 25,
    unit: 'ลิตร',
    notes: 'สำหรับรถยนต์ Eco Car และไฮบริด ช่วยประหยัดน้ำมันสูงสุด',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'PTT Dynamic Commonrail',
    brand: 'PTT Lubricants',
    viscosity: '10W-30',
    oilType: 'กึ่งสังเคราะห์ (Semi Synthetic)',
    currentStock: 85,
    totalUsed: 215,
    totalReceived: 300,
    minStockThreshold: 40,
    unit: 'ลิตร',
    notes: 'สำหรับรถกระบะและรถยนต์ดีเซลคอมมอนเรลงานหนัก',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'Mobil 1 FS Extreme Protection',
    brand: 'Mobil 1',
    viscosity: '5W-40',
    oilType: 'สังเคราะห์แท้ (Fully Synthetic)',
    currentStock: 0,
    totalUsed: 100,
    totalReceived: 100,
    minStockThreshold: 20,
    unit: 'ลิตร',
    notes: 'ทนความร้อนสูงพิเศษ ปกป้องเครื่องยนต์รอบจัด',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'Valvoline All-Climate HD',
    brand: 'Valvoline',
    viscosity: '15W-40',
    oilType: 'ธรรมดา (Mineral)',
    currentStock: 160,
    totalUsed: 140,
    totalReceived: 300,
    minStockThreshold: 50,
    unit: 'ลิตร',
    notes: 'สำหรับเครื่องยนต์ดีเซลงานหนัก รถบรรทุกและเครื่องจักรการเกษตร',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'Motul H-Tech 100 Plus',
    brand: 'Motul',
    viscosity: '5W-30',
    oilType: 'สังเคราะห์แท้ (Fully Synthetic)',
    currentStock: 45,
    totalUsed: 55,
    totalReceived: 100,
    minStockThreshold: 20,
    unit: 'ลิตร',
    notes: 'เทคโนโลยีจากสนามแข่ง ปกป้องเครื่องยนต์เทอร์โบ',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'น้ำยาบำบัดไอเสีย AdBlue (DEF ถัง 1,000 ลิตร)',
    brand: 'AdBlue มาตรฐาน ISO 22241',
    viscosity: 'AdBlue 32.5%',
    currentStock: 750,
    totalUsed: 250,
    totalReceived: 1000,
    minStockThreshold: 200,
    unit: 'ลิตร',
    notes: 'สำหรับรถบรรทุกเครื่องยนต์ดีเซลมาตรฐาน EURO 5 / EURO 6 ทุกโรงงาน',
    updatedBy: 'ผู้ดูแลระบบ',
  },
  {
    name: 'น้ำยาบำบัดไอเสีย AdBlue (แกลลอน 20 ลิตร)',
    brand: 'AdBlue Pro Clean',
    viscosity: 'AdBlue 32.5%',
    currentStock: 60,
    totalUsed: 40,
    totalReceived: 100,
    minStockThreshold: 20,
    unit: 'ลิตร',
    notes: 'แกลลอนพกพาสำหรับรถวิ่งสายยาวและสำรองประจำรถ',
    updatedBy: 'ผู้ดูแลระบบ',
  }
];

let cachedOils: OilItem[] | null = null;
let cachedTxs: StockTransaction[] | null = null;

// Helper to get local oils from memory or storage
export const getLocalOils = (): OilItem[] => {
  if (cachedOils) {
    return cachedOils;
  }
  try {
    const raw = localStorage.getItem(LOCAL_OILS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedOils = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  const initialized: OilItem[] = INITIAL_OILS.map((item, idx) => ({
    ...item,
    id: 'oil_' + (idx + 1),
    updatedAt: new Date().toISOString(),
  }));
  cachedOils = initialized;
  try {
    localStorage.setItem(LOCAL_OILS_KEY, JSON.stringify(initialized));
  } catch {
    // Ignore
  }
  return initialized;
};

export const saveLocalOils = (items: OilItem[]) => {
  cachedOils = items;
  try {
    localStorage.setItem(LOCAL_OILS_KEY, JSON.stringify(items));
  } catch {
    // Ignore
  }
};

export const getLocalTransactions = (): StockTransaction[] => {
  if (cachedTxs) {
    return cachedTxs;
  }
  try {
    const raw = localStorage.getItem(LOCAL_TXS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedTxs = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  const oils = getLocalOils();
  const now = new Date(Date.now() - 3 * 86400000).toISOString();
  const initTxs: StockTransaction[] = oils.map((o, idx) => ({
    id: 'tx_seed_' + (idx + 1),
    oilId: o.id,
    oilName: o.name,
    viscosity: o.viscosity,
    type: 'receive',
    amount: o.totalReceived,
    stockBefore: 0,
    stockAfter: o.totalReceived,
    performedBy: 'ระบบตั้งต้นคลัง CPT',
    recipientOrVehicle: 'คลังสินค้าส่วนกลาง',
    referenceNote: 'ยอดยกมาตั้งต้นคลังน้ำมันเครื่อง',
    date: now,
    createdAt: now,
  }));
  cachedTxs = initTxs;
  try {
    localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(initTxs));
  } catch {
    // Ignore
  }
  return initTxs;
};

export const saveLocalTransactions = (txs: StockTransaction[]) => {
  cachedTxs = txs;
  try {
    localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(txs));
  } catch {
    // Ignore
  }
};

const oilListeners: Array<(oils: OilItem[]) => void> = [];
const txListeners: Array<(txs: StockTransaction[]) => void> = [];

const notifyOilListeners = (oils: OilItem[]) => {
  saveLocalOils(oils);
  oilListeners.forEach((cb) => cb(oils));
};

const notifyTxListeners = (txs: StockTransaction[]) => {
  saveLocalTransactions(txs);
  txListeners.forEach((cb) => cb(txs));
};

// Subscribe to real-time engine oil list (live onSnapshot)
export const subscribeOils = (
  onData: (oils: OilItem[]) => void,
  onError?: (err: Error) => void
) => {
  const localItems = getLocalOils();
  onData(localItems);
  oilListeners.push(onData);

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, OILS_COLLECTION), orderBy('brand', 'asc'));
    unsubFirestore = onSnapshot(
      q,
      async (snapshot) => {
        setCloudSyncStatus('connected', null);
        if (snapshot.empty) {
          await seedInitialData();
          return;
        }
        const items: OilItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            ...(docSnap.data() as OilItem),
            id: docSnap.id,
          });
        });
        if (items.length > 0) {
          notifyOilListeners(items);
        }
      },
      (error) => {
        console.warn('Firestore oils notice:', error.message);
        if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', error.message);
        } else if (error.message.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', error.message);
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Subscribe oils notice:', err?.message || err);
  }

  return () => {
    unsubFirestore();
    const idx = oilListeners.indexOf(onData);
    if (idx !== -1) oilListeners.splice(idx, 1);
  };
};

// Subscribe to real-time stock transaction history
export const subscribeTransactions = (
  onData: (txs: StockTransaction[]) => void,
  onError?: (err: Error) => void
) => {
  const localItems = getLocalTransactions();
  onData(localItems);
  txListeners.push(onData);

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, TRANSACTIONS_COLLECTION), orderBy('createdAt', 'desc'));
    unsubFirestore = onSnapshot(
      q,
      (snapshot) => {
        setCloudSyncStatus('connected', null);
        const items: StockTransaction[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            ...(docSnap.data() as StockTransaction),
            id: docSnap.id,
          });
        });
        if (items.length > 0) {
          notifyTxListeners(items);
        }
      },
      (error) => {
        console.warn('Firestore transactions notice:', error.message);
        if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', error.message);
        } else if (error.message.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', error.message);
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Subscribe transactions notice:', err?.message || err);
  }

  return () => {
    unsubFirestore();
    const idx = txListeners.indexOf(onData);
    if (idx !== -1) txListeners.splice(idx, 1);
  };
};

// Seed initial oils with single batch commit
export const seedInitialData = async () => {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (let i = 0; i < INITIAL_OILS.length; i++) {
      const oil = INITIAL_OILS[i];
      const newDocRef = doc(collection(db, OILS_COLLECTION), 'oil_' + (i + 1));
      batch.set(newDocRef, {
        ...oil,
        id: newDocRef.id,
        updatedAt: nowIso,
        createdAt: nowIso,
      });

      const txRef = doc(collection(db, TRANSACTIONS_COLLECTION), 'tx_seed_' + (i + 1));
      batch.set(txRef, {
        id: txRef.id,
        oilId: newDocRef.id,
        oilName: oil.name,
        viscosity: oil.viscosity,
        type: 'receive',
        amount: oil.totalReceived,
        stockBefore: 0,
        stockAfter: oil.totalReceived,
        performedBy: 'ระบบตั้งต้น (System Seed)',
        recipientOrVehicle: 'คลังสินค้าส่วนกลาง',
        referenceNote: 'ยอดยกมาตั้งต้นคลังน้ำมันเครื่อง',
        date: new Date(Date.now() - 7 * 86400000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
        updatedBy: 'ระบบ',
      });
    }
    await batch.commit();
    setCloudSyncStatus('connected', null);
  } catch (err) {
    console.warn('Notice seeding data in Firestore:', err);
  }
};

// Add new oil item
export const addOilItem = async (
  data: Omit<OilItem, 'id' | 'updatedAt' | 'createdAt'>,
  userName: string
): Promise<string> => {
  const newId = 'oil_' + Date.now();
  const now = new Date().toISOString();
  const newItem: OilItem = {
    ...data,
    id: newId,
    currentStock: Number(data.currentStock) || 0,
    totalUsed: Number(data.totalUsed) || 0,
    totalReceived: Number(data.totalReceived) || Number(data.currentStock) || 0,
    minStockThreshold: Number(data.minStockThreshold) || 10,
    unit: 'ลิตร',
    updatedAt: now,
    createdAt: now,
    updatedBy: userName || 'สมาชิก',
  };

  const localOils = getLocalOils();
  notifyOilListeners([newItem, ...localOils]);

  runInBackground(async () => {
    const newRef = doc(collection(db, OILS_COLLECTION), newId);
    await setDoc(newRef, newItem);
  });

  return newId;
};

// Update oil item
export const updateOilItem = async (
  oilId: string,
  updates: Partial<OilItem>,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const localOils = getLocalOils();
  const updatedOils = localOils.map((o) =>
    o.id === oilId ? { ...o, ...updates, updatedAt: now, updatedBy: userName } : o
  );
  notifyOilListeners(updatedOils);

  runInBackground(async () => {
    const docRef = doc(db, OILS_COLLECTION, oilId);
    await setDoc(
      docRef,
      {
        ...updates,
        updatedAt: now,
        updatedBy: userName || 'สมาชิก',
      },
      { merge: true }
    );
  });
};

// Delete oil item
export const deleteOilItem = async (oilId: string): Promise<void> => {
  const localOils = getLocalOils().filter((o) => o.id !== oilId);
  notifyOilListeners(localOils);

  runInBackground(async () => {
    const docRef = doc(db, OILS_COLLECTION, oilId);
    await deleteDoc(docRef);
  });
};

// Record dispense
export const recordDispense = async (params: {
  oil: OilItem;
  amount: number;
  recipientOrVehicle: string;
  currentMileage?: number;
  referenceNote?: string;
  date?: string;
  performedBy: string;
  vehicleId?: string;
}): Promise<void> => {
  const { oil, amount, recipientOrVehicle, currentMileage, referenceNote, date, performedBy, vehicleId } = params;

  if (amount <= 0) {
    throw new Error('จำนวนที่ต้องการเบิกต้องมากกว่า 0 ลิตร');
  }
  if (oil.currentStock < amount) {
    throw new Error(`ไม่สามารถเบิกได้เนื่องจากสต๊อกคงเหลือมีเพียง ${oil.currentStock} ลิตร (ต้องการเบิก ${amount} ลิตร)`);
  }

  const nowIso = new Date().toISOString();
  const txDate = date || nowIso;
  const newStock = Math.round((oil.currentStock - amount) * 100) / 100;
  const newUsed = Math.round(((oil.totalUsed || 0) + amount) * 100) / 100;
  const newTxId = 'tx_' + Date.now();

  const newTx: StockTransaction = {
    id: newTxId,
    oilId: oil.id,
    oilName: oil.name,
    viscosity: oil.viscosity,
    type: 'dispense',
    amount,
    stockBefore: oil.currentStock,
    stockAfter: newStock,
    performedBy,
    recipientOrVehicle,
    currentMileage: currentMileage ? Number(currentMileage) : undefined,
    referenceNote: referenceNote || '',
    date: txDate,
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: performedBy,
  };

  const localOils = getLocalOils().map((o) =>
    o.id === oil.id ? { ...o, currentStock: newStock, totalUsed: newUsed, updatedAt: nowIso, updatedBy: performedBy } : o
  );
  notifyOilListeners(localOils);

  const localTxs = [newTx, ...getLocalTransactions()];
  notifyTxListeners(localTxs);

  if (vehicleId && currentMileage && Number(currentMileage) > 0) {
    try {
      const vList = getLocalVehicles().map((v) =>
        v.id === vehicleId ? { ...v, currentMileage: Number(currentMileage), updatedAt: nowIso, updatedBy: performedBy } : v
      );
      saveLocalVehicles(vList);
    } catch {
      // Ignore
    }
  }

  runInBackground(async () => {
    const oilRef = doc(db, OILS_COLLECTION, oil.id);
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION), newTxId);
    await runTransaction(db, async (transaction) => {
      const oilDoc = await transaction.get(oilRef);
      if (oilDoc.exists()) {
        const cur = oilDoc.data() as OilItem;
        const sAfter = Math.round((cur.currentStock - amount) * 100) / 100;
        const uAfter = Math.round(((cur.totalUsed || 0) + amount) * 100) / 100;
        transaction.update(oilRef, {
          currentStock: sAfter,
          totalUsed: uAfter,
          updatedAt: nowIso,
          updatedBy: performedBy,
        });
      } else {
        transaction.set(oilRef, {
          ...oil,
          currentStock: newStock,
          totalUsed: newUsed,
          updatedAt: nowIso,
          updatedBy: performedBy,
        });
      }
      transaction.set(txRef, newTx);

      if (vehicleId && currentMileage && Number(currentMileage) > 0) {
        const vRef = doc(db, 'vehicles', vehicleId);
        transaction.set(
          vRef,
          {
            currentMileage: Number(currentMileage),
            updatedAt: nowIso,
            updatedBy: performedBy,
          },
          { merge: true }
        );
      }
    });
  });
};

// Record receive
export const recordReceive = async (params: {
  oil: OilItem;
  amount: number;
  supplierOrSource: string;
  referenceNote?: string;
  date?: string;
  performedBy: string;
}): Promise<void> => {
  const { oil, amount, supplierOrSource, referenceNote, date, performedBy } = params;

  if (amount <= 0) {
    throw new Error('จำนวนที่รับเข้าต้องมากกว่า 0 ลิตร');
  }

  const nowIso = new Date().toISOString();
  const txDate = date || nowIso;
  const newStock = Math.round((oil.currentStock + amount) * 100) / 100;
  const newReceived = Math.round(((oil.totalReceived || 0) + amount) * 100) / 100;
  const newTxId = 'tx_' + Date.now();

  const newTx: StockTransaction = {
    id: newTxId,
    oilId: oil.id,
    oilName: oil.name,
    viscosity: oil.viscosity,
    type: 'receive',
    amount,
    stockBefore: oil.currentStock,
    stockAfter: newStock,
    performedBy,
    recipientOrVehicle: supplierOrSource,
    referenceNote: referenceNote || '',
    date: txDate,
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: performedBy,
  };

  const localOils = getLocalOils().map((o) =>
    o.id === oil.id ? { ...o, currentStock: newStock, totalReceived: newReceived, updatedAt: nowIso, updatedBy: performedBy } : o
  );
  notifyOilListeners(localOils);

  const localTxs = [newTx, ...getLocalTransactions()];
  notifyTxListeners(localTxs);

  runInBackground(async () => {
    const oilRef = doc(db, OILS_COLLECTION, oil.id);
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION), newTxId);
    await runTransaction(db, async (transaction) => {
      const oilDoc = await transaction.get(oilRef);
      if (oilDoc.exists()) {
        const cur = oilDoc.data() as OilItem;
        const sAfter = Math.round((cur.currentStock + amount) * 100) / 100;
        const rAfter = Math.round(((cur.totalReceived || 0) + amount) * 100) / 100;
        transaction.update(oilRef, {
          currentStock: sAfter,
          totalReceived: rAfter,
          updatedAt: nowIso,
          updatedBy: performedBy,
        });
      } else {
        transaction.set(oilRef, {
          ...oil,
          currentStock: newStock,
          totalReceived: newReceived,
          updatedAt: nowIso,
          updatedBy: performedBy,
        });
      }
      transaction.set(txRef, newTx);
    });
  });
};

// Update transaction record
export const updateTransactionRecord = async (
  originalTx: StockTransaction,
  updatedFields: {
    amount: number;
    recipientOrVehicle: string;
    referenceNote?: string;
    date: string;
    performedBy: string;
  },
  userName: string
): Promise<void> => {
  const deltaAmount = updatedFields.amount - originalTx.amount;
  const nowIso = new Date().toISOString();

  const localOils = getLocalOils().map((oil) => {
    if (oil.id === originalTx.oilId) {
      let newStock = oil.currentStock;
      let newUsed = oil.totalUsed || 0;
      let newReceived = oil.totalReceived || 0;

      if (originalTx.type === 'dispense') {
        newStock = Math.round((oil.currentStock - deltaAmount) * 100) / 100;
        newUsed = Math.round(((oil.totalUsed || 0) + deltaAmount) * 100) / 100;
      } else if (originalTx.type === 'receive') {
        newStock = Math.round((oil.currentStock + deltaAmount) * 100) / 100;
        newReceived = Math.round(((oil.totalReceived || 0) + deltaAmount) * 100) / 100;
      }
      return { ...oil, currentStock: newStock, totalUsed: newUsed, totalReceived: newReceived, updatedAt: nowIso };
    }
    return oil;
  });
  notifyOilListeners(localOils);

  const localTxs = getLocalTransactions().map((t) =>
    t.id === originalTx.id
      ? { ...t, ...updatedFields, updatedAt: nowIso, updatedBy: userName }
      : t
  );
  notifyTxListeners(localTxs);

  runInBackground(async () => {
    const txRef = doc(db, TRANSACTIONS_COLLECTION, originalTx.id);
    const oilRef = doc(db, OILS_COLLECTION, originalTx.oilId);
    await runTransaction(db, async (transaction) => {
      const oilDoc = await transaction.get(oilRef);
      if (oilDoc.exists()) {
        const oilData = oilDoc.data() as OilItem;
        let newStock = oilData.currentStock;
        let newUsed = oilData.totalUsed || 0;
        let newReceived = oilData.totalReceived || 0;

        if (originalTx.type === 'dispense') {
          newStock = Math.round((oilData.currentStock - deltaAmount) * 100) / 100;
          newUsed = Math.round(((oilData.totalUsed || 0) + deltaAmount) * 100) / 100;
        } else if (originalTx.type === 'receive') {
          newStock = Math.round((oilData.currentStock + deltaAmount) * 100) / 100;
          newReceived = Math.round(((oilData.totalReceived || 0) + deltaAmount) * 100) / 100;
        }

        transaction.update(oilRef, {
          currentStock: newStock,
          totalUsed: Math.max(0, newUsed),
          totalReceived: Math.max(0, newReceived),
          updatedAt: nowIso,
          updatedBy: userName,
        });
      }
      transaction.set(
        txRef,
        {
          amount: updatedFields.amount,
          recipientOrVehicle: updatedFields.recipientOrVehicle,
          referenceNote: updatedFields.referenceNote || '',
          date: updatedFields.date,
          performedBy: updatedFields.performedBy,
          updatedAt: nowIso,
          updatedBy: userName,
        },
        { merge: true }
      );
    });
  });
};

// Delete transaction
export const deleteTransactionRecord = async (
  tx: StockTransaction,
  userName: string
): Promise<void> => {
  const nowIso = new Date().toISOString();

  const localOils = getLocalOils().map((oil) => {
    if (oil.id === tx.oilId) {
      let newStock = oil.currentStock;
      let newUsed = oil.totalUsed || 0;
      let newReceived = oil.totalReceived || 0;

      if (tx.type === 'dispense') {
        newStock = Math.round((oil.currentStock + tx.amount) * 100) / 100;
        newUsed = Math.max(0, Math.round(((oil.totalUsed || 0) - tx.amount) * 100) / 100);
      } else if (tx.type === 'receive') {
        newStock = Math.round((oil.currentStock - tx.amount) * 100) / 100;
        newReceived = Math.max(0, Math.round(((oil.totalReceived || 0) - tx.amount) * 100) / 100);
      }
      return { ...oil, currentStock: newStock, totalUsed: newUsed, totalReceived: newReceived, updatedAt: nowIso };
    }
    return oil;
  });
  notifyOilListeners(localOils);

  const localTxs = getLocalTransactions().filter((t) => t.id !== tx.id);
  notifyTxListeners(localTxs);

  runInBackground(async () => {
    const txRef = doc(db, TRANSACTIONS_COLLECTION, tx.id);
    const oilRef = doc(db, OILS_COLLECTION, tx.oilId);
    await runTransaction(db, async (transaction) => {
      const oilDoc = await transaction.get(oilRef);
      if (oilDoc.exists()) {
        const oilData = oilDoc.data() as OilItem;
        let newStock = oilData.currentStock;
        let newUsed = oilData.totalUsed || 0;
        let newReceived = oilData.totalReceived || 0;

        if (tx.type === 'dispense') {
          newStock = Math.round((oilData.currentStock + tx.amount) * 100) / 100;
          newUsed = Math.max(0, Math.round(((oilData.totalUsed || 0) - tx.amount) * 100) / 100);
        } else if (tx.type === 'receive') {
          newStock = Math.round((oilData.currentStock - tx.amount) * 100) / 100;
          newReceived = Math.max(0, Math.round(((oilData.totalReceived || 0) - tx.amount) * 100) / 100);
        }

        transaction.update(oilRef, {
          currentStock: newStock,
          totalUsed: newUsed,
          totalReceived: newReceived,
          updatedAt: nowIso,
          updatedBy: userName,
        });
      }
      transaction.delete(txRef);
    });
  });
};
