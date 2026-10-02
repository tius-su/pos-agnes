import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';

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
  settings: {
    storeName:     'Agnes Fashion',
    storeAddress:  'Pasar Baru Cikarang Blok C',
    storePhone:    '0851-1702-1168',
    receiptFooter: 'Terima Kasih Telah Berbelanja di Agnes Fashion! Barang yang sudah dibeli tidak dapat ditukar.'
  }
};

// ─── NORMALISASI PRODUK (Mencegah property mismatch dari Firestore/Local) ───
export const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const nama = item.nama_barang || item.namaBarang || item.nama || item.name || item.produk || item.title || 'Barang';
  const kategori = item.kategori || item.category || 'Lainnya';
  const stokTersedia = Number(item.stokTersedia ?? item.stok ?? item.stock ?? item.qty ?? item.jumlah ?? 0);
  const hargaModal = Number(item.hargaModal ?? item.harga_modal ?? item.modal ?? item.cost ?? 0);
  const hargaJual = Number(item.hargaJual ?? item.harga_jual ?? item.harga ?? item.price ?? 0);
  const supplierList = Array.isArray(item.supplierList) ? item.supplierList
    : (item.supplier || item.suplier || item.nama_suplier) ? [item.supplier || item.suplier || item.nama_suplier]
    : [];

  return {
    ...item,
    id: item.id || Date.now() + Math.random(),
    nama_barang: nama,
    kategori,
    stokTersedia,
    hargaModal,
    hargaJual,
    supplierList
  };
};

export const normalizeAppData = (data) => {
  if (!data || typeof data !== 'object') return null;
  const rawStok = Array.isArray(data.stok) ? data.stok
    : Array.isArray(data.products) ? data.products
    : Array.isArray(data.items) ? data.items
    : [];
  
  return {
    ...data,
    stok: rawStok.map(normalizeItem).filter(Boolean),
    pembelian: Array.isArray(data.pembelian) ? data.pembelian : [],
    penjualan: Array.isArray(data.penjualan) ? data.penjualan : [],
    settings: data.settings || INITIAL_DATA.settings
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
 * Subscribe realtime ke Firebase.
 */
export const subscribeToFirebaseCloud = (onData, onError) => {
  try {
    const unsub = onSnapshot(
      FIREBASE_DOC(),
      async (snap) => {
        if (snap.exists() && snap.data()) {
          const norm = normalizeAppData(snap.data());
          if (norm && norm.stok.length > 0) {
            onData(norm);
            return;
          }
        }
        
        // Fallback jika single document kosong: cek Firestore Collection 'stok' / 'products'
        try {
          const stokCol = await getDocs(collection(db, 'stok'));
          if (!stokCol.empty) {
            const itemsFromCol = stokCol.docs.map(d => normalizeItem({ id: d.id, ...d.data() })).filter(Boolean);
            if (itemsFromCol.length > 0) {
              const fullData = normalizeAppData({ ...INITIAL_DATA, stok: itemsFromCol });
              onData(fullData);
              return;
            }
          }
          const prodCol = await getDocs(collection(db, 'products'));
          if (!prodCol.empty) {
            const itemsFromCol = prodCol.docs.map(d => normalizeItem({ id: d.id, ...d.data() })).filter(Boolean);
            if (itemsFromCol.length > 0) {
              const fullData = normalizeAppData({ ...INITIAL_DATA, stok: itemsFromCol });
              onData(fullData);
              return;
            }
          }
        } catch (colErr) {
          console.warn('[Firebase] Collection fallback check:', colErr);
        }

        onData(snap.exists() ? normalizeAppData(snap.data()) : null);
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
