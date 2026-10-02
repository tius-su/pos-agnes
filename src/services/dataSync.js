import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const LOCAL_CACHE_KEY = 'agnes_pos_cache'; // renamed: ini hanya cache, bukan sumber data
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

// ─── LOCAL CACHE (bukan sumber data utama) ────────────────────────────────────
export const loadLocalData = () => {
  try {
    // Coba key lama dulu untuk backward compatibility
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
             || localStorage.getItem('agnes_pos_data');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Cache load error:', e);
  }
  return null; // null = belum ada cache, bukan INITIAL_DATA
};

export const saveLocalData = (data) => {
  try {
    const updated = { ...data, lastUpdated: new Date().toISOString() };
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
 * @param {Function} onData  - dipanggil dengan data saat Firebase update
 * @param {Function} onError - dipanggil saat error koneksi
 * @returns unsubscribe function
 */
export const subscribeToFirebaseCloud = (onData, onError) => {
  try {
    const unsub = onSnapshot(
      FIREBASE_DOC(),
      (snap) => {
        if (snap.exists()) {
          onData(snap.data());
        } else {
          // Dokumen belum ada di Firestore
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
 * Push data ke Firebase (DATABASE UTAMA).
 * Selalu tambahkan lastUpdated baru.
 */
export const pushToFirebaseCloud = async (data) => {
  try {
    const payload = { ...data, lastUpdated: new Date().toISOString() };
    await setDoc(FIREBASE_DOC(), payload);
    saveLocalData(payload); // update cache
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
