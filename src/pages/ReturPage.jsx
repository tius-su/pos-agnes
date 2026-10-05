import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { isoDate } from '../services/dataSync';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

const ReturPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [search, setSearch] = useState('');
  const [selectedTrx, setSelectedTrx] = useState(null);
  const [returItems, setReturItems] = useState([]);
  const [alasan, setAlasan] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('proses');
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart]   = useState('');
  const [dateEnd, setDateEnd]       = useState('');

  const getRange = () => {
    const today = new Date();
    if (datePreset === 'today')     { const d = isoDate(today); return { start: d, end: d }; }
    if (datePreset === 'yesterday') { const y = new Date(today); y.setDate(y.getDate()-1); const d = isoDate(y); return { start: d, end: d }; }
    if (datePreset === 'week')      { const w = new Date(today); w.setDate(w.getDate()-6); return { start: isoDate(w), end: isoDate(today) }; }
    if (datePreset === 'month')     { const m = new Date(today.getFullYear(), today.getMonth(), 1); return { start: isoDate(m), end: isoDate(today) }; }
    if (datePreset === 'year')      { return { start: `${today.getFullYear()}-01-01`, end: isoDate(today) }; }
    if (datePreset === 'custom')    { return { start: dateStart, end: dateEnd }; }
    return { start: '', end: '' };
  };
  const { start, end } = getRange();

  const penjualan = appData.penjualan || [];
  const returHistory = appData.retur || [];

  // Filter transaksi untuk retur
  const filteredTrx = useMemo(() => {
    return penjualan.filter(t => {
      const sTerm = search.toLowerCase().trim();
      const trxDate = t.tanggal || '';
      const matchSearch = !sTerm ||
        (t.kodeTrx && t.kodeTrx.toLowerCase().includes(sTerm)) ||
        (t.pelanggan && t.pelanggan.toLowerCase().includes(sTerm)) ||
        trxDate.includes(sTerm);
      const matchDate = (!start && !end) ||
        (start && !end && trxDate >= start) ||
        (!start && end && trxDate <= end) ||
        (trxDate >= start && trxDate <= end);
      return matchSearch && matchDate;
    }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.waktu || '').localeCompare(a.waktu || ''));
  }, [penjualan, search, start, end]);

  // Filter riwayat retur by date
  const filteredRetur = useMemo(() => {
    return returHistory.filter(r => {
      if (!start && !end) return true;
      const returDate = r.tanggal || '';
      if (start && !end) return returDate >= start;
      if (!start && end) return returDate <= end;
      return returDate >= start && returDate <= end;
    }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  }, [returHistory, start, end]);

  const openRetur = (trx) => {
    setSelectedTrx(trx);
    setReturItems((trx.items || []).map(i => ({
      ...i,
      returQty: 0,
      maxQty: i.jumlah,
    })));
    setAlasan('');
  };

  const updateReturQty = (idx, val) => {
    setReturItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const qty = Math.min(Math.max(0, parseInt(val) || 0), it.maxQty);
      return { ...it, returQty: qty };
    }));
  };

  const totalRetur = returItems.reduce((s, i) => s + i.hargaJual * i.returQty, 0);
  const hasRetur = returItems.some(i => i.returQty > 0);

  const handleProses = async () => {
    if (!selectedTrx) { toast('Pilih transaksi yang akan diretur', 'error'); return; }
    if (!hasRetur) { toast('Pilih minimal 1 item untuk diretur', 'error'); return; }
    if (!alasan.trim()) { toast('Alasan retur wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const returData = {
        id: Date.now(),
        idTrxAsli: selectedTrx.id,
        kodeTrxAsli: selectedTrx.kodeTrx,
        tanggal: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-'),
        waktu: new Date().toLocaleTimeString('id-ID'),
        pelanggan: selectedTrx.pelanggan || 'Umum',
        alasan,
        items: returItems.filter(i => i.returQty > 0).map(i => ({
          barang: i.barang,
          jumlah: i.returQty,
          hargaJual: i.hargaJual,
          subtotal: i.hargaJual * i.returQty,
        })),
        totalRetur,
      };

      // Restore stok
      const newStok = (appData.stok || []).map(s => {
        const ret = returItems.find(i =>
          i.returQty > 0 &&
          (i.barang === s.nama_barang || i.originalName === s.nama_barang || (i.barang && i.barang.startsWith(s.nama_barang)))
        );
        if (!ret) return s;
        return { ...s, stokTersedia: s.stokTersedia + ret.returQty };
      });

      // Kurangi total transaksi asal (tandai retur)
      const newPenjualan = (appData.penjualan || []).map(t => {
        if (t.id !== selectedTrx.id) return t;
        return { ...t, hasRetur: true, returId: returData.id };
      });

      await saveAndSync({
        ...appData,
        stok: newStok,
        penjualan: newPenjualan,
        retur: [...(appData.retur || []), returData],
      });

      toast(`✅ Retur berhasil! ${formatRp(totalRetur)} — stok dikembalikan`, 'success');
      setSelectedTrx(null);
      setTab('riwayat');
    } catch (e) {
      toast('Gagal memproses retur', 'error');
    }
    setSaving(false);
  };

  const totalReturSemua = returHistory.reduce((s, r) => s + r.totalRetur, 0);

  const PRESET_BTNS = [['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini'],['year','Tahun Ini'],['all','Semua'],['custom','Custom']];

  return (
    <div className="tab-page active fade-up">

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="stat-card rose">
          <i className="stat-icon fa-solid fa-rotate-left" />
          <div className="stat-label">Total Retur</div>
          <div className="stat-value">{returHistory.length}</div>
          <div className="stat-meta">kasus retur</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Nilai Retur</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalReturSemua)}</div>
          <div className="stat-meta">total dikembalikan</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-boxes-stacked" />
          <div className="stat-label">Item Diretur</div>
          <div className="stat-value">{returHistory.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.jumlah, 0), 0)}</div>
          <div className="stat-meta">pcs dikembalikan</div>
        </div>
      </div>

      {/* Filter Date + Tab */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ padding: '12px 16px' }}>
          <div className="card-title"><i className="fa-solid fa-calendar-days" /> Filter Periode</div>
        </div>
        <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_BTNS.map(([p,l]) => (
            <button key={p} className={`date-preset-btn${datePreset === p ? ' active' : ''}`} onClick={() => setDatePreset(p)}>{l}</button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="date-range-inputs" style={{ padding: '0 16px 12px' }}>
            <span>Dari</span>
            <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            <span>–</span>
            <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        )}
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['proses', 'fa-plus-circle', 'Proses Retur'], ['riwayat', 'fa-clock-rotate-left', 'Riwayat Retur']].map(([key, icon, label]) => (
          <button key={key} type="button" className={`btn ${tab === key ? 'btn-purple' : 'btn-ghost'} btn-sm`} onClick={() => setTab(key)}>
            <i className={`fa-solid ${icon}`} /> {label}
          </button>
        ))}
      </div>

      {tab === 'proses' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-magnifying-glass" /> Cari Transaksi</div>
          </div>
          <div style={{ padding: '8px 16px 12px' }}>
            <div className="form-input-icon">
              <i className="fa-solid fa-search" />
              <input className="form-input" placeholder="Cari kode TRX, nama pelanggan, tanggal..." value={search} onChange={e => setSearch(e.target.value)} id="retur-search" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Kode TRX</th><th>Tanggal</th><th>Pelanggan</th><th>Item</th><th>Total</th><th style={{ textAlign: 'center' }}>Aksi</th></tr>
              </thead>
              <tbody>
                {filteredTrx.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-receipt" /><p>Tidak ada transaksi ditemukan.</p></div></td></tr>
                ) : filteredTrx.slice(0, 20).map(t => (
                  <tr key={t.id}>
                    <td className="cell-main" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {t.kodeTrx}
                      {t.hasRetur && <span className="badge badge-amber" style={{ fontSize: 9, marginLeft: 4 }}>Retur</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{t.tanggal}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.waktu}</span></td>
                    <td>{t.pelanggan || 'Umum'}</td>
                    <td style={{ fontSize: 11 }}>{(t.items || []).map(i => `${i.barang}×${i.jumlah}`).join(', ')}</td>
                    <td className="cell-amount cell-green">{formatRp(t.totalPenjualan)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openRetur(t)} style={{ padding: '4px 10px' }}>
                        <i className="fa-solid fa-rotate-left" /> Retur
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-clock-rotate-left" /> Riwayat Retur</div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Tanggal</th><th>TRX Asal</th><th>Pelanggan</th><th>Alasan</th><th>Item Retur</th><th>Nilai Retur</th></tr>
              </thead>
              <tbody>
                {filteredRetur.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-rotate-left" /><p>Belum ada retur di periode ini.</p></div></td></tr>
                ) : filteredRetur.map(r => (
                  <tr key={r.id}>
                    <td>{r.tanggal}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.waktu}</span></td>
                    <td className="cell-main" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.kodeTrxAsli}</td>
                    <td>{r.pelanggan}</td>
                    <td style={{ fontSize: 12 }}>{r.alasan}</td>
                    <td style={{ fontSize: 11 }}>{r.items.map(i => `${i.barang}×${i.jumlah}`).join(', ')}</td>
                    <td className="cell-amount" style={{ color: 'var(--rose)', fontWeight: 800 }}>-{formatRp(r.totalRetur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ RETUR MODAL ══════════════════════════════════════════════ */}
      {selectedTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setSelectedTrx(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="fa-solid fa-rotate-left" style={{ color: 'var(--amber)' }} /> Proses Retur — <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{selectedTrx.kodeTrx}</span></div>
              <button className="modal-close" onClick={() => setSelectedTrx(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Info */}
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                <b>{selectedTrx.pelanggan || 'Umum'}</b> · {selectedTrx.tanggal} · {selectedTrx.metodeBayar}
              </div>

              {/* Items */}
              <div className="form-label">Pilih Item & Jumlah yang Diretur:</div>
              {returItems.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{it.barang}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dibeli: {it.maxQty} pcs · {formatRp(it.hargaJual)}/pcs</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Retur:</label>
                    <input type="number" className="form-input" style={{ width: 60, textAlign: 'center', fontSize: 13, fontWeight: 700, padding: '4px 6px' }} min="0" max={it.maxQty} value={it.returQty} onChange={e => updateReturQty(idx, e.target.value)} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {it.maxQty}</span>
                  </div>
                  {it.returQty > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rose)', minWidth: 80, textAlign: 'right' }}>-{formatRp(it.hargaJual * it.returQty)}</span>
                  )}
                </div>
              ))}

              {/* Alasan */}
              <div className="form-group">
                <label className="form-label">Alasan Retur *</label>
                <input className="form-input" placeholder="Barang rusak / ukuran tidak sesuai / dll..." value={alasan} onChange={e => setAlasan(e.target.value)} id="retur-alasan" />
              </div>

              {/* Total */}
              {totalRetur > 0 && (
                <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(225,29,72,.2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>Total Nilai Retur</span>
                    <span style={{ fontWeight: 800, color: 'var(--rose)', fontSize: 16 }}>{formatRp(totalRetur)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Stok item yang dipilih akan dikembalikan otomatis</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedTrx(null)} disabled={saving}>Batal</button>
              <button type="button" className="btn btn-amber" onClick={handleProses} disabled={saving || !hasRetur} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Memproses...</> : <><i className="fa-solid fa-rotate-left" /> Proses Retur</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturPage;
