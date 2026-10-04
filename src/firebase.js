import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
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

// Gunakan redirect (bukan popup) agar tidak kena blokir COOP di GitHub Pages
export const loginWithGoogle = async () => {
  if (!firebaseReady || !auth || !googleProvider) {
    return {
      user: null,
      error: {
        message: 'Firebase belum dikonfigurasi. Isi variabel VITE_FIREBASE_* di .env.local lalu restart aplikasi.'
      }
    };
  }

  try {
    await signInWithRedirect(auth, googleProvider);
    return { user: null, error: null };
  } catch (error) {
    console.error('Google Auth Error:', error);
    return { user: null, error };
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
