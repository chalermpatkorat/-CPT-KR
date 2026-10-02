export type OilCategory = 'สังเคราะห์แท้ (Fully Synthetic)' | 'กึ่งสังเคราะห์ (Semi Synthetic)' | 'ธรรมดา (Mineral)' | 'อื่นๆ';

export interface OilItem {
  id: string;
  name: string; // เช่น Castrol EDGE, Shell Helix Ultra, PTT Performa
  brand: string; // เช่น Castrol, Shell, PTT, Mobil 1, Motul, Valvoline
  viscosity: string; // เช่น 0W-20, 5W-30, 5W-40, 10W-40, 15W-40, 20W-50
  oilType?: string; // ประเภทน้ำมัน (ไม่บังคับ)
  currentStock: number; // คงเหลือ (หน่วย: ลิตร)
  totalUsed: number; // ใช้ไปแล้วสะสม (หน่วย: ลิตร)
  totalReceived: number; // รับเข้าสะสม (หน่วย: ลิตร)
  minStockThreshold: number; // จุดเตือนใกล้หมด (ลิตร) เช่น 20
  unit: string; // "ลิตร"
  notes?: string; // หมายเหตุ เช่น เหมาะสำหรับเครื่องยนต์ดีเซลคอมมอนเรล
  updatedAt: string; // ISO string
  createdAt?: string;
  updatedBy: string; // ชื่อหรืออีเมลผู้แก้ไขล่าสุด
}

export type TransactionType = 'dispense' | 'receive'; // 'dispense' = เบิกใช้, 'receive' = รับเข้า

export interface StockTransaction {
  id: string;
  oilId: string;
  oilName: string;
  viscosity: string;
  type: TransactionType;
  amount: number; // จำนวนลิตร
  stockBefore: number; // สต๊อกก่อนทำรายการ
  stockAfter: number; // สต๊อกหลังทำรายการ
  performedBy: string; // ผู้ทำรายการ (สมาชิก)
  recipientOrVehicle: string; // ผู้เบิก / ทะเบียนรถ / วัตถุประสงค์ หรือ ซัพพลายเออร์ที่นำส่ง
  currentMileage?: number; // เลขไมล์ปัจจุบัน ณ ตอนเบิก
  referenceNote?: string; // หมายเหตุเพิ่มเติม / ล็อตที่ผลิต
  date: string; // วันที่ทำรายการ YYYY-MM-DDTHH:mm หรือ ISO string
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type FactoryName = string;

export interface FactoryItem {
  id: string;
  name: string; // เช่น โรงงาน 1, โรงงาน 2, โรงงานบางนา, โรงงานระยอง
  order: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Vehicle {
  id: string;
  licensePlate: string; // ทะเบียนรถ เช่น 70-1234 กทม.
  factory: string; // ชื่อโรงงาน
  route: string; // สายรถ เช่น สายเหนือ, สายอีสาน, สายคลังสินค้า-ท่าเรือ
  distancePerTrip: number; // ระยะทางต่อเที่ยว (กม.)
  tripsPerMonth: number; // เที่ยววิ่งต่อเดือน
  currentMileage: number; // เลขไมล์ปัจจุบัน (กม.)
  lastOilChangeMileage: number; // เลขไมล์ที่เปลี่ยนถ่ายน้ำมันเครื่องล่าสุด (กม.)
  lastOilChangeDate: string; // วันที่เปลี่ยนถ่ายล่าสุด (YYYY-MM-DD)
  oilChangeIntervalKm: number; // รอบการเปลี่ยนถ่าย (20,000 กม.)
  nextOilChangeDueDate?: string; // วันที่ต้องเรียกรถเข้ามาเปลี่ยนถ่ายรอบถัดไป (YYYY-MM-DD)
  notes?: string; // หมายเหตุ เช่น ชื่อคนขับ, ยี่ห้อรถ
  updatedAt: string;
  updatedBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: string;
  lastLoginAt: string;
}

export const ADMIN_EMAIL = 'chalermpat.korat1499@gmail.com';

export const isUserAdmin = (emailOrUser?: string | { email?: string | null } | null): boolean => {
  if (!emailOrUser) return false;
  const email = typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email;
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

export interface AdBlueRefillRecord {
  id: string;
  vehicleId?: string; // รหัสอ้างอิงรถในระบบ
  licensePlate: string; // ทะเบียนรถ เช่น 70-1122 กทม.
  factory: string; // โรงงาน เช่น โรงงาน 1, โรงงาน 2
  date: string; // วัน/เดือน/ปี ที่เติม (YYYY-MM-DD หรือ ISO string)
  percentBefore: number; // %ก่อนเติม เช่น 15
  percentAfter: number; // %หลังเติม เช่น 100
  litersFilled: number; // จำนวนลิตรที่เติม เช่น 20
  filledBy: string; // ผู้เติม เช่น ช่างสุรชัย
  currentMileage?: number; // เลขไมล์ ณ เวลาที่เติม (ถ้ามี)
  notes?: string; // หมายเหตุเพิ่มเติม เช่น เติมจากถัง 1,000L หรือ แกลลอน
  deductedFromStock?: boolean; // ตัดสต๊อกจากคลังน้ำยา AdBlue หรือไม่
  oilId?: string; // รหัสสินค้า AdBlue ที่ตัดสต๊อก
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
