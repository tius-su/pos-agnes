import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import LabelPrintModal from '../components/LabelPrintModal';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const CAT_EMOJI = { 'Pakaian Wanita': '👗', 'Pakaian Pria': '👕', 'Hijab': '🧕', 'Aksesoris': '💍', 'Lainnya': '📦' };
const CATEGORIES = ['Pakaian Wanita', 'Pakaian Pria', 'Hijab', 'Aksesoris', 'Lainnya'];

const emptyForm = {
  r_date: new Date().toISOString().slice(0, 10),
  r_supplier: '',
  r_name: '',
  r_category: 'Pakaian Wanita',
  r_qty: '',
  r_cost: '',
  r_price: '',
  r_min_grosir: '',
  r_price_grosir: '',
  r_variants: '',
  r_image_url: ''
};

const emptyBatchRow = {
  name: '',
  category: 'Pakaian Wanita',
  qty: '',
  cost: '',
  price: '',
  minGrosir: '',
  priceGrosir: '',
  variants: '',
  imageUrl: ''
};

const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'LLL', '3XL', 'All Size'];
const QUICK_COLORS = ['Hitam', 'Putih', 'Navy', 'Maroon', 'Sage Green', 'Rose', 'Mocca', 'Kuning', 'Cokelat'];

const getSupplierProductOptions = (stokList, supplier) => {
  const selectedSupplier = (supplier || '').trim().toLowerCase();
  if (!selectedSupplier) return [];

  const options = (stokList || [])
    .filter(item => {
      const itemSuppliers = [
        item?.supplier,
        item?.suplier,
        item?.nama_suplier,
        ...(Array.isArray(item?.supplierList) ? item.supplierList : [])
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      return itemSuppliers.includes(selectedSupplier);
    })
    .map(item => item?.nama_barang)
    .filter(Boolean);

  return [...new Set(options)].sort((a, b) => a.localeCompare(b));
};

const StokPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // for edit
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [customVariantInput, setCustomVariantInput] = useState('');
  const [printModalItems, setPrintModalItems] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchRows, setBatchRows] = useState([{ ...emptyBatchRow }]);
  const fileInputRef = useRef(null);

  const activeVariants = (form.r_variants || '').split(',').map(s => s.trim()).filter(Boolean);

  const toggleVariantItem = (val) => {
    if (!val) return;
    let next;
    if (activeVariants.includes(val)) {
      next = activeVariants.filter(s => s !== val);
    } else {
      next = [...activeVariants, val];
    }
    setForm(f => ({ ...f, r_variants: next.join(', ') }));
  };

  const addCustomVariant = () => {
    if (!customVariantInput || !customVariantInput.trim()) return;
    const item = customVariantInput.trim();
    if (!activeVariants.includes(item)) {
      const next = [...activeVariants, item];
      setForm(f => ({ ...f, r_variants: next.join(', ') }));
    }
    setCustomVariantInput('');
  };

  const filtered = (appData.stok || []).filter(i => {
    const sTerm = search.toLowerCase().trim();
    const matchSearch = !sTerm ||
      (i.nama_barang && i.nama_barang.toLowerCase().includes(sTerm)) ||
      (i.kategori && i.kategori.toLowerCase().includes(sTerm)) ||
      (i.supplier && i.supplier.toLowerCase().includes(sTerm)) ||
      (i.suplier && i.suplier.toLowerCase().includes(sTerm)) ||
      (i.nama_suplier && i.nama_suplier.toLowerCase().includes(sTerm)) ||
      (Array.isArray(i.supplierList) && i.supplierList.some(s => String(s).toLowerCase().includes(sTerm)));
    return matchSearch && (!catFilter || i.kategori === catFilter);
  });

  const supplierProductOptions = useMemo(
    () => getSupplierProductOptions(appData.stok, form.r_supplier),
    [appData.stok, form.r_supplier]
  );

  const findExistingProduct = (supplier, productName) => {
    const selectedSupplier = (supplier || '').trim().toLowerCase();
    const normalizedName = (productName || '').trim().toLowerCase();

    if (!normalizedName) return null;

    return (appData.stok || []).find(item => {
      const matchesName = String(item?.nama_barang || '').trim().toLowerCase() === normalizedName;
      if (!matchesName) return false;

      if (!selectedSupplier) return true;

      const itemSuppliers = [
        item?.supplier,
        item?.suplier,
        item?.nama_suplier,
        ...(Array.isArray(item?.supplierList) ? item.supplierList : [])
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      return itemSuppliers.includes(selectedSupplier);
    }) || null;
  };

  const applyProductSuggestion = (nextName, updater) => {
    const selectedItem = findExistingProduct(form.r_supplier, nextName);
    if (!selectedItem) return updater;

    return {
      ...updater,
      r_name: selectedItem.nama_barang,
      r_category: selectedItem.kategori || updater.r_category,
      r_cost: String(selectedItem.hargaModal ?? updater.r_cost),
      r_price: String(selectedItem.hargaJual ?? updater.r_price),
      r_min_grosir: selectedItem.minQtyGrosir ? String(selectedItem.minQtyGrosir) : updater.r_min_grosir,
      r_price_grosir: selectedItem.hargaGrosir ? String(selectedItem.hargaGrosir) : updater.r_price_grosir,
      r_variants: selectedItem.variasiText || updater.r_variants,
      r_image_url: selectedItem.imageUrl || updater.r_image_url
    };
  };

  const handleFormChange = e => {
    const { name, value } = e.target;
    setForm(f => {
      if (name === 'r_supplier') {
        return { ...f, r_supplier: value, r_name: '' };
      }

      if (name === 'r_name') {
        const selectedItem = findExistingProduct(f.r_supplier, value);
        if (selectedItem) {
          return {
            ...f,
            r_name: selectedItem.nama_barang,
            r_category: selectedItem.kategori || f.r_category,
            r_cost: String(selectedItem.hargaModal ?? f.r_cost),
            r_price: String(selectedItem.hargaJual ?? f.r_price),
            r_min_grosir: selectedItem.minQtyGrosir ? String(selectedItem.minQtyGrosir) : f.r_min_grosir,
            r_price_grosir: selectedItem.hargaGrosir ? String(selectedItem.hargaGrosir) : f.r_price_grosir,
            r_variants: selectedItem.variasiText || f.r_variants,
            r_image_url: selectedItem.imageUrl || f.r_image_url
          };
        }
      }

      return { ...f, [name]: value };
    });
  };

  const openRestock = () => {
    setEditItem(null);
    setForm(emptyForm);
    setBatchMode(false);
    setBatchRows([{ ...emptyBatchRow }]);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item.nama_barang);
    setBatchMode(false);
    setForm({
      r_date: new Date().toISOString().slice(0, 10),
      r_supplier: item.supplierList?.[0] || '',
      r_name: item.nama_barang,
      r_category: item.kategori,
      r_qty: '',
      r_cost: String(item.hargaModal),
      r_price: String(item.hargaJual),
      r_min_grosir: item.minQtyGrosir ? String(item.minQtyGrosir) : '',
      r_price_grosir: item.hargaGrosir ? String(item.hargaGrosir) : '',
      r_variants: item.variasiText || '',
      r_image_url: item.imageUrl || ''
    });
    setShowModal(true);
  };

  const updateBatchRow = (idx, field, value) => {
    setBatchRows(rows => rows.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const addBatchRow = () => setBatchRows(rows => [...rows, { ...emptyBatchRow }]);
  const removeBatchRow = (idx) => setBatchRows(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);

  const applyStockInput = (stokList, pembelianList, input, idx = 0) => {
    const qty = parseInt(input.qty) || 0;
    const cost = parseFloat(input.cost) || 0;
    const price = parseFloat(input.price) || 0;
    const minGrosir = parseInt(input.minGrosir) || 0;
    const priceGrosir = parseFloat(input.priceGrosir) || 0;
    const name = (input.name || '').trim();
    const supplier = (input.supplier || '').trim();
    const category = input.category || 'Pakaian Wanita';
    const variants = input.variants ? input.variants.trim() : '';
    const imageUrl = input.imageUrl || '';

    if (!name) return { stokList, pembelianList };

    const existIdx = stokList.findIndex(s => s.nama_barang.toLowerCase() === name.toLowerCase());

    if (existIdx >= 0) {
      const existingItem = stokList[existIdx];
      const existingQty = existingItem.stokTersedia || 0;
      const existingCost = existingItem.hargaModal || 0;
      const totalQty = existingQty + qty;
      const averageCost = qty > 0 && totalQty > 0
        ? ((existingQty * existingCost) + (qty * cost)) / totalQty
        : (cost || existingCost);

      stokList[existIdx] = {
        ...existingItem,
        hargaModal: averageCost,
        hargaJual: price || existingItem.hargaJual,
        minQtyGrosir: minGrosir,
        hargaGrosir: priceGrosir,
        variasiText: variants,
        stokTersedia: totalQty,
        kategori: category,
        imageUrl: imageUrl || existingItem.imageUrl || '',
        supplierList: [...new Set([...(existingItem.supplierList || []), supplier].filter(Boolean))]
      };
    } else {
      stokList.push({
        nama_barang: name,
        kategori: category,
        hargaModal: cost,
        hargaJual: price,
        minQtyGrosir: minGrosir,
        hargaGrosir: priceGrosir,
        variasiText: variants,
        imageUrl,
        stokTersedia: qty,
        supplierList: supplier ? [supplier] : []
      });
    }

    if (qty > 0 && supplier) {
      pembelianList.push({
        id: Date.now() + idx,
        tanggal: input.date,
        waktu: new Date().toLocaleTimeString('id-ID'),
        supplier,
        barang: name,
        kategori: category,
        jumlah: qty,
        hargaModal: cost,
        totalModal: cost * qty
      });
    }

    return { stokList, pembelianList };
  };

  const handleSubmit = async e => {
    e.preventDefault();

    let newStok = [...(appData.stok || [])];
    let newPembelian = [...(appData.pembelian || [])];

    if (batchMode && !editItem) {
      const validRows = batchRows.filter(row => row.name.trim());
      if (validRows.length === 0) { toast('Isi minimal 1 nama barang', 'error'); return; }
      validRows.forEach((row, idx) => {
        ({ stokList: newStok, pembelianList: newPembelian } = applyStockInput(newStok, newPembelian, {
          ...row,
          supplier: form.r_supplier,
          date: form.r_date
        }, idx));
      });
    } else {
      if (!form.r_name.trim()) { toast('Nama barang harus diisi', 'error'); return; }
      ({ stokList: newStok, pembelianList: newPembelian } = applyStockInput(newStok, newPembelian, {
        name: form.r_name,
        category: form.r_category,
        qty: form.r_qty,
        cost: form.r_cost,
        price: form.r_price,
        minGrosir: form.r_min_grosir,
        priceGrosir: form.r_price_grosir,
        variants: form.r_variants,
        imageUrl: form.r_image_url,
        supplier: form.r_supplier,
        date: form.r_date
      }));
    }

    await saveAndSync({ ...appData, stok: newStok, pembelian: newPembelian });
    setShowModal(false);
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const confirmDelete = (name) => {
    setDeleteConfirmItem(name);
  };

  const executeDelete = async () => {
    if (!deleteConfirmItem) return;
    const name = deleteConfirmItem;
    const newStok = (appData.stok || []).filter(s => s.nama_barang !== name);
    await saveAndSync({ ...appData, stok: newStok });
    toast(`Produk "${name}" berhasil dihapus`, 'success');
    setDeleteConfirmItem(null);
  };

  // Summary stats
  const totalSkus = appData.stok?.length || 0;
  const totalItems = (appData.stok || []).reduce((s, i) => s + i.stokTersedia, 0);
  const nilaiStok = (appData.stok || []).reduce((s, i) => s + i.hargaModal * i.stokTersedia, 0);
  const habis = (appData.stok || []).filter(i => i.stokTersedia <= 0).length;
  const menipis = (appData.stok || []).filter(i => i.stokTersedia > 0 && i.stokTersedia <= 5).length;

  return (
    <div className="tab-page active fade-up">
      {/* Stat Cards */}
      <div className="stats-grid stok-stats-grid">
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-tags" />
          <div className="stat-label">Total SKU</div>
          <div className="stat-value">{totalSkus}</div>
          <div className="stat-meta">Jenis produk</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-boxes-stacked" />
          <div className="stat-label">Total Item</div>
          <div className="stat-value">{totalItems}</div>
          <div className="stat-meta">Stok tersedia</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Nilai Stok</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(nilaiStok)}</div>
          <div className="stat-meta">Harga modal</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-triangle-exclamation" />
          <div className="stat-label">Stok Menipis</div>
          <div className="stat-value">{menipis}</div>
          <div className="stat-meta">≤ 5 unit</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--rose)' }}>
          <i className="stat-icon fa-solid fa-ban" style={{ color: 'var(--rose)' }} />
          <div className="stat-label" style={{ color: 'var(--rose)' }}>Stok Habis</div>
          <div className="stat-value">{habis}</div>
          <div className="stat-meta">Perlu restock</div>
        </div>
      </div>

      {/* Table & Mobile Card Section */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title"><i className="fa-solid fa-boxes-stacked" /> Daftar Stok Barang</div>
            <div className="card-subtitle">{filtered.length} produk ditemukan</div>
          </div>
          <div className="stok-header-actions">
            <div className="form-input-icon search-input-wrap">
              <i className="fa-solid fa-search" />
              <input className="form-input" placeholder="Cari barang / supplier..." value={search} onChange={e => setSearch(e.target.value)} id="stok-search" />
            </div>
            <select className="form-input filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Semua Kategori</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setPrintModalItems(filtered)} title="Cetak Barcode untuk semua produk di list">
              <i className="fa-solid fa-barcode" style={{ color: 'var(--brand)' }} /> Cetak Label Barcode
            </button>
            <button className="btn btn-purple btn-sm btn-restock-head" onClick={openRestock} id="btn-restock">
              <i className="fa-solid fa-plus" /> Restock / Tambah
            </button>
          </div>
        </div>

        {/* Desktop View (Table) */}
        <div className="overflow-x-auto desktop-table-view">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Harga Modal</th>
                <th>Harga Jual</th>
                <th>Margin</th>
                <th>Nilai Stok</th>
                <th>Supplier</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                  Belum ada produk. Klik "Restock / Tambah" untuk mulai.
                </td></tr>
              ) : filtered.map(item => {
                const margin = item.hargaJual > 0 ? ((item.hargaJual - item.hargaModal) / item.hargaJual * 100).toFixed(0) : 0;
                const statusColor = item.stokTersedia <= 0 ? 'badge-red' : item.stokTersedia <= 5 ? 'badge-amber' : 'badge-green';
                const suppliers = item.supplierList?.join(', ') || item.supplier || item.suplier || item.nama_suplier || '—';

                return (
                  <tr key={item.nama_barang}>
                    <td>
                      <span style={{ marginRight: 8 }}>{CAT_EMOJI[item.kategori] || '📦'}</span>
                      <span className="cell-main">{item.nama_barang}</span>
                    </td>
                    <td><span className="badge badge-violet">{item.kategori}</span></td>
                    <td><span className={`badge ${statusColor}`}>{item.stokTersedia} pcs</span></td>
                    <td className="cell-amount">{formatRp(item.hargaModal)}</td>
                    <td className="cell-amount cell-violet">{formatRp(item.hargaJual)}</td>
                    <td><span className={`badge ${parseInt(margin) >= 30 ? 'badge-green' : 'badge-amber'}`}>{margin}%</span></td>
                    <td className="cell-amount cell-sky">{formatRp(item.hargaModal * item.stokTersedia)}</td>
                    <td style={{ fontSize: 11 }}>{suppliers}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPrintModalItems([item])} title="Cetak Barcode / Label Harga">
                          <i className="fa-solid fa-barcode" style={{ color: 'var(--brand)' }} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit / Restock">
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => confirmDelete(item.nama_barang)} title="Hapus Barang">
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="mobile-cards-view">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-box-open" />
              <p>Produk tidak ditemukan.<br />Klik "Restock / Tambah" untuk mulai.</p>
            </div>
          ) : filtered.map(item => {
            const margin = item.hargaJual > 0 ? ((item.hargaJual - item.hargaModal) / item.hargaJual * 100).toFixed(0) : 0;
            const statusColor = item.stokTersedia <= 0 ? 'badge-red' : item.stokTersedia <= 5 ? 'badge-amber' : 'badge-green';
            const statusText = item.stokTersedia <= 0 ? 'Habis' : item.stokTersedia <= 5 ? `Sisa ${item.stokTersedia}` : `${item.stokTersedia} pcs`;
            const suppliers = item.supplierList?.join(', ') || item.supplier || item.suplier || item.nama_suplier || '—';

            return (
              <div key={item.nama_barang} className="stok-mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{CAT_EMOJI[item.kategori] || '📦'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama_barang}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge badge-violet">{item.kategori}</span>
                      <span className={`badge ${statusColor}`}>{statusText}</span>
                      <span className={`badge ${parseInt(margin) >= 30 ? 'badge-green' : 'badge-amber'}`}>{margin}% margin</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit / Restock" style={{ padding: '7px 10px' }}>
                      <i className="fa-solid fa-pen-to-square" /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => confirmDelete(item.nama_barang)} title="Hapus Barang" style={{ padding: '7px 10px' }}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>
                  <div>
                    <span style={{ color: '#475569', fontSize: 10, display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>HARGA MODAL</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{formatRp(item.hargaModal)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#475569', fontSize: 10, display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>HARGA JUAL</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--brand)' }}>{formatRp(item.hargaJual)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#475569', fontSize: 10, display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>NILAI STOK</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--sky)' }}>{formatRp(item.hargaModal * item.stokTersedia)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#475569', fontSize: 10, display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>SUPPLIER</span>
                    <span style={{ fontWeight: 600, fontSize: 11, color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏭 {suppliers}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restock Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-box-archive" style={{ color: 'var(--brand)' }} />
                {editItem ? `Edit: ${editItem}` : 'Input Restock / Barang Baru'}
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tanggal Pembelian</label>
                    <input type="date" className="form-input" name="r_date" value={form.r_date} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nama Supplier</label>
                    <select 
                      className="form-input" 
                      name="r_supplier" 
                      value={form.r_supplier} 
                      onChange={handleFormChange}
                    >
                      <option value="">Pilih Supplier</option>
                      {(appData.suppliers || []).map(sup => (
                        <option key={sup.id || sup.nama} value={sup.nama}>{sup.nama} - {sup.kontak}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!editItem && (
                  <div style={{ background: 'var(--sky-dim)', border: '1px solid rgba(2,132,199,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--sky)' }}>
                        <i className="fa-solid fa-layer-group" /> Input banyak item satu supplier
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tanggal dan supplier di atas dipakai untuk semua barang.</div>
                    </div>
                    <button
                      type="button"
                      className={`btn ${batchMode ? 'btn-purple' : 'btn-ghost'} btn-sm`}
                      onClick={() => setBatchMode(v => !v)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {batchMode ? 'Mode Banyak' : 'Aktifkan'}
                    </button>
                  </div>
                )}
                {batchMode && !editItem ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {batchRows.map((row, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-hover)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Item #{idx + 1}</div>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeBatchRow(idx)} disabled={batchRows.length === 1}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                        <div className="form-grid form-grid-2" style={{ marginBottom: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Nama Barang</label>
                            <input
                              className="form-input"
                              list={form.r_supplier ? `supplier-product-options-${idx}` : undefined}
                              value={row.name}
                              onChange={e => {
                                const nextValue = e.target.value;
                                updateBatchRow(idx, 'name', nextValue);
                                const selectedItem = findExistingProduct(form.r_supplier, nextValue);
                                if (selectedItem) {
                                  updateBatchRow(idx, 'category', selectedItem.kategori || row.category);
                                  updateBatchRow(idx, 'cost', String(selectedItem.hargaModal ?? row.cost));
                                  updateBatchRow(idx, 'price', String(selectedItem.hargaJual ?? row.price));
                                  updateBatchRow(idx, 'minGrosir', selectedItem.minQtyGrosir ? String(selectedItem.minQtyGrosir) : row.minGrosir);
                                  updateBatchRow(idx, 'priceGrosir', selectedItem.hargaGrosir ? String(selectedItem.hargaGrosir) : row.priceGrosir);
                                  updateBatchRow(idx, 'variants', selectedItem.variasiText || row.variants);
                                  updateBatchRow(idx, 'imageUrl', selectedItem.imageUrl || row.imageUrl);
                                }
                              }}
                              placeholder="Nama produk..."
                            />
                            {form.r_supplier && supplierProductOptions.length > 0 && (
                              <datalist id={`supplier-product-options-${idx}`}>
                                {supplierProductOptions.map(option => (
                                  <option key={option} value={option} />
                                ))}
                              </datalist>
                            )}
                          </div>
                          <div className="form-group">
                            <label className="form-label">Kategori</label>
                            <select className="form-input" value={row.category} onChange={e => updateBatchRow(idx, 'category', e.target.value)}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="form-grid form-grid-3" style={{ marginBottom: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Qty</label>
                            <input type="number" className="form-input" min="0" value={row.qty} onChange={e => updateBatchRow(idx, 'qty', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Modal / Unit</label>
                            <input type="number" className="form-input" min="0" value={row.cost} onChange={e => updateBatchRow(idx, 'cost', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Jual / Unit</label>
                            <input type="number" className="form-input" min="0" value={row.price} onChange={e => updateBatchRow(idx, 'price', e.target.value)} />
                          </div>
                        </div>
                        <div className="form-grid form-grid-2" style={{ marginBottom: 10 }}>
                          <div className="form-group">
                            <label className="form-label">Min Grosir</label>
                            <input type="number" className="form-input" min="2" value={row.minGrosir} onChange={e => updateBatchRow(idx, 'minGrosir', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Harga Grosir</label>
                            <input type="number" className="form-input" min="0" value={row.priceGrosir} onChange={e => updateBatchRow(idx, 'priceGrosir', e.target.value)} />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Variasi / Foto URL</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input className="form-input" value={row.variants} onChange={e => updateBatchRow(idx, 'variants', e.target.value)} placeholder="S, M, Hitam..." />
                            <input className="form-input" value={row.imageUrl} onChange={e => updateBatchRow(idx, 'imageUrl', e.target.value)} placeholder="https://foto..." />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addBatchRow}>
                      <i className="fa-solid fa-plus" /> Tambah Baris Item
                    </button>
                  </div>
                ) : (
                  <>
                <div className="form-group">
                  <label className="form-label">Nama Barang / Produk</label>
                  <input
                    type="text"
                    className="form-input"
                    name="r_name"
                    value={form.r_name}
                    onChange={handleFormChange}
                    list={form.r_supplier && supplierProductOptions.length ? 'supplier-product-options' : undefined}
                    required
                    placeholder={form.r_supplier ? 'Pilih atau ketik nama barang...' : 'Gamis Silk Premium...'}
                    readOnly={!!editItem}
                  />
                  {form.r_supplier && supplierProductOptions.length > 0 && (
                    <datalist id="supplier-product-options">
                      {supplierProductOptions.map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select className="form-input" name="r_category" value={form.r_category} onChange={handleFormChange}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jumlah Tambah (Qty)</label>
                    <input type="number" className="form-input" name="r_qty" value={form.r_qty} onChange={handleFormChange} min="0" placeholder="0 = hanya update harga" />
                  </div>
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Harga Modal / Unit (Rp)</label>
                    <input type="number" className="form-input" name="r_cost" value={form.r_cost} onChange={handleFormChange} min="0" placeholder="100000" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Jual / Unit (Rp)</label>
                    <input type="number" className="form-input" name="r_price" value={form.r_price} onChange={handleFormChange} min="0" placeholder="150000" required />
                  </div>
                </div>
                {/* ═══ HARGA GROSIR (OPSIONAL) ═══ */}
                <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
                    <i className="fa-solid fa-tags" /> Harga Grosir Otomatis (Opsional)
                  </div>
                  <div className="form-grid form-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Min. Pembelian Grosir (Qty)</label>
                      <input type="number" className="form-input" name="r_min_grosir" value={form.r_min_grosir} onChange={handleFormChange} placeholder="Misal: 3" min="2" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Harga Grosir Per Unit (Rp)</label>
                      <input type="number" className="form-input" name="r_price_grosir" value={form.r_price_grosir} onChange={handleFormChange} placeholder="Misal: 135000" min="0" />
                    </div>
                  </div>
                </div>
                {/* ═══ VARIASI PRODUK (INTERAKTIF UKURAN & WARNA) ═══ */}
                <div style={{ background: 'var(--brand-dim)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-palette" /> Variasi Produk (Ukuran & Warna)
                  </div>

                  {/* Quick Sizes */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>📐 Pilih Ukuran Cepat:</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {QUICK_SIZES.map(size => {
                        const active = activeVariants.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggleVariantItem(size)}
                            style={{
                              padding: '3px 9px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: active ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                              background: active ? 'var(--brand)' : '#fff',
                              color: active ? '#fff' : 'var(--text-primary)',
                              transition: '.12s'
                            }}
                          >
                            {active ? '✓ ' : ''}{size}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Colors */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>🎨 Pilih Warna Cepat:</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {QUICK_COLORS.map(color => {
                        const active = activeVariants.includes(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => toggleVariantItem(color)}
                            style={{
                              padding: '3px 9px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: active ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                              background: active ? 'var(--brand)' : '#fff',
                              color: active ? '#fff' : 'var(--text-primary)',
                              transition: '.12s'
                            }}
                          >
                            {active ? '✓ ' : ''}{color}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Input Size / Color */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: 11, padding: '4px 8px', height: 30 }}
                      placeholder="+ Ukuran / Warna Lain (misal: LLL, Dusty Pink...)"
                      value={customVariantInput}
                      onChange={e => setCustomVariantInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomVariant(); } }}
                    />
                    <button type="button" className="btn btn-purple btn-sm" onClick={addCustomVariant} style={{ height: 30, fontSize: 11, padding: '0 10px', whiteSpace: 'nowrap' }}>
                      <i className="fa-solid fa-plus" /> Tambah
                    </button>
                  </div>

                  {/* Selected Chips */}
                  {activeVariants.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                      <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700 }}>Terpilih ({activeVariants.length}):</span>
                      {activeVariants.map(v => (
                        <span
                          key={v}
                          onClick={() => toggleVariantItem(v)}
                          style={{
                            background: '#fff',
                            border: '1px solid var(--brand)',
                            color: 'var(--brand)',
                            borderRadius: 99,
                            padding: '2px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Klik untuk hapus"
                        >
                          {v} <i className="fa-solid fa-xmark" style={{ fontSize: 9 }} />
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Textarea edit manual */}
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      name="r_variants"
                      value={form.r_variants}
                      onChange={handleFormChange}
                      placeholder="Atau ketik manual pisahkan koma: S, M, L, XL, LLL..."
                      style={{ fontSize: 11, padding: '4px 8px', height: 28, background: '#fff' }}
                    />
                  </div>
                </div>
                {form.r_cost && form.r_price && (
                  <div style={{ background: 'var(--emerald-dim)', border: '1px solid rgba(5,150,105,.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--emerald)' }}>
                    <i className="fa-solid fa-chart-line" /> Margin:{' '}
                    <b>{form.r_price > 0 ? (((form.r_price - form.r_cost) / form.r_price) * 100).toFixed(1) : 0}%</b>
                    {' '} | Laba/unit: <b>{formatRp(form.r_price - form.r_cost)}</b>
                    {form.r_qty ? <> | Total modal: <b>{formatRp(form.r_cost * form.r_qty)}</b></> : ''}
                  </div>
                )}

                {/* ═══ FOTO PRODUK ═══ */}
                <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginTop: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    <i className="fa-solid fa-image" style={{ color: 'var(--brand)', marginRight: 6 }} />
                    Foto Produk (ditampilkan di E-Katalog)
                  </div>

                  {/* Preview foto jika sudah ada URL */}
                  {form.r_image_url && (
                    <div style={{ marginBottom: 10, textAlign: 'center', position: 'relative' }}>
                      <img
                        src={form.r_image_url}
                        alt="Preview"
                        style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }}
                        onError={e => e.target.style.display = 'none'}
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, r_image_url: '' }))}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 99, width: 22, height: 22, fontSize: 10, cursor: 'pointer' }}
                        title="Hapus foto"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  )}

                  {/* Upload dari perangkat */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>
                      📤 Upload dari HP: Foto produk → Share → copy link → paste di bawah
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Atau upload ke <b>imgbb.com</b> / <b>postimages.org</b> → copy link langsung
                    </div>
                  </div>

                  {/* Atau paste URL langsung */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>
                      🔗 Atau tempel URL foto dari internet:
                    </div>
                    <input
                      type="url"
                      className="form-input"
                      name="r_image_url"
                      value={form.r_image_url}
                      onChange={handleFormChange}
                      placeholder="https://contoh.com/foto-produk.jpg"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>

                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-purple">
                  <i className="fa-solid fa-floppy-disk" /> Simpan & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteConfirmItem(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Konfirmasi Hapus Produk
              </div>
              <button className="modal-close" onClick={() => setDeleteConfirmItem(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-main)', marginBottom: 12 }}>
                Apakah Anda yakin ingin menghapus produk <b style={{ color: 'var(--brand-light)' }}>"{deleteConfirmItem}"</b> dari daftar stok barang?
              </p>
              <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(225,29,72,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--rose)' }}>
                <i className="fa-solid fa-shield-halved" /> <b>Catatan:</b> Produk akan dihapus dari katalog stok. Riwayat penjualan barang ini di Laporan Keuangan akan tetap tersimpan aman.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirmItem(null)}>
                Batal
              </button>
              <button type="button" className="btn btn-danger" onClick={executeDelete} id="btn-confirm-delete">
                <i className="fa-solid fa-trash" /> Ya, Hapus Produk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Label & Barcode Modal */}
      {printModalItems && (
        <LabelPrintModal
          items={printModalItems}
          storeName={appData.settings?.storeName || 'Melan Jaya'}
          onClose={() => setPrintModalItems(null)}
        />
      )}
    </div>
  );
};

export default StokPage;
