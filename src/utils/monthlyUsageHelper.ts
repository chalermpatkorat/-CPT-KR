import { Vehicle, StockTransaction, AdBlueRefillRecord } from '../types';

export interface VehicleMonthlyUsageRecord {
  month: string; // YYYY-MM
  vehicleId?: string;
  licensePlate: string;
  factory: string;
  route?: string;
  engineOilLiters: number;
  engineOilCount: number;
  adBlueLiters: number;
  adBlueCount: number;
  totalLiters: number;
  latestMileage: number;
  lastServiceOrRefillDate?: string;
  isFromVehicleCycleRecord?: boolean;
}

export interface MonthSummaryItem {
  monthKey: string;
  monthName: string;
  monthNumber: number;
  engineOilLiters: number;
  engineOilTxCount: number;
  adBlueLiters: number;
  adBlueRefillCount: number;
  totalLiters: number;
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Checks if a transaction is an AdBlue dispense
 */
export const isAdBlueTransaction = (tx: StockTransaction): boolean => {
  const text = `${tx.oilName || ''} ${tx.viscosity || ''} ${tx.referenceNote || ''}`.toLowerCase();
  return text.includes('adblue') || text.includes('แอดบลู') || text.includes('def');
};

/**
 * Robust vehicle matcher that reliably connects any text / plate / transaction / refill to a vehicle
 */
export const findMatchingVehicle = (
  text: string,
  vehicles: Vehicle[],
  vehicleId?: string
): Vehicle | undefined => {
  if (vehicleId) {
    const byId = vehicles.find((v) => v.id === vehicleId);
    if (byId) return byId;
  }
  if (!text || !text.trim()) return undefined;

  const raw = text.trim();
  const rawLower = raw.toLowerCase();

  // 1. Exact match
  const exact = vehicles.find((v) => v.licensePlate.trim().toLowerCase() === rawLower);
  if (exact) return exact;

  // 2. Normalized match (remove spaces, hyphens, parentheses, brackets)
  const normRaw = rawLower.replace(/[\s\-\.\(\)\[\]]/g, '');
  const normMatch = vehicles.find((v) => {
    const normV = v.licensePlate.toLowerCase().replace(/[\s\-\.\(\)\[\]]/g, '');
    return normRaw === normV;
  });
  if (normMatch) return normMatch;

  // 3. Substring match
  const subMatch = vehicles.find((v) => {
    const normV = v.licensePlate.toLowerCase().replace(/[\s\-\.\(\)\[\]]/g, '');
    if (normV.length < 3) return false;
    return normRaw.includes(normV) || (normRaw.length >= 3 && normV.includes(normRaw));
  });
  if (subMatch) return subMatch;

  // 4. Number part comparison (e.g. "70-1122" and "70-1122 กทม." have digits "701122")
  const rawDigits = raw.replace(/\D/g, '');
  if (rawDigits.length >= 4) {
    const digitMatch = vehicles.find((v) => {
      const vDigits = v.licensePlate.replace(/\D/g, '');
      return vDigits === rawDigits;
    });
    if (digitMatch) return digitMatch;
  }

  return undefined;
};

/**
 * Extracts YYYY-MM from date string
 */
export const extractYearMonth = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    return dateStr.slice(0, 7);
  } catch {
    return '';
  }
};

/**
 * Checks if a vehicle's monthly usage was cleared by user
 */
export const isVehicleUsageCleared = (
  plateOrRecipient: string,
  monthKey: string,
  clearedVehicleMonths?: Set<string>
): boolean => {
  if (!clearedVehicleMonths || clearedVehicleMonths.size === 0) return false;
  const clean = (plateOrRecipient || '').trim().toLowerCase();
  if (!clean) return false;

  for (const key of clearedVehicleMonths) {
    if (!key.startsWith(`${monthKey}_`)) continue;
    const clearedPlate = key.replace(`${monthKey}_`, '');
    if (
      clearedPlate &&
      (clean === clearedPlate ||
        clean.includes(clearedPlate) ||
        clearedPlate.includes(clean))
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Calculates vehicle usage breakdown for a specific month (YYYY-MM).
 * Reconciles data between:
 * 1. VehiclesTab (Vehicle oil change dates & mileage)
 * 2. VehiclesTab AdBlue subview (AdBlueRefillRecord entries)
 * 3. Stock transactions (Engine oil & AdBlue dispenses)
 */
export const calculateVehicleMonthlyUsage = (params: {
  vehicles: Vehicle[];
  transactions: StockTransaction[];
  adBlueRefills: AdBlueRefillRecord[];
  selectedMonth: string; // YYYY-MM
  clearedVehicleMonths?: Set<string>;
}): VehicleMonthlyUsageRecord[] => {
  const { vehicles, transactions, adBlueRefills, selectedMonth, clearedVehicleMonths } = params;

  // Map keyed by vehicleId (or custom plate key if not in vehicles list)
  const map = new Map<string, VehicleMonthlyUsageRecord>();

  // 1. Initialize with all registered vehicles from VehiclesTab (4 factories)
  vehicles.forEach((v) => {
    map.set(v.id, {
      month: selectedMonth,
      vehicleId: v.id,
      licensePlate: v.licensePlate,
      factory: v.factory || 'ไม่ระบุ',
      route: v.route || '',
      engineOilLiters: 0,
      engineOilCount: 0,
      adBlueLiters: 0,
      adBlueCount: 0,
      totalLiters: 0,
      latestMileage: v.currentMileage || 0,
      lastServiceOrRefillDate: undefined,
      isFromVehicleCycleRecord: false,
    });
  });

  // Keep track of transaction IDs linked to AdBlue refills to prevent double-counting
  const handledAdBlueTxIds = new Set<string>();

  // 2. Process all AdBlue refills for this month
  const monthRefills = adBlueRefills.filter((r) => {
    const m = extractYearMonth(r.date) || extractYearMonth(r.createdAt);
    if (m !== selectedMonth) return false;
    if (isVehicleUsageCleared(r.licensePlate, selectedMonth, clearedVehicleMonths)) return false;
    return true;
  });

  monthRefills.forEach((r) => {
    if (r.dispenseTxId) {
      handledAdBlueTxIds.add(r.dispenseTxId);
    }

    const matchedVeh = findMatchingVehicle(r.licensePlate, vehicles, r.vehicleId);
    const key = matchedVeh ? matchedVeh.id : `ext_adblue_${r.licensePlate.trim().toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        month: selectedMonth,
        vehicleId: matchedVeh?.id,
        licensePlate: matchedVeh ? matchedVeh.licensePlate : r.licensePlate,
        factory: matchedVeh ? matchedVeh.factory : r.factory || 'ไม่ระบุ',
        route: matchedVeh?.route || '',
        engineOilLiters: 0,
        engineOilCount: 0,
        adBlueLiters: 0,
        adBlueCount: 0,
        totalLiters: 0,
        latestMileage: r.currentMileage || 0,
        lastServiceOrRefillDate: r.date,
        isFromVehicleCycleRecord: false,
      });
    }

    const item = map.get(key)!;
    item.adBlueCount += 1;
    item.adBlueLiters += Number(r.litersFilled) || 0;
    if (r.currentMileage && r.currentMileage > item.latestMileage) {
      item.latestMileage = r.currentMileage;
    }
    if (r.date && (!item.lastServiceOrRefillDate || r.date > item.lastServiceOrRefillDate)) {
      item.lastServiceOrRefillDate = r.date;
    }
  });

  // 3. Process Stock Transactions for this month
  const monthTxs = transactions.filter((tx) => {
    if (tx.type !== 'dispense') return false;
    const m = extractYearMonth(tx.date) || extractYearMonth(tx.createdAt);
    if (m !== selectedMonth) return false;
    if (isVehicleUsageCleared(tx.recipientOrVehicle || '', selectedMonth, clearedVehicleMonths)) return false;
    return true;
  });

  monthTxs.forEach((tx) => {
    const isAd = isAdBlueTransaction(tx);
    const vehicleId = (tx as any).vehicleId as string | undefined;
    const matchedVeh = findMatchingVehicle(tx.recipientOrVehicle, vehicles, vehicleId);

    // If AdBlue transaction that was already accounted for via linked refill, skip
    if (isAd && handledAdBlueTxIds.has(tx.id)) {
      return;
    }

    const key = matchedVeh
      ? matchedVeh.id
      : `ext_tx_${(tx.recipientOrVehicle || 'อื่นๆ').trim().toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        month: selectedMonth,
        vehicleId: matchedVeh?.id,
        licensePlate: matchedVeh ? matchedVeh.licensePlate : (tx.recipientOrVehicle ? tx.recipientOrVehicle.split(' ')[0] : 'อื่นๆ'),
        factory: matchedVeh ? matchedVeh.factory : 'ไม่ระบุ',
        route: matchedVeh?.route || '',
        engineOilLiters: 0,
        engineOilCount: 0,
        adBlueLiters: 0,
        adBlueCount: 0,
        totalLiters: 0,
        latestMileage: tx.currentMileage || 0,
        lastServiceOrRefillDate: tx.date,
        isFromVehicleCycleRecord: false,
      });
    }

    const item = map.get(key)!;

    if (isAd) {
      // Check if this vehicle already has refills matching date & amount
      const hasDuplicateRefill = monthRefills.some((r) => {
        const matchesPlate = matchedVeh ? (r.vehicleId === matchedVeh.id || r.licensePlate === matchedVeh.licensePlate) : r.licensePlate.includes(item.licensePlate);
        const sameAmount = Math.abs((Number(r.litersFilled) || 0) - (Number(tx.amount) || 0)) < 0.1;
        const sameDay = (r.date || '').slice(0, 10) === (tx.date || '').slice(0, 10);
        return matchesPlate && (sameAmount || sameDay);
      });

      if (!hasDuplicateRefill) {
        item.adBlueCount += 1;
        item.adBlueLiters += Number(tx.amount) || 0;
      }
    } else {
      // Engine oil
      item.engineOilCount += 1;
      item.engineOilLiters += Number(tx.amount) || 0;
    }

    if (tx.currentMileage && tx.currentMileage > item.latestMileage) {
      item.latestMileage = tx.currentMileage;
    }
    if (tx.date && (!item.lastServiceOrRefillDate || tx.date > item.lastServiceOrRefillDate)) {
      item.lastServiceOrRefillDate = tx.date;
    }
  });

  // 4. Cross-check with VehiclesTab Engine Oil Change Dates
  // If a vehicle in VehiclesTab has lastOilChangeDate in this month, but no dispense transaction was recorded
  // (e.g. stock deduction was not checked, stock was 0, or vehicle edited in VehiclesTab),
  // ensure the oil change is recognized so data is 100% consistent with VehiclesTab!
  vehicles.forEach((v) => {
    const oilMonth = extractYearMonth(v.lastOilChangeDate);
    if (oilMonth !== selectedMonth) return;
    if (isVehicleUsageCleared(v.licensePlate, selectedMonth, clearedVehicleMonths)) return;

    const item = map.get(v.id);
    if (item && item.engineOilCount === 0) {
      item.engineOilCount = 1;
      // Standard oil capacity for engine service
      item.engineOilLiters = 4;
      item.isFromVehicleCycleRecord = true;
      if (v.lastOilChangeMileage && v.lastOilChangeMileage > item.latestMileage) {
        item.latestMileage = v.lastOilChangeMileage;
      }
      if (v.lastOilChangeDate && (!item.lastServiceOrRefillDate || v.lastOilChangeDate > item.lastServiceOrRefillDate)) {
        item.lastServiceOrRefillDate = v.lastOilChangeDate;
      }
    }
  });

  // 5. Finalize totals and rounding
  const results = Array.from(map.values()).map((r) => {
    const eOil = Math.round(r.engineOilLiters * 10) / 10;
    const adBlue = Math.round(r.adBlueLiters * 10) / 10;
    return {
      ...r,
      engineOilLiters: eOil,
      adBlueLiters: adBlue,
      totalLiters: Math.round((eOil + adBlue) * 10) / 10,
    };
  });

  return results;
};

/**
 * Calculates 12-month summary for a given year.
 * Mathematically guaranteed to equal the sum of vehicle usages in each month.
 */
export const calculate12MonthsSummary = (params: {
  vehicles: Vehicle[];
  transactions: StockTransaction[];
  adBlueRefills: AdBlueRefillRecord[];
  selectedYear: number;
  clearedVehicleMonths?: Set<string>;
}): MonthSummaryItem[] => {
  const { vehicles, transactions, adBlueRefills, selectedYear, clearedVehicleMonths } = params;

  return THAI_MONTH_NAMES.map((monthName, idx) => {
    const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
    const vehicleUsages = calculateVehicleMonthlyUsage({
      vehicles,
      transactions,
      adBlueRefills,
      selectedMonth: monthKey,
      clearedVehicleMonths,
    });

    const activeVehicles = vehicleUsages.filter((v) => v.engineOilLiters > 0 || v.adBlueLiters > 0);

    const engineOilLiters = activeVehicles.reduce((sum, v) => sum + v.engineOilLiters, 0);
    const engineOilTxCount = activeVehicles.reduce((sum, v) => sum + v.engineOilCount, 0);
    const adBlueLiters = activeVehicles.reduce((sum, v) => sum + v.adBlueLiters, 0);
    const adBlueRefillCount = activeVehicles.reduce((sum, v) => sum + v.adBlueCount, 0);

    const roundedOil = Math.round(engineOilLiters * 10) / 10;
    const roundedAd = Math.round(adBlueLiters * 10) / 10;

    return {
      monthKey,
      monthName,
      monthNumber: idx + 1,
      engineOilLiters: roundedOil,
      engineOilTxCount,
      adBlueLiters: roundedAd,
      adBlueRefillCount,
      totalLiters: Math.round((roundedOil + roundedAd) * 10) / 10,
    };
  });
};

/**
 * Calculates all monthly usages across all months present in data (used for Google Sheets & Excel export)
 */
export const calculateAllMonthsVehicleUsage = (params: {
  vehicles: Vehicle[];
  transactions: StockTransaction[];
  adBlueRefills: AdBlueRefillRecord[];
  clearedVehicleMonths?: Set<string>;
}): VehicleMonthlyUsageRecord[] => {
  const { vehicles, transactions, adBlueRefills, clearedVehicleMonths } = params;

  // Collect all unique YYYY-MM
  const monthSet = new Set<string>();

  transactions.forEach((tx) => {
    const m = extractYearMonth(tx.date) || extractYearMonth(tx.createdAt);
    if (m) monthSet.add(m);
  });

  adBlueRefills.forEach((r) => {
    const m = extractYearMonth(r.date) || extractYearMonth(r.createdAt);
    if (m) monthSet.add(m);
  });

  vehicles.forEach((v) => {
    const m = extractYearMonth(v.lastOilChangeDate);
    if (m) monthSet.add(m);
  });

  // Also include current month
  const nowM = new Date().toISOString().slice(0, 7);
  monthSet.add(nowM);

  const allMonths = Array.from(monthSet).sort().reverse();
  const allRecords: VehicleMonthlyUsageRecord[] = [];

  for (const m of allMonths) {
    const monthList = calculateVehicleMonthlyUsage({
      vehicles,
      transactions,
      adBlueRefills,
      selectedMonth: m,
      clearedVehicleMonths,
    });
    // Keep vehicles that have usage
    const withUsage = monthList.filter((v) => v.engineOilLiters > 0 || v.adBlueLiters > 0);
    allRecords.push(...withUsage);
  }

  return allRecords.sort((a, b) => b.month.localeCompare(a.month) || a.licensePlate.localeCompare(b.licensePlate));
};
