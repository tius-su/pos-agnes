import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// Service Worker didaftarkan otomatis oleh vite-plugin-pwa (registerType: 'autoUpdate')
// dengan path yang benar untuk GitHub Pages /pos-agnes/

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
