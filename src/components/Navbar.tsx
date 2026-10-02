import React, { useState } from 'react';
import { AppUserSession, CloudSyncStatus } from '../lib/firebase';
import {
  Droplets,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  History,
  Bell,
  LogOut,
  User as UserIcon,
  Wifi,
  Menu,
  X,
  FileSpreadsheet,
  Truck,
  AlertTriangle,
  Database,
  BarChart3
} from 'lucide-react';
import { OilItem, Vehicle, FactoryItem } from '../types';
import { calculateVehicleCycle } from '../services/vehicleService';

export type ActiveTab = 'stock' | 'dispense' | 'receive' | 'vehicles' | 'report' | 'monthly_summary' | 'history';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: AppUserSession | null;
  onLogout: () => void;
  oils: OilItem[];
  vehicles: Vehicle[];
  factories?: FactoryItem[];
  cloudSyncStatus: CloudSyncStatus;
  onOpenAlerts: () => void;
  onOpenRulesModal: () => void;
  onSyncGoogleSheets: () => void;
  isSyncingSheets: boolean;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  oils,
  vehicles,
  factories = [],
  cloudSyncStatus,
  onOpenAlerts,
  onOpenRulesModal,
  onSyncGoogleSheets,
  isSyncingSheets,
  onOpenAuthModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Calculate oil alerts (out of stock + low stock)
  const oilAlertCount = oils.filter(
    (o) => o.currentStock <= o.minStockThreshold || o.currentStock <= 0
  ).length;

  // Calculate vehicles alert (due soon within 1 month or overdue)
  const vehiclesDueCount = vehicles.filter((v) => {
    const cycle = calculateVehicleCycle(v);
    return cycle.status === 'due_soon' || cycle.status === 'overdue';
  }).length;

  const totalAlertCount = oilAlertCount + vehiclesDueCount;

  const factoryCountText = factories.length > 0 ? `${factories.length} โรงงาน` : 'แต่ละโรงงาน';

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'stock', label: 'ข้อมูลสต๊อก', icon: <Layers className="w-4 h-4" /> },
    { id: 'dispense', label: 'เบิกสินค้า', icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'receive', label: 'รับเข้าสินค้า', icon: <ArrowDownLeft className="w-4 h-4" /> },
    {
      id: 'vehicles',
      label: `ข้อมูลรถ (${factoryCountText})`,
      icon: <Truck className="w-4 h-4" />,
      badge: vehiclesDueCount > 0 ? vehiclesDueCount : undefined,
    },
    { id: 'report', label: 'รายงานคงเหลือ (สั่งพิมพ์)', icon: <FileText className="w-4 h-4" /> },
    { id: 'monthly_summary', label: 'สรุปการใช้รายเดือน', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'history', label: 'ประวัติเบิกจ่ายและรับเข้า', icon: <History className="w-4 h-4" /> },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20 flex-shrink-0">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base lg:text-lg">
                  ระบบจัดการน้ำมันเครื่อง&น้ำยาแอดบลู CPT KR
                </span>
                
                {/* Real-time Cloud Sync Badge */}
                {cloudSyncStatus === 'connected' ? (
                  <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ซิงค์คลาวด์เรียลไทม์
                  </span>
                ) : cloudSyncStatus === 'permission_denied' ? (
                  <button
                    type="button"
                    onClick={onOpenRulesModal}
                    title="คลิกเพื่อดูวิธีเปิดสิทธิ์ Firebase Rules ให้ทุกเครื่องมองเห็นข้อมูลตรงกัน"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
                    <span>รอเปิดสิทธิ์ Rules (คลิกดูวิธี)</span>
                  </button>
                ) : (
                  <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    เชื่อมต่อคลาวด์...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                หน่วยนับเป็นลิตร • ซิงค์อัตโนมัติ Firebase & Google Sheets • รอบเปลี่ยนถ่าย 20,000 กม.
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-white text-amber-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons: Alerts, Google Sheets, User */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Database Rules Button if needed */}
            <button
              type="button"
              onClick={onOpenRulesModal}
              title="ตั้งค่าเชื่อมต่อ Firebase Real-time ให้ทุกเครื่อง"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>สิทธิ์คลาวด์</span>
            </button>

            {/* Quick Google Sheets Sync button */}
            <button
              type="button"
              onClick={onSyncGoogleSheets}
              disabled={isSyncingSheets}
              title="ซิงค์ข้อมูลไปยัง Google Sheets"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className={`w-4 h-4 text-emerald-600 ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheets ? 'กำลังซิงค์...' : 'Google Sheets'}</span>
            </button>

            {/* Notification Bell with Badge */}
            <button
              type="button"
              onClick={onOpenAlerts}
              title="การแจ้งเตือนสต๊อกใกล้หมด & รถใกล้ถึงรอบเปลี่ยนถ่าย"
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {totalAlertCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-sm">
                  {totalAlertCount}
                </span>
              )}
            </button>

            {/* User Profile & Logout */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'สมาชิก'}
                    className="w-8 h-8 rounded-full border border-amber-300 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs border border-amber-300">
                    {(user.displayName || user.email || 'M').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0] || 'สมาชิก'}
                  </div>
                  <div className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>ออนไลน์</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="ออกจากระบบ"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ</span>
              </button>
            )}

            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200/80 space-y-1 animate-in slide-in-from-top-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => {
                  onSyncGoogleSheets();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ซิงค์ Google Sheets</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenRulesModal();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-indigo-700 underline font-semibold flex items-center gap-1"
              >
                <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                <span>ตั้งค่าสิทธิ์คลาวด์</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
