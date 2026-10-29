import React, { useState } from 'react';
import { Vehicle, FactoryItem, AdBlueRefillRecord, OilItem } from '../types';
import {
  calculateVehicleCycle,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  recordOilChange,
  scheduleVehicleDueDate,
  formatThaiDate,
  addFactory,
  updateFactoryName,
  deleteFactory,
  DEFAULT_FACTORIES,
  batchRestoreVehicles
} from '../services/vehicleService';
import {
  deleteAdBlueRefill,
  exportAdBlueRefillsToExcel,
  batchRestoreAdBlue
} from '../services/adblueService';
import {
  exportVehiclesToCsv,
  downloadVehiclesTemplateCsv,
  parseVehiclesFromRows,
  exportAdBlueToCsv,
  downloadAdBlueTemplateCsv,
  parseAdBlueFromRows
} from '../services/csvService';
import { recordDispense } from '../services/stockService';
import * as XLSX from 'xlsx';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Calendar,
  Building2,
  ArrowUpRight,
  Edit2,
  Trash2,
  Wrench,
  Download,
  Upload,
  X,
  Check,
  Sparkles,
  Printer,
  Droplets,
  Percent,
  Layers,
  ShieldAlert,
  Maximize2,
  FileSpreadsheet
} from 'lucide-react';
import { VehiclePrintModal } from './VehiclePrintModal';
import { AdBlueRefillModal } from './AdBlueRefillModal';
import { AdBluePrintModal } from './AdBluePrintModal';
import { CsvDataModal } from './CsvDataModal';

interface VehiclesTabProps {
  vehicles: Vehicle[];
  factories?: FactoryItem[];
  adBlueRefills?: AdBlueRefillRecord[];
  adBlueOils?: OilItem[];
  oils?: OilItem[];
  userName: string;
  isAdmin?: boolean;
  onDispenseForVehicle: (licensePlate: string, currentMileage: number, vehicleId: string) => void;
}

const getTodayLocalDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const VehiclesTab: React.FC<VehiclesTabProps> = ({
  vehicles,
  factories = [],
  adBlueRefills = [],
  adBlueOils = [],
  oils = [],
  userName,
  isAdmin = false,
  onDispenseForVehicle,
}) => {
  // Sub-view: 'vehicles' (ข้อมูลรถและรอบเปลี่ยนถ่าย) or 'adblue' (ประวัติเติม AdBlue แยกเฉพาะ)
  const [subView, setSubView] = useState<'vehicles' | 'adblue'>('vehicles');

  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'normal'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Print Modal State for Vehicles
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalFactory, setPrintModalFactory] = useState<string>('all');

  // AdBlue Refill Modal State
  const [isAdBlueModalOpen, setIsAdBlueModalOpen] = useState(false);
  const [adBluePreselectedVehicle, setAdBluePreselectedVehicle] = useState<Vehicle | null>(null);
  const [editingAdBlueRecord, setEditingAdBlueRecord] = useState<AdBlueRefillRecord | null>(null);

  // AdBlue Print Modal State
  const [isAdBluePrintOpen, setIsAdBluePrintOpen] = useState(false);

  // CSV Export & Import / Restore Modal States
  const [isVehicleCsvModalOpen, setIsVehicleCsvModalOpen] = useState(false);
  const [isAdBlueCsvModalOpen, setIsAdBlueCsvModalOpen] = useState(false);

  // Add / Edit Vehicle Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Dynamic Factory List
  const factoryList: string[] =
    factories.length > 0 ? factories.map((f) => f.name) : DEFAULT_FACTORIES;

  // Form Fields for Vehicle
  const [formPlate, setFormPlate] = useState('');
  const [formFactory, setFormFactory] = useState<string>(factoryList[0] || 'โรงงาน 1');
  const [formRoute, setFormRoute] = useState('');
  const [formDistancePerTrip, setFormDistancePerTrip] = useState('100');
  const [formTripsPerMonth, setFormTripsPerMonth] = useState('30');
  const [formCurrentMileage, setFormCurrentMileage] = useState('100000');
  const [formLastOilChangeDate, setFormLastOilChangeDate] = useState('');
  const [formLastOilChangeMileage, setFormLastOilChangeMileage] = useState('');
  const [formCycleType, setFormCycleType] = useState<'distance' | 'month'>('distance');
  const [formIntervalKm, setFormIntervalKm] = useState<string>('20000');
  const [formIntervalMonths, setFormIntervalMonths] = useState<string>('6');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Quick Scheduling Modal (กำหนดวันเรียกรถเข้า)
  const [schedulingVehicle, setSchedulingVehicle] = useState<Vehicle | null>(null);
  const [scheduleInputDate, setScheduleInputDate] = useState('');
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  // Quick Service Modal (เปลี่ยนถ่ายน้ำมันเครื่องรอบใหม่)
  const [serviceVehicle, setServiceVehicle] = useState<Vehicle | null>(null);
  const [serviceMileage, setServiceMileage] = useState('');
  const [serviceDate, setServiceDate] = useState(() => getTodayLocalDateStr());
  const [serviceDeductStock, setServiceDeductStock] = useState<boolean>(true);
  const [serviceOilId, setServiceOilId] = useState<string>('');
  const [serviceAmountLiters, setServiceAmountLiters] = useState<string>('4');
  const [serviceSubmitting, setServiceSubmitting] = useState<boolean>(false);

  // Open Service Modal with proper date initialization (preserves previously recorded date or defaults to today)
  const handleOpenServiceModal = (vehicle: Vehicle) => {
    setServiceVehicle(vehicle);
    setServiceMileage(vehicle.currentMileage.toString());
    const initialDate =
      vehicle.lastOilChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(vehicle.lastOilChangeDate)
        ? vehicle.lastOilChangeDate
        : getTodayLocalDateStr();
    setServiceDate(initialDate);
  };

  // Filter available engine oils for service modal
  const engineOils = oils.filter(
    (o) =>
      !o.name.toLowerCase().includes('adblue') &&
      !o.name.includes('แอดบลู') &&
      !o.viscosity.toLowerCase().includes('adblue')
  );

  // Delete State
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [adBlueToDelete, setAdBlueToDelete] = useState<AdBlueRefillRecord | null>(null);

  // Factory Management Modal State
  const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
  const [newFactoryInput, setNewFactoryInput] = useState('');
  const [editingFactoryId, setEditingFactoryId] = useState<string | null>(null);
  const [editingFactoryName, setEditingFactoryName] = useState('');
  const [factoryActionError, setFactoryActionError] = useState<string | null>(null);
  const [factoryActionSuccess, setFactoryActionSuccess] = useState<string | null>(null);
  const [factoryLoading, setFactoryLoading] = useState(false);
  const [factoryToDelete, setFactoryToDelete] = useState<FactoryItem | null>(null);

  // Handlers for Factory Management
  const handleCreateFactory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactoryInput.trim()) return;

    setFactoryLoading(true);
    setFactoryActionError(null);
    setFactoryActionSuccess(null);

    try {
      await addFactory(newFactoryInput.trim(), userName);
      setFactoryActionSuccess(`เพิ่มโรงงาน "${newFactoryInput.trim()}" สำเร็จเรียบร้อย`);
      setNewFactoryInput('');
    } catch (err: any) {
      setFactoryActionError(err.message || 'ไม่สามารถเพิ่มโรงงานได้');
    } finally {
      setFactoryLoading(false);
    }
  };

  const handleStartEditFactory = (f: FactoryItem) => {
    setEditingFactoryId(f.id);
    setEditingFactoryName(f.name);
    setFactoryActionError(null);
    setFactoryActionSuccess(null);
  };

  const handleSaveEditFactory = async (f: FactoryItem) => {
    if (!editingFactoryName.trim()) return;
    setFactoryLoading(true);
    setFactoryActionError(null);
    setFactoryActionSuccess(null);

    try {
      await updateFactoryName(f.id, editingFactoryName.trim(), f.name, userName);
      setFactoryActionSuccess(
        `แก้ไขชื่อโรงงานเป็น "${editingFactoryName.trim()}" และอัปเดตข้อมูลรถทั้งหมดเรียบร้อยแล้ว`
      );
      setEditingFactoryId(null);
    } catch (err: any) {
      setFactoryActionError(err.message || 'ไม่สามารถแก้ไขชื่อโรงงานได้');
    } finally {
      setFactoryLoading(false);
    }
  };

  const handleDeleteFactoryItem = async (f: FactoryItem) => {
    const assignedVehicles = vehicles.filter((v) => v.factory === f.name);
    if (assignedVehicles.length > 0) {
      setFactoryActionError(
        `ไม่สามารถลบ "${f.name}" ได้เนื่องจากมีรถ ${assignedVehicles.length} คันสังกัดอยู่ กรุณาย้ายหรือเปลี่ยนโรงงานของรถก่อนลบ`
      );
      setFactoryToDelete(null);
      return;
    }

    setFactoryLoading(true);
    setFactoryActionError(null);
    setFactoryActionSuccess(null);

    try {
      await deleteFactory(f.id, f.name);
      setFactoryActionSuccess(`ลบโรงงาน "${f.name}" สำเร็จเรียบร้อย`);
      setFactoryToDelete(null);
      if (selectedFactory === f.name) {
        setSelectedFactory('all');
      }
    } catch (err: any) {
      setFactoryActionError(err.message || 'ไม่สามารถลบโรงงานได้');
    } finally {
      setFactoryLoading(false);
    }
  };

  // Metrics Calculation for Vehicles
  const vehicleStats = vehicles.map((v) => ({
    vehicle: v,
    cycle: calculateVehicleCycle(v),
  }));

  const overdueCount = vehicleStats.filter((s) => s.cycle.status === 'overdue').length;
  const dueSoonCount = vehicleStats.filter((s) => s.cycle.status === 'due_soon').length;
  const normalCount = vehicleStats.filter((s) => s.cycle.status === 'normal').length;

  // Filtered Vehicles
  const filteredVehicles = vehicleStats.filter(({ vehicle, cycle }) => {
    const matchesFactory = selectedFactory === 'all' || vehicle.factory === selectedFactory;
    const matchesSearch =
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vehicle.notes && vehicle.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'due') {
      matchesStatus = cycle.status === 'due_soon' || cycle.status === 'overdue';
    } else if (statusFilter === 'normal') {
      matchesStatus = cycle.status === 'normal';
    }

    return matchesFactory && matchesSearch && matchesStatus;
  });

  // Filtered AdBlue Refill Records
  const filteredAdBlueRecords = adBlueRefills.filter((r) => {
    const matchesFactory = selectedFactory === 'all' || r.factory === selectedFactory;
    const matchesSearch =
      r.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.filledBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFactory && matchesSearch;
  });

  const totalAdBlueLiters = filteredAdBlueRecords.reduce((sum, r) => sum + (r.litersFilled || 0), 0);

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormPlate('');
    setFormFactory(selectedFactory !== 'all' ? selectedFactory : (factoryList[0] || 'โรงงาน 1'));
    setFormRoute('');
    setFormDistancePerTrip('120');
    setFormTripsPerMonth('30');
    setFormCurrentMileage('');
    setFormLastOilChangeMileage('');
    setFormLastOilChangeDate(getTodayLocalDateStr());
    setFormCycleType('distance');
    setFormIntervalKm('20000');
    setFormIntervalMonths('6');
    setFormDueDate('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormPlate(v.licensePlate);
    setFormFactory(v.factory);
    setFormRoute(v.route);
    setFormDistancePerTrip(v.distancePerTrip.toString());
    setFormTripsPerMonth(v.tripsPerMonth.toString());
    setFormCurrentMileage(v.currentMileage.toString());
    setFormLastOilChangeMileage(v.lastOilChangeMileage ? v.lastOilChangeMileage.toString() : v.currentMileage.toString());
    setFormLastOilChangeDate(v.lastOilChangeDate || '');
    setFormCycleType(v.cycleType === 'month' ? 'month' : 'distance');
    setFormIntervalKm((v.oilChangeIntervalKm || 20000).toString());
    setFormIntervalMonths((v.intervalMonths || 6).toString());
    setFormDueDate(v.nextOilChangeDueDate || '');
    setFormNotes(v.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenPrint = (factoryTarget: string = 'all') => {
    setPrintModalFactory(factoryTarget);
    setIsPrintModalOpen(true);
  };

  const handleOpenAdBlueRefillForVehicle = (v: Vehicle) => {
    setEditingAdBlueRecord(null);
    setAdBluePreselectedVehicle(v);
    setIsAdBlueModalOpen(true);
  };

  const handleOpenNewAdBlueRefill = () => {
    setEditingAdBlueRecord(null);
    setAdBluePreselectedVehicle(null);
    setIsAdBlueModalOpen(true);
  };

  const handleEditAdBlueRefill = (r: AdBlueRefillRecord) => {
    setEditingAdBlueRecord(r);
    setAdBluePreselectedVehicle(null);
    setIsAdBlueModalOpen(true);
  };

  const handleDeleteAdBlueConfirm = async () => {
    if (!adBlueToDelete) return;
    try {
      await deleteAdBlueRefill(adBlueToDelete.id, userName);
      setSuccessToast(`ลบประวัติการเติม AdBlue เรียบร้อยแล้ว`);
      setAdBlueToDelete(null);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      setErrorToast(err.message || 'ลบไม่สำเร็จ');
      setTimeout(() => setErrorToast(null), 4000);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate.trim()) {
      setFormError('กรุณากรอกทะเบียนรถ');
      return;
    }

    const currentKm = parseFloat(formCurrentMileage);
    const dist = parseFloat(formDistancePerTrip) || 0;
    const trips = parseFloat(formTripsPerMonth) || 0;

    if (isNaN(currentKm) || currentKm < 0) {
      setFormError('กรุณากรอกเลขไมล์ปัจจุบันให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const parsedLastMileage = parseFloat(formLastOilChangeMileage);
      const safeLastMileage = !isNaN(parsedLastMileage) && parsedLastMileage >= 0 ? parsedLastMileage : currentKm;
      const safeLastDate = formLastOilChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(formLastOilChangeDate)
        ? formLastOilChangeDate
        : getTodayLocalDateStr();

      const intervalKmNum = parseFloat(formIntervalKm) || 20000;
      const intervalMonthsNum = parseInt(formIntervalMonths, 10) || 6;

      if (editingVehicle) {
        await updateVehicle(
          editingVehicle.id,
          {
            licensePlate: formPlate.trim(),
            factory: formFactory,
            route: formRoute.trim(),
            distancePerTrip: dist,
            tripsPerMonth: trips,
            currentMileage: currentKm,
            lastOilChangeMileage: safeLastMileage,
            lastOilChangeDate: safeLastDate,
            oilChangeIntervalKm: intervalKmNum,
            cycleType: formCycleType,
            intervalMonths: intervalMonthsNum,
            nextOilChangeDueDate: formDueDate ? formDueDate : undefined,
            notes: formNotes.trim(),
          },
          userName
        );
        setSuccessToast(`บันทึกการแก้ไขข้อมูลรถ ${formPlate.trim()} เรียบร้อยแล้ว`);
      } else {
        await addVehicle(
          {
            licensePlate: formPlate.trim(),
            factory: formFactory,
            route: formRoute.trim(),
            distancePerTrip: dist,
            tripsPerMonth: trips,
            currentMileage: currentKm,
            lastOilChangeMileage: safeLastMileage,
            lastOilChangeDate: safeLastDate,
            oilChangeIntervalKm: intervalKmNum,
            cycleType: formCycleType,
            intervalMonths: intervalMonthsNum,
            nextOilChangeDueDate: formDueDate ? formDueDate : undefined,
            notes: formNotes.trim(),
            updatedBy: userName,
          },
          userName
        );
        setSuccessToast(`เพิ่มข้อมูลรถ ${formPlate.trim()} เรียบร้อยแล้ว`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setFormError(err.message || 'บันทึกข้อมูลรถไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveScheduleDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingVehicle) return;
    setScheduleSubmitting(true);
    try {
      await scheduleVehicleDueDate(schedulingVehicle.id, scheduleInputDate, userName);
      setSuccessToast(
        scheduleInputDate
          ? `บันทึกวันนัดหมายเรียกรถ ${schedulingVehicle.licensePlate} เข้าเปลี่ยนถ่ายวันที่ ${formatThaiDate(scheduleInputDate)} สำเร็จ`
          : `ตั้งค่าให้คำนวณวันเรียกรถ ${schedulingVehicle.licensePlate} ตามเที่ยววิ่งอัตโนมัติเรียบร้อย`
      );
      setSchedulingVehicle(null);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorToast(err.message || 'บันทึกวันนัดหมายไม่สำเร็จ');
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleQuickServiceConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceVehicle) return;

    const km = parseFloat(serviceMileage);
    if (isNaN(km) || km <= 0) {
      setErrorToast('กรุณากรอกเลขไมล์ที่เปลี่ยนถ่ายให้ถูกต้อง');
      setTimeout(() => setErrorToast(null), 4000);
      return;
    }

    const targetOil = engineOils.find((o) => o.id === serviceOilId) || engineOils[0];
    const amountNum = parseFloat(serviceAmountLiters) || 4;

    if (serviceDeductStock && targetOil && targetOil.currentStock < amountNum) {
      setErrorToast(`สต๊อก ${targetOil.name} ไม่เพียงพอ (คงเหลือ ${targetOil.currentStock} ลิตร, ต้องการเบิก ${amountNum} ลิตร)`);
      setTimeout(() => setErrorToast(null), 4000);
      return;
    }

    const dateToSave =
      serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate)
        ? serviceDate
        : (serviceVehicle.lastOilChangeDate || getTodayLocalDateStr());

    setServiceSubmitting(true);
    try {
      // 1. Update vehicle oil change cycle
      await recordOilChange(serviceVehicle.id, km, dateToSave, userName);

      // 2. Link with stock: If checked, record dispense transaction
      if (serviceDeductStock && targetOil) {
        let dispenseDateIso = new Date().toISOString();
        try {
          const [y, m, d] = dateToSave.split('-').map(Number);
          dispenseDateIso = new Date(y, m - 1, d, 12, 0, 0).toISOString();
        } catch {}

        await recordDispense({
          oil: targetOil,
          amount: amountNum,
          recipientOrVehicle: `${serviceVehicle.licensePlate} (${serviceVehicle.factory})`,
          currentMileage: km,
          referenceNote: `[เปลี่ยนถ่ายน้ำมันเครื่องรอบ 20,000 กม.] ไมล์ ${km.toLocaleString('th-TH')} กม. (วันที่ ${formatThaiDate(dateToSave)})`,
          date: dispenseDateIso,
          performedBy: userName,
          vehicleId: serviceVehicle.id,
        });
      }

      setSuccessToast(
        `บันทึกเปลี่ยนถ่ายน้ำมันเครื่องรถ ${serviceVehicle.licensePlate} วันที่ ${formatThaiDate(dateToSave)} เรียบร้อยแล้ว ` +
        (serviceDeductStock && targetOil ? `(ตัดสต๊อก ${targetOil.name} จำนวน ${amountNum} ลิตร สำเร็จ)` : '')
      );
      setServiceVehicle(null);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      console.error('Service error:', err);
      setErrorToast(err.message || 'บันทึกเปลี่ยนถ่ายไม่สำเร็จ');
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete) return;
    try {
      const plate = vehicleToDelete.licensePlate;
      await deleteVehicle(vehicleToDelete.id);
      setSuccessToast(`ลบข้อมูลรถ ${plate} เรียบร้อยแล้ว`);
      setVehicleToDelete(null);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Delete vehicle error:', err);
    }
  };

  const handleExportVehiclesExcel = () => {
    const data = vehicles.map((v, i) => {
      const cycle = calculateVehicleCycle(v);
      return {
        'ลำดับ': i + 1,
        'โรงงาน': v.factory,
        'ทะเบียนรถ': v.licensePlate,
        'สายรถ': v.route,
        'ระยะทาง/เที่ยว (กม.)': v.distancePerTrip,
        'เที่ยววิ่ง/เดือน': v.tripsPerMonth,
        'เลขไมล์ปัจจุบัน (กม.)': v.currentMileage,
        'วันที่เปลี่ยนถ่ายล่าสุด': v.lastOilChangeDate ? formatThaiDate(v.lastOilChangeDate) : '-',
        'ไมล์ที่เปลี่ยนถ่ายล่าสุด (กม.)': v.lastOilChangeMileage || v.currentMileage,
        'เกณฑ์รอบเปลี่ยนถ่าย': cycle.cycleType === 'month' ? `ตามจำนวนเดือน (${cycle.cycleDescription})` : `ตามระยะทาง (${cycle.cycleDescription})`,
        'รอบเปลี่ยนถ่ายถัดไป': cycle.cycleType === 'month' ? `${cycle.formattedDueDate} (ประมาณ ${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.)` : `${cycle.nextTargetMileage.toLocaleString('th-TH')} กม.`,
        'ระยะที่วิ่งไปแล้วในรอบนี้ (กม.)': cycle.kmSinceLastChange,
        'ระยะคงเหลือก่อนถึงรอบ (กม.)': cycle.kmRemaining,
        'วันที่ต้องเข้ามาเปลี่ยนถ่าย (วันเรียกรถเข้า)': cycle.formattedDueDate,
        'จำนวนวันที่เหลือ': cycle.status === 'overdue' ? 'เกินกำหนดแล้ว' : `${cycle.estimatedDaysRemaining} วัน`,
        'รูปแบบวันนัดหมาย': cycle.isManualDueDate ? '📌 กำหนดวันเอง' : cycle.cycleType === 'month' ? '📅 คำนวณตามรอบเดือน' : '⚡ คำนวณจากเที่ยววิ่ง',
        'สถานะรอบถ่าย': cycle.statusText,
        'หมายเหตุ': v.notes || '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูลรถและรอบถ่ายน้ำมันเครื่อง');
    XLSX.writeFile(wb, `ข้อมูลรถ_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successToast && (
        <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorToast && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Permission / Read-Only Warning Banner */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-950 no-print text-xs sm:text-sm shadow-2xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold">โหมดดูข้อมูลและสั่งพิมพ์รายงาน (Read-Only)</p>
              <p className="text-xs text-amber-800">
                สิทธิ์การเพิ่ม ลบ หรือแก้ไขข้อมูลสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น (ผู้ใช้งานทั่วไปสามารถดูข้อมูล ค้นหา และสั่งพิมพ์รายงาน/ส่งออก Excel ได้ตามปกติ)
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg font-bold text-xs whitespace-nowrap">
            พิมพ์รายงานได้
          </span>
        </div>
      )}

      {/* Top Banner with Sub-View Switcher & Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Truck className="w-4 h-4 text-amber-400" />
            <span>ข้อมูลรถประจำโรงงาน ({factoryList.length} โรงงาน) & ประวัติเติมน้ำยา AdBlue</span>
            <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-amber-300 text-[11px] font-semibold rounded-full hidden sm:inline-flex items-center gap-1 ml-1 normal-case">
              <Maximize2 className="w-3 h-3 text-amber-300" />
              เต็มความกว้างหน้าจอ (Fit Screen)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            {subView === 'vehicles'
              ? 'ประวัติถ่ายน้ำมันเครื่อง (รอบเปลี่ยนถ่าย 20,000 กม.)'
              : 'ประวัติรายงานการเติมน้ำยาบำบัดไอเสีย AdBlue (แยกเฉพาะ)'}
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            {subView === 'vehicles'
              ? 'คำนวณรอบเปลี่ยนถ่ายถัดไปโดยบวกเพิ่ม 20,000 กม. จากไมล์ที่เปลี่ยนถ่ายล่าสุด พร้อมแจ้งเตือนล่วงหน้า 1 เดือน'
              : 'บันทึกและตรวจสอบประวัติการเติมน้ำยา AdBlue (%ก่อนเติม, %หลังเติม, จำนวนลิตร, ผู้เติม) รายคัน'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-View Switcher Toggle */}
          <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1 border border-white/20">
            <button
              type="button"
              onClick={() => setSubView('vehicles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subView === 'vehicles'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>ประวัติถ่ายน้ำมันเครื่อง ({vehicles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('adblue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subView === 'adblue'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>ประวัติเติม AdBlue ({adBlueRefills.length})</span>
            </button>
          </div>

          {subView === 'vehicles' ? (
            <>
              {/* Print Vehicles Report Button */}
              <button
                type="button"
                onClick={() => handleOpenPrint(selectedFactory)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>สั่งพิมพ์</span>
              </button>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={() => exportVehiclesToCsv(vehicles)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-xs sm:text-sm transition cursor-pointer border border-white/20"
                title="ส่งออกประวัติถ่ายน้ำมันเครื่องเป็นไฟล์ CSV (UTF-8 พร้อมเปิดใน Excel)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>ส่งออก CSV</span>
              </button>

              {/* Import CSV / Restore Button */}
              <button
                type="button"
                onClick={() => setIsVehicleCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition cursor-pointer border border-emerald-400/30"
                title="นำเข้าไฟล์ CSV หรือกู้คืนข้อมูลรถและรอบเปลี่ยนถ่าย"
              >
                <Upload className="w-4 h-4" />
                <span>นำเข้า CSV / กู้คืน</span>
              </button>

              {isAdmin && (
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer border border-white/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มข้อมูลรถ</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* AdBlue Sub-view Actions */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenNewAdBlueRefill}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ บันทึกเติม AdBlue</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAdBluePrintOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer border border-white/20"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์รายงาน</span>
              </button>

              <button
                type="button"
                onClick={() => exportAdBlueToCsv(adBlueRefills)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-xs sm:text-sm transition cursor-pointer border border-white/20"
                title="ส่งออกประวัติเติม AdBlue เป็นไฟล์ CSV (UTF-8 พร้อมเปิดใน Excel)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>ส่งออก CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAdBlueCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600/80 hover:bg-teal-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition cursor-pointer border border-teal-400/30"
                title="นำเข้าไฟล์ CSV หรือกู้คืนข้อมูลประวัติเติม AdBlue"
              >
                <Upload className="w-4 h-4" />
                <span>นำเข้า CSV / กู้คืน</span>
              </button>

              <button
                type="button"
                onClick={() => exportAdBlueRefillsToExcel(adBlueRefills)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-xs sm:text-sm transition cursor-pointer border border-white/20"
              >
                <Download className="w-4 h-4" />
                <span>Excel</span>
              </button>
            </>
          )}

          {/* Manage Factories Button (Only for Admin) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setIsFactoryModalOpen(true);
                setFactoryActionError(null);
                setFactoryActionSuccess(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer border border-indigo-400/30"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-300" />
              <span>จัดการโรงงาน ({factoryList.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-view Content: 1. Main Vehicles Tab */}
      {subView === 'vehicles' && (
        <>
          {/* Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  จำนวนรถทั้งหมด
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {vehicles.length}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">คัน</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">ครอบคลุมทั้ง {factoryList.length} โรงงาน</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  เกินรอบเปลี่ยนถ่าย (ด่วน)
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold ${
                      overdueCount > 0 ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {overdueCount}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">คัน</span>
                </div>
                <p className="text-[11px] text-red-500 font-medium mt-1">
                  {overdueCount > 0 ? 'วิ่งเลยเป้าหมาย (+20,000 กม.) แล้ว!' : 'ไม่มีรถเกินรอบ'}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlertOctagon className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  เตือนล่วงหน้า 1 เดือน
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold ${
                      dueSoonCount > 0 ? 'text-amber-600' : 'text-slate-800'
                    }`}
                  >
                    {dueSoonCount}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">คัน</span>
                </div>
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  {dueSoonCount > 0 ? 'เตรียมสั่งซื้อน้ำมันเครื่อง' : 'ยังไม่ถึงรอบเตือน'}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  dueSoonCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ประวัติเติม AdBlue รวม
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-teal-600">
                    {totalAdBlueLiters.toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">ลิตร</span>
                </div>
                <p className="text-[11px] text-teal-600 font-medium mt-1">
                  {adBlueRefills.length} บันทึกการเติม
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Droplets className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Factory Tabs and Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setSelectedFactory('all')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedFactory === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทุกโรงงาน ({vehicles.length})
                </button>
                {factoryList.map((fac) => {
                  const count = vehicles.filter((v) => v.factory === fac).length;
                  const isSelected = selectedFactory === fac;
                  return (
                    <button
                      key={fac}
                      onClick={() => setSelectedFactory(fac)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{fac}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Print for currently selected factory */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenPrint(selectedFactory)}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    พิมพ์รายงาน ({selectedFactory === 'all' ? 'ทุกโรงงาน' : selectedFactory})
                  </span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาทะเบียนรถ, สายรถ, หรือหมายเหตุ..."
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">ทุกสถานะรอบถ่าย</option>
                  <option value="due">เฉพาะใกล้ถึงรอบ & เกินรอบ</option>
                  <option value="normal">เฉพาะสถานะปกติ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vehicles Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
            {filteredVehicles.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-base font-bold text-slate-700">ไม่พบข้อมูลรถ</h4>
                <p className="text-xs text-slate-400 mt-1">
                  ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "+ เพิ่มข้อมูลรถ" เพื่อลงทะเบียนรถใหม่
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[400px]">
                  <table className="w-full text-left text-xs table-auto">
                    <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">ทะเบียนรถ & ข้อมูล</th>
                        <th className="py-2.5 px-2.5 min-w-[130px] whitespace-nowrap">โรงงาน & สายรถ</th>
                        <th className="py-2.5 px-2 text-center w-[110px] whitespace-nowrap">เที่ยววิ่ง</th>
                        <th className="py-2.5 px-3 text-right min-w-[150px] whitespace-nowrap">เลขไมล์ปัจจุบัน & ถ่ายล่าสุด</th>
                        <th className="py-2.5 px-2 text-center w-[110px] whitespace-nowrap">เกณฑ์รอบถ่าย</th>
                        <th className="py-2.5 px-3 text-right min-w-[150px] whitespace-nowrap">เป้าหมายรอบถัดไป</th>
                        <th className="py-2.5 px-2 text-center w-[145px] whitespace-nowrap">วันเรียกรถเข้าถ่าย</th>
                        <th className="py-2.5 px-2 text-center w-[120px] whitespace-nowrap">สถานะ</th>
                        <th className="py-2.5 px-3 text-center min-w-[180px] whitespace-nowrap">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredVehicles.map(({ vehicle, cycle }) => {
                        const isOverdue = cycle.status === 'overdue';
                        const isDueSoon = cycle.status === 'due_soon';

                        const percentUsed = Math.min(
                          100,
                          Math.round((cycle.kmSinceLastChange / (vehicle.oilChangeIntervalKm || 20000)) * 100)
                        );

                        // Calculate vehicle's total AdBlue filled
                        const vehicleAdBlueLiters = adBlueRefills
                          .filter((r) => r.licensePlate === vehicle.licensePlate)
                          .reduce((sum, r) => sum + (r.litersFilled || 0), 0);

                        return (
                          <tr
                            key={vehicle.id}
                            className={`hover:bg-amber-50/40 transition-colors ${
                              isOverdue ? 'bg-red-50/40' : isDueSoon ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {/* Col 1: ทะเบียนรถ & ข้อมูล */}
                            <td className="py-2.5 px-3">
                              <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                {vehicle.licensePlate}
                              </div>
                              {vehicleAdBlueLiters > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 border border-teal-200/60 px-1.5 py-0.2 rounded font-bold mt-0.5">
                                  <Droplets className="w-2.5 h-2.5" />
                                  <span>AdBlue: {vehicleAdBlueLiters} ลิตร</span>
                                </span>
                              )}
                              {vehicle.notes && (
                                <span className="text-[11px] text-slate-400 block truncate max-w-[170px]" title={vehicle.notes}>
                                  {vehicle.notes}
                                </span>
                              )}
                            </td>

                            {/* Col 2: โรงงาน & สายรถ */}
                            <td className="py-2.5 px-2.5">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                                {vehicle.factory}
                              </span>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-[130px]" title={vehicle.route}>
                                {vehicle.route ? `สาย ${vehicle.route}` : '-'}
                              </div>
                            </td>

                            {/* Col 3: เที่ยววิ่ง */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              <div className="font-bold text-slate-800 text-xs">
                                {vehicle.distancePerTrip.toLocaleString('th-TH')} <span className="text-[10px] text-slate-500 font-normal">กม./เที่ยว</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {vehicle.tripsPerMonth} <span className="text-[10px]">เที่ยว/ด.</span>
                              </div>
                            </td>

                            {/* Col 4: เลขไมล์ปัจจุบัน & ถ่ายล่าสุด */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className="font-black text-slate-900 text-xs sm:text-sm">
                                {vehicle.currentMileage.toLocaleString('th-TH')} กม.
                              </span>
                              <span className="block text-[11px] text-emerald-700 font-bold mt-0.5">
                                ถ่ายล่าสุด: {vehicle.lastOilChangeDate ? formatThaiDate(vehicle.lastOilChangeDate) : '-'}
                              </span>
                              {vehicle.lastOilChangeMileage ? (
                                <span className="block text-[10px] text-slate-400">
                                  (ที่ไมล์ {vehicle.lastOilChangeMileage.toLocaleString('th-TH')} กม.)
                                </span>
                              ) : null}
                            </td>

                            {/* Col 5: เกณฑ์รอบถ่าย */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {cycle.cycleType === 'month' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  รอบ {cycle.intervalMonths} เดือน
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  +{cycle.intervalKm.toLocaleString('th-TH')} กม.
                                </span>
                              )}
                            </td>

                            {/* Col 6: เป้าหมายรอบถัดไป */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="text-right">
                                {cycle.cycleType === 'month' ? (
                                  <>
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                      {cycle.formattedDueDate}
                                    </span>
                                    <span className={`block text-[11px] font-semibold ${
                                      isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-purple-700'
                                    }`}>
                                      {isOverdue
                                        ? `เลยกำหนด ${Math.abs(cycle.estimatedDaysRemaining)} วัน`
                                        : `เหลืออีก ${cycle.estimatedDaysRemaining} วัน`}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      ไมล์คาดการณ์: ~{cycle.nextTargetMileage.toLocaleString('th-TH')} กม.
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                      {cycle.nextTargetMileage.toLocaleString('th-TH')} กม.
                                    </span>
                                    <span className={`block text-[11px] font-semibold ${
                                      isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>
                                      {isOverdue
                                        ? `เกินรอบ ${Math.abs(cycle.kmRemaining).toLocaleString('th-TH')} กม.`
                                        : `เหลืออีก ${cycle.kmRemaining.toLocaleString('th-TH')} กม.`}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      วิ่งแล้ว {cycle.kmSinceLastChange.toLocaleString('th-TH')} กม. ({percentUsed}%)
                                    </span>
                                    <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1 ml-auto overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          isOverdue ? 'bg-red-500' : isDueSoon ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${percentUsed}%` }}
                                      ></div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Col 7: วันเรียกรถเข้าถ่าย */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSchedulingVehicle(vehicle);
                                    setScheduleInputDate(
                                      vehicle.nextOilChangeDueDate ||
                                      (cycle.estimatedDueDate ? cycle.estimatedDueDate.toISOString().slice(0, 10) : '')
                                    );
                                  }}
                                  title="คลิกเพื่อกำหนดหรือเปลี่ยนวันนัดหมายเรียกรถเข้า"
                                  className="group inline-flex flex-col items-center p-1.5 rounded-xl hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition cursor-pointer text-left shadow-2xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-700">
                                      {cycle.formattedDueDate}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                      cycle.isManualDueDate
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {cycle.isManualDueDate ? '📌 นัดเอง' : '⚡ อัตโนมัติ'}
                                    </span>
                                    <span className={`text-[10px] font-bold ${
                                      isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-700' : 'text-slate-500'
                                    }`}>
                                      {isOverdue
                                        ? '• เลยกำหนด'
                                        : cycle.estimatedDaysRemaining === 0
                                        ? '• วันนี้!'
                                        : `• อีก ${cycle.estimatedDaysRemaining} วัน`}
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <div className="inline-flex flex-col items-center p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-left">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                      {cycle.formattedDueDate}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                      cycle.isManualDueDate
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {cycle.isManualDueDate ? '📌 นัดเอง' : '⚡ อัตโนมัติ'}
                                    </span>
                                    <span className={`text-[10px] font-bold ${
                                      isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-700' : 'text-slate-500'
                                    }`}>
                                      {isOverdue
                                        ? '• เลยกำหนด'
                                        : cycle.estimatedDaysRemaining === 0
                                        ? '• วันนี้!'
                                        : `• อีก ${cycle.estimatedDaysRemaining} วัน`}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Col 8: สถานะ */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {isOverdue ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                                    <AlertOctagon className="w-3 h-3" />
                                    เกิน {Math.abs(cycle.kmRemaining).toLocaleString('th-TH')} กม.
                                  </span>
                                  <span className="text-[10px] text-red-600 font-bold mt-0.5">
                                    เปลี่ยนทันที!
                                  </span>
                                </div>
                              ) : isDueSoon ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    อีก {cycle.kmRemaining.toLocaleString('th-TH')} กม.
                                  </span>
                                  <span className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                    ~{cycle.estimatedDaysRemaining} วัน (ล่วงหน้า)
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    เหลือ {cycle.kmRemaining.toLocaleString('th-TH')} กม.
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    ~{cycle.estimatedDaysRemaining} วัน
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Col 9: การจัดการ */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isAdmin ? (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Quick Dispense Oil */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDispenseForVehicle(vehicle.licensePlate, vehicle.currentMileage, vehicle.id)
                                    }
                                    title="เบิกน้ำมันเครื่องให้รถคันนี้ทันที"
                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    <span>เบิกน้ำมัน</span>
                                  </button>

                                  {/* Quick Refill AdBlue */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAdBlueRefillForVehicle(vehicle)}
                                    title="บันทึกการเติมน้ำยาบำบัดไอเสีย AdBlue ให้รถคันนี้"
                                    className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  >
                                    <Droplets className="w-3 h-3" />
                                    <span>+AdBlue</span>
                                  </button>

                                  {/* Record Oil Change Service */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenServiceModal(vehicle)}
                                    title="บันทึกเปลี่ยนถ่ายน้ำมันเครื่องรอบใหม่"
                                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Vehicle */}
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(vehicle)}
                                    title="แก้ไขข้อมูลรถ"
                                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Vehicle */}
                                  <button
                                    type="button"
                                    onClick={() => setVehicleToDelete(vehicle)}
                                    title="ลบข้อมูลรถ"
                                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                                  โหมดอ่านอย่างเดียว
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Card Summary Row */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium">
                  <span>
                    แสดงผล <strong>{filteredVehicles.length}</strong> จากทั้งหมด <strong>{vehicles.length}</strong> คัน ({selectedFactory === 'all' ? 'ทุกโรงงาน' : selectedFactory})
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      เกินรอบ: <strong className="text-red-600 font-bold">{overdueCount}</strong> คัน
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      ใกล้ถึงรอบ: <strong className="text-amber-700 font-bold">{dueSoonCount}</strong> คัน
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      ปกติ: <strong className="text-emerald-700 font-bold">{Math.max(0, vehicles.length - overdueCount - dueSoonCount)}</strong> คัน
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Sub-view Content: 2. Dedicated AdBlue Refills Section */}
      {subView === 'adblue' && (
        <div className="space-y-4 no-print">
          {/* AdBlue Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  จำนวนครั้งที่เติม AdBlue
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-teal-700">
                    {filteredAdBlueRecords.length}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">ครั้ง</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  โรงงาน: {selectedFactory === 'all' ? 'ทุกโรงงาน' : selectedFactory}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Droplets className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ปริมาณ AdBlue ที่เติมรวม
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                    {totalAdBlueLiters.toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">ลิตร</span>
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">
                  เฉลี่ย ~{filteredAdBlueRecords.length > 0 ? Math.round(totalAdBlueLiters / filteredAdBlueRecords.length) : 0} ลิตร/ครั้ง
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Percent className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  คงเหลือในสต๊อก (น้ำยา AdBlue)
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    {adBlueOils.reduce((sum, o) => sum + (o.currentStock || 0), 0).toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">ลิตร</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  จาก {adBlueOils.length} รายการสต๊อก AdBlue
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* AdBlue Filter & Actions Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาทะเบียนรถ, ผู้เติม, หรือหมายเหตุ..."
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-700 outline-none font-bold"
              >
                <option value="all">ทุกโรงงาน</option>
                {factoryList.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenNewAdBlueRefill}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ บันทึกการเติม AdBlue</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAdBluePrintOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-300" />
                <span>พิมพ์รายงาน AdBlue</span>
              </button>
            </div>
          </div>

          {/* AdBlue Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredAdBlueRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Droplets className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-base font-bold text-slate-700">ไม่พบประวัติการเติม AdBlue</h4>
                <p className="text-xs text-slate-400 mt-1">
                  กดปุ่ม "+ บันทึกการเติม AdBlue" เพื่อบันทึกรายการแรก
                </p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[380px]">
                <table className="w-full text-left text-xs table-auto">
                  <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-[95px] whitespace-nowrap">วัน-เวลาที่เติม</th>
                      <th className="py-2.5 px-3 min-w-[140px] whitespace-nowrap">ทะเบียนรถ</th>
                      <th className="py-2.5 px-2.5 w-[110px] whitespace-nowrap">โรงงาน</th>
                      <th className="py-2.5 px-2 text-center w-[85px] bg-amber-50/70 whitespace-nowrap">% ก่อนเติม</th>
                      <th className="py-2.5 px-2 text-center w-[85px] bg-teal-50/70 whitespace-nowrap">% หลังเติม</th>
                      <th className="py-2.5 px-3 text-right w-[100px] whitespace-nowrap">จำนวนลิตร</th>
                      <th className="py-2.5 px-2.5 w-[100px] whitespace-nowrap">ผู้เติม</th>
                      <th className="py-2.5 px-2.5 text-right w-[95px] whitespace-nowrap">เลขไมล์ (กม.)</th>
                      <th className="py-2.5 px-3 min-w-[130px]">หมายเหตุ</th>
                      <th className="py-2.5 px-2.5 text-center w-[80px] whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAdBlueRecords.map((r) => {
                      const rDate = new Date(r.date);
                      const isValidDate = !isNaN(rDate.getTime());
                      const dateStr = isValidDate ? rDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
                      const timeStr = isValidDate ? rDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';

                      return (
                        <tr key={r.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-xs">{dateStr}</div>
                            <div className="text-[11px] text-slate-500">{timeStr}</div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap font-extrabold text-slate-900 text-xs sm:text-sm">
                            {r.licensePlate}
                          </td>

                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                              {r.factory}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-amber-700 bg-amber-50/20">
                            {r.percentBefore}%
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-teal-700 bg-teal-50/20">
                            {r.percentAfter}%
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="font-black text-teal-700 text-xs sm:text-sm">
                              {r.litersFilled.toLocaleString('th-TH')}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-0.5">ลิตร</span>
                          </td>

                          <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-800 text-xs">
                            {r.filledBy}
                          </td>

                          <td className="py-2.5 px-2.5 text-right text-slate-700 font-semibold whitespace-nowrap text-xs">
                            {r.currentMileage ? `${r.currentMileage.toLocaleString('th-TH')} กม.` : '-'}
                          </td>

                          <td className="py-2.5 px-3 text-xs text-slate-500 max-w-xs truncate" title={r.notes}>
                            {r.notes || '-'}
                          </td>

                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {isAdmin ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditAdBlueRefill(r)}
                                  title="แก้ไขบันทึก"
                                  className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAdBlueToDelete(r)}
                                  title="ลบบันทึก"
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                                ดูอย่างเดียว
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 shadow-2xs">
                    <tr>
                      <td colSpan={5} className="py-2.5 px-4 text-right">
                        รวมปริมาณน้ำยา AdBlue ที่เติมทั้งหมด:
                      </td>
                      <td className="py-2.5 px-3 text-right text-teal-800 font-black">
                        {totalAdBlueLiters.toLocaleString('th-TH')} ลิตร
                      </td>
                      <td colSpan={4} className="py-2.5 px-3 text-xs text-slate-500">
                        ({filteredAdBlueRecords.length} ครั้ง)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  {editingVehicle ? 'แก้ไขข้อมูลรถ' : 'เพิ่มข้อมูลรถใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ทะเบียนรถ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    placeholder="เช่น 70-1234 กทม."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    โรงงานสังกัด <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formFactory}
                    onChange={(e) => setFormFactory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
                  >
                    {factoryList.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สายรถ / เส้นทางวิ่งประจำ
                </label>
                <input
                  type="text"
                  value={formRoute}
                  onChange={(e) => setFormRoute(e.target.value)}
                  placeholder="เช่น สายบางนา - แหลมฉบัง หรือ ขนส่งนิคมมาบตาพุด"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ระยะทางต่อเที่ยว (กม.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formDistancePerTrip}
                    onChange={(e) => setFormDistancePerTrip(e.target.value)}
                    placeholder="เช่น 150"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เที่ยววิ่งต่อเดือน (เที่ยว)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formTripsPerMonth}
                    onChange={(e) => setFormTripsPerMonth(e.target.value)}
                    placeholder="เช่น 30"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เลขไมล์ปัจจุบัน (กม.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formCurrentMileage}
                  onChange={(e) => setFormCurrentMileage(e.target.value)}
                  placeholder="เช่น 118500"
                  className="w-full px-3.5 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Last Oil Change Date and Mileage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    วันที่เปลี่ยนถ่ายล่าสุด
                  </label>
                  <input
                    type="date"
                    value={formLastOilChangeDate}
                    onChange={(e) => setFormLastOilChangeDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-900"
                  />
                  {formLastOilChangeDate && (
                    <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
                      {formatThaiDate(formLastOilChangeDate)}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    เลขไมล์ที่เปลี่ยนถ่ายล่าสุด (กม.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formLastOilChangeMileage}
                    onChange={(e) => setFormLastOilChangeMileage(e.target.value)}
                    placeholder="เช่น 100000"
                    className="w-full px-3 py-2 text-sm font-semibold border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    * ไมล์ตั้งต้นสำหรับนับรอบ +20,000 กม.
                  </span>
                </div>
              </div>

              {/* Cycle Criteria Selection: Distance (+20,000 km) vs Month */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>เกณฑ์การคำนวณรอบเปลี่ยนถ่ายถัดไป (เลือกแบบใดแบบหนึ่ง) *</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      เลือกได้ว่าจะเซ็ตระบบไว้ที่ระยะทาง (+20,000 กม. แบบเดิม) หรือเซ็ตตามจำนวนเดือน เพื่อให้ระบบคำนวณรอบถัดไป
                    </p>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                    formCycleType === 'month' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {formCycleType === 'month' ? '📅 ตามจำนวนเดือน' : '🛣️ ตามระยะทาง'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option 1: Distance-based */}
                  <div
                    onClick={() => setFormCycleType('distance')}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      formCycleType === 'distance'
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="cycleType"
                        checked={formCycleType === 'distance'}
                        onChange={() => setFormCycleType('distance')}
                        className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-extrabold text-xs text-slate-900 block">
                          1. คำนวณตามระยะทาง (กม.)
                        </span>
                        <span className="text-[11px] text-slate-600 mt-0.5 block">
                          แบบเดิม (+20,000 กม. หรือตามที่ระบุ)
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-indigo-200/60">
                      <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                        ระยะทางรอบเปลี่ยนถ่าย (กิโลเมตร)
                      </label>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        value={formIntervalKm}
                        disabled={formCycleType !== 'distance'}
                        onChange={(e) => setFormIntervalKm(e.target.value)}
                        placeholder="20000"
                        className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {['10000', '15000', '20000', '25000', '30000'].map((km) => (
                          <button
                            key={km}
                            type="button"
                            disabled={formCycleType !== 'distance'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormCycleType('distance');
                              setFormIntervalKm(km);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                              formIntervalKm === km && formCycleType === 'distance'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            +{Number(km).toLocaleString('th-TH')} กม.
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Month-based */}
                  <div
                    onClick={() => setFormCycleType('month')}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      formCycleType === 'month'
                        ? 'border-purple-600 bg-purple-50/70 shadow-xs ring-1 ring-purple-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="cycleType"
                        checked={formCycleType === 'month'}
                        onChange={() => setFormCycleType('month')}
                        className="mt-0.5 w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-extrabold text-xs text-slate-900 block">
                          2. คำนวณตามจำนวนเดือน
                        </span>
                        <span className="text-[11px] text-slate-600 mt-0.5 block">
                          นับจากวันที่เปลี่ยนถ่ายล่าสุด
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-purple-200/60">
                      <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                        จำนวนเดือนต่อรอบ (เดือน)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="36"
                        step="1"
                        value={formIntervalMonths}
                        disabled={formCycleType !== 'month'}
                        onChange={(e) => setFormIntervalMonths(e.target.value)}
                        placeholder="6"
                        className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {['1', '3', '6', '12'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={formCycleType !== 'month'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormCycleType('month');
                              setFormIntervalMonths(m);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                              formIntervalMonths === m && formCycleType === 'month'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            ทุกๆ {m} เดือน
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview of Calculation */}
                {(() => {
                  const currentKm = parseFloat(formCurrentMileage) || 0;
                  const lastKm = parseFloat(formLastOilChangeMileage);
                  const hasLastKm = !isNaN(lastKm) && lastKm > 0;
                  const baseMileage = hasLastKm ? lastKm : currentKm;
                  const intervalKmNum = parseFloat(formIntervalKm) || 20000;
                  const intervalMonthsNum = parseInt(formIntervalMonths, 10) || 6;

                  if (formCycleType === 'month') {
                    let baseDate = new Date();
                    if (formLastOilChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(formLastOilChangeDate)) {
                      const [y, m, d] = formLastOilChangeDate.split('-').map(Number);
                      baseDate = new Date(y, m - 1, d);
                    }
                    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + intervalMonthsNum, baseDate.getDate());
                    const targetStr = formatThaiDate(targetDate);
                    return (
                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span>
                            สรุปผลคำนวณตามรอบเดือน: กำหนดเปลี่ยนถ่ายรอบถัดไป{' '}
                            <strong>{targetStr}</strong> (ครบ {intervalMonthsNum} เดือน นับจาก {formatThaiDate(formLastOilChangeDate || baseDate)})
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const targetMileage = baseMileage + intervalKmNum;
                    return (
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <span>
                            สรุปผลคำนวณตามระยะทาง: เป้าหมายรอบถัดไปคือ{' '}
                            <strong className="text-indigo-950 font-black underline">
                              {targetMileage.toLocaleString('th-TH')} กม.
                            </strong>{' '}
                            (เลขไมล์ล่าสุด {baseMileage.toLocaleString('th-TH')} + {intervalKmNum.toLocaleString('th-TH')} กม.)
                          </span>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Next Oil Change Due Date Field */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>วันที่ต้องเข้ามาเปลี่ยนถ่ายในรอบถัดไป (วันเรียกรถเข้า)</span>
                  </label>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    formDueDate ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-700'
                  }`}>
                    {formDueDate ? '📌 กำหนดวันเอง' : '⚡ ใช้คำนวณอัตโนมัติ'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                  />
                  {formDueDate && (
                    <button
                      type="button"
                      onClick={() => setFormDueDate('')}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                      title="ล้างวันที่ เพื่อให้ระบบคำนวณวันนัดหมายให้อัตโนมัติ"
                    >
                      ล้างวัน
                    </button>
                  )}
                </div>

                {(() => {
                  let autoDateStr = '';
                  let formatted = '';
                  let descText = '';

                  if (formCycleType === 'month') {
                    const intervalMonthsNum = parseInt(formIntervalMonths, 10) || 6;
                    let baseDate = new Date();
                    if (formLastOilChangeDate && /^\d{4}-\d{2}-\d{2}$/.test(formLastOilChangeDate)) {
                      const [y, m, d] = formLastOilChangeDate.split('-').map(Number);
                      baseDate = new Date(y, m - 1, d);
                    }
                    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + intervalMonthsNum, baseDate.getDate());
                    const y = targetDate.getFullYear();
                    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
                    const d = String(targetDate.getDate()).padStart(2, '0');
                    autoDateStr = `${y}-${m}-${d}`;
                    formatted = formatThaiDate(targetDate);
                    const today = new Date();
                    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                    const targetMs = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
                    const daysRemaining = Math.round((targetMs - todayMs) / 86400000);
                    descText = `คำนวณตามรอบ ${intervalMonthsNum} เดือน: ${formatted} (${daysRemaining <= 0 ? 'ครบกำหนดแล้ว' : `อีก ~${daysRemaining} วัน`})`;
                  } else {
                    const dist = parseFloat(formDistancePerTrip) || 0;
                    const trips = parseFloat(formTripsPerMonth) || 0;
                    const monthlyKm = dist * trips;
                    const dailyKm = monthlyKm > 0 ? monthlyKm / 30 : 50;

                    const currentKm = parseFloat(formCurrentMileage) || 0;
                    const lastKm = parseFloat(formLastOilChangeMileage);
                    const hasLastKm = !isNaN(lastKm) && lastKm > 0;
                    const baseMileage = hasLastKm ? lastKm : currentKm;
                    const intervalKmNum = parseFloat(formIntervalKm) || 20000;
                    const targetMileage = baseMileage + intervalKmNum;
                    const kmRemaining = Math.max(0, targetMileage - currentKm);

                    const daysEst = kmRemaining <= 0 ? 0 : Math.max(1, Math.round(kmRemaining / dailyKm));
                    const autoDate = new Date(Date.now() + daysEst * 86400000);
                    const y = autoDate.getFullYear();
                    const m = String(autoDate.getMonth() + 1).padStart(2, '0');
                    const d = String(autoDate.getDate()).padStart(2, '0');
                    autoDateStr = `${y}-${m}-${d}`;
                    formatted = formatThaiDate(autoDate);
                    descText = `คำนวณจากเที่ยววิ่ง (+${intervalKmNum.toLocaleString('th-TH')} กม.): ${formatted} (อีก ~${daysEst} วัน)`;
                  }

                  return (
                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>
                          {formDueDate
                            ? `นัดหมายไว้: ${formatThaiDate(formDueDate)} (${descText})`
                            : descText}
                        </span>
                      </div>
                      {!formDueDate && (
                        <button
                          type="button"
                          onClick={() => setFormDueDate(autoDateStr)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-[10px] border border-indigo-200 transition cursor-pointer flex-shrink-0"
                        >
                          ⚡ ใช้วันนี้
                        </button>
                      )}
                    </div>
                  );
                })()}

                <p className="text-[11px] text-slate-400">
                  * หากระบุวันที่ ผู้ใช้งานและทีมงานจะทราบวันนัดหมายเรียกรถเข้าที่แน่นอน / หากปล่อยว่าง ระบบจะคำนวณวันให้โดยอัตโนมัติตามเกณฑ์ที่เลือก
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / ชื่อช่าง / ยี่ห้อรถ
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="เช่น รถหัวลาก Hino 380 หรือ ช่างประสิทธิ์"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : editingVehicle ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูลรถ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Service Modal */}
      {serviceVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-100" />
                <h3 className="font-bold text-base">บันทึกเปลี่ยนถ่ายน้ำมันเครื่องรอบใหม่</h3>
              </div>
              <button
                onClick={() => setServiceVehicle(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickServiceConfirm} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block font-semibold">รถคันที่เข้ารับบริการ:</span>
                <span className="font-black text-slate-900 text-base">
                  {serviceVehicle.licensePlate}
                </span>
                <span className="block text-slate-500 mt-0.5">
                  โรงงาน: <strong>{serviceVehicle.factory}</strong> • สาย: {serviceVehicle.route || '-'}
                </span>
              </div>

              {/* Current / Previous Oil Change History Card */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ประวัติถ่ายน้ำมันเครื่องล่าสุด:
                  </span>
                  <span className="font-extrabold text-emerald-950 text-xs px-2 py-0.5 bg-emerald-100/90 rounded-md">
                    {serviceVehicle.lastOilChangeDate ? formatThaiDate(serviceVehicle.lastOilChangeDate) : 'ยังไม่มีประวัติ'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-800">
                  <span>เลขไมล์ที่เปลี่ยนถ่ายรอบล่าสุด:</span>
                  <span className="font-bold text-slate-800">
                    {serviceVehicle.lastOilChangeMileage ? `${serviceVehicle.lastOilChangeMileage.toLocaleString('th-TH')} กม.` : '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เลขไมล์ที่เปลี่ยนถ่ายรอบนี้ (กม.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={serviceMileage}
                  onChange={(e) => setServiceMileage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {serviceVehicle.cycleType === 'month'
                    ? `* รถคันนี้ตั้งเกณฑ์รอบไว้ที่: ทุกๆ ${serviceVehicle.intervalMonths || 6} เดือน (ระบบจะนับจากวันที่เปลี่ยนถ่ายรอบนี้ไปอีก ${serviceVehicle.intervalMonths || 6} เดือน)`
                    : `* ระบบจะนำเลขไมล์ที่เปลี่ยนถ่ายรอบนี้ ไปบวกเพิ่ม ${(serviceVehicle.oilChangeIntervalKm || 20000).toLocaleString('th-TH')} กม. เป็นรอบเป้าหมายเปลี่ยนถ่ายรอบถัดไปอัตโนมัติ (เป้าหมายใหม่ = ${(Number(serviceMileage) || 0) > 0 ? ((Number(serviceMileage) || 0) + (serviceVehicle.oilChangeIntervalKm || 20000)).toLocaleString('th-TH') : 'ไมล์รอบนี้ + ' + (serviceVehicle.oilChangeIntervalKm || 20000).toLocaleString('th-TH')} กม.)`}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    วันที่เปลี่ยนถ่าย <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {serviceVehicle.lastOilChangeDate && (
                      <button
                        type="button"
                        onClick={() => setServiceDate(serviceVehicle.lastOilChangeDate)}
                        className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[11px] font-semibold transition cursor-pointer"
                        title="ใช้วันที่เปลี่ยนถ่ายล่าสุดของรถคันนี้"
                      >
                        วันเดิม
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setServiceDate(getTodayLocalDateStr())}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      วันนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        setServiceDate(`${y}-${m}-${day}`);
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      เมื่อวาน
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-900"
                />
                {serviceDate ? (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <span>🗓️ บันทึกเป็นวันที่:</span>
                    <strong className="underline">{formatThaiDate(serviceDate)}</strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">
                    * กรุณาระบุวันที่เปลี่ยนถ่ายจริง
                  </p>
                )}
              </div>

              {/* Option to automatically deduct from stock and link with stock dispensing */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-950">
                  <input
                    type="checkbox"
                    checked={serviceDeductStock}
                    onChange={(e) => setServiceDeductStock(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>เบิกและตัดสต๊อกน้ำมันเครื่องด้วย (บันทึกลงประวัติสต๊อก)</span>
                </label>
                {serviceDeductStock && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        เลือกชนิดน้ำมันเครื่อง
                      </label>
                      <select
                        value={serviceOilId || (engineOils[0]?.id || '')}
                        onChange={(e) => setServiceOilId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white outline-none font-medium"
                      >
                        {engineOils.map((oil) => (
                          <option key={oil.id} value={oil.id}>
                            {oil.name} ({oil.viscosity}) - เหลือ {oil.currentStock}L
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        จำนวนลิตรที่ใช้
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={serviceAmountLiters}
                        onChange={(e) => setServiceAmountLiters(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white outline-none font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const plate = serviceVehicle.licensePlate;
                    const km = parseFloat(serviceMileage) || serviceVehicle.currentMileage;
                    const id = serviceVehicle.id;
                    setServiceVehicle(null);
                    onDispenseForVehicle(plate, km, id);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 rounded-xl transition cursor-pointer flex items-center gap-1 mr-auto"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>ไปหน้าเบิกสินค้า</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceVehicle(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={serviceSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {serviceSubmitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึกรอบใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Scheduling Modal */}
      {schedulingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">ระบุวันเรียกรถเข้าเปลี่ยนถ่าย</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    กำหนดวันที่ต้องเรียกรถเข้ามาเปลี่ยนถ่ายน้ำมันเครื่อง
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSchedulingVehicle(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleDate} className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">ทะเบียนรถ:</span>
                  <span className="font-black text-slate-900 text-sm">
                    {schedulingVehicle.licensePlate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">โรงงาน / สายรถ:</span>
                  <span className="font-bold text-slate-700">
                    {schedulingVehicle.factory} • {schedulingVehicle.route || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">เลขไมล์ปัจจุบัน:</span>
                  <span className="font-extrabold text-slate-900">
                    {schedulingVehicle.currentMileage.toLocaleString('th-TH')} กม.
                  </span>
                </div>
                {schedulingVehicle.lastOilChangeMileage ? (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-semibold">เลขไมล์ที่เปลี่ยนถ่ายล่าสุด:</span>
                    <span className="font-bold text-emerald-800">
                      {schedulingVehicle.lastOilChangeMileage.toLocaleString('th-TH')} กม.
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-indigo-700 font-bold">รอบเปลี่ยนถ่ายถัดไป (+20,000 กม.):</span>
                  <span className="font-black text-indigo-700">
                    {calculateVehicleCycle(schedulingVehicle).nextTargetMileage.toLocaleString('th-TH')} กม.
                  </span>
                </div>
              </div>

              {(() => {
                const cycle = calculateVehicleCycle(schedulingVehicle);
                return (
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-800">
                      <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>ข้อมูลการคำนวณอัตโนมัติจากเที่ยววิ่ง:</span>
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      ระยะทาง {schedulingVehicle.distancePerTrip} กม./เที่ยว × {schedulingVehicle.tripsPerMonth} เที่ยว/ด.
                      (วิ่งเฉลี่ยวันละ ~{Math.round(cycle.dailyKm)} กม. เหลืออีก {cycle.kmRemaining.toLocaleString('th-TH')} กม.)
                      <br />
                      วันที่คำนวณอัตโนมัติ: <strong>{cycle.formattedDueDate}</strong> (~{cycle.estimatedDaysRemaining} วัน)
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (cycle.dueDateString) {
                            setScheduleInputDate(cycle.dueDateString);
                          }
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        ⚡ ใช้วันที่คำนวณอัตโนมัติ ({cycle.formattedDueDate})
                      </button>
                      {scheduleInputDate && (
                        <button
                          type="button"
                          onClick={() => setScheduleInputDate('')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          ล้างวัน (ใช้คำนวณอัตโนมัติ)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ระบุวันที่ต้องเรียกรถเข้ามาเปลี่ยนถ่ายรอบถัดไป
                </label>
                <input
                  type="date"
                  value={scheduleInputDate}
                  onChange={(e) => setScheduleInputDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {scheduleInputDate
                    ? `* กำหนดนัดหมายเรียกรถเข้า: ${formatThaiDate(scheduleInputDate)}`
                    : '* หากเว้นว่างไว้ ระบบจะคำนวณวันนัดหมายให้อัตโนมัติตามระยะวิ่งของสายรถ'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSchedulingVehicle(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {scheduleSubmitting ? 'กำลังบันทึก...' : 'บันทึกวันเรียกรถเข้า'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vehicle Confirmation Modal */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">ยืนยันการลบข้อมูลรถ?</h4>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบรถทะเบียน <strong>{vehicleToDelete.licensePlate}</strong> ({vehicleToDelete.factory}) ออกจากระบบ
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVehicleToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete AdBlue Confirmation Modal */}
      {adBlueToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">ยืนยันการลบประวัติเติม AdBlue?</h4>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบรายการเติม AdBlue ของรถ <strong>{adBlueToDelete.licensePlate}</strong> จำนวน <strong>{adBlueToDelete.litersFilled} ลิตร</strong>
              </p>
              {adBlueToDelete.deductedFromStock && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 text-left mt-3">
                  <span>ℹ️ รายการนี้มีการตัดสต๊อก ระบบจะ<strong>คืนยอด {adBlueToDelete.litersFilled} ลิตร กลับเข้าคลังสต๊อกน้ำยา AdBlue</strong> ให้อัตโนมัติ</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdBlueToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteAdBlueConfirm}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Management Modal */}
      {isFactoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">จัดการข้อมูลโรงงาน (เพิ่ม & แก้ไขชื่อ)</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    สามารถแก้ไขชื่อโรงงานหรือเพิ่มโรงงานใหม่เพื่อจัดหมวดหมู่รถ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFactoryModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {factoryActionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{factoryActionError}</span>
                </div>
              )}
              {factoryActionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{factoryActionSuccess}</span>
                </div>
              )}

              {/* Add New Factory Form */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  + เพิ่มโรงงานใหม่
                </label>
                <form onSubmit={handleCreateFactory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newFactoryInput}
                    onChange={(e) => setNewFactoryInput(e.target.value)}
                    placeholder="เช่น โรงงาน 5, คลังระยอง หรือ โรงงานบางนา"
                    className="flex-1 px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  />
                  <button
                    type="submit"
                    disabled={factoryLoading || !newFactoryInput.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer flex-shrink-0"
                  >
                    {factoryLoading ? 'กำลังเพิ่ม...' : 'เพิ่มโรงงาน'}
                  </button>
                </form>
              </div>

              {/* Existing Factories List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    รายชื่อโรงงานทั้งหมด ({factories.length || DEFAULT_FACTORIES.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    * แก้ไขชื่อจะปรับข้อมูลรถให้อัตโนมัติ
                  </span>
                </div>

                <div className="space-y-2">
                  {factories.length === 0 ? (
                    DEFAULT_FACTORIES.map((facName, index) => {
                      const count = vehicles.filter((v) => v.factory === facName).length;
                      return (
                        <div
                          key={facName}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="font-bold text-slate-800 text-sm">{facName}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                              {count} คัน
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    factories.map((f, index) => {
                      const count = vehicles.filter((v) => v.factory === f.name).length;
                      const isEditingThis = editingFactoryId === f.id;

                      return (
                        <div
                          key={f.id}
                          className={`p-3 rounded-xl border transition ${
                            isEditingThis
                              ? 'bg-amber-50/60 border-amber-300'
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          {isEditingThis ? (
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold text-amber-900 block">
                                แก้ไขชื่อโรงงาน:
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingFactoryName}
                                  onChange={(e) => setEditingFactoryName(e.target.value)}
                                  className="flex-1 px-3 py-1.5 text-sm font-bold border border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditFactory(f)}
                                  disabled={factoryLoading || !editingFactoryName.trim()}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>บันทึก</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFactoryId(null)}
                                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {index + 1}
                                </span>
                                <div>
                                  <span className="font-extrabold text-slate-900 text-sm">
                                    {f.name}
                                  </span>
                                  <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                    {count} คันสังกัด
                                  </span>
                                </div>
                              </div>

                              {factoryToDelete?.id === f.id ? (
                                <div className="flex items-center gap-1.5 animate-in fade-in">
                                  <span className="text-xs text-red-600 font-bold">ยืนยันลบ?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFactoryItem(f)}
                                    disabled={factoryLoading}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                  >
                                    ลบ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFactoryToDelete(null)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditFactory(f)}
                                    title="แก้ไขชื่อโรงงาน"
                                    className="px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>แก้ไขชื่อ</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setFactoryToDelete(f)}
                                    title={
                                      count > 0
                                        ? `ไม่สามารถลบได้เนื่องจากมีรถ ${count} คันสังกัดอยู่`
                                        : 'ลบโรงงาน'
                                    }
                                    disabled={count > 0}
                                    className={`p-1.5 rounded-lg text-xs transition ${
                                      count > 0
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                                    }`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFactoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Print Report Modal */}
      <VehiclePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        vehicles={vehicles}
        factoryList={factoryList}
        initialFactory={printModalFactory}
        userName={userName}
      />

      {/* AdBlue Refill Modal (New & Edit) */}
      <AdBlueRefillModal
        isOpen={isAdBlueModalOpen}
        onClose={() => {
          setIsAdBlueModalOpen(false);
          setAdBluePreselectedVehicle(null);
          setEditingAdBlueRecord(null);
        }}
        vehicles={vehicles}
        adBlueOils={adBlueOils}
        userName={userName}
        preselectedVehicle={adBluePreselectedVehicle}
        editingRecord={editingAdBlueRecord}
        onSuccess={() => {
          setSuccessToast('บันทึกข้อมูลการเติมน้ำยา AdBlue เรียบร้อยแล้ว');
          setTimeout(() => setSuccessToast(null), 3000);
        }}
      />

      {/* AdBlue Print Modal */}
      <AdBluePrintModal
        isOpen={isAdBluePrintOpen}
        onClose={() => setIsAdBluePrintOpen(false)}
        records={adBlueRefills}
        factoryList={factoryList}
        initialFactory={selectedFactory}
        userName={userName}
      />

      {/* CSV Export & Import / Restore Modal for Vehicles */}
      <CsvDataModal
        isOpen={isVehicleCsvModalOpen}
        onClose={() => setIsVehicleCsvModalOpen(false)}
        title="ส่งออก / นำเข้า CSV & กู้คืน: ประวัติถ่ายน้ำมันเครื่อง"
        subtitle="ระบบรองรับทั้งไฟล์ CSV และ Excel (.xlsx) พร้อมคำนวณรอบและอัปเดตทะเบียนรถอัตโนมัติ"
        domainName="ข้อมูลรถและรอบเปลี่ยนถ่าย"
        isAdmin={isAdmin}
        currentUserName={userName}
        onExportCurrentCsv={() => exportVehiclesToCsv(vehicles)}
        onDownloadTemplateCsv={downloadVehiclesTemplateCsv}
        parseRows={parseVehiclesFromRows}
        onExecuteImport={async (data, mode) => {
          return await batchRestoreVehicles(data, mode, userName);
        }}
        onSuccessNotification={(msg) => {
          setSuccessToast(msg);
          setTimeout(() => setSuccessToast(null), 4000);
        }}
      />

      {/* CSV Export & Import / Restore Modal for AdBlue */}
      <CsvDataModal
        isOpen={isAdBlueCsvModalOpen}
        onClose={() => setIsAdBlueCsvModalOpen(false)}
        title="ส่งออก / นำเข้า CSV & กู้คืน: ประวัติเติมน้ำยาบำบัดไอเสีย AdBlue"
        subtitle="บันทึกและกู้คืนรายการเติม AdBlue (%ก่อนเติม, %หลังเติม, ลิตร, เลขไมล์, ผู้เติม)"
        domainName="ประวัติเติม AdBlue"
        isAdmin={isAdmin}
        currentUserName={userName}
        onExportCurrentCsv={() => exportAdBlueToCsv(adBlueRefills)}
        onDownloadTemplateCsv={downloadAdBlueTemplateCsv}
        parseRows={parseAdBlueFromRows}
        onExecuteImport={async (data, mode) => {
          return await batchRestoreAdBlue(data, mode, userName);
        }}
        onSuccessNotification={(msg) => {
          setSuccessToast(msg);
          setTimeout(() => setSuccessToast(null), 4000);
        }}
      />
    </div>
  );
};

