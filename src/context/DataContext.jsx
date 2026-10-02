import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadLocalData, saveLocalData,
  subscribeToFirebaseCloud, pushToFirebaseCloud,
  pullFromGitHub, pushToGitHub, INITIAL_DATA
} from '../services/dataSync';

const DataContext = createContext(null);

// Helper: validasi apakah data dari cloud/github layak dipakai
const isValidData = (data) => {
  return data && typeof data === 'object' && Array.isArray(data.stok);
};

export const DataProvider = ({ children }) => {
  const [appData, setAppData] = useState(() => loadLocalData() || INITIAL_DATA);
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

  // Subscribe to Firebase & pull GitHub safely using timestamp comparison
  useEffect(() => {
    setSyncStatus('syncing');

    // ✅ FIX: Selalu load dari localStorage dulu sebagai initial data
    // Ini memastikan data tampil meski Firebase belum merespons
    const localData = loadLocalData();
    if (isValidData(localData) && localData.stok.length > 0) {
      setAppData(localData);
      setSyncStatus('ok');
    }

    const unsub = subscribeToFirebaseCloud((cloudData) => {
      // ✅ FIX: Validasi data cloud lebih ketat menggunakan isValidData()
      if (isValidData(cloudData)) {
        setAppData(prev => {
          const localTime = new Date(prev.lastUpdated || 0).getTime();
          const cloudTime = new Date(cloudData.lastUpdated || 0).getTime();
          // Only accept cloud data if it is newer or equal to local data
          if (cloudTime >= localTime) {
            const saved = saveLocalData(cloudData);
            return saved;
          }
          return prev;
        });
        setLastSync(new Date());
        setSyncStatus('ok');
      } else {
        // Firebase merespons tapi data kosong/baru — tetap pakai data lokal
        setSyncStatus('ok');
      }
    });
    unsubRef.current = unsub;

    // Pull from GitHub fallback safely (ONLY if GitHub has newer timestamp)
    pullFromGitHub().then(({ success, data }) => {
      if (success && isValidData(data)) {
        setAppData(prev => {
          const localTime = new Date(prev.lastUpdated || 0).getTime();
          const ghTime = new Date(data.lastUpdated || 0).getTime();
          if (ghTime > localTime) {
            const saved = saveLocalData(data);
            return saved;
          }
          return prev;
        });
        setLastSync(new Date());
        setSyncStatus('ok');
      } else {
        setSyncStatus('ok');
      }
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Save and push to both Firebase & GitHub
  const saveAndSync = useCallback(async (newData) => {
    // 1. Immediately update local storage and React UI state
    const saved = saveLocalData(newData);
    setAppData(saved);
    setSyncStatus('syncing');
    toast('✅ Data berhasil disimpan!', 'success');

    // 2. Push to Firebase & GitHub asynchronously
    const [fbRes, ghRes] = await Promise.allSettled([
      pushToFirebaseCloud(saved),
      pushToGitHub(saved)
    ]);

    const fbOk = fbRes.status === 'fulfilled' && fbRes.value?.success;
    const ghOk = ghRes.status === 'fulfilled' && ghRes.value?.success;

    if (fbOk || ghOk) {
      setSyncStatus('ok');
      setLastSync(new Date());
    } else {
      setSyncStatus('ok'); // Local data is permanently saved
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
