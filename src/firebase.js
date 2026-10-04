import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult as firebaseGetRedirectResult,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Baca dari env variables (lokal: .env.local | GitHub Actions: Secrets)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const firebaseReady = Object.values(firebaseConfig).every(Boolean);

let app = null;
if (firebaseReady) {
  app = initializeApp(firebaseConfig);
}

export const auth = firebaseReady ? getAuth(app) : null;
export const db = firebaseReady ? getFirestore(app) : null;
export const googleProvider = auth ? new GoogleAuthProvider() : null;

if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

// Export agar AuthContext bisa cek hasil redirect saat app load
export const getRedirectResult = (authInstance = auth) => {
  if (!authInstance) return Promise.resolve(null);
  return firebaseGetRedirectResult(authInstance);
};

// Prioritaskan redirect, tapi fallback ke popup jika browser/domain memblokir redirect.
export const loginWithGoogle = async () => {
  if (!firebaseReady || !auth || !googleProvider) {
    return {
      user: null,
      error: {
        code: 'auth/configuration-not-found',
        message: 'Firebase belum dikonfigurasi. Isi variabel VITE_FIREBASE_* di .env.local lalu restart aplikasi.'
      }
    };
  }

  try {
    const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
    
    // Untuk GitHub Pages, gunakan popup karena redirect tidak bekerja dengan baik
    if (isLocalhost || isGitHubPages) {
      const result = await signInWithPopup(auth, googleProvider);
      return { user: result.user, error: null };
    }

    await signInWithRedirect(auth, googleProvider);
    return { user: null, error: null };
  } catch (error) {
    console.warn('Redirect login failed, trying popup fallback:', error);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return { user: result.user, error: null };
    } catch (popupError) {
      console.error('Google Auth Error:', popupError);
      
      // Handle common Firebase auth errors
      let errorMessage = popupError.message || 'Login gagal';
      let errorCode = popupError.code || 'auth/unknown';
      
      if (errorCode.includes('popup-closed-by-user')) {
        errorMessage = 'Login dibatalkan oleh pengguna';
      } else if (errorCode.includes('network-request-failed')) {
        errorMessage = 'Tidak ada koneksi internet. Periksa koneksi Anda.';
      } else if (errorCode.includes('auth/domain-not-whitelisted')) {
        errorMessage = 'Domain tidak diizinkan. Tambahkan domain ke Firebase Auth whitelist.';
      } else if (errorCode.includes('auth/invalid-api-key')) {
        errorMessage = 'API Key Firebase tidak valid. Periksa konfigurasi Firebase.';
      }
      
      return { user: null, error: { code: errorCode, message: errorMessage } };
    }
  }
};

export const logoutUser = async () => {
  if (!auth) {
    return { success: false, error: 'Firebase belum dikonfigurasi.' };
  }

  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default app;
