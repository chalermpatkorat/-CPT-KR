import { useState, useEffect } from 'react';
import {
  initAuthObserver,
  logoutUser,
  testFirestoreConnection,
  signInWithGoogle,
  subscribeCloudSyncStatus,
  CloudSyncStatus,
  AppUserSession
} from './lib/firebase';
import { OilItem, StockTransaction, Vehicle, FactoryItem, AdBlueRefillRecord, isUserAdmin } from './types';
import {
  subscribeOils,
  subscribeTransactions
} from './services/stockService';
import {
  subscribeVehicles,
  calculateVehicleCycle,
  subscribeFactories
} from './services/vehicleService';
import { subscribeAdBlueRefills } from './services/adblueService';
import { syncStockToGoogleSheets } from './services/googleSheetsService';

import { Navbar, ActiveTab } from './components/Navbar';
import { StockListTab } from './components/StockListTab';
import { DispenseTab } from './components/DispenseTab';
import { ReceiveTab } from './components/ReceiveTab';
import { VehiclesTab } from './components/VehiclesTab';
import { ReportTab } from './components/ReportTab';
import { MonthlySummaryTab } from './components/MonthlySummaryTab';
import { HistoryTab } from './components/HistoryTab';
import { AlertModal } from './components/AlertModal';
import { AuthModal } from './components/AuthModal';
import { FirebaseRulesModal } from './components/FirebaseRulesModal';

import {
  AlertTriangle,
  FileSpreadsheet,
  X,
  ExternalLink,
  Database
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AppUserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('stock');
  const [oils, setOils] = useState<OilItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [factories, setFactories] = useState<FactoryItem[]>([]);
  const [adBlueRefills, setAdBlueRefills] = useState<AdBlueRefillRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Real-time Cloud Sync Status
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('connecting');

  // Preselected oil for quick dispense or receive from other tabs
  const [preselectedOilId, setPreselectedOilId] = useState<string | null>(null);

  // Prefilled vehicle data for quick dispense from Vehicles tab
  const [prefilledVehiclePlate, setPrefilledVehiclePlate] = useState<string | null>(null);
  const [prefilledMileage, setPrefilledMileage] = useState<number | null>(null);
  const [prefilledVehicleId, setPrefilledVehicleId] = useState<string | null>(null);

  // Alert Modal
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Google Sheets state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [lastSpreadsheetId, setLastSpreadsheetId] = useState<string | undefined>(undefined);

  // 1. Initialize Auth State and Cloud Sync Status
  useEffect(() => {
    const unsubAuth = initAuthObserver((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setIsAuthModalOpen(true);
      } else {
        setIsAuthModalOpen(false);
      }
    });

    const unsubSync = subscribeCloudSyncStatus((status) => {
      setCloudSyncStatus(status);
    });

    testFirestoreConnection();

    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  // 2. Subscribe to Real-time stock data
  useEffect(() => {
    setLoadingData(true);

    const unsubOils = subscribeOils(
      (data) => {
        setOils(data);
        setLoadingData(false);
      },
      (err) => {
        console.warn('Oil subscription notice:', err);
        setLoadingData(false);
      }
    );

    const unsubTxs = subscribeTransactions(
      (data) => {
        setTransactions(data);
      },
      (err) => {
        console.warn('Tx subscription notice:', err);
      }
    );

    const unsubVehicles = subscribeVehicles(
      (data) => {
        setVehicles(data);
      },
      (err) => {
        console.warn('Vehicle subscription notice:', err);
      }
    );

    const unsubFactories = subscribeFactories(
      (data) => {
        setFactories(data);
      },
      (err) => {
        console.warn('Factory subscription notice:', err);
      }
    );

    const unsubAdBlue = subscribeAdBlueRefills(
      (data) => {
        setAdBlueRefills(data);
      },
      (err) => {
        console.warn('AdBlue subscription notice:', err);
      }
    );

    return () => {
      unsubOils();
      unsubTxs();
      unsubVehicles();
      unsubFactories();
      unsubAdBlue();
    };
  }, [user]);

  // Quick navigation helpers
  const handleQuickDispense = (oil: OilItem) => {
    setPreselectedOilId(oil.id);
    setActiveTab('dispense');
  };

  const handleQuickReceive = (oil: OilItem) => {
    setPreselectedOilId(oil.id);
    setActiveTab('receive');
  };

  const handleDispenseForVehicle = (licensePlate: string, currentMileage: number, vehicleId: string) => {
    setPrefilledVehiclePlate(licensePlate);
    setPrefilledMileage(currentMileage);
    setPrefilledVehicleId(vehicleId);
    setActiveTab('dispense');
  };

  // Google Sheets Sync Handler
  const handleSyncGoogleSheets = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsSyncingSheets(true);
    setSyncNotice(null);

    try {
      const res = await syncStockToGoogleSheets(oils, transactions, lastSpreadsheetId);
      setLastSpreadsheetId(res.spreadsheetId);
      setSheetsUrl(res.spreadsheetUrl);
      setSyncNotice('ซิงค์ข้อมูลสต๊อกและประวัติลงใน Google Sheets สำเร็จเรียบร้อย!');
    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      if (err.message && err.message.includes('Google Workspace')) {
        try {
          await signInWithGoogle();
          const retryRes = await syncStockToGoogleSheets(oils, transactions, lastSpreadsheetId);
          setLastSpreadsheetId(retryRes.spreadsheetId);
          setSheetsUrl(retryRes.spreadsheetUrl);
          setSyncNotice('ซิงค์ข้อมูลสต๊อกและประวัติลงใน Google Sheets สำเร็จเรียบร้อย!');
        } catch (e: any) {
          alert(e.message || 'ไม่สามารถเชื่อมต่อ Google Sheets ได้ กรุณาตรวจสอบสิทธิ์');
        }
      } else {
        alert(err.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลไปยัง Google Sheets');
      }
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const currentUserName = user?.displayName || user?.email?.split('@')[0] || 'สมาชิกทีม';
  const isAdmin = isUserAdmin(user);

  // Compute alert counts
  const alertOils = oils.filter((o) => o.currentStock <= o.minStockThreshold);
  const adBlueOils = oils.filter(
    (o) =>
      o.name.toLowerCase().includes('adblue') ||
      o.name.includes('แอดบลู') ||
      o.viscosity.toLowerCase().includes('adblue') ||
      o.brand.toLowerCase().includes('adblue')
  );
  const overdueVehicles = vehicles.filter((v) => {
    const cycle = calculateVehicleCycle(v);
    return cycle.status === 'overdue';
  });
  const dueSoonVehicles = vehicles.filter((v) => {
    const cycle = calculateVehicleCycle(v);
    return cycle.status === 'due_soon';
  });
  const totalVehiclesDue = overdueVehicles.length + dueSoonVehicles.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        isAdmin={isAdmin}
        onLogout={logoutUser}
        oils={oils}
        vehicles={vehicles}
        factories={factories}
        cloudSyncStatus={cloudSyncStatus}
        onOpenAlerts={() => setIsAlertModalOpen(true)}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onSyncGoogleSheets={handleSyncGoogleSheets}
        isSyncingSheets={isSyncingSheets}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Real-time Multi-device Sync Warning Banner (When permission_denied) */}
      {cloudSyncStatus === 'permission_denied' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between no-print shadow-sm border-b border-amber-600/30">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Database className="w-4 h-4 flex-shrink-0 animate-bounce text-amber-950" />
            <span className="flex-1">
              <strong>แจ้งเตือนการเชื่อมต่อเรียลไทม์:</strong> ขณะนี้ฐานข้อมูล Firebase ยังติดสิทธิ์ความปลอดภัยเริ่มต้น (ทำให้ผู้ใช้ต่างเครื่องยังไม่เห็นข้อมูลชุดเดียวกัน)
            </span>
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="bg-slate-950 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 flex items-center gap-1 shadow-xs"
            >
              <span>คลิกดูวิธีเปิดสิทธิ์ 1 นาที</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* System Warning Banner (Stock or Vehicle 20,000 km Oil Change Alert) */}
      {(alertOils.length > 0 || totalVehiclesDue > 0) && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between no-print shadow-xs">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse text-yellow-200" />
            <span className="truncate">
              <strong>แจ้งเตือนระบบ:</strong>{' '}
              {alertOils.length > 0 && `มีสินค้าใกล้หมดสต๊อก ${alertOils.length} รายการ`}
              {alertOils.length > 0 && totalVehiclesDue > 0 && ' | '}
              {totalVehiclesDue > 0 && `มีรถใกล้ถึงรอบ/เกินรอบเปลี่ยนถ่าย 20,000 กม. จำนวน ${totalVehiclesDue} คัน (เตือนล่วงหน้า 1 เดือน)`}
            </span>
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="ml-auto underline font-bold hover:text-yellow-100 cursor-pointer text-xs whitespace-nowrap bg-black/20 px-2.5 py-1 rounded-md"
            >
              ตรวจสอบทันที
            </button>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Success Toast Notification */}
      {syncNotice && sheetsUrl && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4 no-print">
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-4 text-emerald-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">{syncNotice}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  ระบบได้สร้างชีต "สต๊อกคงเหลือ" และ "ประวัติเบิกจ่าย-รับเข้า" บน Google Drive ของคุณเรียบร้อย
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>เปิดดูบน Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setSyncNotice(null)}
                className="p-1.5 text-emerald-600 hover:text-emerald-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadingData ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-slate-600">กำลังเชื่อมต่อฐานข้อมูลสต๊อกเรียลไทม์...</p>
          </div>
        ) : (
          <>
            {activeTab === 'stock' && (
              <StockListTab
                oils={oils}
                userName={currentUserName}
                isAdmin={isAdmin}
                onQuickDispense={handleQuickDispense}
                onQuickReceive={handleQuickReceive}
              />
            )}

            {activeTab === 'dispense' && (
              <DispenseTab
                oils={oils}
                vehicles={vehicles}
                userName={currentUserName}
                isAdmin={isAdmin}
                preselectedOilId={preselectedOilId}
                prefilledVehiclePlate={prefilledVehiclePlate}
                prefilledMileage={prefilledMileage}
                prefilledVehicleId={prefilledVehicleId}
                onSuccessNavigate={() => setActiveTab('history')}
              />
            )}

            {activeTab === 'receive' && (
              <ReceiveTab
                oils={oils}
                userName={currentUserName}
                isAdmin={isAdmin}
                preselectedOilId={preselectedOilId}
                onOpenAddNewOil={() => {
                  setPreselectedOilId(null);
                  setActiveTab('stock');
                }}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehiclesTab
                vehicles={vehicles}
                factories={factories}
                adBlueRefills={adBlueRefills}
                adBlueOils={adBlueOils}
                oils={oils}
                userName={currentUserName}
                isAdmin={isAdmin}
                onDispenseForVehicle={handleDispenseForVehicle}
              />
            )}

            {activeTab === 'report' && (
              <ReportTab
                oils={oils}
                transactions={transactions}
                userName={currentUserName}
                onSyncGoogleSheets={handleSyncGoogleSheets}
                isSyncingSheets={isSyncingSheets}
                sheetsUrl={sheetsUrl}
              />
            )}

            {activeTab === 'monthly_summary' && (
              <MonthlySummaryTab
                oils={oils}
                transactions={transactions}
                adBlueRefills={adBlueRefills}
                vehicles={vehicles}
                factories={factories}
                userName={currentUserName}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab
                transactions={transactions}
                oils={oils}
                userName={currentUserName}
                isAdmin={isAdmin}
              />
            )}
          </>
        )}
      </main>

      {/* Footer (Hidden on Print) */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            ระบบจัดการสต๊อกน้ำมันเครื่อง&น้ำยาแอดบลู CPT KR • หน่วยนับ: ลิตร • ข้อมูลรถและรอบถ่าย 20,000 กม. ({factories.length > 0 ? `${factories.length} โรงงาน` : 'แต่ละโรงงาน'})
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {cloudSyncStatus === 'connected' ? 'ซิงค์คลาวด์ Real-time ออนไลน์' : 'โหมดแคชในเครื่อง (รอเปิดสิทธิ์)'}
            </span>
            <span>•</span>
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              ตั้งค่าสิทธิ์คลาวด์ Firebase
            </button>
            <span>•</span>
            <span>รองรับ Google Sheets & Excel</span>
          </div>
        </div>
      </footer>

      {/* Alert Modal */}
      <AlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        oils={oils}
        vehicles={vehicles}
        onGoToReceive={(oil) => {
          setPreselectedOilId(oil.id);
          setActiveTab('receive');
        }}
        onGoToVehicles={() => setActiveTab('vehicles')}
        onDispenseForVehicle={handleDispenseForVehicle}
      />

      {/* Member Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen && !user && !authLoading}
        onSuccess={() => setIsAuthModalOpen(false)}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Firebase Cloud Sync / Security Rules Helper Modal */}
      <FirebaseRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        projectId="engine-oil---adblue-cptkorat"
      />
    </div>
  );
}
