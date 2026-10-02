import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { getGitHubSettings, saveGitHubSettings, pushToGitHub, pullFromGitHub, saveLocalData, loadLocalData } from '../services/dataSync';
import { pushToFirebaseCloud } from '../services/dataSync';

const SettingsPage = () => {
  const { appData, saveAndSync, updateData, toast } = useData();
  const ghSettings = getGitHubSettings();

  const [ghToken, setGhToken] = useState(ghSettings.token);
  const [ghRepo, setGhRepo] = useState(ghSettings.repo);
  const [storeName, setStoreName] = useState(appData.settings?.storeName || '');
  const [storeAddress, setStoreAddress] = useState(appData.settings?.storeAddress || '');
  const [storePhone, setStorePhone] = useState(appData.settings?.storePhone || '');
  const [receiptFooter, setReceiptFooter] = useState(appData.settings?.receiptFooter || '');
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const saveGH = () => {
    saveGitHubSettings(ghToken, ghRepo);
    toast('Token & Repo GitHub disimpan!', 'success');
  };

  const pushGH = async () => {
    setSyncing(true);
    const { success, error } = await pushToGitHub(appData);
    setSyncing(false);
    if (success) toast('✅ Push ke GitHub berhasil!', 'success');
    else toast(`❌ Push gagal: ${error}`, 'error');
  };

  const pullGH = async () => {
    setPulling(true);
    const { success, data, error } = await pullFromGitHub();
    setPulling(false);
    if (success && data && Array.isArray(data.stok)) {
      // ✅ FIX: Benar-benar apply data ke state, bukan hanya fetch
      await saveAndSync(data);
      toast(`✅ Pull berhasil! ${data.stok.length} produk dimuat.`, 'success');
    } else if (success) {
      toast('⚠️ Data dari GitHub tidak valid atau stok kosong.', 'warning');
    } else {
      toast(`❌ Pull gagal: ${error}`, 'error');
    }
  };

  const pushFirebase = async () => {
    setSyncing(true);
    const { success, error } = await pushToFirebaseCloud(appData);
    setSyncing(false);
    if (success) toast('✅ Push ke Firebase berhasil!', 'success');
    else toast(`❌ Firebase error: ${error}`, 'error');
  };

  const saveStore = async () => {
    const newData = {
      ...appData,
      settings: { storeName, storeAddress, storePhone, receiptFooter }
    };
    await saveAndSync(newData);
  };

  // ✅ RECOVERY: Paksa push data dari browser ini ke Firebase + GitHub
  const forcePushToCloud = async () => {
    const localData = loadLocalData();
    if (!localData || !Array.isArray(localData.stok) || localData.stok.length === 0) {
      toast('⚠️ Tidak ada data di browser ini untuk dipulihkan.', 'warning');
      return;
    }
    setSyncing(true);
    toast(`🔄 Memulihkan ${localData.stok.length} produk ke cloud...`, 'info');
    // Force timestamp agar lebih baru dari cloud
    const recoveryData = { ...localData, lastUpdated: new Date().toISOString() };
    saveLocalData(recoveryData);
    const [fbRes, ghRes] = await Promise.allSettled([
      pushToFirebaseCloud(recoveryData),
      pushToGitHub(recoveryData)
    ]);
    setSyncing(false);
    const fbOk = fbRes.status === 'fulfilled' && fbRes.value?.success;
    const ghOk = ghRes.status === 'fulfilled' && ghRes.value?.success;
    if (fbOk || ghOk) {
      toast(`✅ ${localData.stok.length} produk berhasil dipulihkan ke cloud!`, 'success');
    } else {
      toast('❌ Gagal push ke cloud. Cek token GitHub dan koneksi.', 'error');
    }
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agnes-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('File backup berhasil diunduh', 'success');
  };

  const restoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        await saveAndSync(data);
        toast('✅ Backup berhasil dipulihkan!', 'success');
      } catch {
        toast('❌ File tidak valid', 'error');
      }
    };
    reader.readAsText(file);
  };

  const copySetupLink = () => {
    const url = `https://tius-su.github.io/pos-agnes/?token=${ghToken}&repo=${ghRepo}`;
    navigator.clipboard.writeText(url).then(() => toast('Link setup disalin!', 'success'));
  };

  return (
    <div className="tab-page active fade-up">
      <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Firebase Sync — DATABASE UTAMA */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-fire" style={{ color: '#f97316' }} /> Firebase Cloud Database (Database Utama)</div>
            <span className="badge badge-green">Realtime Active</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Seluruh data stok, transaksi penjualan, dan laporan disinkronkan secara <b>realtime</b> ke Firebase Firestore Cloud.
            </p>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}><b>Project ID:</b> <code style={{ color: 'var(--brand)', fontWeight: 700 }}>agnes-pos</code></div>
              <div><b>Auth Domain:</b> <code style={{ color: 'var(--brand)', fontWeight: 700 }}>agnes-pos.firebaseapp.com</code></div>
            </div>
            <div className="flex items-center gap-8 flex-wrap">
              <button className="btn btn-purple" onClick={pushFirebase} disabled={syncing}>
                {syncing ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                  : <><i className="fa-solid fa-fire" /> Sync Data ke Firebase Cloud</>}
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  const initialData = {
                    appName: 'Agnes Fashion POS',
                    lastUpdated: new Date().toISOString(),
                    stok: [
                      { nama_barang: 'Gamis Silk Premium', kategori: 'Pakaian Wanita', stokTersedia: 12, hargaModal: 120000, hargaJual: 175000, supplierList: ['Grosir Bandung'] },
                      { nama_barang: 'Kemeja Katun Pria', kategori: 'Pakaian Pria', stokTersedia: 15, hargaModal: 75000, hargaJual: 115000, supplierList: ['Tanah Abang'] },
                      { nama_barang: 'Hijab Bella Square', kategori: 'Hijab', stokTersedia: 30, hargaModal: 15000, hargaJual: 25000, supplierList: ['Grosir Hijab Solo'] },
                      { nama_barang: 'Bros Etnik Premium', kategori: 'Aksesoris', stokTersedia: 20, hargaModal: 10000, hargaJual: 20000, supplierList: ['Aksesoris Jogja'] }
                    ],
                    pembelian: [],
                    penjualan: appData.penjualan || [],
                    settings: appData.settings
                  };
                  await saveAndSync(initialData);
                  toast('✅ Data sampel katalog & stok berhasil dimuat ulang!', 'success');
                }}
              >
                <i className="fa-solid fa-rotate-right" style={{ color: 'var(--brand)' }} /> Isi Ulang Stok Sampel
              </button>
            </div>
          </div>
        </div>

        {/* GitHub Pages Deployment Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-rocket" style={{ color: 'var(--sky)' }} /> Deployment — GitHub Pages</div>
            <span className="badge badge-sky">Live</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Aplikasi di-deploy otomatis ke GitHub Pages setiap kali ada push ke branch <b>main</b>.
            </p>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <i className="fa-solid fa-globe" style={{ color: 'var(--brand)' }} />
                <a href="https://tius-su.github.io/pos-agnes/" target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>
                  tius-su.github.io/pos-agnes/
                </a>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                GitHub Secrets yang perlu diset di repo → Settings → Secrets → Actions:
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'VITE_FIREBASE_API_KEY',
                  'VITE_FIREBASE_AUTH_DOMAIN',
                  'VITE_FIREBASE_PROJECT_ID',
                  'VITE_FIREBASE_STORAGE_BUCKET',
                  'VITE_FIREBASE_MESSAGING_SENDER_ID',
                  'VITE_FIREBASE_APP_ID',
                  'VITE_GITHUB_TOKEN'
                ].map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-key" style={{ fontSize: 10, color: 'var(--amber)' }} />
                    <code style={{ fontSize: 11, background: 'var(--brand-dim)', color: 'var(--brand)', padding: '1px 6px', borderRadius: 4 }}>{s}</code>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-circle-info" style={{ fontSize: 10, color: 'var(--sky)' }} />
                  <code style={{ fontSize: 11, background: 'var(--sky-dim)', color: 'var(--sky)', padding: '1px 6px', borderRadius: 4 }}>VITE_GITHUB_REPO</code>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Variable, bukan Secret)</span>
                </div>
              </div>
            </div>
            <a href="https://github.com/tius-su/pos-agnes/settings/secrets/actions" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <i className="fa-brands fa-github" /> Buka GitHub Secrets
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
            <button className="btn btn-purple" onClick={saveStore}>
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
              Unduh atau pulihkan salinan lengkap data toko dalam format JSON.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={downloadBackup}>
                <i className="fa-solid fa-download" style={{ color: 'var(--emerald)' }} /> Unduh Backup JSON
              </button>
              <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }}>
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
