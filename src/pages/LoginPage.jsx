import React, { useState, useEffect } from 'react';
import { loginWithGoogle } from '../firebase';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const { error: err } = await loginWithGoogle();
    if (err) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setError('Domain (tius-su.github.io) belum didaftarkan di Firebase Console. Silakan tambahkan tius-su.github.io di Firebase -> Authentication -> Settings -> Authorized Domains.');
      } else {
        setError(err.message || 'Login gagal. Coba lagi.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Decorative orbs */}
      <div className="login-orb" style={{ width: 400, height: 400, background: '#7c3aed', top: '-100px', left: '-100px' }} />
      <div className="login-orb" style={{ width: 300, height: 300, background: '#a855f7', bottom: '-80px', right: '-80px', animationDelay: '2s' }} />
      <div className="login-orb" style={{ width: 200, height: 200, background: '#0284c7', top: '40%', right: '10%', animationDelay: '1s' }} />

      <div className="login-card">
        <div className="login-logo" style={{ textAlign: 'center' }}>
          <img
            src="/melanjaya.jpg"
            alt="Melan Jaya POS Logo"
            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
            style={{
              maxHeight: 95,
              maxWidth: '90%',
              borderRadius: 12,
              objectFit: 'contain',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              marginBottom: 16,
              border: '2px solid rgba(255,255,255,0.2)',
              background: '#fff',
              padding: 4,
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          />
          <div className="login-logo-icon logo-mj" style={{ display: 'none', margin: '0 auto 16px auto' }}>
            MJ
          </div>
          <h1>Melan Jaya</h1>
          <p>Point of Sale & Management System</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
            Masuk untuk mengakses sistem kasir
          </p>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Data tersinkronisasi otomatis via Firebase & GitHub
          </p>
        </div>

        <button className="btn-google" onClick={handleGoogleLogin} disabled={loading} id="btn-google-login">
          {loading ? (
            <>
              <i className="fa-solid fa-circle-notch" style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
              Memuat...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Masuk dengan Google
            </>
          )}
        </button>

        {error && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#f87171', marginTop: 12 }}>
            <i className="fa-solid fa-triangle-exclamation" /> {error}
          </p>
        )}

        <div className="login-footer">
          <i className="fa-solid fa-shield-halved" style={{ color: 'rgba(255,255,255,0.4)', marginRight: 6 }} />
          Diamankan oleh Firebase Authentication
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
