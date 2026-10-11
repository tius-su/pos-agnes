import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, getRedirectResult, firebaseReady } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Jika Firebase tidak terkonfigurasi
    if (!firebaseReady || !auth) {
      console.warn('[AuthContext] Firebase not configured. Using offline mode.');
      setAuthError({
        code: 'auth/configuration-not-found',
        message: 'Firebase belum dikonfigurasi. Gunakan mode offline.'
      });
      setUser(null);
      setLoading(false);
      return undefined;
    }

    // 1. Tangkap hasil redirect login Google (jika user baru kembali dari redirect)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setAuthError(null);
        }
      })
      .catch((err) => {
        console.error('Redirect result error:', err);
        setAuthError(err);
      });

    // 2. Subscribe perubahan auth state (login/logout)
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setAuthError(null);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authError, firebaseReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
