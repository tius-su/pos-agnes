import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { pushToFirebaseCloud, saveLocalData, loadLocalData, INITIAL_DATA, normalizeAppData } from '../services/dataSync';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

const ALLOWED_OWNER_EMAILS = [
  'owner.tiuss75@gmail.com',
  'owner2.tiuss168@gmail.com',
  'owner1.melawatisubrata@gmail.com'
];

const SettingsPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const { user } = useAuth();

  const [storeName, setStoreName]         = useState(appData.settings?.storeName     || 'Melan Jaya');
  const [storeAddress, setStoreAddress]   = useState(appData.settings?.storeAddress  || '');
  const [storePhone, setStorePhone]       = useState(appData.settings?.storePhone    || '');
  const [receiptFooter, setReceiptFooter] = useState(appData.settings?.receiptFooter || '');
  const [logoUrl, setLogoUrl]             = useState(appData.settings?.logoUrl       || '/melanjaya.jpg');
  const [syncing, setSyncing]             = useState(false);
  const [debugData, setDebugData]         = useState(null);
  const [debugLoading, setDebugLoading]   = useState(false);
  const [showDebug, setShowDebug]         = useState(false);

  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const isOwnerAuthorized = ALLOWED_OWNER_EMAILS.includes(currentUserEmail);

  // ── Baca raw data dari Firestore untuk debug ───────────────────────────────
  const fetchDebugData = async () => {
    setDebugLoading(true);
    setShowDebug(true);
    const result = { mainDoc: null, collections: {}, error: null };
    try {
      // Baca dokumen utama pos_data/store_data
      const mainSnap = await getDoc(doc(db, 'pos_data', 'store_data'));
      if (mainSnap.exists()) {
        result.mainDoc = mainSnap.data();
      } else {
        result.mainDoc = '(dokumen tidak ada)';
      }
    } catch (e) {
      result.error = e.message;
    }

    // Cek collection-level fallback
    for (const colName of ['stok', 'products', 'items', 'barang', 'inventory']) {
      try {
        const colSnap = await getDocs(collection(db, colName));
        if (!colSnap.empty) {
          result.collections[colName] = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        result.collections[colName] = `error: ${e.message}`;
      }
    }
    setDebugData(result);
    setDebugLoading(false);
  };

  // ── Push data appData saat ini ke Firebase (overwrite) ────────────────────
  const pushCurrentToFirebase = async () => {
    setSyncing(true);
    const { success, error } = await pushToFirebaseCloud(appData);
    setSyncing(false);
    if (success) {
      toast(`✅ ${appData.stok?.length || 0} produk berhasil disimpan ke Firebase!`, 'success');
      fetchDebugData(); // refresh debug panel
    } else {
      toast(`❌ Firebase error: ${error}`, 'error');
    }
  };

  // ── Push manual ke Firebase ────────────────────────────────────────────────
  const pushFirebase = async () => {
    setSyncing(true);
    const { success, error } = await pushToFirebaseCloud(appData);
    setSyncing(false);
    if (success) toast('✅ Data berhasil disinkron ke Firebase Cloud!', 'success');
    else {
      if (error && error.toLowerCase().includes('permission')) {
        toast(`⚠️ Akun ${currentUserEmail || 'saat ini'} tidak memiliki izin TULIS di Firebase. Pastikan login dengan email Owner.`, 'error');
      } else {
        toast(`❌ Firebase error: ${error}`, 'error');
      }
    }
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
      settings: {
        ...(appData.settings || {}),
        storeName,
        storeAddress,
        storePhone,
        receiptFooter,
        logoUrl
      }
    };
    await saveAndSync(newData);
    toast('✅ Profil toko & logo tersimpan!', 'success');
  };

  // ── Unduh backup JSON ──────────────────────────────────────────────────────
  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `melan-jaya-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
              <div style={{ marginBottom: 8 }}><b>Auth Domain:</b> <code style={{ color: 'var(--brand)', fontWeight: 700 }}>agnes-pos.firebaseapp.com</code></div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <b>Akun Login Saat Ini:</b>{' '}
                <code style={{ color: isOwnerAuthorized ? '#059669' : '#e11d48', fontWeight: 700 }}>
                  {currentUserEmail || 'Belum Login'}
                </code>
                <div style={{ fontSize: 11, marginTop: 4, color: isOwnerAuthorized ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {isOwnerAuthorized
                    ? '✅ Akun terdaftar sebagai Owner. Memiliki akses BACA & TULIS ke Firestore Cloud.'
                    : '⚠️ Akun tidak terdaftar di daftar Owner Whitelist. Data tetap tersimpan aman di perangkat (Lokal).'}
                </div>
              </div>
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
            <div className="card-title"><i className="fa-solid fa-store" /> Profil Toko &amp; Logo</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, background: 'var(--bg-hover)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
              <img
                src={logoUrl || '/melanjaya.jpg'}
                alt="Preview Logo"
                onError={(e) => { e.target.src = '/melanjaya.jpg'; }}
                style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--brand)', background: '#fff' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Logo Toko Terpasang</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Path: <code style={{ color: 'var(--brand)' }}>{logoUrl}</code></div>
                <div style={{ fontSize: 10, color: 'var(--emerald)', marginTop: 2 }}>✅ Gambar logo Toko Melan Jaya aktif di sidebar, login, &amp; struk</div>
              </div>
            </div>

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
              <label className="form-label">URL / Path Logo Toko</label>
              <input type="text" className="form-input" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="/melanjaya.jpg" id="store-logo-url" />
            </div>
            <div className="form-group">
              <label className="form-label">Pesan Footer Struk</label>
              <input type="text" className="form-input" value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} id="store-footer" />
            </div>
            <button className="btn btn-purple" onClick={saveStore} id="btn-save-store">
              <i className="fa-solid fa-floppy-disk" /> Simpan &amp; Sync
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

        {/* Firebase Debug Inspector */}
        <div className="card" style={{ border: '1px solid var(--amber)' }}>
          <div className="card-header">
            <div className="card-title">
              <i className="fa-solid fa-bug" style={{ color: 'var(--amber)' }} /> Firebase Debug Inspector
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={fetchDebugData}
              disabled={debugLoading}
              id="btn-fetch-debug"
            >
              {debugLoading
                ? <><i className="fa-solid fa-circle-notch animate-spin" /> Membaca...</>
                : <><i className="fa-solid fa-magnifying-glass" /> Cek Firestore</>}
            </button>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Klik <b>Cek Firestore</b> untuk melihat data mentah yang tersimpan di Firebase.
              Gunakan ini untuk mendiagnosis mengapa katalog tidak muncul.
            </p>

            {/* Status saat ini */}
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
              <b>Status Katalog Saat Ini (dari React state):</b>
              <div style={{ marginTop: 6, color: appData.stok?.length > 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 700 }}>
                {appData.stok?.length > 0
                  ? `✅ ${appData.stok.length} produk tersedia di katalog`
                  : '❌ Katalog KOSONG di state React'}
              </div>
              {appData.stok?.length > 0 && (
                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                  Produk: {appData.stok.slice(0, 3).map(s => s.nama_barang).join(', ')}{appData.stok.length > 3 ? ` +${appData.stok.length - 3} lainnya` : ''}
                </div>
              )}
            </div>

            {showDebug && debugData && (
              <div>
                {debugData.error && (
                  <div style={{ background: '#fef2f2', border: '1px solid var(--rose)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: 'var(--rose)' }}>
                    <b>❌ Firebase Error:</b> {debugData.error}
                  </div>
                )}

                <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                  <b style={{ fontSize: 12 }}>📄 Dokumen: pos_data/store_data</b>
                  {debugData.mainDoc === '(dokumen tidak ada)' ? (
                    <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 6 }}>
                      ❌ Dokumen TIDAK ADA di Firestore! Gunakan tombol "Push ke Firebase" untuk membuat dokumen.
                    </div>
                  ) : (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Fields tersedia: <b style={{ color: 'var(--brand)' }}>{Object.keys(debugData.mainDoc || {}).join(', ')}</b>
                      </div>
                      {debugData.mainDoc?.stok !== undefined && (
                        <div style={{ fontSize: 11, color: Array.isArray(debugData.mainDoc.stok) && debugData.mainDoc.stok.length > 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                          stok: {Array.isArray(debugData.mainDoc.stok)
                            ? `✅ Array dengan ${debugData.mainDoc.stok.length} item`
                            : typeof debugData.mainDoc.stok === 'object'
                            ? `⚠️ Object (bukan Array) — ${Object.keys(debugData.mainDoc.stok).length} key`
                            : `❓ Tipe: ${typeof debugData.mainDoc.stok}`}
                        </div>
                      )}
                      {debugData.mainDoc?.stok === undefined && (
                        <div style={{ fontSize: 11, color: 'var(--rose)' }}>❌ Field "stok" tidak ditemukan di dokumen!</div>
                      )}
                      <pre style={{ fontSize: 10, marginTop: 8, background: '#1e1b4b', color: '#c4b5fd', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                        {JSON.stringify(debugData.mainDoc, null, 2).slice(0, 1500)}
                      </pre>
                    </div>
                  )}
                </div>

                {Object.keys(debugData.collections).length > 0 && (
                  <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                    <b style={{ fontSize: 12 }}>📚 Collections Ditemukan:</b>
                    {Object.entries(debugData.collections).map(([name, docs]) => (
                      <div key={name} style={{ marginTop: 6, fontSize: 11 }}>
                        <code style={{ color: 'var(--brand)' }}>{name}</code>:{' '}
                        {Array.isArray(docs) ? `${docs.length} dokumen` : docs}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    className="btn btn-purple btn-sm"
                    onClick={pushCurrentToFirebase}
                    disabled={syncing}
                    id="btn-push-debug"
                  >
                    {syncing
                      ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                      : <><i className="fa-solid fa-cloud-arrow-up" /> Push {appData.stok?.length || 0} Produk ke Firebase</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={resetToSample} id="btn-debug-reset">
                    <i className="fa-solid fa-rotate-right" /> Reset ke Stok Sampel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;

