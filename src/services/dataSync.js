import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const LOCAL_DATA_KEY = 'agnes_pos_data';
const GH_TOKEN_KEY = 'agnes_token';
const GH_REPO_KEY = 'agnes_repo';
const DEFAULT_REPO = import.meta.env.VITE_GITHUB_REPO || 'tius-su/pos-agnes';
const DEFAULT_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';

export const INITIAL_DATA = {
  appName: 'Agnes Fashion POS',
  lastUpdated: new Date().toISOString(),
  stok: [
    {
      nama_barang: 'Gamis Silk',
      kategori: 'Pakaian Wanita',
      hargaModal: 85000,
      hargaJual: 150000,
      stokTersedia: 10,
      supplierList: ['Cilla Busana']
    },
    {
      nama_barang: 'Gamis Elegant Silk Premium',
      kategori: 'Pakaian Wanita',
      hargaModal: 120000,
      hargaJual: 185000,
      stokTersedia: 15,
      supplierList: ['Supplier Silk Utama']
    },
    {
      nama_barang: 'Kemeja Unisex Linen Casual',
      kategori: 'Pakaian Pria',
      hargaModal: 85000,
      hargaJual: 135000,
      stokTersedia: 24,
      supplierList: ['Konveksi Bandung']
    }
  ],
  pembelian: [
    {
      id: 1790594080379,
      tanggal: '2026-09-28',
      waktu: '18:14:40',
      supplier: 'Cilla Busana',
      barang: 'Gamis Silk',
      kategori: 'Pakaian Wanita',
      jumlah: 10,
      hargaModal: 85000,
      totalModal: 850000
    },
    {
      id: 1,
      tanggal: '2026-09-28',
      waktu: '10:00:00',
      supplier: 'Supplier Silk Utama',
      barang: 'Gamis Elegant Silk Premium',
      kategori: 'Pakaian Wanita',
      jumlah: 15,
      hargaModal: 120000,
      totalModal: 1800000
    },
    {
      id: 2,
      tanggal: '2026-09-28',
      waktu: '11:30:00',
      supplier: 'Konveksi Bandung',
      barang: 'Kemeja Unisex Linen Casual',
      kategori: 'Pakaian Pria',
      jumlah: 24,
      hargaModal: 85000,
      totalModal: 2040000
    }
  ],
  penjualan: [
    {
      id: 1,
      kodeTrx: 'TRX-882101',
      tanggal: '2026-09-28',
      waktu: '14:20:00',
      pelanggan: 'Ibu Rahma',
      noWa: '6285117021',
      metodeBayar: 'Tunai',
      items: [
        {
          barang: 'Gamis Elegant Silk Premium',
          jumlah: 1,
          hargaModal: 120000,
          hargaJual: 185000,
          subtotal: 185000
        }
      ],
      totalPenjualan: 185000,
      totalModal: 120000,
      laba: 65000
    }
  ],
  settings: {
    storeName: 'Agnes Fashion',
    storeAddress: 'Pasar Baru Cikarang Blok C',
    storePhone: '0851-1702-1168',
    receiptFooter: 'Terima Kasih Telah Berbelanja di Agnes Fashion! Barang yang sudah dibeli tidak dapat ditukar.'
  }
};

// LocalStorage helpers
export const loadLocalData = () => {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load local data", e);
  }
  return INITIAL_DATA;
};

export const saveLocalData = (data) => {
  try {
    const updated = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to save local data", e);
    return data;
  }
};

// Firebase Cloud Sync
export const subscribeToFirebaseCloud = (onDataReceived) => {
  try {
    const docRef = doc(db, 'pos_data', 'store_data');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        onDataReceived(cloudData);
      }
    }, (error) => {
      console.warn("Firestore snapshot error (may require security rules or internet):", error.message);
    });
    return unsubscribe;
  } catch (e) {
    console.error("Firebase Cloud Subscription Error:", e);
    return () => {};
  }
};

export const pushToFirebaseCloud = async (data) => {
  try {
    const docRef = doc(db, 'pos_data', 'store_data');
    const payload = { ...data, lastUpdated: new Date().toISOString() };
    await setDoc(docRef, payload);
    saveLocalData(payload);
    return { success: true };
  } catch (e) {
    console.error("Firebase Cloud Push Error:", e);
    return { success: false, error: e.message };
  }
};

// GitHub JSON API Sync
export const getGitHubSettings = () => {
  return {
    token: localStorage.getItem(GH_TOKEN_KEY) || DEFAULT_TOKEN,
    repo: localStorage.getItem(GH_REPO_KEY) || DEFAULT_REPO
  };
};

export const saveGitHubSettings = (token, repo) => {
  localStorage.setItem(GH_TOKEN_KEY, token.trim());
  localStorage.setItem(GH_REPO_KEY, repo.trim());
};

export const pullFromGitHub = async () => {
  const { token, repo } = getGitHubSettings();
  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/github.json?t=${Date.now()}`, { headers });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

    const fileMeta = await res.json();
    const contentUtf8 = decodeURIComponent(escape(atob(fileMeta.content.replace(/\n/g, ''))));
    const data = JSON.parse(contentUtf8);
    return { success: true, data, sha: fileMeta.sha };
  } catch (e) {
    console.warn("GitHub Pull failed, using local/firebase cache", e.message);
    return { success: false, error: e.message };
  }
};

export const pushToGitHub = async (data) => {
  const { token, repo } = getGitHubSettings();
  if (!token) return { success: false, error: "Token GitHub belum diisi" };

  try {
    const updatedData = { ...data, lastUpdated: new Date().toISOString() };

    // Get SHA
    let sha = '';
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/github.json`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;
    }

    const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));
    const bodyPayload = {
      message: `POS Sync: ${new Date().toLocaleString('id-ID')}`,
      content: contentBase64,
      sha: sha || undefined
    };

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/github.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || 'Push failed');
    }

    saveLocalData(updatedData);
    return { success: true };
  } catch (e) {
    console.error("GitHub Push Error:", e);
    return { success: false, error: e.message };
  }
};
