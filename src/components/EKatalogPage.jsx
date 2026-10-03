import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

const CAT_EMOJI = { 'Pakaian Wanita': '👗', 'Pakaian Pria': '👕', 'Hijab': '🧕', 'Aksesoris': '💍', 'Lainnya': '📦' };
const CATEGORIES = ['Semua', 'Pakaian Wanita', 'Pakaian Pria', 'Hijab', 'Aksesoris', 'Lainnya'];

const formatWaNumber = (phone) => {
  if (!phone) return '6285117027358';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
};

const EKatalogPage = ({ isStandalone = false }) => {
  const { appData, toast } = useData();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [shareModal, setShareModal] = useState(false);

  const stok = appData.stok || [];
  const settings = appData.settings || {};
  const storeName = settings.storeName || 'Agnes Fashion';
  const storeAddress = settings.storeAddress || 'Pasar Baru Cikarang Blok C';
  const storePhone = settings.storePhone || '0851-1702-1168';
  const waTargetNumber = formatWaNumber(storePhone);

  const filteredProducts = stok.filter(item => {
    const sTerm = search.toLowerCase().trim();
    const matchSearch = !sTerm ||
      item.nama_barang.toLowerCase().includes(sTerm) ||
      item.kategori.toLowerCase().includes(sTerm);
    const matchCat = selectedCategory === 'Semua' || item.kategori === selectedCategory;
    return matchSearch && matchCat;
  });

  const getWaLinkForProduct = (item, variant = '') => {
    let msg = `Halo ${storeName}, saya tertarik untuk memesan produk berikut dari E-Katalog:\n\n` +
      `*Produk:* ${item.nama_barang}\n` +
      `*Kategori:* ${item.kategori}\n` +
      `*Harga:* ${formatRp(item.hargaJual)}\n`;

    if (variant) {
      msg += `*Variasi / Ukuran:* ${variant}\n`;
    } else if (item.variasiText) {
      msg += `*Pilihan Variasi:* ${item.variasiText}\n`;
    }

    if (item.hargaGrosir > 0) {
      msg += `\n(Catatan: Siap ambil grosir ≥${item.minQtyGrosir || 3} pcs @ ${formatRp(item.hargaGrosir)})\n`;
    }

    msg += `\nApakah stok ini masih tersedia? Terima kasih!`;
    return `https://wa.me/${waTargetNumber}?text=${encodeURIComponent(msg)}`;
  };

  const copyCatalogLink = () => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    navigator.clipboard.writeText(catalogUrl);
    toast('✅ Link E-Katalog berhasil disalin!', 'success');
  };

  const shareCatalogToWa = () => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    const text = `Halo! Yuk lihat koleksi produk pakaian terbaru dari *${storeName}* di E-Katalog Digital kami:\n\n${catalogUrl}\n\nPesan langsung via WhatsApp resmi toko! 🛍️✨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="tab-page active fade-up" style={{ paddingBottom: 40 }}>

      {/* ── Banner Header Katalog ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2e1065, #5b21b6, #7c3aed)',
        borderRadius: 20,
        padding: '24px 20px',
        color: '#fff',
        marginBottom: 20,
        boxShadow: '0 10px 25px rgba(124, 58, 237, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, marginBottom: 10, backdropFilter: 'blur(4px)' }}>
            <i className="fa-solid fa-sparkles" /> E-Katalog Digital Resmi
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            {storeName}
          </h1>
          <p style={{ fontSize: 13, opacity: 0.88, margin: 0, maxWidth: 500 }}>
            📍 {storeAddress} · 📱 WA: {storePhone}
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={copyCatalogLink} style={{ background: '#fff', color: '#5b21b6', fontWeight: 800 }}>
              <i className="fa-solid fa-copy" /> Salin Link Katalog
            </button>
            <button className="btn btn-sm" onClick={shareCatalogToWa} style={{ background: '#25D366', color: '#fff', fontWeight: 800 }}>
              <i className="fa-brands fa-whatsapp" /> Bagikan ke WhatsApp
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div style={{
          position: 'absolute', right: -30, bottom: -30, width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', pointerEvents: 'none'
        }} />
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="card" style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-input-icon" style={{ flex: 1, minWidth: 240 }}>
            <i className="fa-solid fa-search" />
            <input
              className="form-input"
              placeholder="Cari baju, gamis, hijab, aksesoris..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="katalog-search"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0 2px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            const emoji = cat === 'Semua' ? '✨' : (CAT_EMOJI[cat] || '📦');
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 99,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isActive ? 'var(--brand)' : 'var(--bg-hover)',
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  boxShadow: isActive ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                }}
              >
                {emoji} {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Products Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16
      }}>
        {filteredProducts.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
            <i className="fa-solid fa-shirt" style={{ fontSize: 40, color: 'var(--text-muted)', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Produk tidak ditemukan</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Coba kata kunci pencarian atau kategori lain.</div>
          </div>
        ) : (
          filteredProducts.map(item => {
            const variants = (item.variasiText || '').split(',').map(s => s.trim()).filter(Boolean);
            const isAvailable = item.stokTersedia > 0;

            return (
              <div
                key={item.id || item.nama_barang}
                className="card product-katalog-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  border: '1px solid var(--border)'
                }}
              >
                {/* Product Header Graphic */}
                <div style={{
                  height: 120,
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: 48, opacity: 0.9 }}>
                    {CAT_EMOJI[item.kategori] || '👗'}
                  </span>
                  
                  <span style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 10, fontWeight: 800,
                    background: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                    color: isAvailable ? '#059669' : '#e11d48',
                    padding: '3px 8px', borderRadius: 99
                  }}>
                    {isAvailable ? 'Ready Stock' : 'Stok Habis'}
                  </span>
                </div>

                {/* Product Body */}
                <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', tracking: 0.5, marginBottom: 4 }}>
                    {item.kategori}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px 0', lineHeight: 1.3 }}>
                    {item.nama_barang}
                  </h3>

                  {/* Price */}
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>
                      {formatRp(item.hargaJual)}
                    </div>
                    {item.hargaGrosir > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', marginTop: 2 }}>
                        🏷️ Grosir (≥{item.minQtyGrosir || 3} pcs): {formatRp(item.hargaGrosir)}
                      </div>
                    )}
                  </div>

                  {/* Variants Pills */}
                  {variants.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                      {variants.slice(0, 5).map((v, idx) => (
                        <span key={idx} style={{ fontSize: 9, fontWeight: 700, background: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                          {v}
                        </span>
                      ))}
                      {variants.length > 5 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>
                          +{variants.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action WA button */}
                  <a
                    href={getWaLinkForProduct(item)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                    style={{
                      marginTop: 14,
                      background: '#25D366',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 12,
                      justifyContent: 'center',
                      textDecoration: 'none',
                      borderRadius: 8
                    }}
                  >
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: 14 }} /> Pesan via WhatsApp
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default EKatalogPage;
