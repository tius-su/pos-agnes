import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const CAT_EMOJI = { 'Pakaian Wanita': '👗', 'Pakaian Pria': '👕', 'Hijab': '🧕', 'Aksesoris': '💍', 'Lainnya': '📦' };

const KasirPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [cart, setCart] = useState([]);
  const [payMethod, setPayMethod] = useState('Tunai');
  const [cashInput, setCashInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerWa, setCustomerWa] = useState('');
  const [datetime, setDatetime] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTrx, setLastTrx] = useState(null);

  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDatetime(now.toISOString().slice(0, 16));
  }, []);

  const filtered = appData.stok.filter(i => {
    const sTerm = search.toLowerCase().trim();
    const matchSearch = !sTerm ||
      (i.nama_barang && i.nama_barang.toLowerCase().includes(sTerm)) ||
      (i.kategori && i.kategori.toLowerCase().includes(sTerm)) ||
      (i.supplier && i.supplier.toLowerCase().includes(sTerm)) ||
      (i.suplier && i.suplier.toLowerCase().includes(sTerm)) ||
      (i.nama_suplier && i.nama_suplier.toLowerCase().includes(sTerm)) ||
      (Array.isArray(i.supplierList) && i.supplierList.some(s => String(s).toLowerCase().includes(sTerm)));
    return matchSearch && (!category || i.kategori === category);
  });

  const addToCart = (item) => {
    if (item.stokTersedia <= 0) return;
    setCart(prev => {
      const ex = prev.find(c => c.nama_barang === item.nama_barang);
      if (ex) {
        if (ex.qty >= item.stokTersedia) { toast('Stok tidak mencukupi!', 'error'); return prev; }
        return prev.map(c => c.nama_barang === item.nama_barang ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (name, d) => {
    setCart(prev => {
      const updated = prev.map(c => {
        if (c.nama_barang !== name) return c;
        const maxStock = appData.stok.find(s => s.nama_barang === name)?.stokTersedia || 0;
        const newQty = c.qty + d;
        if (newQty <= 0) return null;
        if (newQty > maxStock) { toast('Melebihi stok tersedia!', 'warning'); return c; }
        return { ...c, qty: newQty };
      }).filter(Boolean);
      return updated;
    });
  };

  const total = cart.reduce((s, c) => s + c.hargaJual * c.qty, 0);
  const totalModal = cart.reduce((s, c) => s + (c.hargaModal || 0) * c.qty, 0);
  const laba = total - totalModal;
  const cashNum = parseFloat(cashInput) || 0;
  const kembalian = cashNum - total;

  const handleCheckout = async () => {
    if (!cart.length) { toast('Keranjang masih kosong!', 'error'); return; }
    if (payMethod === 'Tunai' && cashNum < total) { toast('Uang tidak cukup!', 'error'); return; }

    const trxDate = datetime ? new Date(datetime) : new Date();
    const kodeTrx = 'TRX-' + Math.floor(100000 + Math.random() * 900000);

    const trx = {
      id: Date.now(),
      kodeTrx,
      tanggal: trxDate.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-'),
      waktu: trxDate.toLocaleTimeString('id-ID'),
      pelanggan: customerName || 'Umum',
      noWa: customerWa,
      metodeBayar: payMethod,
      items: cart.map(c => ({
        barang: c.nama_barang,
        jumlah: c.qty,
        hargaModal: c.hargaModal || 0,
        hargaJual: c.hargaJual,
        subtotal: c.hargaJual * c.qty
      })),
      totalPenjualan: total,
      totalModal,
      laba,
      uangDiterima: payMethod === 'Tunai' ? cashNum : total,
      kembalian: payMethod === 'Tunai' ? kembalian : 0
    };

    // Reduce stock
    const newStok = appData.stok.map(s => {
      const cartItem = cart.find(c => c.nama_barang === s.nama_barang);
      if (!cartItem) return s;
      return { ...s, stokTersedia: s.stokTersedia - cartItem.qty };
    });

    const newData = {
      ...appData,
      stok: newStok,
      penjualan: [...(appData.penjualan || []), trx]
    };

    await saveAndSync(newData);
    setLastTrx(trx);
    setShowReceipt(true);
    setCart([]);
    setCashInput('');
    setCustomerName('');
    setCustomerWa('');

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDatetime(now.toISOString().slice(0, 16));
  };

  const sendWhatsApp = () => {
    if (!lastTrx || !customerWa && !lastTrx.noWa) { toast('No WhatsApp tidak diisi', 'warning'); return; }
    const no = (lastTrx.noWa || customerWa).replace(/\D/g, '');
    const s = appData.settings;
    let msg = `*STRUK BELANJA ${s.storeName?.toUpperCase() || 'AGNES FASHION'}*\n`;
    msg += `${s.storeAddress || ''}\n`;
    msg += `───────────────────\n`;
    msg += `No TRX : ${lastTrx.kodeTrx}\n`;
    msg += `Tanggal: ${lastTrx.tanggal} ${lastTrx.waktu}\n`;
    msg += `Pelanggan: ${lastTrx.pelanggan}\n`;
    msg += `───────────────────\n`;
    lastTrx.items.forEach(i => { msg += `${i.barang} x${i.jumlah}  ${formatRp(i.subtotal)}\n`; });
    msg += `───────────────────\n`;
    msg += `*TOTAL: ${formatRp(lastTrx.totalPenjualan)}*\n`;
    msg += `Metode: ${lastTrx.metodeBayar}\n`;
    if (lastTrx.metodeBayar === 'Tunai') {
      msg += `Bayar: ${formatRp(lastTrx.uangDiterima)}\n`;
      msg += `Kembalian: ${formatRp(lastTrx.kembalian)}\n`;
    }
    msg += `───────────────────\n`;
    msg += `${s.receiptFooter || 'Terima kasih!'}`;
    window.open(`https://wa.me/${no}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="tab-page active fade-up">
      <div className="pos-layout">
        {/* Product Grid */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-store" /> Katalog Produk</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="form-input-icon" style={{ width: 200 }}>
                <i className="fa-solid fa-search" />
                <input
                  className="form-input"
                  placeholder="Cari barang / supplier..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  id="pos-search"
                />
              </div>
              <select className="form-input" style={{ width: 140 }} value={category} onChange={e => setCategory(e.target.value)} id="pos-category">
                <option value="">Semua Kategori</option>
                {['Pakaian Wanita','Pakaian Pria','Hijab','Aksesoris','Lainnya'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="product-grid">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <i className="fa-solid fa-box-open" />
                <p>Produk tidak ditemukan.<br />Tambahkan stok di menu <b>Stok Barang</b>.</p>
              </div>
            ) : filtered.map(item => {
              const oos = item.stokTersedia <= 0;
              const low = !oos && item.stokTersedia <= 5;
              const supplierText = Array.isArray(item.supplierList) && item.supplierList.length > 0
                ? item.supplierList.join(', ')
                : (item.supplier || item.suplier || item.nama_suplier || '');

              return (
                <div key={item.nama_barang} className={`product-card${oos ? ' out-of-stock' : ''}`}>
                  <div className="product-stock-badge">
                    {oos ? <span className="badge badge-red">Habis</span>
                      : low ? <span className="badge badge-amber">Sisa {item.stokTersedia}</span>
                      : <span className="badge badge-green">{item.stokTersedia}</span>}
                  </div>
                  <div className="product-emoji">{CAT_EMOJI[item.kategori] || '📦'}</div>
                  <div className="product-name">{item.nama_barang}</div>
                  {supplierText && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🏭 {supplierText}
                    </div>
                  )}
                  <div className="product-price">{formatRp(item.hargaJual)}</div>
                  <button className="product-add-btn" onClick={() => addToCart(item)} disabled={oos}>
                    <i className="fa-solid fa-cart-plus" /> Tambah
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="cart-panel">
          <div className="cart-header">
            <div className="cart-header-title">
              <i className="fa-solid fa-shopping-cart" /> Keranjang
              {cart.length > 0 && (
                <span className="badge badge-violet">{cart.reduce((s,c) => s+c.qty, 0)}</span>
              )}
            </div>
            {cart.length > 0 && (
              <button className="cart-clear-btn" onClick={() => setCart([])}>
                <i className="fa-solid fa-trash" /> Kosongkan
              </button>
            )}
          </div>

          {/* Customer Info */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', gap: 8 }}>
            <input className="form-input" placeholder="Nama pelanggan" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ fontSize: 11 }} id="cart-customer" />
            <input className="form-input" placeholder="No WA (opsional)" value={customerWa} onChange={e => setCustomerWa(e.target.value)} style={{ fontSize: 11 }} id="cart-wa" />
            <input type="datetime-local" className="form-input" value={datetime} onChange={e => setDatetime(e.target.value)} style={{ fontSize: 11, minWidth: 160 }} id="cart-datetime" />
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <i className="fa-solid fa-cart-shopping" />
                <p>Keranjang masih kosong.<br />Pilih produk di katalog.</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={item.nama_barang} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.nama_barang}</div>
                  <div className="cart-item-price">{formatRp(item.hargaJual)} / pcs</div>
                </div>
                <div className="cart-item-qty">
                  <button className="qty-btn" onClick={() => updateQty(item.nama_barang, -1)}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.nama_barang, 1)}>+</button>
                </div>
                <div className="cart-item-subtotal">{formatRp(item.hargaJual * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="cart-footer">
            {/* Payment Method */}
            <div className="payment-methods">
              {['Tunai', 'Transfer', 'QRIS'].map(m => (
                <button key={m} className={`pay-btn${payMethod === m ? ' active' : ''}`} onClick={() => setPayMethod(m)}>
                  {m === 'Tunai' ? '💵' : m === 'Transfer' ? '🏦' : '📱'} {m}
                </button>
              ))}
            </div>

            {/* Total */}
            <div className="total-box">
              <span className="total-label">Total Belanja</span>
              <span className="total-value">{formatRp(total)}</span>
            </div>

            {/* Cash input */}
            {payMethod === 'Tunai' && (
              <div className="kembalian-row">
                <div>
                  <label className="form-label">Uang Diterima (Rp)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0"
                    value={cashInput}
                    onChange={e => setCashInput(e.target.value)}
                    id="cash-input"
                  />
                </div>
                <div>
                  <label className="form-label">Kembalian</label>
                  <div className="kembalian-display">
                    {cashNum >= total ? formatRp(kembalian) : '—'}
                  </div>
                </div>
              </div>
            )}

            <button className="btn btn-green btn-full btn-lg" onClick={handleCheckout} disabled={!cart.length} id="btn-checkout">
              <i className="fa-solid fa-check-circle" /> Proses Pembayaran
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowReceipt(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-receipt" style={{ color: 'var(--emerald)' }} /> Struk Pembayaran
              </div>
              <button className="modal-close" onClick={() => setShowReceipt(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body" id="print-area">
              <div className="receipt-paper">
                <div className="receipt-title">{appData.settings.storeName?.toUpperCase() || 'AGNES FASHION'}</div>
                <div className="receipt-subtitle">{appData.settings.storeAddress}</div>
                <div className="receipt-subtitle">{appData.settings.storePhone}</div>
                <hr className="receipt-divider" />
                <div className="receipt-row"><span>No TRX</span><span style={{ fontWeight: 700 }}>{lastTrx.kodeTrx}</span></div>
                <div className="receipt-row"><span>Tanggal</span><span>{lastTrx.tanggal} {lastTrx.waktu}</span></div>
                <div className="receipt-row"><span>Pelanggan</span><span>{lastTrx.pelanggan}</span></div>
                <div className="receipt-row"><span>Metode</span><span style={{ fontWeight: 700 }}>{lastTrx.metodeBayar}</span></div>
                <hr className="receipt-divider" />
                {lastTrx.items.map((it, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{it.barang}</div>
                    <div className="receipt-row" style={{ marginLeft: 8 }}>
                      <span>{it.jumlah}x {formatRp(it.hargaJual)}</span>
                      <span>{formatRp(it.subtotal)}</span>
                    </div>
                  </div>
                ))}
                <hr className="receipt-divider" />
                <div className="receipt-row bold"><span>TOTAL BAYAR</span><span style={{ color: '#059669' }}>{formatRp(lastTrx.totalPenjualan)}</span></div>
                {lastTrx.metodeBayar === 'Tunai' && <>
                  <div className="receipt-row"><span>Uang Diterima</span><span>{formatRp(lastTrx.uangDiterima)}</span></div>
                  <div className="receipt-row"><span>Kembalian</span><span>{formatRp(lastTrx.kembalian)}</span></div>
                </>}
                <hr className="receipt-divider" />
                <div className="receipt-footer-text">{appData.settings.receiptFooter || 'Terima kasih!'}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <i className="fa-solid fa-print" /> Print
              </button>
              <button className="btn btn-wa" style={{ flex: 1 }} onClick={sendWhatsApp}>
                <i className="fa-brands fa-whatsapp" /> Kirim WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KasirPage;
