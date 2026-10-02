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
import { Vehicle, FactoryItem } from '../types';

const VEHICLES_COLLECTION = 'vehicles';
const FACTORIES_COLLECTION = 'factories';
const LOCAL_VEHICLES_KEY = 'cpt_stock_vehicles_data';
const LOCAL_FACTORIES_KEY = 'cpt_stock_factories_data';

// Helper to run background tasks safely and report sync errors
const runInBackground = (task: () => Promise<any>) => {
  queueMicrotask(() => {
    task()
      .then(() => {
        setCloudSyncStatus('connected', null);
      })
      .catch((err) => {
        console.warn('Background sync note (vehicles):', err?.message || err);
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', msg);
        } else if (msg.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', msg);
        }
      });
  });
};

export const DEFAULT_FACTORIES = ['โรงงาน 1', 'โรงงาน 2', 'โรงงาน 3', 'โรงงาน 4'];

// Sample initial vehicles for the 4 factories
export const INITIAL_VEHICLES: Array<Omit<Vehicle, 'id' | 'updatedAt'>> = [
  // โรงงาน 1
  {
    licensePlate: '70-1122 กทม.',
    factory: 'โรงงาน 1',
    route: 'สายบางนา - แหลมฉบัง',
    distancePerTrip: 180,
    tripsPerMonth: 28,
    currentMileage: 118500,
    lastOilChangeMileage: 100000,
    lastOilChangeDate: '2026-06-15',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-10-15',
    notes: 'รถหัวลาก Hino 380 แรงม้า ช่างสุรชัย',
    updatedBy: 'ระบบตั้งต้น',
  },
  {
    licensePlate: '71-3344 กทม.',
    factory: 'โรงงาน 1',
    route: 'สายบางปะกง - ฉะเชิงเทรา',
    distancePerTrip: 95,
    tripsPerMonth: 30,
    currentMileage: 82400,
    lastOilChangeMileage: 75000,
    lastOilChangeDate: '2026-08-01',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-11-20',
    notes: 'รถหกล้อตู้บรรทุก Isuzu Forward',
    updatedBy: 'ระบบตั้งต้น',
  },

  // โรงงาน 2
  {
    licensePlate: '70-5566 อยุธยา',
    factory: 'โรงงาน 2',
    route: 'สายอยุธยา - สระบุรี (ขนหิน/ปูน)',
    distancePerTrip: 140,
    tripsPerMonth: 35,
    currentMileage: 141200,
    lastOilChangeMileage: 120000,
    lastOilChangeDate: '2026-05-10',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-09-28',
    notes: 'รถสิบล้อดั๊มพ์ Fuso Super Great เกินรอบแล้ว',
    updatedBy: 'ระบบตั้งต้น',
  },
  {
    licensePlate: '70-7788 สระบุรี',
    factory: 'โรงงาน 2',
    route: 'สายวังน้อย - นครราชสีมา',
    distancePerTrip: 320,
    tripsPerMonth: 20,
    currentMileage: 95000,
    lastOilChangeMileage: 90000,
    lastOilChangeDate: '2026-08-20',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-10-25',
    notes: 'รถหัวลาก Scania R450 ขนส่งสายยาว',
    updatedBy: 'ระบบตั้งต้น',
  },

  // โรงงาน 3
  {
    licensePlate: '70-9900 ระยอง',
    factory: 'โรงงาน 3',
    route: 'สายมาบตาพุด - นิคมพัฒนา',
    distancePerTrip: 110,
    tripsPerMonth: 40,
    currentMileage: 157800,
    lastOilChangeMileage: 140000,
    lastOilChangeDate: '2026-07-02',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-10-18',
    notes: 'รถบรรทุกตู้คอนเทนเนอร์เคมีภัณฑ์',
    updatedBy: 'ระบบตั้งต้น',
  },
  {
    licensePlate: '1ฒภ-2345 ชลบุรี',
    factory: 'โรงงาน 3',
    route: 'สายศรีราชา - อมตะนคร',
    distancePerTrip: 80,
    tripsPerMonth: 25,
    currentMileage: 64000,
    lastOilChangeMileage: 60000,
    lastOilChangeDate: '2026-09-01',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-12-15',
    notes: 'รถกระบะตอนเดียว Toyota Hilux Revo',
    updatedBy: 'ระบบตั้งต้น',
  },

  // โรงงาน 4
  {
    licensePlate: '71-4455 สมุทรปราการ',
    factory: 'โรงงาน 4',
    route: 'สายบางปู - พระประแดง',
    distancePerTrip: 75,
    tripsPerMonth: 32,
    currentMileage: 126000,
    lastOilChangeMileage: 110000,
    lastOilChangeDate: '2026-06-25',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-11-05',
    notes: 'รถหกล้อ Hino 500',
    updatedBy: 'ระบบตั้งต้น',
  },
  {
    licensePlate: '72-6677 สมุทรปราการ',
    factory: 'โรงงาน 4',
    route: 'สายสุขสวัสดิ์ - มหาชัย',
    distancePerTrip: 120,
    tripsPerMonth: 26,
    currentMileage: 88500,
    lastOilChangeMileage: 70000,
    lastOilChangeDate: '2026-07-15',
    oilChangeIntervalKm: 20000,
    nextOilChangeDueDate: '2026-10-10',
    notes: 'รถสิบล้อตู้ Isuzu Giga',
    updatedBy: 'ระบบตั้งต้น',
  },
];

let cachedVehicles: Vehicle[] | null = null;
let cachedFactories: FactoryItem[] | null = null;

export const getLocalVehicles = (): Vehicle[] => {
  if (cachedVehicles) {
    return cachedVehicles;
  }
  try {
    const raw = localStorage.getItem(LOCAL_VEHICLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed.map((v: Vehicle) => ({
          ...v,
          currentMileage: Number(v.currentMileage) || 0,
          lastOilChangeMileage:
            v.lastOilChangeMileage && Number(v.lastOilChangeMileage) > 0
              ? Number(v.lastOilChangeMileage)
              : Number(v.currentMileage) || 0,
        }));
        cachedVehicles = sanitized;
        return sanitized;
      }
    }
  } catch {
    // Ignore
  }
  const initialized: Vehicle[] = INITIAL_VEHICLES.map((v, idx) => ({
    ...v,
    id: 'veh_' + (idx + 1),
    updatedAt: new Date().toISOString(),
  }));
  cachedVehicles = initialized;
  try {
    localStorage.setItem(LOCAL_VEHICLES_KEY, JSON.stringify(initialized));
  } catch {
    // Ignore
  }
  return initialized;
};

export const saveLocalVehicles = (vehicles: Vehicle[]) => {
  cachedVehicles = vehicles;
  notifyVehicleListeners(vehicles);
};

export const getLocalFactories = (): FactoryItem[] => {
  if (cachedFactories) {
    return cachedFactories;
  }
  try {
    const raw = localStorage.getItem(LOCAL_FACTORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedFactories = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  const initFactories: FactoryItem[] = DEFAULT_FACTORIES.map((name, idx) => ({
    id: 'fac_' + (idx + 1),
    name,
    order: idx + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'ระบบตั้งต้น',
  }));
  cachedFactories = initFactories;
  try {
    localStorage.setItem(LOCAL_FACTORIES_KEY, JSON.stringify(initFactories));
  } catch {
    // Ignore
  }
  return initFactories;
};

export const saveLocalFactories = (factories: FactoryItem[]) => {
  cachedFactories = factories;
  notifyFactoryListeners(factories);
};

const vehicleListeners: Array<(vehicles: Vehicle[]) => void> = [];
const factoryListeners: Array<(factories: FactoryItem[]) => void> = [];

const notifyVehicleListeners = (vehicles: Vehicle[]) => {
  cachedVehicles = vehicles;
  try {
    localStorage.setItem(LOCAL_VEHICLES_KEY, JSON.stringify(vehicles));
  } catch {
    // Ignore
  }
  vehicleListeners.forEach((cb) => cb(vehicles));
};

const notifyFactoryListeners = (factories: FactoryItem[]) => {
  cachedFactories = factories;
  try {
    localStorage.setItem(LOCAL_FACTORIES_KEY, JSON.stringify(factories));
  } catch {
    // Ignore
  }
  factoryListeners.forEach((cb) => cb(factories));
};

export const formatThaiDate = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    if (typeof date === 'string') {
      const parts = date.slice(0, 10).split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const localDate = new Date(y, m, d);
          return localDate.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
      }
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
};

export interface VehicleCycleCalc {
  baseMileage: number;
  nextTargetMileage: number;
  kmSinceLastChange: number;
  kmRemaining: number;
  monthlyKm: number;
  dailyKm: number;
  estimatedDaysRemaining: number;
  estimatedDueDate: Date | null;
  dueDateString: string;
  formattedDueDate: string;
  isManualDueDate: boolean;
  status: 'normal' | 'due_soon' | 'overdue';
  statusText: string;
}

export const calculateVehicleCycle = (vehicle: Vehicle): VehicleCycleCalc => {
  const interval = vehicle.oilChangeIntervalKm || 20000;
  const currentKm = Number(vehicle.currentMileage) || 0;

  // Base mileage = starting odometer for this cycle
  const baseMileage =
    vehicle.lastOilChangeMileage && Number(vehicle.lastOilChangeMileage) > 0
      ? Number(vehicle.lastOilChangeMileage)
      : currentKm;

  // Target odometer = base mileage + 20,000 km
  const nextTargetMileage = baseMileage + interval;

  // Driven since last change
  const kmSinceLastChange = Math.max(0, currentKm - baseMileage);

  // Remaining km before reaching nextTargetMileage
  const kmRemaining = nextTargetMileage - currentKm;

  const monthlyKm = (Number(vehicle.distancePerTrip) || 0) * (Number(vehicle.tripsPerMonth) || 0);
  const dailyKm = monthlyKm > 0 ? monthlyKm / 30 : 50;

  let estimatedDaysRemaining = 999;
  let estimatedDueDate: Date | null = null;
  let isManualDueDate = false;

  if (vehicle.nextOilChangeDueDate) {
    try {
      const parts = vehicle.nextOilChangeDueDate.slice(0, 10).split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const manualDate = new Date(y, m, d);
        if (!isNaN(manualDate.getTime())) {
          estimatedDueDate = manualDate;
          isManualDueDate = true;
          const today = new Date();
          const nowMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          const dueMs = manualDate.getTime();
          estimatedDaysRemaining = Math.round((dueMs - nowMs) / 86400000);
        }
      }
    } catch {
      // Fallback
    }
  }

  if (!isManualDueDate) {
    if (kmRemaining <= 0) {
      estimatedDaysRemaining = 0;
      estimatedDueDate = new Date();
    } else if (dailyKm > 0) {
      estimatedDaysRemaining = Math.max(1, Math.round(kmRemaining / dailyKm));
      const today = new Date();
      estimatedDueDate = new Date(today.getTime() + estimatedDaysRemaining * 86400000);
    }
  }

  let status: 'normal' | 'due_soon' | 'overdue' = 'normal';
  let statusText = 'ปกติ';

  if (kmRemaining <= 0 || estimatedDaysRemaining <= 0) {
    status = 'overdue';
    statusText = 'เกินรอบเปลี่ยนถ่ายแล้ว (ต้องเรียกรถเข้าด่วน!)';
  } else if (kmRemaining <= 2000 || estimatedDaysRemaining <= 30) {
    status = 'due_soon';
    statusText = 'ใกล้ถึงรอบ (เตรียมเรียกรถเข้าถ่าย)';
  }

  const formattedDueDate = estimatedDueDate ? formatThaiDate(estimatedDueDate) : '-';

  let dueDateString = '';
  if (vehicle.nextOilChangeDueDate) {
    dueDateString = vehicle.nextOilChangeDueDate.slice(0, 10);
  } else if (estimatedDueDate) {
    const y = estimatedDueDate.getFullYear();
    const m = String(estimatedDueDate.getMonth() + 1).padStart(2, '0');
    const d = String(estimatedDueDate.getDate()).padStart(2, '0');
    dueDateString = `${y}-${m}-${d}`;
  }

  return {
    baseMileage,
    nextTargetMileage,
    kmSinceLastChange,
    kmRemaining,
    monthlyKm,
    dailyKm,
    estimatedDaysRemaining,
    estimatedDueDate,
    dueDateString,
    formattedDueDate,
    isManualDueDate,
    status,
    statusText,
  };
};

// Subscribe to vehicles list (live onSnapshot with instant local cache)
export const subscribeVehicles = (
  onData: (vehicles: Vehicle[]) => void,
  onError?: (err: Error) => void
) => {
  const localItems = getLocalVehicles();
  onData(localItems);
  vehicleListeners.push(onData);

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, VEHICLES_COLLECTION), orderBy('factory', 'asc'));
    unsubFirestore = onSnapshot(
      q,
      async (snapshot) => {
        setCloudSyncStatus('connected', null);
        if (snapshot.empty) {
          await seedInitialVehicles();
          return;
        }
        const items: Vehicle[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            ...(docSnap.data() as Vehicle),
            id: docSnap.id,
          });
        });
        if (items.length > 0) {
          notifyVehicleListeners(items);
        }
      },
      (error) => {
        console.warn('Firestore vehicles notice:', error.message);
        if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', error.message);
        } else if (error.message.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', error.message);
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Subscribe vehicles exception:', err?.message || err);
  }

  return () => {
    unsubFirestore();
    const idx = vehicleListeners.indexOf(onData);
    if (idx !== -1) vehicleListeners.splice(idx, 1);
  };
};

export const seedInitialVehicles = async () => {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (let i = 0; i < INITIAL_VEHICLES.length; i++) {
      const v = INITIAL_VEHICLES[i];
      const newRef = doc(collection(db, VEHICLES_COLLECTION), 'veh_' + (i + 1));
      batch.set(newRef, {
        ...v,
        id: newRef.id,
        updatedAt: now,
      });
    }
    await batch.commit();
    setCloudSyncStatus('connected', null);
  } catch (err) {
    console.warn('Notice seeding vehicles in Firestore:', err);
  }
};

// Add new vehicle
export const addVehicle = async (
  data: Partial<Vehicle> & { licensePlate: string; factory: string; currentMileage: number },
  userName: string
): Promise<string> => {
  const newId = 'veh_' + Date.now();
  const now = new Date().toISOString();
  const currentKm = Number(data.currentMileage) || 0;

  const newVehicle: Vehicle = {
    id: newId,
    licensePlate: data.licensePlate.trim(),
    factory: data.factory,
    route: data.route ? data.route.trim() : '',
    distancePerTrip: Number(data.distancePerTrip) || 0,
    tripsPerMonth: Number(data.tripsPerMonth) || 0,
    currentMileage: currentKm,
    lastOilChangeMileage: data.lastOilChangeMileage !== undefined ? Number(data.lastOilChangeMileage) : currentKm,
    lastOilChangeDate: data.lastOilChangeDate || now.slice(0, 10),
    oilChangeIntervalKm: data.oilChangeIntervalKm || 20000,
    nextOilChangeDueDate: data.nextOilChangeDueDate || undefined,
    notes: data.notes ? data.notes.trim() : '',
    updatedAt: now,
    updatedBy: userName || 'สมาชิก',
  };

  const localItems = [newVehicle, ...getLocalVehicles()];
  notifyVehicleListeners(localItems);

  runInBackground(async () => {
    const newRef = doc(collection(db, VEHICLES_COLLECTION), newId);
    await setDoc(newRef, newVehicle);
  });

  return newId;
};

// Update vehicle
export const updateVehicle = async (
  vehicleId: string,
  updates: Partial<Vehicle>,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const localItems = getLocalVehicles().map((v) =>
    v.id === vehicleId ? { ...v, ...updates, updatedAt: now, updatedBy: userName } : v
  );
  notifyVehicleListeners(localItems);

  runInBackground(async () => {
    const docRef = doc(db, VEHICLES_COLLECTION, vehicleId);
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

// Delete vehicle
export const deleteVehicle = async (vehicleId: string): Promise<void> => {
  const localItems = getLocalVehicles().filter((v) => v.id !== vehicleId);
  notifyVehicleListeners(localItems);

  runInBackground(async () => {
    const docRef = doc(db, VEHICLES_COLLECTION, vehicleId);
    await deleteDoc(docRef);
  });
};

// Record an oil change for a vehicle
export const recordOilChange = async (
  vehicleId: string,
  newMileage: number,
  changeDate: string,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const localItems = getLocalVehicles().map((v) =>
    v.id === vehicleId
      ? {
          ...v,
          lastOilChangeMileage: newMileage,
          currentMileage: newMileage,
          lastOilChangeDate: changeDate,
          updatedAt: now,
          updatedBy: userName,
        }
      : v
  );
  notifyVehicleListeners(localItems);

  runInBackground(async () => {
    const docRef = doc(db, VEHICLES_COLLECTION, vehicleId);
    await setDoc(
      docRef,
      {
        lastOilChangeMileage: newMileage,
        currentMileage: newMileage,
        lastOilChangeDate: changeDate,
        updatedAt: now,
        updatedBy: userName,
      },
      { merge: true }
    );
  });
};

// Quickly set or adjust the next scheduled call-in date for a vehicle
export const scheduleVehicleDueDate = async (
  vehicleId: string,
  dueDate: string,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const localItems = getLocalVehicles().map((v) =>
    v.id === vehicleId
      ? {
          ...v,
          nextOilChangeDueDate: dueDate ? dueDate : undefined,
          updatedAt: now,
          updatedBy: userName,
        }
      : v
  );
  notifyVehicleListeners(localItems);

  runInBackground(async () => {
    const docRef = doc(db, VEHICLES_COLLECTION, vehicleId);
    await setDoc(
      docRef,
      {
        nextOilChangeDueDate: dueDate || null,
        updatedAt: now,
        updatedBy: userName,
      },
      { merge: true }
    );
  });
};

// ==========================================
// FACTORY MANAGEMENT (เพิ่มและแก้ไขชื่อโรงงาน)
// ==========================================

export const seedDefaultFactories = async () => {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (let i = 0; i < DEFAULT_FACTORIES.length; i++) {
      const name = DEFAULT_FACTORIES[i];
      const newRef = doc(collection(db, FACTORIES_COLLECTION), 'fac_' + (i + 1));
      batch.set(newRef, {
        id: newRef.id,
        name,
        order: i + 1,
        updatedAt: now,
        updatedBy: 'ระบบตั้งต้น',
      });
    }
    await batch.commit();
    setCloudSyncStatus('connected', null);
  } catch (err) {
    console.warn('Notice seeding default factories in Firestore:', err);
  }
};

export const subscribeFactories = (
  onData: (factories: FactoryItem[]) => void,
  onError?: (err: Error) => void
) => {
  const localItems = getLocalFactories();
  onData(localItems);
  factoryListeners.push(onData);

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, FACTORIES_COLLECTION), orderBy('order', 'asc'));
    unsubFirestore = onSnapshot(
      q,
      async (snapshot) => {
        setCloudSyncStatus('connected', null);
        if (snapshot.empty) {
          await seedDefaultFactories();
          return;
        }
        const items: FactoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            ...(docSnap.data() as FactoryItem),
            id: docSnap.id,
          });
        });
        if (items.length > 0) {
          notifyFactoryListeners(items);
        }
      },
      (error) => {
        console.warn('Firestore factories notice:', error.message);
        if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('denied')) {
          setCloudSyncStatus('permission_denied', error.message);
        } else if (error.message.toLowerCase().includes('offline')) {
          setCloudSyncStatus('offline', error.message);
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Subscribe factories notice:', err?.message || err);
  }

  return () => {
    unsubFirestore();
    const idx = factoryListeners.indexOf(onData);
    if (idx !== -1) factoryListeners.splice(idx, 1);
  };
};

export const addFactory = async (name: string, userName: string): Promise<FactoryItem> => {
  const currentFactories = getLocalFactories();
  const existing = currentFactories.find(
    (f) => f.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) {
    throw new Error(`โรงงานชื่อ "${name}" มีอยู่ในระบบแล้ว`);
  }

  const now = new Date().toISOString();
  const newFactory: FactoryItem = {
    id: 'fac_' + Date.now(),
    name: name.trim(),
    order: currentFactories.length + 1,
    updatedAt: now,
    updatedBy: userName || 'สมาชิก',
  };

  const updatedList = [...currentFactories, newFactory];
  notifyFactoryListeners(updatedList);

  runInBackground(async () => {
    const newRef = doc(collection(db, FACTORIES_COLLECTION), newFactory.id);
    await setDoc(newRef, newFactory);
  });

  return newFactory;
};

export const updateFactoryName = async (
  factoryId: string,
  newName: string,
  oldName: string,
  userName: string
): Promise<void> => {
  const currentFactories = getLocalFactories();
  const duplicate = currentFactories.find(
    (f) => f.id !== factoryId && f.name.trim().toLowerCase() === newName.trim().toLowerCase()
  );
  if (duplicate) {
    throw new Error(`ชื่อโรงงาน "${newName}" ซ้ำกับโรงงานอื่น`);
  }

  const now = new Date().toISOString();
  const updatedFactories = currentFactories.map((f) =>
    f.id === factoryId ? { ...f, name: newName.trim(), updatedAt: now, updatedBy: userName } : f
  );
  notifyFactoryListeners(updatedFactories);

  const currentVehicles = getLocalVehicles();
  const affectedVehicles = currentVehicles.filter((v) => v.factory === oldName);
  if (affectedVehicles.length > 0) {
    const updatedVehicles = currentVehicles.map((v) =>
      v.factory === oldName ? { ...v, factory: newName.trim(), updatedAt: now, updatedBy: userName } : v
    );
    notifyVehicleListeners(updatedVehicles);
  }

  runInBackground(async () => {
    const facRef = doc(db, FACTORIES_COLLECTION, factoryId);
    await setDoc(
      facRef,
      {
        name: newName.trim(),
        updatedAt: now,
        updatedBy: userName,
      },
      { merge: true }
    );
  });
};

export const deleteFactory = async (factoryId: string, factoryName: string): Promise<void> => {
  const currentVehicles = getLocalVehicles();
  const assigned = currentVehicles.filter((v) => v.factory === factoryName);
  if (assigned.length > 0) {
    throw new Error(`ไม่สามารถลบ "${factoryName}" ได้เนื่องจากมีรถ ${assigned.length} คันสังกัดอยู่`);
  }

  const updatedFactories = getLocalFactories().filter((f) => f.id !== factoryId);
  notifyFactoryListeners(updatedFactories);

  runInBackground(async () => {
    const facRef = doc(db, FACTORIES_COLLECTION, factoryId);
    await deleteDoc(facRef);
  });
};
