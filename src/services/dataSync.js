import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const LOCAL_CACHE_KEY = 'agnes_pos_cache';
const GH_TOKEN_KEY   = 'agnes_token';
const GH_REPO_KEY    = 'agnes_repo';
const DEFAULT_REPO   = import.meta.env.VITE_GITHUB_REPO  || 'tius-su/pos-agnes';
const DEFAULT_TOKEN  = import.meta.env.VITE_GITHUB_TOKEN || '';

export const SAMPLE_STOK = [
  { nama_barang: 'Gamis Silk Premium', kategori: 'Pakaian Wanita', stokTersedia: 12, hargaModal: 120000, hargaJual: 175000, supplierList: ['Grosir Bandung'] },
  { nama_barang: 'Kemeja Katun Pria', kategori: 'Pakaian Pria', stokTersedia: 15, hargaModal: 75000, hargaJual: 115000, supplierList: ['Tanah Abang'] },
  { nama_barang: 'Hijab Bella Square', kategori: 'Hijab', stokTersedia: 30, hargaModal: 15000, hargaJual: 25000, supplierList: ['Grosir Hijab Solo'] },
  { nama_barang: 'Bros Etnik Premium', kategori: 'Aksesoris', stokTersedia: 20, hargaModal: 10000, hargaJual: 20000, supplierList: ['Aksesoris Jogja'] }
];

export const INITIAL_DATA = {
  appName: 'Agnes Fashion POS',
  lastUpdated: new Date().toISOString(),
  stok: SAMPLE_STOK,
  pembelian: [],
  penjualan: [],
  pengeluaran: [],
  settings: {
    storeName:     'Agnes Fashion',
    storeAddress:  'Pasar Baru Cikarang Blok C',
    storePhone:    '0851-1702-1168',
    monthlyTarget: 50000000,
    receiptFooter: 'Terima Kasih Telah Berbelanja di Agnes Fashion! Barang yang sudah dibeli tidak dapat ditukar.'
  }
};

// ─── NORMALISASI PRODUK (Mencegah property mismatch dari Firestore/Local) ───
export const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const nama = item.nama_barang || item.namaBarang || item.nama || item.name || item.produk || item.title || item.namaProduk || 'Barang';
  const kategori = item.kategori || item.category || 'Lainnya';
  const stokTersedia = Number(item.stokTersedia ?? item.stok ?? item.stock ?? item.qty ?? item.jumlah ?? item.quantity ?? 0);
  const hargaModal = Number(item.hargaModal ?? item.harga_modal ?? item.modal ?? item.cost ?? item.hargaBeli ?? 0);
  const hargaJual = Number(item.hargaJual ?? item.harga_jual ?? item.harga ?? item.price ?? item.sellPrice ?? 0);
  const supplierList = Array.isArray(item.supplierList) ? item.supplierList
    : (item.supplier || item.suplier || item.nama_suplier) ? [item.supplier || item.suplier || item.nama_suplier]
    : [];

  return {
    ...item,
    id: item.id || item.code || item.barcode || item.key || (Date.now() + Math.random()),
    nama_barang: nama,
    kategori,
    stokTersedia,
    hargaModal,
    hargaJual,
    supplierList
  };
};

export const normalizeAppData = (data) => {
  // Kembalikan INITIAL_DATA jika input tidak valid (null, undefined, bukan object)
  if (!data || typeof data !== 'object') {
    return {
      ...INITIAL_DATA,
      stok: INITIAL_DATA.stok.map(normalizeItem).filter(Boolean)
    };
  }

  let rawStok = [];
  if (Array.isArray(data.stok)) {
    rawStok = data.stok;
  } else if (data.stok && typeof data.stok === 'object') {
    rawStok = Object.values(data.stok);
  } else if (Array.isArray(data.products)) {
    rawStok = data.products;
  } else if (data.products && typeof data.products === 'object') {
    rawStok = Object.values(data.products);
  } else if (Array.isArray(data.items)) {
    rawStok = data.items;
  } else if (data.items && typeof data.items === 'object') {
    rawStok = Object.values(data.items);
  } else if (Array.isArray(data.barang)) {
    rawStok = data.barang;
  } else if (data.barang && typeof data.barang === 'object') {
    rawStok = Object.values(data.barang);
  } else if (Array.isArray(data.inventory)) {
    rawStok = data.inventory;
  } else if (data.inventory && typeof data.inventory === 'object') {
    rawStok = Object.values(data.inventory);
  }

  // Jika stok kosong, gunakan SAMPLE_STOK agar katalog kasir & stok selalu terisi
  if (rawStok.length === 0) {
    rawStok = SAMPLE_STOK;
  }

  let rawPenjualan = [];
  if (Array.isArray(data.penjualan)) {
    rawPenjualan = data.penjualan;
  } else if (data.penjualan && typeof data.penjualan === 'object') {
    rawPenjualan = Object.values(data.penjualan);
  } else if (Array.isArray(data.sales)) {
    rawPenjualan = data.sales;
  } else if (data.sales && typeof data.sales === 'object') {
    rawPenjualan = Object.values(data.sales);
  } else if (Array.isArray(data.transactions)) {
    rawPenjualan = data.transactions;
  } else if (data.transactions && typeof data.transactions === 'object') {
    rawPenjualan = Object.values(data.transactions);
  }

  let rawPembelian = [];
  if (Array.isArray(data.pembelian)) {
    rawPembelian = data.pembelian;
  } else if (data.pembelian && typeof data.pembelian === 'object') {
    rawPembelian = Object.values(data.pembelian);
  } else if (Array.isArray(data.purchases)) {
    rawPembelian = data.purchases;
  } else if (data.purchases && typeof data.purchases === 'object') {
    rawPembelian = Object.values(data.purchases);
  }

  let rawPengeluaran = [];
  if (Array.isArray(data.pengeluaran)) {
    rawPengeluaran = data.pengeluaran;
  } else if (data.pengeluaran && typeof data.pengeluaran === 'object') {
    rawPengeluaran = Object.values(data.pengeluaran);
  } else if (Array.isArray(data.expenses)) {
    rawPengeluaran = data.expenses;
  } else if (data.expenses && typeof data.expenses === 'object') {
    rawPengeluaran = Object.values(data.expenses);
  }

  return {
    ...data,
    stok: rawStok.map(normalizeItem).filter(Boolean),
    pembelian: rawPembelian,
    penjualan: rawPenjualan,
    pengeluaran: rawPengeluaran,
    settings: {
      ...INITIAL_DATA.settings,
      ...(data.settings || {})
    }
  };
};

// ─── LOCAL CACHE (bukan sumber data utama) ────────────────────────────────────
export const loadLocalData = () => {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
             || localStorage.getItem('agnes_pos_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeAppData(parsed);
    }
  } catch (e) {
    console.error('Cache load error:', e);
  }
  return null;
};

export const saveLocalData = (data) => {
  try {
    const normalized = normalizeAppData(data) || data;
    const updated = { ...normalized, lastUpdated: new Date().toISOString() };
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Cache save error:', e);
    return data;
  }
};

// ─── FIREBASE (DATABASE UTAMA) ────────────────────────────────────────────────
const FIREBASE_DOC = () => doc(db, 'pos_data', 'store_data');

/**
 * Subscribe realtime ke Firebase (hanya untuk user yang sudah login).
 * Hanya baca dari pos_data/store_data (sesuai Firestore Rules).
 */
export const subscribeToFirebaseCloud = (onData, onError) => {
  try {
    const unsub = onSnapshot(
      FIREBASE_DOC(),
      (snap) => {
        if (snap.exists() && snap.data()) {
          // Dokumen ditemukan → normalize dan kirim ke DataContext
          const firebaseData = normalizeAppData(snap.data());
          if (firebaseData.stok && firebaseData.stok.length > 0) {
            onData(firebaseData);
          } else {
            // Dokumen ada tapi stok kosong → kirim null agar DataContext pakai local cache
            onData(null);
          }
        } else {
          // Dokumen tidak ada → kirim null agar DataContext pakai local cache / INITIAL_DATA
          onData(null);
        }
      },
      (err) => {
        console.warn('[Firebase] Snapshot error:', err.message);
        if (onError) onError(err);
      }
    );
    return unsub;
  } catch (e) {
    console.error('[Firebase] Subscribe error:', e);
    if (onError) onError(e);
    return () => {};
  }
};

/**
 * Fetch data katalog publik dari Firebase (TANPA auth).
 * Membutuhkan Firestore rules: allow read: if true;
 * Digunakan oleh halaman E-Katalog yang dibuka tanpa login.
 */
export const subscribePublicCatalog = (onData, onError) => {
  try {
    const unsub = onSnapshot(
      FIREBASE_DOC(),
      (snap) => {
        if (snap.exists() && snap.data()) {
          const firebaseData = normalizeAppData(snap.data());
          if (firebaseData.stok && firebaseData.stok.length > 0) {
            onData(firebaseData);
          } else {
            onData(null);
          }
        } else {
          onData(null);
        }
      },
      (err) => {
        // Jika rules tidak izinkan public read, gunakan localStorage/INITIAL_DATA
        console.warn('[Firebase] Public catalog read failed (update Firestore rules to allow read: if true):', err.message);
        if (onError) onError(err);
      }
    );
    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
};

/**
 * Push data ke Firebase (DATABASE UTAMA).
 */
export const pushToFirebaseCloud = async (data) => {
  try {
    const normalized = normalizeAppData(data) || data;
    const payload = { ...normalized, lastUpdated: new Date().toISOString() };
    await setDoc(FIREBASE_DOC(), payload);
    saveLocalData(payload);
    return { success: true };
  } catch (e) {
    console.error('[Firebase] Push error:', e);
    return { success: false, error: e.message };
  }
};

// ─── GITHUB (BACKUP OPSIONAL) ─────────────────────────────────────────────────
export const getGitHubSettings = () => ({
  token: localStorage.getItem(GH_TOKEN_KEY) || DEFAULT_TOKEN,
  repo:  localStorage.getItem(GH_REPO_KEY)  || DEFAULT_REPO
});

export const saveGitHubSettings = (token, repo) => {
  localStorage.setItem(GH_TOKEN_KEY, token.trim());
  localStorage.setItem(GH_REPO_KEY, repo.trim());
};

export const pullFromGitHub = async () => {
  const { token, repo } = getGitHubSettings();
  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/github.json?t=${Date.now()}`,
      { headers }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const meta = await res.json();
    const raw  = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
    const data = JSON.parse(raw);
    return { success: true, data, sha: meta.sha };
  } catch (e) {
    console.warn('[GitHub] Pull failed:', e.message);
    return { success: false, error: e.message };
  }
};

export const pushToGitHub = async (data) => {
  const { token, repo } = getGitHubSettings();
  if (!token) return { success: false, error: 'Token GitHub belum diisi' };

  try {
    const payload = { ...data, lastUpdated: new Date().toISOString() };

    // Get SHA
    let sha = '';
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/github.json`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (getRes.ok) sha = (await getRes.json()).sha;

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
    const putRes  = await fetch(
      `https://api.github.com/repos/${repo}/contents/github.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization':  `token ${token}`,
          'Content-Type':   'application/json',
          'Accept':         'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `POS Backup: ${new Date().toLocaleString('id-ID')}`,
          content,
          sha: sha || undefined
        })
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || 'Push failed');
    }
    return { success: true };
  } catch (e) {
    console.error('[GitHub] Push error:', e);
    return { success: false, error: e.message };
  }
};
