import React, { useState, useRef } from 'react';
import BarcodeSVG from './BarcodeSVG';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

const LabelPrintModal = ({ items = [], storeName = 'Melan Jaya', onClose }) => {
  const printAreaRef = useRef(null);

  // Config state
  const [paperType, setPaperType] = useState('67x35'); // '67x35' | '50x30' | '40x30' | 'a4'
  const [showStore, setShowStore] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showVariant, setShowVariant] = useState(true);
  const [sharingIdx, setSharingIdx] = useState(null);

  // Qty map per item: { [itemName]: count }
  const [qtyMap, setQtyMap] = useState(() => {
    const map = {};
    items.forEach(it => {
      map[it.nama_barang] = 1;
    });
    return map;
  });

  const setAllQty = (val) => {
    const map = {};
    items.forEach(it => {
      map[it.nama_barang] = Math.max(1, parseInt(val) || 1);
    });
    setQtyMap(map);
  };

  const setQty = (nama, val) => {
    setQtyMap(prev => ({
      ...prev,
      [nama]: Math.max(1, parseInt(val) || 1)
    }));
  };

  // Build array of label instances to render
  const labelList = [];
  items.forEach(it => {
    const count = qtyMap[it.nama_barang] || 1;
    for (let i = 0; i < count; i++) {
      labelList.push(it);
    }
  });

  const handlePrint = () => {
    window.print();
  };

  // ─── Share Label ke WhatsApp (gambar canvas) ────────────────────────
  // Karena browser tidak bisa langsung attach file ke WA, kita share info teks lengkap
  const shareItemToWA = (it) => {
    const codeText = it.barcode || (it.nama_barang.slice(0, 4).toUpperCase() + '-' + String(it.id || Math.floor(Math.random() * 9999)).slice(-4));
    let msg = `🏷️ *LABEL HARGA — ${storeName.toUpperCase()}*\n`;
    msg += `──────────────────────\n`;
    msg += `📦 Produk  : ${it.nama_barang}\n`;
    msg += `🏷️ Kategori: ${it.kategori || '—'}\n`;
    if (it.variasiText) msg += `🎨 Variasi : ${it.variasiText}\n`;
    msg += `💰 Harga   : *${formatRp(it.hargaJual)}*\n`;
    if (it.hargaGrosir > 0) msg += `🛒 Grosir  : ${formatRp(it.hargaGrosir)} (min ${it.minQtyGrosir || 3} pcs)\n`;
    msg += `🔖 Kode    : ${codeText}\n`;
    msg += `──────────────────────\n`;
    msg += `Dikirim dari ${storeName} POS`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Share semua label ke WhatsApp (sebagai daftar)
  const shareAllToWA = () => {
    let msg = `🏷️ *DAFTAR LABEL HARGA — ${storeName.toUpperCase()}*\n`;
    msg += `────────────────────────\n`;
    items.forEach((it, i) => {
      msg += `${i + 1}. ${it.nama_barang}\n`;
      msg += `   💰 ${formatRp(it.hargaJual)}`;
      if (it.variasiText) msg += ` · 🎨 ${it.variasiText}`;
      if (it.hargaGrosir > 0) msg += `\n   🛒 Grosir: ${formatRp(it.hargaGrosir)}`;
      msg += '\n';
    });
    msg += `────────────────────────\n`;
    msg += `Total: ${items.length} produk\nDikirim dari ${storeName} POS`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const getLabelSize = () => {
    if (paperType === '67x35') return { w: '67mm', minH: 140, barcodeH: 42 };
    if (paperType === '50x30') return { w: '50mm', minH: 120, barcodeH: 34 };
    if (paperType === '40x30') return { w: '40mm', minH: 100, barcodeH: 28 };
    return { w: 'auto', minH: 120, barcodeH: 34 }; // a4
  };
  const labelSize = getLabelSize();

  return (
    <div className="modal-overlay show" style={{ zIndex: 9999 }}>
      <div className="modal-content modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header - hide on print */}
        <div className="modal-header no-print" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>
            <i className="fa-solid fa-barcode" style={{ color: 'var(--brand)', marginRight: 8 }} />
            Cetak Label Harga &amp; Barcode Produk
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-wa btn-sm" onClick={shareAllToWA} title="Bagikan daftar harga ke WhatsApp">
              <i className="fa-brands fa-whatsapp" /> Share WA
            </button>
            <button className="btn-icon" onClick={onClose} id="btn-close-label-modal">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* Controls - hide on print */}
        <div className="modal-body no-print" style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Label Options */}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Format Ukuran Kertas</label>
              <select className="form-input" value={paperType} onChange={e => setPaperType(e.target.value)}>
                <option value="67x35">🏷️ Stiker 67mm × 35mm (Standar Swalayan)</option>
                <option value="50x30">Stiker Thermal 50mm × 30mm (Standard POS)</option>
                <option value="40x30">Stiker Thermal 40mm × 30mm (Kecil)</option>
                <option value="a4">Lembar A4 Grid (3 Kolom × 8 Baris)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Quick Qty All</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 5, 10].map(n => (
                  <button key={n} className="btn btn-ghost btn-sm" onClick={() => setAllQty(n)} style={{ flex: 1, padding: '6px 0', fontSize: 11 }}>
                    {n}x / item
                  </button>
                ))}
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={showStore} onChange={e => setShowStore(e.target.checked)} />
                Tampilkan Nama Toko ({storeName})
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={showBarcode} onChange={e => setShowBarcode(e.target.checked)} />
                Tampilkan Barcode Code128
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
                Tampilkan Harga Jual
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={showVariant} onChange={e => setShowVariant(e.target.checked)} />
                Tampilkan Variasi (Ukuran/Warna)
              </label>
            </div>
          </div>

          {/* Item Quantity List */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
              Daftar Barang &amp; Jumlah Cetak ({items.length} Barang · Total {labelList.length} Stiker)
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(it => (
                <div key={it.nama_barang} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{it.nama_barang}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{it.kategori} · {formatRp(it.hargaJual)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-wa btn-sm"
                      style={{ padding: '3px 8px', fontSize: 10 }}
                      onClick={() => shareItemToWA(it)}
                      title="Share item ini ke WhatsApp"
                    >
                      <i className="fa-brands fa-whatsapp" />
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jml:</span>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      style={{ width: 56, textAlign: 'center', padding: '4px 6px', fontSize: 12 }}
                      value={qtyMap[it.nama_barang] || 1}
                      onChange={e => setQty(it.nama_barang, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview Title */}
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>👁️ Pratinjau Tampilan Cetak ({paperType === 'a4' ? 'Grid Sheet A4' : `Stiker ${paperType.replace('x', 'mm × ')}mm`})</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>Total {labelList.length} Label</span>
          </div>
        </div>

        {/* Printable Area & Live Preview Container */}
        <div ref={printAreaRef} style={{ overflowY: 'auto', padding: '0 20px 20px', flex: 1 }} className="printable-labels-area">
          <div
            className={`label-grid paper-${paperType}`}
            style={{
              display: 'grid',
              gridTemplateColumns:
                paperType === 'a4' ? 'repeat(3, 1fr)'
                : paperType === '67x35' ? 'repeat(auto-fill, minmax(210px, 1fr))'
                : paperType === '40x30' ? 'repeat(auto-fill, minmax(150px, 1fr))'
                : 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              justifyContent: 'center'
            }}
          >
            {labelList.map((it, idx) => {
              const codeText = it.barcode || (it.nama_barang.slice(0, 4).toUpperCase() + '-' + String(it.id || idx + 100).slice(-4));
              const variantText = it.variasiText || (it.variasiList ? it.variasiList.join(', ') : '');

              return (
                <div
                  key={idx}
                  className="barcode-sticker-tag"
                  style={{
                    border: '1px dashed #ccc',
                    borderRadius: paperType === '67x35' ? 8 : 6,
                    padding: paperType === '67x35' ? '10px 12px' : '8px 10px',
                    background: '#fff',
                    color: '#000',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: labelSize.minH
                  }}
                >
                  {showStore && (
                    <div style={{
                      fontSize: paperType === '67x35' ? 11 : 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      borderBottom: '1px solid #ddd',
                      paddingBottom: 3,
                      marginBottom: 4,
                      color: '#5b21b6'
                    }}>
                      {storeName}
                    </div>
                  )}

                  <div style={{
                    fontSize: paperType === '67x35' ? 12 : 11,
                    fontWeight: 800,
                    color: '#111',
                    lineHeight: 1.3,
                    margin: '2px 0',
                    flex: 1
                  }}>
                    {it.nama_barang}
                  </div>

                  {showVariant && variantText && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#444', marginBottom: 2 }}>
                      Var: {variantText}
                    </div>
                  )}

                  {showBarcode && (
                    <div style={{ margin: '4px 0' }}>
                      <BarcodeSVG text={codeText} height={labelSize.barcodeH} widthModule={paperType === '67x35' ? 1.8 : 1.5} showText={true} />
                    </div>
                  )}

                  {showPrice && (
                    <div style={{ marginTop: 2, paddingTop: 3, borderTop: '1.5px solid #ddd' }}>
                      <div style={{
                        fontSize: paperType === '67x35' ? 16 : 12,
                        fontWeight: 900,
                        color: '#000',
                        letterSpacing: -0.5
                      }}>
                        {formatRp(it.hargaJual)}
                      </div>
                      {it.hargaGrosir > 0 && (
                        <div style={{ fontSize: 8, fontWeight: 700, color: '#555' }}>
                          Grosir ≥{it.minQtyGrosir || 3}pcs: {formatRp(it.hargaGrosir)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer - hide on print */}
        <div className="modal-footer no-print" style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-wa" onClick={shareAllToWA}>
              <i className="fa-brands fa-whatsapp" style={{ marginRight: 6 }} />
              Share ke WA ({items.length} Produk)
            </button>
            <button className="btn btn-purple" onClick={handlePrint} id="btn-do-print">
              <i className="fa-solid fa-print" style={{ marginRight: 6 }} />
              Cetak {labelList.length} Label Stiker
            </button>
          </div>
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .no-print {
              display: none !important;
            }
            .printable-labels-area, .printable-labels-area * {
              visibility: visible;
            }
            .printable-labels-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0 !important;
              margin: 0 !important;
            }
            .label-grid {
              gap: 4px !important;
            }
            .paper-67x35 {
              grid-template-columns: 1fr !important;
              width: 67mm;
            }
            .paper-50x30 {
              grid-template-columns: 1fr !important;
              width: 50mm;
            }
            .paper-40x30 {
              grid-template-columns: 1fr !important;
              width: 40mm;
            }
            .paper-a4 {
              grid-template-columns: repeat(3, 1fr) !important;
              width: 210mm;
            }
            .barcode-sticker-tag {
              border: 1px solid #000 !important;
              box-shadow: none !important;
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}</style>

      </div>
    </div>
  );
};

export default LabelPrintModal;
