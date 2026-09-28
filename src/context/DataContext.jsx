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

  // Merge & update data
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
      setAppData(cloudData);
      setLastSync(new Date());
      setSyncStatus('ok');
    });
    unsubRef.current = unsub;

    // Also pull from GitHub as fallback
    pullFromGitHub().then(({ success, data }) => {
      if (success && data) {
        setAppData(data);
        setLastSync(new Date());
        setSyncStatus('ok');
      } else {
        setSyncStatus('error');
      }
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Auto pull GitHub every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      pullFromGitHub().then(({ success, data }) => {
        if (success && data) {
          setAppData(data);
          setLastSync(new Date());
        }
      });
    }, 30000);

    const onFocus = () => pullFromGitHub().then(({ success, data }) => {
      if (success && data) { setAppData(data); setLastSync(new Date()); }
    });
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  // Save and push to both Firebase & GitHub
  const saveAndSync = useCallback(async (newData) => {
    const saved = saveLocalData(newData);
    setAppData(saved);
    setSyncStatus('syncing');

    const [fbRes, ghRes] = await Promise.allSettled([
      pushToFirebaseCloud(saved),
      pushToGitHub(saved)
    ]);

    const fbOk = fbRes.status === 'fulfilled' && fbRes.value?.success;
    const ghOk = ghRes.status === 'fulfilled' && ghRes.value?.success;

    if (fbOk || ghOk) {
      setSyncStatus('ok');
      setLastSync(new Date());
      const labels = [fbOk && 'Firebase', ghOk && 'GitHub'].filter(Boolean).join(' & ');
      toast(`✅ Tersimpan & disync ke ${labels}`, 'success');
    } else {
      setSyncStatus('error');
      toast('⚠️ Disimpan lokal. Sync gagal — cek koneksi', 'warning');
    }

    return saved;
  }, [toast]);

  return (
    <DataContext.Provider value={{ appData, syncStatus, lastSync, updateData, saveAndSync, toast }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
