import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { normalizeDateStr } from '../services/dataSync';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const STORE_WA = '6285117027358';

const AnalitikPage = () => {
  const { appData } = useData();
  const [preset, setPreset] = useState('month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [activeTab, setActiveTab] = useState('barang'); // 'barang' | 'pelanggan'
  const [sortBy, setSortBy] = useState('qty'); // 'qty' | 'omset' | 'laba'
  const [topN, setTopN] = useState(10);

  const getRange = () => {
    const today = new Date();
    const tStr = today.toISOString().slice(0, 10);
    if (preset === 'today') return { start: tStr, end: tStr };
    if (preset === 'week') { const w = new Date(today); w.setDate(w.getDate() - 6); return { start: w.toISOString().slice(0, 10), end: tStr }; }
    if (preset === 'month') { return { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, end: tStr }; }
    if (preset === 'year') return { start: `${today.getFullYear()}-01-01`, end: tStr };
    if (preset === 'custom') return { start: dateStart, end: dateEnd };
    return { start: '', end: '' };
  };
  const { start, end } = getRange();

  const filteredSales = useMemo(() => {
    return (appData.penjualan || []).filter(t => {
      const d = normalizeDateStr(t.tanggal);
      if (!start && !end) return true;
      return d >= start && d <= end;
    });
  }, [appData.penjualan, start, end]);

  // ── Analisa Barang ──────────────────────────────────────────────────────────
  const itemStats = useMemo(() => {
    const map = {};
    filteredSales.forEach(trx => {
      (trx.items || []).forEach(it => {
        const key = it.barang || it.originalName || 'Unknown';
        if (!map[key]) {
          const stokItem = (appData.stok || []).find(s => s.nama_barang === key);
          map[key] = {
            nama: key,
            kategori: stokItem?.kategori || 'Lainnya',
            stokTersedia: stokItem?.stokTersedia || 0,
            totalQty: 0,
            totalOmset: 0,
            totalModal: 0,
            trxCount: 0
          };
        }
        const jumlah = Number(it.jumlah || 0);
        const subtotal = Number(it.subtotal || (it.hargaJual * jumlah) || 0);
        const modal = Number(it.hargaModal || (appData.stok || []).find(s => s.nama_barang === key)?.hargaModal || 0) * jumlah;
        map[key].totalQty += jumlah;
        map[key].totalOmset += subtotal;
        map[key].totalModal += modal;
        map[key].trxCount += 1;
      });
    });
    return Object.values(map).map(it => ({
      ...it,
      laba: it.totalOmset - it.totalModal,
      margin: it.totalOmset > 0 ? ((it.totalOmset - it.totalModal) / it.totalOmset * 100).toFixed(1) : 0
    })).sort((a, b) => {
      if (sortBy === 'qty') return b.totalQty - a.totalQty;
      if (sortBy === 'omset') return b.totalOmset - a.totalOmset;
      return b.laba - a.laba;
    });
  }, [filteredSales, appData.stok, sortBy]);

  const topItems = itemStats.slice(0, topN);
  const bottomItems = [...itemStats].sort((a, b) => a.totalQty - b.totalQty).slice(0, topN);

  // ── Analisa Pelanggan ──────────────────────────────────────────────────────
  const customerStats = useMemo(() => {
    const map = {};
    filteredSales.forEach(trx => {
      const key = trx.pelanggan || 'Pelanggan Umum';
      if (!map[key]) map[key] = { nama: key, noWa: trx.noWa || '', totalBelanja: 0, totalLaba: 0, totalModal: 0, trxCount: 0 };
      map[key].totalBelanja += trx.totalPenjualan || 0;
      map[key].totalLaba += trx.laba || 0;
      map[key].totalModal += trx.totalModal || 0;
      map[key].trxCount += 1;
      if (trx.noWa && !map[key].noWa) map[key].noWa = trx.noWa;
    });
    return Object.values(map).map(c => ({
      ...c,
      avgBelanja: c.trxCount > 0 ? Math.round(c.totalBelanja / c.trxCount) : 0,
      margin: c.totalBelanja > 0 ? ((c.totalLaba / c.totalBelanja) * 100).toFixed(1) : 0
    })).sort((a, b) => b.totalBelanja - a.totalBelanja);
  }, [filteredSales]);

  const topCustomers = customerStats.slice(0, topN);

  const sendCustomerWA = (c) => {
    const no = c.noWa ? (c.noWa.startsWith('0') ? '62' + c.noWa.slice(1) : c.noWa).replace(/\D/g, '') : STORE_WA;
    const s = appData.settings || {};
    let msg = `Halo *${c.nama}*! 👋\n`;
    msg += `Terima kasih sudah berbelanja di *${s.storeName || 'Melan Jaya'}*!\n\n`;
    msg += `📊 *Riwayat Belanja Anda:*\n`;
    msg += `──────────────────\n`;
    msg += `🛍️ Total Transaksi : ${c.trxCount}x\n`;
    msg += `💰 Total Belanja   : ${formatRp(c.totalBelanja)}\n`;
    msg += `📅 Rata-rata/Trx   : ${formatRp(c.avgBelanja)}\n`;
    msg += `──────────────────\n`;
    msg += `Ada produk baru yang mungkin Anda suka! Kunjungi katalog kami: 🛒\n`;
    msg += `Terima kasih atas kepercayaan Anda! 🙏`;
    window.open(`https://wa.me/${no}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const chartColorItem = (idx) => {
    const palette = ['#7c3aed', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'];
    return palette[idx % palette.length];
  };

  const totalOmset = filteredSales.reduce((s, t) => s + (t.totalPenjualan || 0), 0);
  const totalLaba = filteredSales.reduce((s, t) => s + (t.laba || 0), 0);
  const totalTrx = filteredSales.length;
  const totalItemTerjual = filteredSales.reduce((s, t) => s + (t.items || []).reduce((ss, i) => ss + (i.jumlah || 0), 0), 0);

  const sendItemReportWA = () => {
    let msg = `*📊 ANALISA BARANG LARIS — MELAN JAYA*\n`;
    msg += `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}\n`;
    msg += `─────────────────────\n`;
    topItems.slice(0, 10).forEach((it, i) => {
      msg += `${i + 1}. ${it.nama}\n   Terjual: ${it.totalQty} pcs · ${formatRp(it.totalOmset)} · Laba: ${formatRp(it.laba)}\n`;
    });
    msg += `─────────────────────\n`;
    msg += `Total Omset: ${formatRp(totalOmset)}\nTotal Laba: ${formatRp(totalLaba)}\n\nDikirim dari Melan Jaya POS`;
    window.open(`https://wa.me/${STORE_WA}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="tab-page active fade-up">

      {/* KPI Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-chart-bar" />
          <div className="stat-label">Total Transaksi</div>
          <div className="stat-value">{totalTrx}</div>
          <div className="stat-meta">Dalam periode</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-bag-shopping" />
          <div className="stat-label">Item Terjual</div>
          <div className="stat-value">{totalItemTerjual}</div>
          <div className="stat-meta">Total unit</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Total Omset</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalOmset)}</div>
          <div className="stat-meta">Pendapatan kotor</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-hand-holding-dollar" />
          <div className="stat-label">Total Laba</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalLaba)}</div>
          <div className="stat-meta">Laba kotor</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[['today','Hari Ini'],['week','7 Hari'],['month','Bulan Ini'],['year','Tahun Ini'],['custom','Custom']].map(([k, l]) => (
              <button key={k} className={`date-preset-btn${preset === k ? ' active' : ''}`} onClick={() => setPreset(k)} style={{ fontSize: 11 }}>{l}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ height: 32, fontSize: 12 }} value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="form-input" style={{ height: 32, fontSize: 12 }} value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <select className="form-input" style={{ height: 32, fontSize: 12, width: 80 }} value={topN} onChange={e => setTopN(Number(e.target.value))}>
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'barang' ? 'btn-purple' : 'btn-ghost'}`}
          onClick={() => setActiveTab('barang')}
        >
          <i className="fa-solid fa-fire-flame-curved" /> Analisa Barang
        </button>
        <button
          className={`btn ${activeTab === 'pelanggan' ? 'btn-purple' : 'btn-ghost'}`}
          onClick={() => setActiveTab('pelanggan')}
        >
          <i className="fa-solid fa-users" /> Analisa Pelanggan
        </button>
      </div>

      {/* ─── Tab Barang ──────────────────────────────────────────────── */}
      {activeTab === 'barang' && (
        <>
          {/* Sort & Share Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Urutkan by:</span>
            {[['qty','Qty Terjual'],['omset','Omset'],['laba','Laba']].map(([k, l]) => (
              <button key={k} className={`btn btn-sm ${sortBy === k ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setSortBy(k)} style={{ fontSize: 11 }}>{l}</button>
            ))}
            <button className="btn btn-wa btn-sm" style={{ marginLeft: 'auto' }} onClick={sendItemReportWA}>
              <i className="fa-brands fa-whatsapp" /> Bagikan ke WA
            </button>
          </div>

          {/* Chart - Top Items */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title"><i className="fa-solid fa-fire-flame-curved" style={{ color: 'var(--rose)' }} /> Top {topN} Barang Terlaris</div>
              <div className="card-subtitle">{filteredSales.length} transaksi dianalisa</div>
            </div>
            <div style={{ padding: '0 12px 16px', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems.slice(0, topN)} layout="vertical" margin={{ left: 100, right: 60, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => sortBy === 'qty' ? v : `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nama" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={100} />
                  <Tooltip
                    formatter={(v, n) => [sortBy === 'qty' ? `${v} pcs` : formatRp(v), sortBy === 'qty' ? 'Qty Terjual' : sortBy === 'omset' ? 'Omset' : 'Laba']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Bar dataKey={sortBy === 'qty' ? 'totalQty' : sortBy === 'omset' ? 'totalOmset' : 'laba'} radius={[0, 4, 4, 0]}>
                    {topItems.slice(0, topN).map((_, i) => <Cell key={i} fill={chartColorItem(i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table - Detail Barang Laris */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title"><i className="fa-solid fa-trophy" style={{ color: 'var(--amber)' }} /> Rincian Barang Laris</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nama Barang</th>
                    <th>Kategori</th>
                    <th>Qty Terjual</th>
                    <th>Total Omset</th>
                    <th>Total Modal</th>
                    <th>Laba</th>
                    <th>Margin</th>
                    <th>Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {itemStats.length === 0 ? (
                    <tr><td colSpan={9}><div className="empty-state"><i className="fa-solid fa-chart-bar" /><p>Belum ada data penjualan untuk dianalisa.</p></div></td></tr>
                  ) : itemStats.map((it, idx) => (
                    <tr key={it.nama} style={{ background: idx < 3 ? 'rgba(124,58,237,0.04)' : undefined }}>
                      <td>
                        <span style={{ fontWeight: 900, color: idx === 0 ? 'var(--amber)' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)', fontSize: 13 }}>
                          {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                        </span>
                      </td>
                      <td className="cell-main">{it.nama}</td>
                      <td><span className="badge badge-violet">{it.kategori}</span></td>
                      <td><strong>{it.totalQty} pcs</strong></td>
                      <td className="cell-amount">{formatRp(it.totalOmset)}</td>
                      <td className="cell-amount" style={{ color: 'var(--text-muted)' }}>{formatRp(it.totalModal)}</td>
                      <td className="cell-amount" style={{ color: it.laba >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 800 }}>{formatRp(it.laba)}</td>
                      <td>
                        <span className={`badge ${parseFloat(it.margin) >= 30 ? 'badge-green' : parseFloat(it.margin) >= 15 ? 'badge-amber' : 'badge-red'}`}>
                          {it.margin}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${it.stokTersedia <= 0 ? 'badge-red' : it.stokTersedia <= 5 ? 'badge-amber' : 'badge-green'}`}>
                          {it.stokTersedia} pcs
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barang Lambat Laku */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><i className="fa-solid fa-snooze" style={{ color: 'var(--text-muted)' }} /> Barang Lambat Laku (Slow Moving)</div>
              <div className="card-subtitle">Item dengan penjualan terendah dalam periode</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Kategori</th>
                    <th>Qty Terjual</th>
                    <th>Total Omset</th>
                    <th>Laba</th>
                    <th>Stok Sisa</th>
                    <th>Rekomendasi</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomItems.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-box-open" /><p>Tidak ada data.</p></div></td></tr>
                  ) : bottomItems.map((it) => (
                    <tr key={'slow-' + it.nama}>
                      <td className="cell-main">{it.nama}</td>
                      <td><span className="badge badge-violet">{it.kategori}</span></td>
                      <td style={{ color: it.totalQty <= 2 ? 'var(--rose)' : 'var(--amber)', fontWeight: 700 }}>{it.totalQty} pcs</td>
                      <td className="cell-amount">{formatRp(it.totalOmset)}</td>
                      <td className="cell-amount" style={{ color: it.laba >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>{formatRp(it.laba)}</td>
                      <td>
                        <span className={`badge ${it.stokTersedia <= 0 ? 'badge-red' : it.stokTersedia > 20 ? 'badge-amber' : 'badge-green'}`}>
                          {it.stokTersedia} pcs
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {it.stokTersedia > 20 ? <span style={{ color: 'var(--rose)', fontWeight: 700 }}>⚠️ Terlalu banyak stok</span>
                          : it.totalQty === 0 ? <span style={{ color: 'var(--text-muted)' }}>❌ Tidak terjual</span>
                          : <span style={{ color: 'var(--amber)' }}>🔄 Pertimbangkan diskon</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Tab Pelanggan ──────────────────────────────────────────────── */}
      {activeTab === 'pelanggan' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              <i className="fa-solid fa-users" style={{ color: 'var(--brand)', marginRight: 6 }} />
              {customerStats.length} Pelanggan Aktif Periode Ini
            </span>
          </div>

          {/* Chart Pelanggan */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title"><i className="fa-solid fa-crown" style={{ color: 'var(--amber)' }} /> Top {topN} Pelanggan Terbaik</div>
            </div>
            <div style={{ padding: '0 12px 16px', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 120, right: 60, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(1)}jt`} />
                  <YAxis type="category" dataKey="nama" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={120} />
                  <Tooltip
                    formatter={(v) => [formatRp(v), 'Total Belanja']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Bar dataKey="totalBelanja" radius={[0, 4, 4, 0]}>
                    {topCustomers.map((_, i) => <Cell key={i} fill={chartColorItem(i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table Pelanggan */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><i className="fa-solid fa-table" /> Rincian Laba Rugi per Pelanggan</div>
            </div>
            <div className="overflow-x-auto desktop-table-view">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nama Pelanggan</th>
                    <th>Jml Trx</th>
                    <th>Total Belanja</th>
                    <th>Total Modal</th>
                    <th>Laba dari Pelanggan</th>
                    <th>Margin</th>
                    <th>Rata-rata/Trx</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {customerStats.length === 0 ? (
                    <tr><td colSpan={9}><div className="empty-state"><i className="fa-solid fa-users" /><p>Belum ada data pelanggan.</p></div></td></tr>
                  ) : customerStats.map((c, idx) => (
                    <tr key={c.nama} style={{ background: idx < 3 ? 'rgba(124,58,237,0.04)' : undefined }}>
                      <td>
                        <span style={{ fontWeight: 900, color: idx === 0 ? 'var(--amber)' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)', fontSize: 13 }}>
                          {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                        </span>
                      </td>
                      <td>
                        <div className="cell-main">{c.nama}</div>
                        {c.noWa && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>📱 {c.noWa}</div>}
                      </td>
                      <td><span className="badge badge-violet">{c.trxCount}x</span></td>
                      <td className="cell-amount" style={{ fontWeight: 800 }}>{formatRp(c.totalBelanja)}</td>
                      <td className="cell-amount" style={{ color: 'var(--text-muted)' }}>{formatRp(c.totalModal)}</td>
                      <td className="cell-amount" style={{ color: c.totalLaba >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 800 }}>{formatRp(c.totalLaba)}</td>
                      <td>
                        <span className={`badge ${parseFloat(c.margin) >= 30 ? 'badge-green' : parseFloat(c.margin) >= 15 ? 'badge-amber' : 'badge-red'}`}>
                          {c.margin}%
                        </span>
                      </td>
                      <td className="cell-amount">{formatRp(c.avgBelanja)}</td>
                      <td>
                        {c.noWa && (
                          <button className="btn btn-wa btn-sm" onClick={() => sendCustomerWA(c)} title="Kirim ucapan terima kasih ke pelanggan" style={{ fontSize: 11 }}>
                            <i className="fa-brands fa-whatsapp" /> WA
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="mobile-cards-view" style={{ padding: 12 }}>
              {customerStats.map((c, idx) => (
                <div key={c.nama} className="trx-mobile-card" style={{ borderLeft: `3px solid ${idx === 0 ? 'var(--amber)' : idx === 1 ? '#94a3b8' : 'var(--brand)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{idx < 3 ? ['🥇','🥈','🥉'][idx] : `#${idx+1}`} {c.nama}</div>
                      {c.noWa && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>📱 {c.noWa}</div>}
                    </div>
                    <span className="badge badge-violet">{c.trxCount}x</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, background: 'var(--bg-hover)', padding: '8px 10px', borderRadius: 8, fontSize: 11 }}>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>TOTAL BELANJA</div><div style={{ fontWeight: 800 }}>{formatRp(c.totalBelanja)}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>LABA</div><div style={{ fontWeight: 800, color: c.totalLaba >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>{formatRp(c.totalLaba)}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>MARGIN</div><div style={{ fontWeight: 700 }}>{c.margin}%</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>AVG/TRX</div><div style={{ fontWeight: 700 }}>{formatRp(c.avgBelanja)}</div></div>
                  </div>
                  {c.noWa && (
                    <button className="btn btn-wa btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => sendCustomerWA(c)}>
                      <i className="fa-brands fa-whatsapp" /> Kirim WA ke {c.nama}
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        </>
      )}

    </div>
  );
};

export default AnalitikPage;
