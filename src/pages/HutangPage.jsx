import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { exportToCSV, printReportHTML } from '../services/exportUtils';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
const STORE_OWNER_WA = '6285117027358';

const formatWaNumber = (inputNo) => {
  if (!inputNo) return '';
  let clean = String(inputNo).replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
};

const HutangPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [showForm, setShowForm] = useState(false);
  const [showBayar, setShowBayar] = useState(null);
  const [bayarInput, setBayarInput] = useState('');
  
  // Form State
  const [form, setForm] = useState({
    type: 'piutang', // 'piutang' (Pelanggan berhutang ke toko) | 'hutang' (Toko berhutang ke supplier)
    nama: '',
    noWa: '',
    jumlah: '',
    keterangan: '',
    tanggalJatuhTempo: ''
  });
  
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('semua'); // 'semua' | 'piutang' | 'hutang'
  const [statusFilter, setStatusFilter] = useState('semua'); // 'semua' | 'belum' | 'lunas'
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  
  // Date Presets
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

  const rawList = appData.hutang || [];

  // Filtered List
  const filtered = useMemo(() => {
    return rawList.filter(h => {
      // Type Filter
      const hType = h.type || (h.supplier ? 'hutang' : 'piutang');
      if (typeFilter !== 'semua' && hType !== typeFilter) return false;

      // Status Filter
      if (statusFilter === 'lunas' && h.sisaHutang > 0)  return false;
      if (statusFilter === 'belum' && h.sisaHutang <= 0) return false;

      // Date Range Filter
      if (dStart && dEnd && h.tanggal) {
        if (h.tanggal < dStart || h.tanggal > dEnd) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (h.pelanggan || h.nama || h.supplier || '').toLowerCase();
        const wa = (h.noWa || '').toLowerCase();
        const ket = (h.keterangan || '').toLowerCase();
        if (!nama.includes(q) && !wa.includes(q) && !ket.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.sisaHutang > 0 && b.sisaHutang <= 0) return -1;
      if (a.sisaHutang <= 0 && b.sisaHutang > 0) return 1;
      return (b.tanggal || '').localeCompare(a.tanggal || '');
    });
  }, [rawList, typeFilter, statusFilter, dStart, dEnd, searchQuery]);

  // Statistics
  const totalPiutang = rawList.filter(h => (h.type || 'piutang') === 'piutang').reduce((s, h) => s + (h.sisaHutang || 0), 0);
  const totalHutangToko = rawList.filter(h => h.type === 'hutang').reduce((s, h) => s + (h.sisaHutang || 0), 0);
  const countBelumLunas = rawList.filter(h => h.sisaHutang > 0).length;
  const countLunas = rawList.filter(h => h.sisaHutang <= 0).length;

  const openAdd = (type = 'piutang') => {
    setEditId(null);
    setForm({ type, nama: '', noWa: '', jumlah: '', keterangan: '', tanggalJatuhTempo: '' });
    setShowForm(true);
  };

  const openEdit = (h) => {
    setEditId(h.id);
    setForm({
      type: h.type || 'piutang',
      nama: h.pelanggan || h.nama || h.supplier || '',
      noWa: h.noWa || '',
      jumlah: h.jumlahAwal,
      keterangan: h.keterangan || '',
      tanggalJatuhTempo: h.tanggalJatuhTempo || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) { toast('Nama wajib diisi', 'error'); return; }
    const jumlah = parseFloat(form.jumlah) || 0;
    if (jumlah <= 0) { toast('Jumlah harus > 0', 'error'); return; }
    
    setSaving(true);
    const existing = appData.hutang || [];
    let newList;
    
    if (editId) {
      newList = existing.map(h => h.id === editId ? {
        ...h,
        type: form.type,
        pelanggan: form.type === 'piutang' ? form.nama : undefined,
        supplier: form.type === 'hutang' ? form.nama : undefined,
        nama: form.nama,
        noWa: form.noWa,
        keterangan: form.keterangan,
        tanggalJatuhTempo: form.tanggalJatuhTempo,
        jumlahAwal: jumlah,
        sisaHutang: h.sisaHutang + (jumlah - h.jumlahAwal)
      } : h);
    } else {
      const today = isoDate(new Date());
      newList = [...existing, {
        id: Date.now(),
        type: form.type,
        tanggal: today,
        pelanggan: form.type === 'piutang' ? form.nama : undefined,
        supplier: form.type === 'hutang' ? form.nama : undefined,
        nama: form.nama,
        noWa: form.noWa,
        keterangan: form.keterangan,
        tanggalJatuhTempo: form.tanggalJatuhTempo,
        jumlahAwal: jumlah,
        sisaHutang: jumlah,
        riwayatBayar: [],
      }];
    }
    
    await saveAndSync({ ...appData, hutang: newList });
    toast(editId ? '✅ Data berhasil diperbarui' : `✅ ${form.type === 'piutang' ? 'Piutang' : 'Hutang'} baru dicatat`, 'success');
    setShowForm(false);
    setSaving(false);
  };

  const handleBayar = async () => {
    const nominal = parseFloat(bayarInput) || 0;
    if (nominal <= 0) { toast('Nominal bayar harus > 0', 'error'); return; }
    if (!showBayar) return;
    if (nominal > showBayar.sisaHutang) { toast('Pembayaran melebihi sisa sisa tagihan', 'error'); return; }
    
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
    toast('🗑️ Data berhasil dihapus', 'success');
    setDeleteId(null);
    setSaving(false);
  };

  // Kirim WhatsApp Notifikasi Tagihan ke Pelanggan / Supplier
  const sendTagihanWA = (h) => {
    const rawNo = h.noWa || '';
    const no = formatWaNumber(rawNo);
    const s = appData.settings || {};
    const isPiutang = (h.type || 'piutang') === 'piutang';

    let msg = `Halo *${h.pelanggan || h.nama || h.supplier}*,\n`;
    if (isPiutang) {
      msg += `Kami menginformasikan rincian *Piutang / Tagihan* di *${s.storeName || 'MELAN JAYA'}*:\n\n`;
    } else {
      msg += `Berikut rincian *Hutang Toko* ke Supplier di *${s.storeName || 'MELAN JAYA'}*:\n\n`;
    }
    msg += `📌 Keterangan: ${h.keterangan || '-'}\n`;
    msg += `💰 Jumlah Awal: ${formatRp(h.jumlahAwal)}\n`;
    msg += `✅ Total Dibayar: ${formatRp(h.jumlahAwal - h.sisaHutang)}\n`;
    msg += `🔴 *Sisa Tagihan: ${formatRp(h.sisaHutang)}*\n`;
    if (h.tanggalJatuhTempo) msg += `📅 Jatuh Tempo: ${h.tanggalJatuhTempo}\n`;
    msg += `\nTerima kasih atas kerjasamanya. 🙏`;

    const encoded = encodeURIComponent(msg);
    if (no) {
      window.open(`https://wa.me/${no}?text=${encoded}`, '_blank');
      toast(`📲 Notifikasi WA terkirim ke ${h.pelanggan || h.nama}`, 'success');
    } else {
      // Fallback ke WA Toko
      window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encoded}`, '_blank');
      toast(`📲 Rincian dikirim ke WA Toko (${STORE_OWNER_WA})`, 'info');
    }
  };

  // Kirim Rangkuman Laporan Hutang & Piutang ke WA Toko (6285117027358)
  const sendReportToStoreWA = () => {
    const s = appData.settings || {};
    let msg = `*LAPORAN HUTANG & PIUTANG — ${s.storeName?.toUpperCase() || 'MELAN JAYA'}*\n`;
    msg += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n`;
    msg += `─────────────────────────\n`;
    msg += `💰 *Total Piutang Pelanggan* : ${formatRp(totalPiutang)}\n`;
    msg += `🏬 *Total Hutang Toko/Supplier*: ${formatRp(totalHutangToko)}\n`;
    msg += `─────────────────────────\n`;
    msg += `📋 Total Record  : ${filtered.length} data\n`;
    msg += `⏳ Belum Lunas   : ${countBelumLunas} data\n`;
    msg += `✅ Lunas         : ${countLunas} data\n`;
    msg += `─────────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;

    window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encodeURIComponent(msg)}`, '_blank');
    toast(`📲 Rangkuman laporan dikirim ke WA Toko (${STORE_OWNER_WA})`, 'success');
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

      {/* KPI Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="stat-card rose">
          <i className="stat-icon fa-solid fa-hand-holding-dollar" />
          <div className="stat-label">Piutang Pelanggan</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(totalPiutang)}</div>
          <div className="stat-meta">Tagihan ke pelanggan</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-truck-ramp-box" />
          <div className="stat-label">Hutang Toko / Supplier</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(totalHutangToko)}</div>
          <div className="stat-meta">Kewajiban bayar supplier</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-clock" />
          <div className="stat-label">Belum Lunas</div>
          <div className="stat-value">{countBelumLunas}</div>
          <div className="stat-meta">Transaksi aktif</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-circle-check" />
          <div className="stat-label">Sudah Lunas</div>
          <div className="stat-value">{countLunas}</div>
          <div className="stat-meta">Selesai</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title"><i className="fa-solid fa-scale-balanced" /> Laporan Hutang &amp; Piutang</div>
            <div className="card-subtitle">{filtered.length} data ditemukan</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-wa btn-sm" onClick={sendReportToStoreWA} title="Kirim rangkuman laporan ke WA Toko (6285117027358)">
              <i className="fa-brands fa-whatsapp" /> WA Toko
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const headers = ['Jenis', 'Nama (Pelanggan/Supplier)', 'No WA', 'Keterangan', 'Tgl Catat', 'Jatuh Tempo', 'Jumlah Awal', 'Sisa Tagihan', 'Status'];
                const rows = filtered.map(h => [
                  (h.type || 'piutang') === 'piutang' ? 'Piutang Pelanggan' : 'Hutang Supplier',
                  h.pelanggan || h.nama || h.supplier || '',
                  h.noWa || '',
                  h.keterangan || '',
                  h.tanggal,
                  h.tanggalJatuhTempo || '',
                  h.jumlahAwal,
                  h.sisaHutang,
                  h.sisaHutang <= 0 ? 'Lunas' : 'Belum Lunas'
                ]);
                exportToCSV('Laporan_Hutang_Piutang', headers, rows);
              }}
              title="Unduh CSV/Excel"
            >
              <i className="fa-solid fa-file-excel" style={{ color: 'var(--emerald)' }} /> Excel
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                let html = '<table><thead><tr><th>Jenis</th><th>Nama</th><th>No WA</th><th>Keterangan</th><th>Tgl Catat</th><th>Jatuh Tempo</th><th>Jumlah Awal</th><th>Sisa Tagihan</th></tr></thead><tbody>';
                filtered.forEach(h => {
                  html += `<tr><td>${(h.type || 'piutang') === 'piutang' ? 'Piutang Pelanggan' : 'Hutang Supplier'}</td><td>${h.pelanggan || h.nama || h.supplier}</td><td>${h.noWa || '—'}</td><td>${h.keterangan || '—'}</td><td>${h.tanggal}</td><td>${h.tanggalJatuhTempo || '—'}</td><td>${formatRp(h.jumlahAwal)}</td><td>${formatRp(h.sisaHutang)}</td></tr>`;
                });
                html += '</tbody></table>';
                printReportHTML('LAPORAN HUTANG & PIUTANG LENGKAP', 'Rincian Piutang Pelanggan & Hutang Supplier Toko Melan Jaya POS', html);
              }}
              title="Cetak PDF / Print"
            >
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> PDF
            </button>
            <button className="btn btn-purple btn-sm" onClick={() => openAdd('piutang')}>
              <i className="fa-solid fa-plus" /> Catat Piutang Pelanggan
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => openAdd('hutang')} style={{ border: '1px solid var(--amber)', color: 'var(--amber)' }}>
              <i className="fa-solid fa-plus" /> Catat Hutang Supplier
            </button>
          </div>
        </div>

        {/* Filter Controls (Type, Status, Date & Search) */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          
          {/* Row 1: Filter Jenis & Status & Search */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Filter Jenis */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Jenis:</span>
              {[
                ['semua', 'Semua'],
                ['piutang', '💰 Piutang Pelanggan'],
                ['hutang', '🏬 Hutang Supplier']
              ].map(([k, l]) => (
                <button key={k} className={`btn btn-sm ${typeFilter === k ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setTypeFilter(k)} style={{ fontSize: 11 }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Filter Status */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
              {[
                ['semua', 'Semua'],
                ['belum', '🔴 Belum Lunas'],
                ['lunas', '✅ Lunas']
              ].map(([k, l]) => (
                <button key={k} className={`btn btn-sm ${statusFilter === k ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setStatusFilter(k)} style={{ fontSize: 11 }}>
                  {l}
                </button>
              ))}
            </div>

          </div>

          {/* Row 2: Search Input & Date Presets */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="form-input-icon" style={{ flex: 1, minWidth: 200 }}>
              <i className="fa-solid fa-search" />
              <input
                className="form-input"
                placeholder="Cari nama pelanggan, supplier, WA, atau keterangan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: 11, height: 32 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                ['today', 'Hari Ini'],
                ['yesterday', 'Kemarin'],
                ['week', '7 Hari'],
                ['month', 'Bulan Ini'],
                ['year', 'Tahun Ini'],
                ['all', 'Semua'],
                ['custom', 'Custom']
              ].map(([p, l]) => (
                <button key={p} className={`date-preset-btn${datePreset === p ? ' active' : ''}`} onClick={() => setDatePreset(p)} style={{ fontSize: 10, padding: '4px 8px' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="date-range-inputs" style={{ paddingTop: 4 }}>
              <span>Dari</span>
              <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto desktop-table-view">
          <table className="data-table">
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nama Pelanggan / Supplier</th>
                <th>Keterangan</th>
                <th>Tgl Catat</th>
                <th>Jatuh Tempo</th>
                <th>Jumlah Awal</th>
                <th>Sisa Tagihan</th>
                <th style={{ textAlign: 'center' }}>Aksi &amp; WA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><i className="fa-solid fa-scale-balanced" /><p>Belum ada data hutang / piutang yang cocok.</p></div></td></tr>
              ) : filtered.map(h => {
                const isPiutang = (h.type || 'piutang') === 'piutang';
                const jtWarn = jatuhTempoWarning(h);
                const namaDisp = h.pelanggan || h.nama || h.supplier;

                return (
                  <tr key={h.id}>
                    <td>
                      <span className={`badge ${isPiutang ? 'badge-violet' : 'badge-amber'}`}>
                        {isPiutang ? '💰 Piutang' : '🏬 Hutang Toko'}
                      </span>
                    </td>
                    <td className="cell-main">
                      {namaDisp}
                      {h.noWa && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>📱 {h.noWa}</div>}
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
                          <button className="btn btn-purple btn-sm" title="Catat Pembayaran" onClick={() => { setShowBayar(h); setBayarInput(''); }} style={{ padding: '4px 8px', fontSize: 11 }}>
                            <i className="fa-solid fa-money-bill-wave" /> Bayar
                          </button>
                        )}
                        <button className="btn btn-wa btn-sm" title="Kirim Notifikasi WA" onClick={() => sendTagihanWA(h)} style={{ padding: '4px 8px', fontSize: 11 }}>
                          <i className="fa-brands fa-whatsapp" /> WA
                        </button>
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

        {/* Mobile View (Cards) */}
        <div className="mobile-cards-view" style={{ padding: 12 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-scale-balanced" />
              <p>Belum ada data hutang/piutang.</p>
            </div>
          ) : filtered.map(h => {
            const isPiutang = (h.type || 'piutang') === 'piutang';
            const jtWarn = jatuhTempoWarning(h);
            const namaDisp = h.pelanggan || h.nama || h.supplier;

            return (
              <div key={h.id} className="trx-mobile-card" style={{ borderLeft: `3px solid ${h.sisaHutang <= 0 ? 'var(--emerald)' : isPiutang ? 'var(--brand)' : 'var(--amber)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span className={`badge ${isPiutang ? 'badge-violet' : 'badge-amber'}`} style={{ marginBottom: 4 }}>
                      {isPiutang ? '💰 Piutang Pelanggan' : '🏬 Hutang Toko'}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{namaDisp}</div>
                    {h.noWa && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📱 {h.noWa}</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: h.sisaHutang <= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                    {h.sisaHutang <= 0 ? '✅ LUNAS' : formatRp(h.sisaHutang)}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, background: 'var(--bg-hover)', padding: '6px 8px', borderRadius: 6 }}>
                  <div>📌 {h.keterangan || 'Tanpa keterangan'}</div>
                  <div>📅 Tgl: {h.tanggal} {h.tanggalJatuhTempo ? `· JT: ${h.tanggalJatuhTempo}` : ''}</div>
                  {jtWarn && <div style={{ fontWeight: 700, color: jtWarn.color }}>{jtWarn.label}</div>}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {h.sisaHutang > 0 && (
                    <button className="btn btn-purple btn-sm" onClick={() => { setShowBayar(h); setBayarInput(''); }} style={{ flex: 1 }}>
                      <i className="fa-solid fa-money-bill-wave" /> Bayar
                    </button>
                  )}
                  <button className="btn btn-wa btn-sm" onClick={() => sendTagihanWA(h)} style={{ flex: 1 }}>
                    <i className="fa-brands fa-whatsapp" /> WA Notif
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(h)}>
                    <i className="fa-solid fa-pen-to-square" />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(h.id)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ═══ FORM INPUT MODAL ════════════════════════════════════════════ */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-scale-balanced" style={{ color: 'var(--brand)' }} />
                {editId ? 'Edit Record' : form.type === 'piutang' ? 'Catat Piutang Pelanggan' : 'Catat Hutang Toko'}
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Type Switcher */}
              <div className="form-group">
                <label className="form-label">Kategori Transaksi</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    className={`btn ${form.type === 'piutang' ? 'btn-purple' : 'btn-ghost'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'piutang' }))}
                  >
                    💰 Piutang Pelanggan
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.type === 'hutang' ? 'btn-purple' : 'btn-ghost'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'hutang' }))}
                  >
                    🏬 Hutang Supplier Toko
                  </button>
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">{form.type === 'piutang' ? 'Nama Pelanggan *' : 'Nama Supplier *'}</label>
                  <input className="form-input" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder={form.type === 'piutang' ? 'Nama pelanggan...' : 'Nama supplier...'} id="hutang-nama" />
                </div>
                <div className="form-group">
                  <label className="form-label">No WhatsApp</label>
                  <input className="form-input" value={form.noWa} onChange={e => setForm(f => ({ ...f, noWa: e.target.value }))} placeholder="0812..." />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Tagihan / Hutang (Rp) *</label>
                <input className="form-input" type="number" value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} placeholder="0" min="0" id="hutang-jumlah" />
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan</label>
                <input className="form-input" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} placeholder="Pembelian batik, restok kain, dll..." />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Jatuh Tempo</label>
                <input className="form-input" type="date" value={form.tanggalJatuhTempo} onChange={e => setForm(f => ({ ...f, tanggalJatuhTempo: e.target.value }))} />
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Batal</button>
              <button className="btn btn-purple" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> Simpan Data</>}
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
                <b>{showBayar.pelanggan || showBayar.nama || showBayar.supplier}</b>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sisa Tagihan</span>
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

      {/* ═══ DELETE MODAL ════════════════════════════════════════════ */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}><i className="fa-solid fa-triangle-exclamation" /> Hapus Record?</div>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body"><p style={{ fontSize: 14 }}>Data hutang/piutang ini akan dihapus permanen.</p></div>
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
