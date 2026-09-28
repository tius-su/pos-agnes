import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase';
import { pushToGitHub, pushToFirebaseCloud, getGitHubSettings, saveGitHubSettings } from '../services/dataSync';

const tabs = [
  { key: 'kasir',    icon: 'fa-cash-register',    label: 'Kasir & POS',        sub: 'Proses transaksi penjualan Agnes Fashion' },
  { key: 'stok',     icon: 'fa-boxes-stacked',    label: 'Stok Barang',        sub: 'Kelola stok, restock, dan harga produk' },
  { key: 'laporan',  icon: 'fa-chart-line',        label: 'Laporan Keuangan',   sub: 'Omset, laba bersih, dan riwayat transaksi' },
  { key: 'stok-laporan', icon: 'fa-warehouse',    label: 'Laporan Stok',       sub: 'Dashboard & analitik stok barang lengkap' },
  { key: 'settings', icon: 'fa-gear',             label: 'Pengaturan',         sub: 'Konfigurasi sync dan profil toko' },
];

const Sidebar = ({ activeTab, onTabChange, onClose }) => {
  const { syncStatus, lastSync } = useData();
  const { user } = useAuth();

  const handleLogout = async () => {
    if (confirm('Keluar dari Agnes POS?')) {
      await logoutUser();
    }
  };

  const syncDotClass = syncStatus === 'syncing' ? 'sync-dot pulse' : 'sync-dot';
  const syncDotColor = syncStatus === 'error' ? '#e11d48' : syncStatus === 'ok' ? '#10b981' : '#f59e0b';

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon"><i className="fa-solid fa-shirt" /></div>
          <div className="logo-text">
            <h1>Agnes Fashion</h1>
            <p>POS & Management</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu Utama</div>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`nav-item${activeTab === t.key ? ' active' : ''}`}
            data-tab={t.key}
            onClick={() => { onTabChange(t.key); onClose?.(); }}
          >
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-card" style={{ marginBottom: 8 }}>
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="user-avatar" />
              : <div className="user-avatar-placeholder">{user.displayName?.[0] || 'U'}</div>
            }
            <div className="user-info">
              <div className="user-name">{user.displayName || 'Pengguna'}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
        )}

        <div
          className="sync-status"
          title={lastSync ? `Terakhir sync: ${lastSync.toLocaleTimeString('id-ID')}` : 'Belum sync'}
        >
          <div className={syncDotClass} style={{ background: syncDotColor }} />
          <div className="sync-label">
            {syncStatus === 'syncing' ? 'Menyinkronkan...' : syncStatus === 'ok' ? 'Tersinkronkan' : syncStatus === 'error' ? 'Sync Gagal' : 'Siap'}
            <span>{lastSync ? lastSync.toLocaleTimeString('id-ID') : 'Belum pernah sync'}</span>
          </div>
          <i className="fa-solid fa-cloud" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
        </div>

        <button className="btn-logout" style={{ marginTop: 8 }} onClick={handleLogout}>
          <i className="fa-solid fa-arrow-right-from-bracket" />
          Keluar
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
