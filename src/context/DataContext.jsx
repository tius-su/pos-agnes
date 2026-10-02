import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadLocalData, saveLocalData,
  subscribeToFirebaseCloud, pushToFirebaseCloud,
  pullFromGitHub, pushToGitHub, INITIAL_DATA
} from '../services/dataSync';

const DataContext = createContext(null);

// Helper: validasi apakah data layak dipakai
const isValidData = (data) => {
  return data && typeof data === 'object' && Array.isArray(data.stok);
};

export const DataProvider = ({ children }) => {
  const [appData, setAppData] = useState(() => {
    const local = loadLocalData();
    if (isValidData(local) && local.stok.length > 0) return local;
    return INITIAL_DATA;
  });
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [lastSync, setLastSync] = useState(null);
  const [toasts, setToasts] = useState([]);
  const unsubRef = useRef(null);

  // Toast helpers
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Update data directly locally
  const updateData = useCallback((newData) => {
    const saved = saveLocalData(newData);
    setAppData(saved);
    setLastSync(new Date());
    setSyncStatus('ok');
  }, []);

  // ─── FIREBASE REALTIME SUBSCRIPTION (DATABASE UTAMA) ──────────────────────
  useEffect(() => {
    setSyncStatus('syncing');

    // Realtime listener dari Firebase Firestore
    const unsub = subscribeToFirebaseCloud((cloudData) => {
      if (isValidData(cloudData) && cloudData.stok.length > 0) {
        // Firebase Firestore memuat data valid -> sync langsung ke React state & localStorage
        saveLocalData(cloudData);
        setAppData(cloudData);
        setLastSync(new Date());
        setSyncStatus('ok');
      } else {
        // Coba gunakan cache lokal jika memiliki stok barang
        const local = loadLocalData();
        if (isValidData(local) && local.stok.length > 0) {
          setAppData(local);
          setSyncStatus('ok');
        } else {
          // Jika cloud & local tidak memiliki stok barang, pakai INITIAL_DATA agar Kasir & Stok TIDAK KOSONG
          saveLocalData(INITIAL_DATA);
          setAppData(INITIAL_DATA);
          pushToFirebaseCloud(INITIAL_DATA);
          setSyncStatus('ok');
        }
      }
    });

    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Save and push ke Firebase & GitHub
  const saveAndSync = useCallback(async (newData) => {
    // 1. Simpan ke local cache & update UI langsung
    const saved = saveLocalData(newData);
    setAppData(saved);
    setSyncStatus('syncing');

    // 2. Push ke Firebase Firestore (DATABASE UTAMA)
    const fbRes = await pushToFirebaseCloud(saved);
    if (fbRes.success) {
      setSyncStatus('ok');
      setLastSync(new Date());
      toast('✅ Tersimpan & tersinkron ke Firebase!', 'success');
    } else {
      setSyncStatus('ok');
      toast('✅ Tersimpan lokal (offline mode)', 'info');
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
