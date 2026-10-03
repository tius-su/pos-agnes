import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadLocalData, saveLocalData,
  subscribeToFirebaseCloud, subscribePublicCatalog, pushToFirebaseCloud,
  INITIAL_DATA, normalizeAppData
} from '../services/dataSync';
import { auth } from '../firebase';

const DataContext = createContext(null);

// Helper: apakah data punya stok yang valid dan tidak kosong
const hasValidStock = (data) =>
  data && typeof data === 'object' && Array.isArray(data.stok) && data.stok.length > 0;

// Merge data Firebase dengan fallback lokal, pastikan stok tidak pernah kosong
const mergeWithFallback = (cloudData, fallback) => {
  if (hasValidStock(cloudData)) return cloudData;
  if (hasValidStock(fallback)) return fallback;
  return INITIAL_DATA;
};

export const DataProvider = ({ children, isPublic = false }) => {
  // State awal: coba dari cache lokal, jika kosong pakai INITIAL_DATA (ada sample stok)
  const [appData, setAppData] = useState(() => {
    try {
      const local = loadLocalData();
      if (hasValidStock(local)) return local;
    } catch (e) {
      console.warn('[DataContext] Failed to load local cache:', e);
    }
    return INITIAL_DATA;
  });

  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSync, setLastSync] = useState(null);
  const [toasts, setToasts] = useState([]);
  const unsubRef = useRef(null);
  const initialDataRef = useRef(appData); // simpan snapshot awal sebagai fallback

  // Toast helpers
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Update data locally only (tidak push ke cloud)
  const updateData = useCallback((newData) => {
    const normalized = normalizeAppData(newData);
    const saved = saveLocalData(normalized);
    setAppData(saved);
    setLastSync(new Date());
    setSyncStatus('ok');
  }, []);

  // ─── FIREBASE SUBSCRIPTION ──────────────────────────────────────────────
  useEffect(() => {
    // ── MODE PUBLIK (E-Katalog tanpa login) ──
    if (isPublic) {
      setSyncStatus('syncing');
      const unsub = subscribePublicCatalog(
        (cloudData) => {
          if (cloudData && cloudData.stok && cloudData.stok.length > 0) {
            setAppData(cloudData);
            setSyncStatus('ok');
          } else {
            // Firebase publik belum bisa dibaca (rules belum diupdate) → pakai localStorage
            const localData = loadLocalData();
            if (localData && localData.stok && localData.stok.length > 0) {
              setAppData(localData);
            }
            setSyncStatus('ok');
          }
        },
        () => {
          // Error → pakai localStorage
          const localData = loadLocalData();
          if (localData && localData.stok && localData.stok.length > 0) {
            setAppData(localData);
          }
          setSyncStatus('ok');
        }
      );
      unsubRef.current = unsub;
      return () => { if (unsubRef.current) unsubRef.current(); };
    }

    // ── MODE ADMIN (tunggu login dulu) ──
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      if (!user) {
        setSyncStatus('idle');
        return;
      }

      // User sudah login → subscribe Firestore
      setSyncStatus('syncing');
      const unsub = subscribeToFirebaseCloud(
        (cloudData) => {
          if (cloudData && cloudData.stok && cloudData.stok.length > 0) {
            saveLocalData(cloudData);
            setAppData(cloudData);
            setLastSync(new Date());
            setSyncStatus('ok');
          } else {
            const localData = loadLocalData();
            const bestData = mergeWithFallback(null, localData);
            setAppData(bestData);
            setSyncStatus('ok');
            setLastSync(new Date());

            if (!cloudData) {
              pushToFirebaseCloud(bestData).then(res => {
                if (res.success) console.info('[DataContext] INITIAL_DATA pushed to Firebase');
              });
            }
          }
        },
        (err) => {
          console.warn('[DataContext] Firebase error:', err.message);
          setSyncStatus('error');
        }
      );

      unsubRef.current = unsub;
    });

    return () => {
      unsubAuth();
      if (unsubRef.current) unsubRef.current();
    };
  }, [isPublic]);

  // Save dan sync ke Firebase
  const saveAndSync = useCallback(async (newData) => {
    // Pastikan stok tidak hilang saat save
    const normalized = normalizeAppData(newData);
    const dataToSave = hasValidStock(normalized)
      ? normalized
      : mergeWithFallback(normalized, initialDataRef.current);

    // 1. Simpan ke local & update UI
    const saved = saveLocalData(dataToSave);
    setAppData(saved);
    setSyncStatus('syncing');

    // 2. Push ke Firebase
    const fbRes = await pushToFirebaseCloud(saved);
    if (fbRes.success) {
      setSyncStatus('ok');
      setLastSync(new Date());
      toast('✅ Tersimpan & tersinkron ke Firebase Cloud!', 'success');
    } else {
      setSyncStatus('ok');
      if (fbRes.error && fbRes.error.toLowerCase().includes('permission')) {
        toast('💾 Tersimpan di perangkat (Login akun untuk sinkron Cloud)', 'info');
      } else {
        toast('💾 Tersimpan lokal (offline mode)', 'info');
      }
    }

    return saved;
  }, [toast]);

  return (
    <DataContext.Provider value={{ appData, syncStatus, lastSync, updateData, saveAndSync, toast, toasts }}>
      {children}
      {/* Toast Render */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              background: t.type === 'error' ? 'var(--rose)' : t.type === 'success' ? '#059669' : '#7c3aed',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeUp 0.2s ease-out'
            }}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
