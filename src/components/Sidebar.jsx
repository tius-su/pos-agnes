import React from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase';

const MENU_GROUPS = [
  {
    label: 'Utama',
    items: [
      { key: 'dashboard',  icon: 'fa-house',           label: 'Dashboard',         badge: null },
      { key: 'kasir',      icon: 'fa-cash-register',   label: 'Kasir & POS',       badge: null },
      { key: 'katalog',    icon: 'fa-shop',            label: 'E-Katalog Digital', badge: null },
    ],
  },
  {
    label: 'Inventori',
    items: [
      { key: 'stok',          icon: 'fa-boxes-stacked', label: 'Stok Barang',      badge: 'stokKritis' },
      { key: 'stok-laporan',  icon: 'fa-warehouse',     label: 'Laporan Stok',     badge: null },
      { key: 'retur',         icon: 'fa-rotate-left',   label: 'Retur & Refund',   badge: null },
    ],
  },
  {
    label: 'Keuangan & Pelanggan',
    items: [
      { key: 'laporan',     icon: 'fa-chart-line',           label: 'Laporan Keuangan', badge: null },
      { key: 'pengeluaran', icon: 'fa-receipt',              label: 'Pengeluaran',      badge: null },
      { key: 'laba-rugi',   icon: 'fa-scale-balanced',       label: 'Laba Rugi',        badge: null },
      { key: 'pelanggan',   icon: 'fa-users',                label: 'Pelanggan',        badge: null },
      { key: 'hutang',      icon: 'fa-hand-holding-dollar',  label: 'Hutang & Piutang', badge: 'hutangCount' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { key: 'settings', icon: 'fa-gear', label: 'Pengaturan', badge: null },
    ],
  },
];

const Sidebar = ({ activeTab, onTabChange, onClose, isOpen, hutangCount = 0, stokKritis = 0 }) => {
  const { appData, syncStatus, lastSync } = useData();
  const { user } = useAuth();
  const logoSrc = appData?.settings?.logoUrl || `${import.meta.env.BASE_URL}melanjaya.jpg`;

  const handleLogout = async () => {
    if (confirm('Keluar dari Melan Jaya POS?')) {
      await logoutUser();
    }
  };

  const syncDotClass = syncStatus === 'syncing' ? 'sync-dot pulse' : 'sync-dot';
  const syncDotColor = syncStatus === 'error' ? '#e11d48' : syncStatus === 'ok' ? '#10b981' : '#f59e0b';

  const getBadge = (badgeKey) => {
    if (badgeKey === 'hutangCount') return hutangCount;
    if (badgeKey === 'stokKritis') return stokKritis;
    return 0;
  };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <img
            src={logoSrc}
            alt="Melan Jaya"
            className="sidebar-logo-img"
            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              objectFit: 'cover',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              background: '#fff'
            }}
          />
          <div className="logo-icon logo-mj" style={{ display: 'none' }}>MJ</div>
          <div className="logo-text">
            <h1>{appData?.settings?.storeName || 'Melan Jaya'}</h1>
            <p>POS &amp; Management</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {MENU_GROUPS.map(group => (
          <div key={group.label}>
            <div className="nav-section-label">{group.label}</div>
            {group.items.map(t => {
              const badgeCount = t.badge ? getBadge(t.badge) : 0;
              return (
                <button
                  key={t.key}
                  className={`nav-item${activeTab === t.key ? ' active' : ''}`}
                  data-tab={t.key}
                  onClick={() => { onTabChange(t.key); onClose?.(); }}
                  style={{ position: 'relative' }}
                >
                  <i className={`fa-solid ${t.icon}`} />
                  {t.label}
                  {badgeCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: t.badge === 'hutangCount' ? 'var(--rose)' : 'var(--amber)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 99,
                      padding: '1px 7px',
                      minWidth: 18,
                      textAlign: 'center',
                    }}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
