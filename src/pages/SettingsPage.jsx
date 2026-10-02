import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { pushToFirebaseCloud, saveLocalData, loadLocalData, INITIAL_DATA } from '../services/dataSync';

const SettingsPage = () => {
  const { appData, saveAndSync, toast } = useData();

  const [storeName, setStoreName]         = useState(appData.settings?.storeName     || '');
  const [storeAddress, setStoreAddress]   = useState(appData.settings?.storeAddress  || '');
  const [storePhone, setStorePhone]       = useState(appData.settings?.storePhone    || '');
  const [receiptFooter, setReceiptFooter] = useState(appData.settings?.receiptFooter || '');
  const [syncing, setSyncing]             = useState(false);

  // ── Push manual ke Firebase ────────────────────────────────────────────────
  const pushFirebase = async () => {
    setSyncing(true);
    const { success, error } = await pushToFirebaseCloud(appData);
    setSyncing(false);
    if (success) toast('✅ Data berhasil disinkron ke Firebase!', 'success');
    else toast(`❌ Firebase error: ${error}`, 'error');
  };

  // ── Reset ke stok sampel + push ke Firebase ────────────────────────────────
  const resetToSample = async () => {
    const sampleData = {
      ...INITIAL_DATA,
      penjualan: appData.penjualan || [],
      settings: appData.settings || INITIAL_DATA.settings,
      lastUpdated: new Date().toISOString()
    };
    await saveAndSync(sampleData);
    toast('✅ Stok sampel berhasil dimuat ulang ke Firebase!', 'success');
  };

  // ── Simpan profil toko ─────────────────────────────────────────────────────
  const saveStore = async () => {
    const newData = {
      ...appData,
      settings: { storeName, storeAddress, storePhone, receiptFooter }
    };
    await saveAndSync(newData);
    toast('✅ Profil toko tersimpan!', 'success');
  };

  // ── Unduh backup JSON ──────────────────────────────────────────────────────
  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agnes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast('📥 File backup berhasil diunduh', 'success');
  };

  // ── Import backup JSON → Firebase ──────────────────────────────────────────
  const restoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        await saveAndSync(data);
        toast(`✅ Backup dipulihkan! ${data.stok?.length || 0} produk dimuat.`, 'success');
      } catch {
        toast('❌ File tidak valid atau rusak', 'error');
      }
    };
    reader.readAsText(file);
    // Reset input agar file yang sama bisa dipilih lagi
    e.target.value = '';
  };

  return (
    <div className="tab-page active fade-up">
      <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Firebase Sync */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fa-solid fa-fire" style={{ color: '#f97316' }} /> Firebase Cloud Database
            </div>
            <span className="badge badge-green">Realtime Active</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Seluruh data stok, transaksi penjualan, dan laporan disinkronkan secara <b>realtime</b> ke Firebase Firestore Cloud.
              Perubahan otomatis tersinkron ke semua perangkat.
            </p>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}><b>Project ID:</b> <code style={{ color: 'var(--brand)', fontWeight: 700 }}>agnes-pos</code></div>
              <div><b>Auth Domain:</b> <code style={{ color: 'var(--brand)', fontWeight: 700 }}>agnes-pos.firebaseapp.com</code></div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-purple" onClick={pushFirebase} disabled={syncing} id="btn-push-firebase">
                {syncing
                  ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                  : <><i className="fa-solid fa-fire" /> Sync Data ke Firebase</>}
              </button>
              <button className="btn btn-ghost" onClick={resetToSample} id="btn-reset-sample">
                <i className="fa-solid fa-rotate-right" style={{ color: 'var(--brand)' }} /> Muat Ulang Stok Sampel
              </button>
            </div>
          </div>
        </div>

        {/* Info Deployment */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fa-solid fa-rocket" style={{ color: 'var(--sky)' }} /> Deployment — GitHub Pages
            </div>
            <span className="badge badge-sky">Live</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Aplikasi berjalan di GitHub Pages. Data disimpan di Firebase — bukan di GitHub.
            </p>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fa-solid fa-globe" style={{ color: 'var(--brand)' }} />
                <a
                  href="https://tius-su.github.io/pos-agnes/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}
                >
                  tius-su.github.io/pos-agnes/
                </a>
              </div>
            </div>
            <a
              href="https://tius-su.github.io/pos-agnes/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <i className="fa-solid fa-arrow-up-right-from-square" /> Buka Aplikasi
            </a>
          </div>
        </div>

        {/* Profil Toko */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-store" /> Profil Toko</div>
          </div>
          <div className="card-body">
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Nama Toko</label>
                <input type="text" className="form-input" value={storeName} onChange={e => setStoreName(e.target.value)} id="store-name" />
              </div>
              <div className="form-group">
                <label className="form-label">No. WhatsApp Toko</label>
                <input type="text" className="form-input" value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="0851-xxxx-xxxx" id="store-phone" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Alamat Toko</label>
              <input type="text" className="form-input" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} id="store-address" />
            </div>
            <div className="form-group">
              <label className="form-label">Pesan Footer Struk</label>
              <input type="text" className="form-input" value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} id="store-footer" />
            </div>
            <button className="btn btn-purple" onClick={saveStore} id="btn-save-store">
              <i className="fa-solid fa-floppy-disk" /> Simpan & Sync
            </button>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-database" /> Backup & Restore Data</div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Unduh salinan lengkap data toko (stok, transaksi, pengaturan) dalam format JSON,
              atau pulihkan dari file backup sebelumnya.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={downloadBackup} id="btn-download-backup">
                <i className="fa-solid fa-download" style={{ color: 'var(--emerald)' }} /> Unduh Backup JSON
              </button>
              <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }} id="btn-import-backup">
                <i className="fa-solid fa-upload" style={{ color: 'var(--sky)' }} /> Import Backup JSON
                <input type="file" accept=".json" onChange={restoreBackup} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
