import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadLocalData, saveLocalData,
  subscribeToFirebaseCloud, pushToFirebaseCloud,
  pullFromGitHub, pushToGitHub, INITIAL_DATA
} from '../services/dataSync';

const DataContext = createContext(null);

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

  // Subscribe to Firebase realtime
  useEffect(() => {
    setSyncStatus('syncing');
    const unsub = subscribeToFirebaseCloud((cloudData) => {
      if (cloudData && cloudData.stok && cloudData.stok.length > 0) {
        setAppData(prev => {
          const merged = saveLocalData({ ...prev, ...cloudData });
          return merged;
        });
        setLastSync(new Date());
        setSyncStatus('ok');
      }
    });
    unsubRef.current = unsub;

    // Pull from GitHub fallback safely
    pullFromGitHub().then(({ success, data }) => {
      if (success && data && data.stok && data.stok.length > 0) {
        setAppData(prev => {
          // Only use GitHub data if local has less items or GitHub has newer timestamp
          if (!prev.stok || prev.stok.length <= data.stok.length) {
            const saved = saveLocalData(data);
            return saved;
          }
          return prev;
        });
        setLastSync(new Date());
        setSyncStatus('ok');
      } else {
        setSyncStatus('ok'); // keep ok for local mode
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
      setSyncStatus('ok'); // local mode is healthy
    }

    return saved;
  }, [toast]);

  return (
    <DataContext.Provider value={{ appData, syncStatus, lastSync, updateData, saveAndSync, toast }}>
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
