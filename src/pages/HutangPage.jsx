import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { exportToCSV, printReportHTML } from '../services/exportUtils';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

const HutangPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [showForm, setShowForm] = useState(false);
  const [showBayar, setShowBayar] = useState(null);
  const [bayarInput, setBayarInput] = useState('');
  const [form, setForm] = useState({ pelanggan: '', noWa: '', jumlah: '', keterangan: '', tanggalJatuhTempo: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('semua');
  const [deleteId, setDeleteId] = useState(null);
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
  const { start: dStart, end: dEnd } = getRange();

  const hutangList = appData.hutang || [];

  const filtered = useMemo(() => {
    return hutangList.filter(h => {
      if (filter === 'lunas') { if (h.sisaHutang > 0)  return false; }
      if (filter === 'belum') { if (h.sisaHutang <= 0) return false; }
      if (dStart && dEnd && h.tanggal) {
        if (h.tanggal < dStart || h.tanggal > dEnd) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.sisaHutang > 0 && b.sisaHutang <= 0) return -1;
      if (a.sisaHutang <= 0 && b.sisaHutang > 0) return 1;
      return b.tanggal?.localeCompare(a.tanggal || '');
    });
  }, [hutangList, filter, dStart, dEnd]);

  const totalHutang = hutangList.reduce((s, h) => s + (h.sisaHutang || 0), 0);
  const totalLunas  = hutangList.filter(h => h.sisaHutang <= 0).length;
  const totalBelum  = hutangList.filter(h => h.sisaHutang > 0).length;

  const openAdd = () => {
    setEditId(null);
    setForm({ pelanggan: '', noWa: '', jumlah: '', keterangan: '', tanggalJatuhTempo: '' });
    setShowForm(true);
  };

  const openEdit = (h) => {
    setEditId(h.id);
    setForm({
      pelanggan: h.pelanggan,
      noWa: h.noWa || '',
      jumlah: h.jumlahAwal,
      keterangan: h.keterangan || '',
      tanggalJatuhTempo: h.tanggalJatuhTempo || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.pelanggan.trim()) { toast('Nama pelanggan wajib', 'error'); return; }
    const jumlah = parseFloat(form.jumlah) || 0;
    if (jumlah <= 0) { toast('Jumlah hutang harus > 0', 'error'); return; }
    setSaving(true);
    const existing = appData.hutang || [];
    let newList;
    if (editId) {
      newList = existing.map(h => h.id === editId ? { ...h, ...form, jumlahAwal: jumlah, sisaHutang: h.sisaHutang + (jumlah - h.jumlahAwal) } : h);
    } else {
      const today = isoDate(new Date());
      newList = [...existing, {
        id: Date.now(),
        tanggal: today,
        pelanggan: form.pelanggan,
        noWa: form.noWa,
        keterangan: form.keterangan,
        tanggalJatuhTempo: form.tanggalJatuhTempo,
        jumlahAwal: jumlah,
        sisaHutang: jumlah,
        riwayatBayar: [],
      }];
    }
    await saveAndSync({ ...appData, hutang: newList });
    toast(editId ? '✅ Data hutang diperbarui' : '✅ Hutang baru dicatat', 'success');
    setShowForm(false);
    setSaving(false);
  };

  const handleBayar = async () => {
    const nominal = parseFloat(bayarInput) || 0;
    if (nominal <= 0) { toast('Nominal bayar harus > 0', 'error'); return; }
    if (!showBayar) return;
    if (nominal > showBayar.sisaHutang) { toast('Pembayaran melebihi sisa hutang', 'error'); return; }
    setSaving(true);
    const today = isoDate(new Date());
    const newList = (appData.hutang || []).map(h => {
      if (h.id !== showBayar.id) return h;
      const newSisa = Math.max(0, h.sisaHutang - nominal);
      return {
        ...h,
        sisaHutang: newSisa,
        riwayatBayar: [...(h.riwayatBayar || []), { tanggal: today, nominal }],
      };
    });
    await saveAndSync({ ...appData, hutang: newList });
    toast(`✅ Pembayaran ${formatRp(nominal)} tercatat`, 'success');
    setShowBayar(null);
    setBayarInput('');
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const newList = (appData.hutang || []).filter(h => h.id !== deleteId);
    await saveAndSync({ ...appData, hutang: newList });
    toast('🗑️ Data hutang dihapus', 'success');
    setDeleteId(null);
    setSaving(false);
  };

  const sendTagihanWA = (h) => {
    const no = (h.noWa || '').replace(/\D/g, '');
    if (!no) { toast('No WA tidak tersedia', 'warning'); return; }
    const s = appData.settings;
    let msg = `Halo ${h.pelanggan},\n`;
    msg += `Kami ingin menginformasikan bahwa masih terdapat *sisa hutang* di *${s.storeName || 'Agnes Fashion'}*.\n\n`;
    msg += `📌 Keterangan: ${h.keterangan || '-'}\n`;
    msg += `💰 Jumlah Awal: ${formatRp(h.jumlahAwal)}\n`;
    msg += `✅ Sudah Dibayar: ${formatRp(h.jumlahAwal - h.sisaHutang)}\n`;
    msg += `🔴 *Sisa Hutang: ${formatRp(h.sisaHutang)}*\n`;
    if (h.tanggalJatuhTempo) msg += `📅 Jatuh Tempo: ${h.tanggalJatuhTempo}\n`;
    msg += `\nTerima kasih atas kerjasamanya. 🙏`;
    window.open(`https://wa.me/${no}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const jatuhTempoWarning = (h) => {
    if (!h.tanggalJatuhTempo || h.sisaHutang <= 0) return null;
    const today = new Date();
    const jt = new Date(h.tanggalJatuhTempo);
    const diff = Math.ceil((jt - today) / 86400000);
    if (diff < 0) return { color: 'var(--rose)', label: `Lewat ${Math.abs(diff)} hari` };
    if (diff <= 3) return { color: 'var(--amber)', label: `${diff} hari lagi` };
    return null;
  };

  return (
    <div className="tab-page active fade-up">

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="stat-card rose">
          <i className="stat-icon fa-solid fa-hand-holding-dollar" />
          <div className="stat-label">Total Sisa Hutang</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalHutang)}</div>
          <div className="stat-meta">{totalBelum} pelanggan belum lunas</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-circle-check" />
          <div className="stat-label">Sudah Lunas</div>
          <div className="stat-value">{totalLunas}</div>
          <div className="stat-meta">pelanggan</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-clock" />
          <div className="stat-label">Belum Lunas</div>
          <div className="stat-value">{totalBelum}</div>
          <div className="stat-meta">pelanggan</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-hand-holding-dollar" /> Manajemen Hutang Pelanggan</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const headers = ['Pelanggan', 'No WA', 'Keterangan', 'Tgl Catat', 'Jatuh Tempo', 'Jumlah Awal', 'Sisa Hutang', 'Status'];
                const rows = filtered.map(h => [
                  h.pelanggan,
                  h.noWa || '',
                  h.keterangan || '',
                  h.tanggal,
                  h.tanggalJatuhTempo || '',
                  h.jumlahAwal,
                  h.sisaHutang,
                  h.sisaHutang <= 0 ? 'Lunas' : 'Belum Lunas'
                ]);
                exportToCSV('Laporan_Hutang_Pelanggan', headers, rows);
              }}
              title="Unduh CSV/Excel"
            >
              <i className="fa-solid fa-file-excel" style={{ color: 'var(--emerald)' }} /> Excel
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                let html = '<table><thead><tr><th>Pelanggan</th><th>No WA</th><th>Keterangan</th><th>Tgl Catat</th><th>Jatuh Tempo</th><th>Jumlah Awal</th><th>Sisa Hutang</th></tr></thead><tbody>';
                filtered.forEach(h => {
                  html += `<tr><td>${h.pelanggan}</td><td>${h.noWa || '—'}</td><td>${h.keterangan || '—'}</td><td>${h.tanggal}</td><td>${h.tanggalJatuhTempo || '—'}</td><td>${formatRp(h.jumlahAwal)}</td><td>${formatRp(h.sisaHutang)}</td></tr>`;
                });
                html += '</tbody></table>';
                printReportHTML('LAPORAN HUTANG PELANGGAN', 'Data piutang toko Agnes Fashion POS', html);
              }}
              title="Cetak PDF / Print"
            >
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> PDF
            </button>
            <button className="btn btn-purple btn-sm" onClick={openAdd}>
              <i className="fa-solid fa-plus" /> Catat Hutang
            </button>
          </div>
        </div>

        {/* Filter status + date */}
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {[['semua','Semua'],['belum','Belum Lunas'],['lunas','Lunas']].map(([k,l]) => (
              <button key={k} className={`btn btn-sm ${filter === k ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 10 }}>
            {[['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini'],['year','Tahun Ini'],['all','Semua'],['custom','Custom']].map(([p,l]) => (
              <button key={p} className={`date-preset-btn${datePreset === p ? ' active' : ''}`} onClick={() => setDatePreset(p)}>{l}</button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="date-range-inputs" style={{ paddingBottom: 10 }}>
              <span>Dari</span>
              <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Pelanggan</th><th>Keterangan</th><th>Tgl Catat</th><th>Jatuh Tempo</th><th>Jumlah Awal</th><th>Sisa Hutang</th><th style={{ textAlign: 'center' }}>Aksi</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-hand-holding-dollar" /><p>Belum ada data hutang.</p></div></td></tr>
              ) : filtered.map(h => {
                const jtWarn = jatuhTempoWarning(h);
                return (
                  <tr key={h.id}>
                    <td className="cell-main">
                      {h.pelanggan}
                      {h.noWa && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h.noWa}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{h.keterangan || '—'}</td>
                    <td style={{ fontSize: 12 }}>{h.tanggal}</td>
                    <td style={{ fontSize: 12 }}>
                      {h.tanggalJatuhTempo || '—'}
                      {jtWarn && <div style={{ fontSize: 10, fontWeight: 700, color: jtWarn.color }}>{jtWarn.label}</div>}
                    </td>
                    <td className="cell-amount">{formatRp(h.jumlahAwal)}</td>
                    <td className="cell-amount" style={{ color: h.sisaHutang <= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 800 }}>
                      {h.sisaHutang <= 0 ? '✅ LUNAS' : formatRp(h.sisaHutang)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {h.sisaHutang > 0 && (
                          <button className="btn btn-purple btn-sm" title="Catat Pembayaran" onClick={() => { setShowBayar(h); setBayarInput(''); }} style={{ padding: '4px 8px' }}>
                            <i className="fa-solid fa-money-bill-wave" />
                          </button>
                        )}
                        {h.noWa && h.sisaHutang > 0 && (
                          <button className="btn btn-wa btn-sm" title="Kirim tagihan WA" onClick={() => sendTagihanWA(h)} style={{ padding: '4px 8px' }}>
                            <i className="fa-brands fa-whatsapp" />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(h)} style={{ padding: '4px 8px' }}>
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                        <button className="btn btn-danger btn-sm" title="Hapus" onClick={() => setDeleteId(h.id)} style={{ padding: '4px 8px' }}>
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
      </div>

      {/* ═══ FORM HUTANG ════════════════════════════════════════════ */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="fa-solid fa-hand-holding-dollar" style={{ color: 'var(--rose)' }} /> {editId ? 'Edit Hutang' : 'Catat Hutang Baru'}</div>
              <button className="modal-close" onClick={() => setShowForm(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan *</label>
                  <input className="form-input" value={form.pelanggan} onChange={e => setForm(f => ({ ...f, pelanggan: e.target.value }))} placeholder="Nama pelanggan" id="hutang-pelanggan" />
                </div>
                <div className="form-group">
                  <label className="form-label">No WhatsApp</label>
                  <input className="form-input" value={form.noWa} onChange={e => setForm(f => ({ ...f, noWa: e.target.value }))} placeholder="0812..." />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Jumlah Hutang (Rp) *</label>
                <input className="form-input" type="number" value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} placeholder="0" min="0" id="hutang-jumlah" />
              </div>
              <div className="form-group">
                <label className="form-label">Keterangan</label>
                <input className="form-input" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} placeholder="Pembelian baju batik, cicilan, dll..." />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal Jatuh Tempo</label>
                <input className="form-input" type="date" value={form.tanggalJatuhTempo} onChange={e => setForm(f => ({ ...f, tanggalJatuhTempo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Batal</button>
              <button className="btn btn-purple" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BAYAR MODAL ════════════════════════════════════════════ */}
      {showBayar && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowBayar(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="fa-solid fa-money-bill-wave" style={{ color: 'var(--emerald)' }} /> Catat Pembayaran</div>
              <button className="modal-close" onClick={() => setShowBayar(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <b>{showBayar.pelanggan}</b>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sisa Hutang</span>
                  <span style={{ fontWeight: 800, color: 'var(--rose)', fontSize: 16 }}>{formatRp(showBayar.sisaHutang)}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nominal Pembayaran (Rp) *</label>
                <input className="form-input" type="number" value={bayarInput} onChange={e => setBayarInput(e.target.value)} placeholder="0" min="0" max={showBayar.sisaHutang} id="hutang-bayar" />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[showBayar.sisaHutang, Math.round(showBayar.sisaHutang / 2), 50000, 100000].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).slice(0, 4).map(v => (
                  <button key={v} className="btn btn-ghost btn-sm" onClick={() => setBayarInput(String(v))} style={{ fontSize: 11 }}>{formatRp(v)}</button>
                ))}
              </div>
              {/* Riwayat bayar */}
              {showBayar.riwayatBayar?.length > 0 && (
                <div>
                  <div className="form-label">Riwayat Pembayaran</div>
                  {showBayar.riwayatBayar.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.tanggal}</span>
                      <span style={{ fontWeight: 700, color: 'var(--emerald)' }}>+{formatRp(r.nominal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowBayar(null)} disabled={saving}>Batal</button>
              <button className="btn btn-green" onClick={handleBayar} disabled={saving || !bayarInput} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</> : <><i className="fa-solid fa-check" /> Catat Pembayaran</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE ════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}><i className="fa-solid fa-triangle-exclamation" /> Hapus Data Hutang?</div>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body"><p style={{ fontSize: 14 }}>Data hutang ini akan dihapus permanen.</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)} disabled={saving}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Menghapus...' : <><i className="fa-solid fa-trash" /> Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HutangPage;
