import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
  splitMediaUrls,
  getPrimaryImageUrl,
  isMediaVideo,
  isDirectVideoUrl,
  isYouTubeUrl,
  getYouTubeEmbedUrl,
  getYouTubeThumbnail,
  normalizeMediaUrl,
  handleImageErrorWithFallback,
  shareProductToWhatsApp,
  useResolvedMedia
} from '../utils/mediaHelper';

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

// ── Subcomponent Product Card ──
const ProductCard = ({
  item,
  onOpenDetail,
  onOrderWa,
  onShareProduct
}) => {
  const mediaList = useResolvedMedia(item.imageUrl);
  const primaryImg = getPrimaryImageUrl(mediaList.length > 0 ? mediaList.join(' + ') : item.imageUrl);
  const variants = (item.variasiText || '').split(',').map(s => s.trim()).filter(Boolean);
  const isAvailable = item.stokTersedia > 0;
  const hasVideo = mediaList.some(u => isMediaVideo(u));

  return (
    <div
      className="card product-katalog-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.22s ease',
        border: '1px solid var(--border)',
        borderRadius: 16,
        background: 'var(--bg-card)'
      }}
    >
      {/* Product Media Cover Header */}
      <div
        onClick={() => onOpenDetail(item)}
        style={{
          height: 175,
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
          overflow: 'hidden'
        }}
        title="Klik untuk lihat foto & video lengkap"
      >
        {primaryImg ? (
          <img
            src={primaryImg}
            alt={item.nama_barang}
            referrerPolicy="no-referrer"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease'
            }}
            loading="lazy"
            onError={(e) => handleImageErrorWithFallback(e, primaryImg)}
          />
        ) : (
          <span style={{ fontSize: 52, opacity: 0.9 }}>
            {CAT_EMOJI[item.kategori] || '👗'}
          </span>
        )}

        {/* Media Pill Badge (Multiple Photos / Videos) */}
        {mediaList.length > 1 && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontSize: 10,
              fontWeight: 800,
              background: 'rgba(15, 23, 42, 0.78)',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: 99,
              backdropFilter: 'blur(4px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <i className="fa-solid fa-images" /> {mediaList.length} Foto/Video
          </span>
        )}

        {hasVideo && mediaList.length <= 1 && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontSize: 10,
              fontWeight: 800,
              background: 'rgba(217, 119, 6, 0.9)',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: 99,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <i className="fa-solid fa-circle-play" /> Video
          </span>
        )}

        {/* Availability Badge */}
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 10,
            fontWeight: 800,
            background: isAvailable ? 'rgba(16, 185, 129, 0.92)' : 'rgba(225, 29, 72, 0.92)',
            color: '#fff',
            padding: '3px 8px',
            borderRadius: 99,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
          }}
        >
          {isAvailable ? 'Ready Stock' : 'Stok Habis'}
        </span>
      </div>

      {/* Product Card Body */}
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {item.kategori}
        </div>
        <h3
          onClick={() => onOpenDetail(item)}
          style={{
            fontSize: 14,
            fontWeight: 800,
            margin: '0 0 6px 0',
            lineHeight: 1.35,
            cursor: 'pointer',
            minHeight: 38,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
          title={item.nama_barang}
        >
          {item.nama_barang}
        </h3>

        {/* Price & Wholesale */}
        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--emerald)' }}>
            {formatRp(item.hargaJual)}
          </div>
          {item.hargaGrosir > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', marginTop: 2 }}>
              🏷️ Grosir (≥{item.minQtyGrosir || 3} pcs): {formatRp(item.hargaGrosir)}
            </div>
          )}
        </div>

        {/* Variants Preview */}
        {variants.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {variants.slice(0, 3).map((v, idx) => (
              <span key={idx} style={{ fontSize: 9, fontWeight: 700, background: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                {v}
              </span>
            ))}
            {variants.length > 3 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>
                +{variants.length - 3} lainnya
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-purple btn-sm"
            onClick={() => onOpenDetail(item)}
            style={{ fontWeight: 800, fontSize: 11, padding: '7px 10px', borderRadius: 8 }}
          >
            <i className="fa-solid fa-eye" /> Detail &amp; Foto ({mediaList.length || 1})
          </button>

          <button
            type="button"
            className="btn btn-green btn-sm"
            onClick={() => onOrderWa(item)}
            title="Pesan via WhatsApp (Foto produk ikut dikirim)"
            style={{ fontWeight: 800, fontSize: 11, padding: '7px 10px', borderRadius: 8 }}
          >
            <i className="fa-brands fa-whatsapp" style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

const EKatalogPage = ({ isStandalone = false }) => {
  const { appData, toast } = useData();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  const stok = appData.stok || [];
  const settings = appData.settings || {};
  const storeName = settings.storeName || 'Melan Jaya';
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

  // Modal media list for currently selected product
  const modalMediaList = useResolvedMedia(selectedProduct?.imageUrl);

  const handleOpenDetail = (product) => {
    setSelectedProduct(product);
    setSelectedVariant('');
    setActiveMediaIdx(0);
  };

  const handleCloseDetail = () => {
    setSelectedProduct(null);
    setSelectedVariant('');
    setActiveMediaIdx(0);
  };

  const copyCatalogLink = () => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    navigator.clipboard.writeText(catalogUrl);
    toast('✅ Link E-Katalog berhasil disalin!', 'success');
  };

  const shareCatalogToWa = () => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    let text = `Halo! Yuk lihat koleksi produk pakaian terbaru dari *${storeName}* di E-Katalog Digital kami:\n\n`;
    text += `🛍️ ${catalogUrl}\n\n`;
    text += `📍 ${storeAddress}\n`;
    text += `📱 Hubungi: ${storePhone}\n\n`;
    text += `Pesan langsung via WhatsApp resmi toko! ✨`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleOrderProductWa = async (item, variant = '') => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    toast('📲 Membuka WhatsApp untuk pemesanan...', 'info');
    await shareProductToWhatsApp({
      product: item,
      storeName,
      targetPhone: waTargetNumber,
      catalogUrl,
      variant: variant || selectedVariant
    });
  };

  const handleShareProductDirectWa = async (item) => {
    const catalogUrl = window.location.origin + window.location.pathname + '#katalog';
    toast('📲 Membagikan produk ke WhatsApp...', 'info');
    await shareProductToWhatsApp({
      product: item,
      storeName,
      targetPhone: '',
      catalogUrl,
      variant: selectedVariant
    });
  };

  return (
    <div className="tab-page active fade-up" style={{ paddingBottom: 40 }}>

      {/* ── Banner Header Katalog ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2e1065 0%, #5b21b6 50%, #7c3aed 100%)',
        borderRadius: 20,
        padding: '24px 20px',
        color: '#fff',
        marginBottom: 20,
        boxShadow: '0 10px 25px rgba(124, 58, 237, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img
            src={settings.logoUrl || `${import.meta.env.BASE_URL}MJ-logo.jpg`}
            alt={storeName}
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              objectFit: 'cover',
              background: '#fff',
              border: '2.5px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              flexShrink: 0
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, marginBottom: 8, backdropFilter: 'blur(4px)' }}>
              <i className="fa-solid fa-sparkles" /> E-Katalog Digital Resmi &amp; Galeri Media
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              {storeName}
            </h1>
            <p style={{ fontSize: 13, opacity: 0.88, margin: 0, maxWidth: 500 }}>
              📍 {storeAddress} · 📱 WA: {storePhone}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={copyCatalogLink} style={{ background: '#fff', color: '#5b21b6', fontWeight: 800 }}>
            <i className="fa-solid fa-copy" /> Salin Link Katalog
          </button>
          <button className="btn btn-sm" onClick={shareCatalogToWa} style={{ background: '#25D366', color: '#fff', fontWeight: 800 }}>
            <i className="fa-brands fa-whatsapp" /> Bagikan ke WhatsApp
          </button>
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
          filteredProducts.map(item => (
            <ProductCard
              key={item.id || item.nama_barang}
              item={item}
              onOpenDetail={handleOpenDetail}
              onOrderWa={(it) => handleOrderProductWa(it)}
              onShareProduct={handleShareProductDirectWa}
            />
          ))
        )}
      </div>

      {/* ── Product Detail & Media Lightbox Modal ── */}
      {selectedProduct && (
        <div
          className="modal-overlay show"
          onClick={e => e.target.classList.contains('modal-overlay') && handleCloseDetail()}
          style={{ zIndex: 9999 }}
        >
          <div
            className="modal"
            style={{
              maxWidth: 580,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              borderRadius: 20
            }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span className="badge badge-violet" style={{ fontSize: 10, marginBottom: 2 }}>{selectedProduct.kategori}</span>
                <div className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>
                  {selectedProduct.nama_barang}
                </div>
              </div>
              <button className="modal-close" onClick={handleCloseDetail}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              
              {/* Main Media Stage */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 240,
                  maxHeight: 380,
                  background: '#090d16',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12
                }}
              >
                {(() => {
                  const currentMedia = modalMediaList[activeMediaIdx] || getPrimaryImageUrl(selectedProduct.imageUrl);

                  if (!currentMedia) {
                    return (
                      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.7)' }}>
                        <span style={{ fontSize: 64, display: 'block', marginBottom: 8 }}>
                          {CAT_EMOJI[selectedProduct.kategori] || '👗'}
                        </span>
                        <div style={{ fontSize: 12 }}>Belum ada foto yang diupload</div>
                      </div>
                    );
                  }

                  if (isYouTubeUrl(currentMedia)) {
                    return (
                      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                        <iframe
                          src={getYouTubeEmbedUrl(currentMedia)}
                          title="YouTube Video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            border: 'none'
                          }}
                        />
                      </div>
                    );
                  }

                  if (isDirectVideoUrl(currentMedia)) {
                    return (
                      <video
                        src={currentMedia}
                        controls
                        playsInline
                        autoPlay
                        muted
                        style={{ maxWidth: '100%', maxHeight: 380, width: '100%', objectFit: 'contain' }}
                      />
                    );
                  }

                  return (
                    <img
                      src={currentMedia}
                      alt={selectedProduct.nama_barang}
                      referrerPolicy="no-referrer"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 380,
                        width: '100%',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                      onError={(e) => handleImageErrorWithFallback(e, currentMedia)}
                    />
                  );
                })()}

                {/* Media Counter Pill */}
                {modalMediaList.length > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 99,
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    {activeMediaIdx + 1} / {modalMediaList.length}
                    {isMediaVideo(modalMediaList[activeMediaIdx]) ? ' • 🎬 Video' : ' • 🖼️ Foto'}
                  </div>
                )}

                {/* Navigation Arrows */}
                {modalMediaList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveMediaIdx(prev => (prev > 0 ? prev - 1 : modalMediaList.length - 1))}
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.85)',
                        border: 'none',
                        color: '#0f172a',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Media Sebelumnya"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMediaIdx(prev => (prev < modalMediaList.length - 1 ? prev + 1 : 0))}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.85)',
                        border: 'none',
                        color: '#0f172a',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Media Berikutnya"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails Navigation Strip */}
              {modalMediaList.length > 1 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 14, scrollbarWidth: 'thin' }}>
                  {modalMediaList.map((mediaUrl, idx) => {
                    const isSelected = activeMediaIdx === idx;
                    const isVid = isMediaVideo(mediaUrl);
                    const isYT = isYouTubeUrl(mediaUrl);
                    const thumbUrl = isYT ? getYouTubeThumbnail(mediaUrl) : mediaUrl;

                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveMediaIdx(idx)}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 8,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          flexShrink: 0,
                          border: isSelected ? '2.5px solid var(--brand)' : '1px solid var(--border)',
                          position: 'relative',
                          background: '#0f172a',
                          boxShadow: isSelected ? '0 0 10px rgba(124,58,237,0.4)' : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isVid && !isYT ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
                            <i className="fa-solid fa-circle-play" style={{ color: 'var(--amber)' }} />
                          </div>
                        ) : (
                          <img
                            src={thumbUrl}
                            alt={`Thumb ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => handleImageErrorWithFallback(e, thumbUrl)}
                          />
                        )}

                        {isVid && (
                          <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 8, padding: '1px 3px', borderRadius: 3 }}>
                            ▶
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Product Pricing Details */}
              <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>HARGA SATUAN:</span>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--emerald)' }}>
                      {formatRp(selectedProduct.hargaJual)}
                    </div>
                  </div>
                  <span className={`badge ${selectedProduct.stokTersedia > 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '4px 10px' }}>
                    {selectedProduct.stokTersedia > 0 ? `Ready: ${selectedProduct.stokTersedia} pcs` : 'Stok Habis'}
                  </span>
                </div>

                {selectedProduct.hargaGrosir > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>
                    ✨ Ambil grosir minimal {selectedProduct.minQtyGrosir || 3} pcs: <b>{formatRp(selectedProduct.hargaGrosir)}</b> / pcs
                  </div>
                )}
              </div>

              {/* Variants Selector */}
              {selectedProduct.variasiText && (
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                    🎨 Pilih Variasi / Ukuran / Warna:
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedProduct.variasiText.split(',').map(v => v.trim()).filter(Boolean).map(variant => {
                      const isChosen = selectedVariant === variant;
                      return (
                        <button
                          key={variant}
                          type="button"
                          onClick={() => setSelectedVariant(isChosen ? '' : variant)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: isChosen ? '2px solid var(--brand)' : '1px solid var(--border)',
                            background: isChosen ? 'var(--brand)' : 'var(--bg-card)',
                            color: isChosen ? '#fff' : 'var(--text-primary)',
                            boxShadow: isChosen ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isChosen ? '✓ ' : ''}{variant}
                        </button>
                      );
                    })}
                  </div>
                  {selectedVariant && (
                    <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700, marginTop: 6 }}>
                      Variasi dipilih: <b>{selectedVariant}</b>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer CTA */}
            <div className="modal-footer" style={{ padding: '14px 18px', background: 'var(--bg-hover)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCloseDetail}
              >
                Tutup
              </button>

              <button
                type="button"
                className="btn btn-purple btn-sm"
                onClick={() => handleShareProductDirectWa(selectedProduct)}
                title="Bagikan produk ini ke teman / kontak WhatsApp"
              >
                <i className="fa-solid fa-share-nodes" /> Bagikan Produk
              </button>

              <button
                type="button"
                className="btn btn-green"
                onClick={() => handleOrderProductWa(selectedProduct)}
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                  padding: '9px 18px',
                  borderRadius: 10,
                  flex: 1,
                  boxShadow: '0 4px 14px rgba(37,211,102,0.35)'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: 16 }} /> Pesan ke WhatsApp (Foto Ikut Dikirim)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default EKatalogPage;
