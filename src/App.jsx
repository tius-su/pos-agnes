import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KasirPage from './pages/KasirPage';
import StokPage from './pages/StokPage';
import LaporanPage from './pages/LaporanPage';
import StokLaporanPage from './pages/StokLaporanPage';
import LabaRugiPage from './pages/LabaRugiPage';
import PelangganPage from './pages/PelangganPage';
import ReturPage from './pages/ReturPage';
import HutangPage from './pages/HutangPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';

const PAGE_META = {
  dashboard:    { title: 'Dashboard',                  sub: 'Ringkasan omset, target, dan stok hari ini',            icon: 'fa-house' },
  kasir:        { title: 'Kasir & Point of Sale',       sub: 'Proses transaksi penjualan Agnes Fashion',             icon: 'fa-cash-register' },
  stok:         { title: 'Manajemen Stok Barang',       sub: 'Kelola stok, restock, dan harga produk',               icon: 'fa-boxes-stacked' },
  laporan:      { title: 'Laporan Keuangan',            sub: 'Omset, laba bersih, dan riwayat transaksi',            icon: 'fa-chart-line' },
  'stok-laporan': { title: 'Dashboard Laporan Stok',   sub: 'Analitik stok barang, tren, dan peringatan',           icon: 'fa-warehouse' },
  'laba-rugi':  { title: 'Laporan Laba Rugi',          sub: 'Analisis laba rugi per produk dan per supplier',        icon: 'fa-scale-balanced' },
  pelanggan:    { title: 'Database Pelanggan',          sub: 'Kelola data dan riwayat belanja pelanggan',            icon: 'fa-users' },
  retur:        { title: 'Retur & Refund Barang',       sub: 'Proses pengembalian barang dan restore stok',          icon: 'fa-rotate-left' },
  hutang:       { title: 'Hutang & Piutang',            sub: 'Kelola piutang pelanggan dan hutang toko ke supplier',  icon: 'fa-hand-holding-dollar' },
  settings:     { title: 'Pengaturan & Sinkronisasi',  sub: 'Konfigurasi GitHub, Firebase, dan profil toko',        icon: 'fa-gear' },
};

const BOTTOM_NAV = [
  { key: 'dashboard',   icon: 'fa-house',          label: 'Home' },
  { key: 'kasir',       icon: 'fa-cash-register',  label: 'Kasir' },
  { key: 'stok',        icon: 'fa-boxes-stacked',  label: 'Stok' },
  { key: 'laporan',     icon: 'fa-chart-line',     label: 'Laporan' },
  { key: 'settings',    icon: 'fa-gear',           label: 'Setting' },
];

const App = () => (
  <AuthProvider>
    <DataProviderWrapper />
  </AuthProvider>
);

const DataProviderWrapper = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1e0a3c,#3b0764)' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <i className="fa-solid fa-shirt" style={{ fontSize: 40, marginBottom: 16, display: 'block', opacity: .8 }} />
          <div style={{ fontSize: 13, opacity: .6 }}>
            <i className="fa-solid fa-circle-notch" style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
            Memuat Agnes POS...
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
};

const AppInner = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState('');
  const { toasts, appData } = useData();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' · ' + now.toLocaleTimeString('id-ID')
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Badge hutang belum lunas
  const hutangCount = (appData?.hutang || []).filter(h => h.sisaHutang > 0).length;
  // Badge stok kritis
  const stokKritis = (appData?.stok || []).filter(i => i.stokTersedia <= 5).length;

  const meta = PAGE_META[activeTab] || PAGE_META.dashboard;

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':    return <DashboardPage />;
      case 'kasir':        return <KasirPage />;
      case 'stok':         return <StokPage />;
      case 'laporan':      return <LaporanPage />;
      case 'stok-laporan': return <StokLaporanPage />;
      case 'laba-rugi':    return <LabaRugiPage />;
      case 'pelanggan':    return <PelangganPage />;
      case 'retur':        return <ReturPage />;
      case 'hutang':       return <HutangPage />;
      case 'settings':     return <SettingsPage />;
      default:             return <DashboardPage />;
    }
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar-wrapper${sidebarOpen ? ' open' : ''}`} id="sidebar-wrapper">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
          onClose={() => setSidebarOpen(false)}
          isOpen={sidebarOpen}
          hutangCount={hutangCount}
          stokKritis={stokKritis}
        />
      </div>

      <div className="main-area">
        <header className="topbar">
          <button className="topbar-menu-btn btn-icon" onClick={() => setSidebarOpen(s => !s)} id="btn-menu">
            <i className="fa-solid fa-bars" />
          </button>
          <div className="topbar-title">
            <h2>
              <i className={`fa-solid ${meta.icon}`} style={{ color: 'var(--brand)', marginRight: 8 }} />
              {meta.title}
            </h2>
            <p>{meta.sub}</p>
          </div>
          <div className="topbar-actions">
            <div className="topbar-clock" id="live-clock">{clock}</div>
          </div>
        </header>

        <main className="page-content">
          {renderPage()}
        </main>
      </div>

      <nav className="bottom-nav">
        {BOTTOM_NAV.map(n => (
          <button
            key={n.key}
            className={`bottom-nav-item${activeTab === n.key ? ' active' : ''}`}
            onClick={() => setActiveTab(n.key)}
          >
            <i className={`fa-solid ${n.icon}`} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Toast notifications */}
      {toasts?.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <i className={`fa-solid ${
                t.type === 'success' ? 'fa-check-circle' :
                t.type === 'error'   ? 'fa-triangle-exclamation' :
                t.type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle'
              }`} />
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
