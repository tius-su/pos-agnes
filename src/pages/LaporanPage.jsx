import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const formatRpShort = v => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}rb`;
  return String(v);
};

const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

const LaporanPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [preset, setPreset] = useState('today');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Edit & Delete state
  const [editTrx, setEditTrx] = useState(null);     // transaksi yang sedang diedit
  const [editForm, setEditForm] = useState({});      // form state edit
  const [deleteTrx, setDeleteTrx] = useState(null); // transaksi yang akan dihapus
  const [saving, setSaving] = useState(false);

  const getRange = () => {
    const today = new Date();
    if (preset === 'today') {
      const d = isoDate(today);
      return { start: d, end: d };
    }
    if (preset === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const d = isoDate(y);
      return { start: d, end: d };
    }
    if (preset === 'week') {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      return { start: isoDate(w), end: isoDate(today) };
    }
    if (preset === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: isoDate(m), end: isoDate(today) };
    }
    if (preset === 'custom') return { start: dateStart, end: dateEnd };
    return { start: '', end: '' };
  };

  const { start, end } = getRange();

  const filteredSales = useMemo(() => {
    return (appData.penjualan || []).filter(t => {
      if (!start && !end) return true;
      return t.tanggal >= start && t.tanggal <= end;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.waktu?.localeCompare(a.waktu || ''));
  }, [appData.penjualan, start, end]);

  const filteredBuys = useMemo(() => {
    return (appData.pembelian || []).filter(t => {
      if (!start && !end) return true;
      return t.tanggal >= start && t.tanggal <= end;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [appData.pembelian, start, end]);

  const totalOmset = filteredSales.reduce((s, t) => s + t.totalPenjualan, 0);
  const totalModal = filteredSales.reduce((s, t) => s + t.totalModal, 0);
  const totalLaba = filteredSales.reduce((s, t) => s + t.laba, 0);
  const totalBeli = filteredBuys.reduce((s, t) => s + t.totalModal, 0);
  const marginPct = totalOmset > 0 ? ((totalLaba / totalOmset) * 100).toFixed(1) : 0;

  const chartData = useMemo(() => {
    const byDate = {};
    filteredSales.forEach(t => {
      if (!byDate[t.tanggal]) byDate[t.tanggal] = { tanggal: t.tanggal, omset: 0, laba: 0, trx: 0 };
      byDate[t.tanggal].omset += t.totalPenjualan;
      byDate[t.tanggal].laba += t.laba;
      byDate[t.tanggal].trx += 1;
    });
    return Object.values(byDate).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [filteredSales]);

  // ── OPEN EDIT MODAL ──────────────────────────────────────────────────
  const openEdit = (trx) => {
    setEditTrx(trx);
    setEditForm({
      pelanggan: trx.pelanggan || '',
      noWa: trx.noWa || '',
      tanggal: trx.tanggal || '',
      waktu: trx.waktu || '',
      metodeBayar: trx.metodeBayar || 'Tunai',
      items: (trx.items || []).map(i => ({ ...i })),
    });
  };

  // ── UPDATE ITEM PRICE IN EDIT FORM ───────────────────────────────────
  const updateEditItemPrice = (idx, newPrice) => {
    setEditForm(prev => {
      const items = prev.items.map((it, i) =>
        i === idx ? { ...it, hargaJual: Math.max(0, parseFloat(newPrice) || 0), subtotal: Math.max(0, parseFloat(newPrice) || 0) * it.jumlah } : it
      );
      return { ...prev, items };
    });
  };

  // ── SAVE EDIT ────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editTrx) return;
    setSaving(true);
    try {
      const updatedItems = editForm.items.map(it => ({
        ...it,
        subtotal: it.hargaJual * it.jumlah,
      }));
      const totalPenjualan = updatedItems.reduce((s, i) => s + i.subtotal, 0);
      const totalModalTrx = updatedItems.reduce((s, i) => s + (i.hargaModal || 0) * i.jumlah, 0);
      const laba = totalPenjualan - totalModalTrx;

      const newPenjualan = (appData.penjualan || []).map(t =>
        t.id === editTrx.id
          ? {
              ...t,
              pelanggan: editForm.pelanggan || 'Umum',
              noWa: editForm.noWa,
              tanggal: editForm.tanggal,
              waktu: editForm.waktu,
              metodeBayar: editForm.metodeBayar,
              items: updatedItems,
              totalPenjualan,
              totalModal: totalModalTrx,
              laba,
            }
          : t
      );
      await saveAndSync({ ...appData, penjualan: newPenjualan });
      toast('✅ Transaksi berhasil diperbarui!', 'success');
      setEditTrx(null);
    } catch (e) {
      toast('Gagal menyimpan perubahan', 'error');
    }
    setSaving(false);
  };

  // ── DELETE TRANSACTION ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTrx) return;
    setSaving(true);
    try {
      // Restore stok dari item yang dihapus
      const newStok = (appData.stok || []).map(s => {
        const sold = (deleteTrx.items || []).find(i => i.barang === s.nama_barang);
        if (!sold) return s;
        return { ...s, stokTersedia: s.stokTersedia + sold.jumlah };
      });
      const newPenjualan = (appData.penjualan || []).filter(t => t.id !== deleteTrx.id);
      await saveAndSync({ ...appData, stok: newStok, penjualan: newPenjualan });
      toast(`🗑️ Transaksi ${deleteTrx.kodeTrx} berhasil dihapus & stok dikembalikan`, 'success');
      setDeleteTrx(null);
    } catch (e) {
      toast('Gagal menghapus transaksi', 'error');
    }
    setSaving(false);
  };

  // ── SHARE / EXPORT ───────────────────────────────────────────────────
  const shareReportWA = () => {
    const s = appData.settings;
    let msg = `*LAPORAN PENJUALAN — ${s.storeName || 'Agnes Fashion'}*\n`;
    msg += `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}\n`;
    msg += `────────────────────\n`;
    msg += `💰 Omset     : ${formatRp(totalOmset)}\n`;
    msg += `📦 Modal Beli: ${formatRp(totalModal)}\n`;
    msg += `✅ Laba Bersih: ${formatRp(totalLaba)} (${marginPct}%)\n`;
    msg += `🧾 Transaksi : ${filteredSales.length} trx\n`;
    msg += `────────────────────\n`;
    msg += `Dikirim dari Agnes Fashion POS`;
    const no = (s.storePhone || '').replace(/\D/g, '');
    const url = no ? `https://wa.me/${no}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const exportCSV = () => {
    let csv = 'Kode TRX,Tanggal,Waktu,Pelanggan,Metode,Omset,Modal,Laba\n';
    filteredSales.forEach(t => {
      csv += `${t.kodeTrx},${t.tanggal},${t.waktu || ''},${t.pelanggan || ''},${t.metodeBayar},${t.totalPenjualan},${t.totalModal},${t.laba}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `laporan-agnes-${start || 'semua'}.csv`; a.click();
    toast('File CSV berhasil diunduh', 'success');
  };

  const setPresetBtn = (p) => { setPreset(p); };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {formatRp(p.value)}
          </div>
        ))}
      </div>
    );
  };

  // ── COMPUTED EDIT TOTALS ─────────────────────────────────────────────
  const editTotal = editForm.items?.reduce((s, i) => s + i.hargaJual * i.jumlah, 0) || 0;
  const editModal = editForm.items?.reduce((s, i) => s + (i.hargaModal || 0) * i.jumlah, 0) || 0;
  const editLaba  = editTotal - editModal;

  return (
    <div className="tab-page active fade-up">
      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Total Omset</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatRp(totalOmset)}</div>
          <div className="stat-meta">{filteredSales.length} transaksi</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-box" />
          <div className="stat-label">Total Modal</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatRp(totalModal)}</div>
          <div className="stat-meta">HPP penjualan</div>
        </div>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-chart-line" />
          <div className="stat-label">Laba Bersih</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatRp(totalLaba)}</div>
          <div className="stat-meta">Margin {marginPct}%</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-truck" />
          <div className="stat-label">Total Pembelian</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatRp(totalBeli)}</div>
          <div className="stat-meta">{filteredBuys.length} restock</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-area" /> Grafik Omset &amp; Laba</div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOmset" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLaba" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tickFormatter={formatRpShort} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="omset" name="Omset" stroke="#7c3aed" fill="url(#gradOmset)" strokeWidth={2} />
                <Area type="monotone" dataKey="laba" name="Laba" stroke="#059669" fill="url(#gradLaba)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Penjualan Table */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-receipt" /> Riwayat Penjualan</div>
            <div className="card-subtitle">{filteredSales.length} transaksi ditemukan</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="date-filter-bar">
          {[['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini'],['all','Semua']].map(([p,l]) => (
            <button key={p} className={`date-preset-btn${preset === p ? ' active' : ''}`} onClick={() => setPresetBtn(p)}>{l}</button>
          ))}
          <button className={`date-preset-btn${preset === 'custom' ? ' active' : ''}`} onClick={() => setPresetBtn('custom')}>Custom</button>
          {preset === 'custom' && (
            <div className="date-range-inputs">
              <span>Dari</span>
              <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="report-actions">
          <button className="btn btn-purple btn-sm" onClick={shareReportWA}>
            <i className="fa-brands fa-whatsapp" /> Share via WhatsApp
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
            <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode TRX</th>
                <th>Tanggal &amp; Jam</th>
                <th>Pelanggan</th>
                <th>Item</th>
                <th>Metode</th>
                <th>Omset</th>
                <th>Laba</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <i className="fa-solid fa-receipt" />
                    <p>Belum ada transaksi di periode ini.</p>
                  </div>
                </td></tr>
              ) : filteredSales.map(t => (
                <tr key={t.id}>
                  <td className="cell-main" style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.kodeTrx}</td>
                  <td>{t.tanggal}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.waktu}</span></td>
                  <td>
                    {t.pelanggan || '—'}
                    {t.noWa && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.noWa}</div>}
                  </td>
                  <td>
                    {(t.items || []).map((i, ix) => (
                      <div key={ix} style={{ fontSize: 11 }}>{i.barang} ×{i.jumlah}</div>
                    ))}
                  </td>
                  <td><span className="badge badge-violet">{t.metodeBayar}</span></td>
                  <td className="cell-amount cell-green">{formatRp(t.totalPenjualan)}</td>
                  <td className="cell-amount cell-violet">{formatRp(t.laba)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Edit Transaksi"
                        onClick={() => openEdit(t)}
                        style={{ padding: '4px 8px' }}
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        title="Hapus Transaksi"
                        onClick={() => setDeleteTrx(t)}
                        style={{ padding: '4px 8px' }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pembelian Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-truck-ramp-box" /> Riwayat Pembelian &amp; Restock</div>
            <div className="card-subtitle">{filteredBuys.length} restock ditemukan</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Supplier</th>
                <th>Barang</th>
                <th>Kategori</th>
                <th>Qty</th>
                <th>Harga Modal</th>
                <th>Total Modal</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuys.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <i className="fa-solid fa-truck" />
                    <p>Belum ada restock di periode ini.</p>
                  </div>
                </td></tr>
              ) : filteredBuys.map(t => (
                <tr key={t.id}>
                  <td>{t.tanggal}</td>
                  <td className="cell-main">{t.supplier || '—'}</td>
                  <td>{t.barang}</td>
                  <td><span className="badge badge-sky">{t.kategori || '—'}</span></td>
                  <td><b>{t.jumlah}</b> pcs</td>
                  <td className="cell-amount">{formatRp(t.hargaModal)}</td>
                  <td className="cell-amount cell-amber">{formatRp(t.totalModal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══════════════════════════════════════════════════ */}
      {editTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setEditTrx(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--brand)' }} />
                Edit Transaksi — <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{editTrx.kodeTrx}</span>
              </div>
              <button className="modal-close" onClick={() => setEditTrx(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Info pelanggan */}
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan</label>
                  <input
                    className="form-input"
                    value={editForm.pelanggan}
                    onChange={e => setEditForm(f => ({ ...f, pelanggan: e.target.value }))}
                    placeholder="Umum"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">No WhatsApp</label>
                  <input
                    className="form-input"
                    value={editForm.noWa}
                    onChange={e => setEditForm(f => ({ ...f, noWa: e.target.value }))}
                    placeholder="0812..."
                  />
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.tanggal}
                    onChange={e => setEditForm(f => ({ ...f, tanggal: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Metode Bayar</label>
                  <select
                    className="form-input"
                    value={editForm.metodeBayar}
                    onChange={e => setEditForm(f => ({ ...f, metodeBayar: e.target.value }))}
                  >
                    {['Tunai', 'Transfer', 'QRIS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Items — editable harga jual */}
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Item Terjual</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(editForm.items || []).map((it, idx) => (
                    <div key={idx} style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{it.barang}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: {it.jumlah} pcs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Harga/pcs:</label>
                        <input
                          type="number"
                          className="form-input"
                          value={it.hargaJual}
                          onChange={e => updateEditItemPrice(idx, e.target.value)}
                          style={{ width: 110, fontSize: 13, fontWeight: 700, padding: '5px 8px', color: 'var(--brand)' }}
                          min="0"
                        />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)', minWidth: 90, textAlign: 'right' }}>
                        = {formatRp(it.hargaJual * it.jumlah)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary recalculated */}
              <div style={{ background: 'var(--brand-dim)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Omset</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{formatRp(editTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Modal</span>
                  <span style={{ fontWeight: 600 }}>{formatRp(editModal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 700 }}>Laba Bersih</span>
                  <span style={{ fontWeight: 800, color: editLaba >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>{formatRp(editLaba)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditTrx(null)} disabled={saving}>Batal</button>
              <button className="btn btn-purple" onClick={handleSaveEdit} disabled={saving} style={{ flex: 1 }}>
                {saving
                  ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                  : <><i className="fa-solid fa-floppy-disk" /> Simpan Perubahan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM MODAL ═════════════════════════════════════════ */}
      {deleteTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteTrx(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Hapus Transaksi?
              </div>
              <button className="modal-close" onClick={() => setDeleteTrx(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 12 }}>
                Yakin ingin menghapus transaksi{' '}
                <b style={{ color: 'var(--brand)', fontFamily: 'monospace' }}>{deleteTrx.kodeTrx}</b>?
              </p>

              {/* Detail transaksi */}
              <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pelanggan</span>
                  <span style={{ fontWeight: 600 }}>{deleteTrx.pelanggan || 'Umum'}</span>
                </div>
                <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tanggal</span>
                  <span style={{ fontWeight: 600 }}>{deleteTrx.tanggal} {deleteTrx.waktu}</span>
                </div>
                <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total</span>
                  <span style={{ fontWeight: 700, color: 'var(--emerald)' }}>{formatRp(deleteTrx.totalPenjualan)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  {(deleteTrx.items || []).map((i, ix) => (
                    <div key={ix}>{i.barang} ×{i.jumlah} → {formatRp(i.subtotal)}</div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <i className="fa-solid fa-rotate-left" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>Stok barang yang terjual akan <b>dikembalikan otomatis</b> ke daftar stok.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTrx(null)} disabled={saving}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving} style={{ flex: 1 }}>
                {saving
                  ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menghapus...</>
                  : <><i className="fa-solid fa-trash" /> Ya, Hapus Transaksi</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanPage;
