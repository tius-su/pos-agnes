import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import LoginPage from './pages/LoginPage';
import KasirPage from './pages/KasirPage';
import StokPage from './pages/StokPage';
import LaporanPage from './pages/LaporanPage';
import StokLaporanPage from './pages/StokLaporanPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';

// Toast container
const ToastContainer = () => {
  const { toasts } = useData();
  if (!toasts?.length) return null;
  return (
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
  );
};

const PAGE_META = {
  kasir:        { title: 'Kasir & Point of Sale',    sub: 'Proses transaksi penjualan Agnes Fashion',             icon: 'fa-cash-register' },
  stok:         { title: 'Manajemen Stok Barang',    sub: 'Kelola stok, restock, dan harga produk',               icon: 'fa-boxes-stacked' },
  laporan:      { title: 'Laporan Keuangan',          sub: 'Omset, laba bersih, dan riwayat transaksi',            icon: 'fa-chart-line' },
  'stok-laporan': { title: 'Dashboard Laporan Stok', sub: 'Analitik stok barang, tren, dan peringatan',           icon: 'fa-warehouse' },
  settings:     { title: 'Pengaturan & Sinkronisasi', sub: 'Konfigurasi GitHub, Firebase, dan profil toko',       icon: 'fa-gear' },
};

const BOTTOM_NAV = [
  { key: 'kasir',         icon: 'fa-cash-register', label: 'Kasir' },
  { key: 'stok',          icon: 'fa-boxes-stacked',  label: 'Stok' },
  { key: 'laporan',       icon: 'fa-chart-line',     label: 'Laporan' },
  { key: 'stok-laporan',  icon: 'fa-warehouse',      label: 'Stok' },
  { key: 'settings',      icon: 'fa-gear',           label: 'Setting' },
];

// Root App — AuthProvider wraps everything, DataProvider is inside AppContent
// so it only mounts after user is authenticated
const App = () => (
  <AuthProvider>
    <DataProviderWrapper />
  </AuthProvider>
);

// Wrapper that only renders DataProvider after auth is known
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
  const [activeTab, setActiveTab] = useState('kasir');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState('');
  const { toasts } = useData();

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

  const meta = PAGE_META[activeTab] || PAGE_META.kasir;

  const renderPage = () => {
    switch (activeTab) {
      case 'kasir':        return <KasirPage />;
      case 'stok':         return <StokPage />;
      case 'laporan':      return <LaporanPage />;
      case 'stok-laporan': return <StokLaporanPage />;
      case 'settings':     return <SettingsPage />;
      default:             return <KasirPage />;
    }
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar-wrapper${sidebarOpen ? ' open' : ''}`} id="sidebar-wrapper">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onClose={() => setSidebarOpen(false)} isOpen={sidebarOpen} />
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
