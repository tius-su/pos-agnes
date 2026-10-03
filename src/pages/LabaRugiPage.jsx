import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

const formatRp  = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const formatRpS = v => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
  if (v >= 1000)    return `${(v / 1000).toFixed(0)}rb`;
  return String(v);
};
const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
const pct = (laba, omset) => omset > 0 ? ((laba / omset) * 100).toFixed(1) : '0.0';

const PIE_COLORS = ['#7c3aed','#0284c7','#059669','#d97706','#e11d48','#8b5cf6','#06b6d4','#84cc16'];

const LabaRugiPage = () => {
  const { appData } = useData();
  const [view, setView]     = useState('item');      // 'item' | 'supplier'
  const [preset, setPreset] = useState('month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd]     = useState('');
  const [searchItem, setSearchItem]         = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [sortKey, setSortKey] = useState('laba');    // 'laba' | 'omset' | 'qty' | 'margin'
  const [sortDir, setSortDir] = useState('desc');

  const penjualan = appData.penjualan || [];
  const stok      = appData.stok      || [];

  // ── Date range ──────────────────────────────────────────────────────
  const getRange = () => {
    const today = new Date();
    if (preset === 'today')     { const d = isoDate(today); return { start: d, end: d }; }
    if (preset === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); const d = isoDate(y); return { start: d, end: d }; }
    if (preset === 'week')      { const w = new Date(today); w.setDate(w.getDate() - 6); return { start: isoDate(w), end: isoDate(today) }; }
    if (preset === 'month')     { const m = new Date(today.getFullYear(), today.getMonth(), 1); return { start: isoDate(m), end: isoDate(today) }; }
    if (preset === 'year')      { return { start: `${today.getFullYear()}-01-01`, end: isoDate(today) }; }
    if (preset === 'custom')    { return { start: dateStart, end: dateEnd }; }
    return { start: '', end: '' };
  };
  const { start, end } = getRange();

  const filteredSales = useMemo(() => penjualan.filter(t => {
    if (!start && !end) return true;
    return t.tanggal >= start && t.tanggal <= end;
  }), [penjualan, start, end]);

  // ── Helper: get supplier for a product ──────────────────────────────
  const getSupplier = (namaBarang) => {
    const item = stok.find(s => s.nama_barang === namaBarang);
    if (!item) return 'Tidak Diketahui';
    return item.supplier || item.suplier || item.nama_suplier ||
      (item.supplierList && item.supplierList[0]) || 'Tidak Diketahui';
  };

  // ── Per ITEM aggregation ─────────────────────────────────────────────
  const itemData = useMemo(() => {
    const map = {};
    filteredSales.forEach(t => {
      (t.items || []).forEach(i => {
        if (!map[i.barang]) {
          map[i.barang] = {
            nama: i.barang,
            supplier: getSupplier(i.barang),
            qty: 0, omset: 0, modal: 0, laba: 0,
          };
        }
        map[i.barang].qty   += i.jumlah;
        map[i.barang].omset += i.subtotal;
        const itemModal = (i.hargaModal || 0) * i.jumlah;
        map[i.barang].modal += itemModal;
        map[i.barang].laba  += i.subtotal - itemModal;
      });
    });
    return Object.values(map);
  }, [filteredSales, stok]);

  // ── Per SUPPLIER aggregation ─────────────────────────────────────────
  const supplierData = useMemo(() => {
    const map = {};
    itemData.forEach(it => {
      const sup = it.supplier;
      if (!map[sup]) map[sup] = { supplier: sup, qty: 0, omset: 0, modal: 0, laba: 0, items: [] };
      map[sup].qty   += it.qty;
      map[sup].omset += it.omset;
      map[sup].modal += it.modal;
      map[sup].laba  += it.laba;
      map[sup].items.push(it.nama);
    });
    return Object.values(map);
  }, [itemData]);

  // ── Summary ──────────────────────────────────────────────────────────
  const totalOmset = itemData.reduce((s, i) => s + i.omset, 0);
  const totalModal = itemData.reduce((s, i) => s + i.modal, 0);
  const totalLaba  = itemData.reduce((s, i) => s + i.laba,  0);
  const totalQty   = itemData.reduce((s, i) => s + i.qty,   0);

  // ── Sorting helper ───────────────────────────────────────────────────
  const sortFn = (a, b) => {
    const mult = sortDir === 'desc' ? -1 : 1;
    if (sortKey === 'margin') return mult * (parseFloat(pct(a.laba, a.omset)) - parseFloat(pct(b.laba, b.omset)));
    return mult * (a[sortKey] - b[sortKey]);
  };
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const SortIcon = ({ k }) => sortKey === k
    ? <i className={`fa-solid fa-sort-${sortDir === 'desc' ? 'down' : 'up'}`} style={{ fontSize: 10, marginLeft: 4, color: 'var(--brand)' }} />
    : <i className="fa-solid fa-sort" style={{ fontSize: 10, marginLeft: 4, color: 'var(--text-muted)' }} />;

  // ── Filtered + sorted ────────────────────────────────────────────────
  const displayItems = useMemo(() => {
    const sTerm = searchItem.toLowerCase();
    return itemData
      .filter(i => !sTerm || i.nama.toLowerCase().includes(sTerm) || i.supplier.toLowerCase().includes(sTerm))
      .sort(sortFn);
  }, [itemData, searchItem, sortKey, sortDir]);

  const displaySuppliers = useMemo(() => {
    const sTerm = searchSupplier.toLowerCase();
    return supplierData
      .filter(s => !sTerm || s.supplier.toLowerCase().includes(sTerm))
      .sort(sortFn);
  }, [supplierData, searchSupplier, sortKey, sortDir]);

  // ── Chart data ───────────────────────────────────────────────────────
  const barItems = [...displayItems].sort((a, b) => b.laba - a.laba).slice(0, 12).map(i => ({
    nama: i.nama.length > 14 ? i.nama.slice(0, 13) + '…' : i.nama,
    Omset: i.omset, Modal: i.modal, Laba: i.laba,
  }));
  const pieSupplier = supplierData.map((s, i) => ({
    name: s.supplier, value: Math.max(0, s.laba), fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const exportCSV = () => {
    const rows = view === 'item'
      ? [['Produk','Supplier','Qty','Omset','Modal','Laba','Margin%'], ...displayItems.map(i => [i.nama, i.supplier, i.qty, i.omset, i.modal, i.laba, pct(i.laba, i.omset)])]
      : [['Supplier','Qty','Omset','Modal','Laba','Margin%'], ...displaySuppliers.map(s => [s.supplier, s.qty, s.omset, s.modal, s.laba, pct(s.laba, s.omset)])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `labarugi-${view}-${start || 'semua'}.csv`;
    a.click();
  };

  const PRESET_BTNS = [['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini'],['year','Tahun Ini'],['all','Semua'],['custom','Custom']];

  return (
    <div className="tab-page active fade-up">

      {/* ── KPI Cards ── */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Total Omset</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalOmset)}</div>
          <div className="stat-meta">{totalQty} item terjual</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-box" />
          <div className="stat-label">Total Modal (HPP)</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalModal)}</div>
          <div className="stat-meta">harga pokok penjualan</div>
        </div>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-chart-line" />
          <div className="stat-label">Laba Kotor</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(totalLaba)}</div>
          <div className="stat-meta">Margin {pct(totalLaba, totalOmset)}%</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-tags" />
          <div className="stat-label">Jumlah Produk</div>
          <div className="stat-value">{itemData.length}</div>
          <div className="stat-meta">SKU terjual · {supplierData.length} supplier</div>
        </div>
      </div>

      {/* ── Filter & View toggle ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ padding: '12px 16px' }}>
          <div className="card-title"><i className="fa-solid fa-filter" /> Filter Periode</div>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
            <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> Export CSV
          </button>
        </div>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_BTNS.map(([p, l]) => (
            <button key={p} className={`date-preset-btn${preset === p ? ' active' : ''}`} onClick={() => setPreset(p)}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="date-range-inputs" style={{ padding: '0 16px 12px' }}>
            <span>Dari</span>
            <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            <span>–</span>
            <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        )}
        {/* View Switch */}
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${view === 'item' ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setView('item')}>
            <i className="fa-solid fa-box" /> Per Produk
          </button>
          <button className={`btn btn-sm ${view === 'supplier' ? 'btn-purple' : 'btn-ghost'}`} onClick={() => setView('supplier')}>
            <i className="fa-solid fa-truck" /> Per Supplier
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      {view === 'item' && barItems.length > 0 && (
        <div className="card mb-16" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-bar" /> Grafik Laba per Produk (Top 12)</div>
          </div>
          <div style={{ height: 250, padding: '0 8px 12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barItems} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nama" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={formatRpS} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip formatter={v => formatRp(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Omset" fill="#7c3aed" radius={[3,3,0,0]} />
                <Bar dataKey="Modal" fill="#0284c7" radius={[3,3,0,0]} />
                <Bar dataKey="Laba"  fill="#059669" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {view === 'supplier' && pieSupplier.length > 0 && (
        <div className="card mb-16" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-pie" /> Laba per Supplier</div>
          </div>
          <div style={{ height: 220, padding: '0 8px 12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieSupplier} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieSupplier.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={v => formatRp(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── TABLE: Per Produk ── */}
      {view === 'item' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><i className="fa-solid fa-box" /> Laba Rugi per Produk</div>
              <div className="card-subtitle">{displayItems.length} produk</div>
            </div>
          </div>
          <div style={{ padding: '8px 16px 12px' }}>
            <div className="form-input-icon">
              <i className="fa-solid fa-search" />
              <input className="form-input" placeholder="Cari produk atau supplier..." value={searchItem} onChange={e => setSearchItem(e.target.value)} id="lr-item-search" />
            </div>
          </div>

          {/* Desktop table */}
          <div className="desktop-table-view">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Supplier</th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('qty')}>Qty <SortIcon k="qty" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('omset')}>Omset <SortIcon k="omset" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('modal')}>Modal (HPP) <SortIcon k="modal" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('laba')}>Laba Kotor <SortIcon k="laba" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('margin')}>Margin <SortIcon k="margin" /></th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><i className="fa-solid fa-chart-line" /><p>Belum ada data penjualan di periode ini.</p></div></td></tr>
                  ) : displayItems.map((i, idx) => {
                    const margin = parseFloat(pct(i.laba, i.omset));
                    const statusColor = i.laba < 0 ? 'var(--rose)' : margin >= 30 ? 'var(--emerald)' : margin >= 15 ? 'var(--amber)' : 'var(--text-secondary)';
                    const statusLabel = i.laba < 0 ? 'RUGI' : margin >= 30 ? 'Sangat Baik' : margin >= 15 ? 'Baik' : 'Tipis';
                    return (
                      <tr key={idx} style={{ background: i.laba < 0 ? 'rgba(225,29,72,.04)' : undefined }}>
                        <td className="cell-main">{i.nama}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i.supplier}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{i.qty}</td>
                        <td className="cell-amount cell-green">{formatRp(i.omset)}</td>
                        <td className="cell-amount" style={{ color: 'var(--sky)' }}>{formatRp(i.modal)}</td>
                        <td className="cell-amount" style={{ color: i.laba < 0 ? 'var(--rose)' : 'var(--brand)', fontWeight: 800 }}>{formatRp(i.laba)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: statusColor }}>{margin}%</td>
                        <td><span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}22`, padding: '2px 8px', borderRadius: 99 }}>{statusLabel}</span></td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  {displayItems.length > 0 && (
                    <tr style={{ background: 'var(--brand-dim)', fontWeight: 800 }}>
                      <td colSpan={2} style={{ fontWeight: 800 }}>TOTAL</td>
                      <td style={{ textAlign: 'center' }}>{totalQty}</td>
                      <td className="cell-amount cell-green">{formatRp(totalOmset)}</td>
                      <td className="cell-amount" style={{ color: 'var(--sky)' }}>{formatRp(totalModal)}</td>
                      <td className="cell-amount" style={{ color: 'var(--brand)', fontWeight: 900, fontSize: 14 }}>{formatRp(totalLaba)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--brand)' }}>{pct(totalLaba, totalOmset)}%</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="mobile-cards-view" style={{ padding: '0 12px 12px' }}>
            {displayItems.map((i, idx) => {
              const margin = parseFloat(pct(i.laba, i.omset));
              const statusColor = i.laba < 0 ? 'var(--rose)' : margin >= 30 ? 'var(--emerald)' : margin >= 15 ? 'var(--amber)' : 'var(--text-secondary)';
              const statusLabel = i.laba < 0 ? 'RUGI' : margin >= 30 ? 'Sangat Baik' : margin >= 15 ? 'Baik' : 'Tipis';
              return (
                <div key={idx} className="trx-mobile-card" style={{ borderLeft: `3px solid ${statusColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{i.nama}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏭 {i.supplier} · {i.qty} pcs</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}22`, padding: '2px 8px', borderRadius: 99 }}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                    {[['Omset', formatRp(i.omset), 'var(--emerald)'], ['Modal', formatRp(i.modal), 'var(--sky)'], ['Laba', formatRp(i.laba), statusColor]].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center', background: 'var(--bg-hover)', borderRadius: 6, padding: '6px 4px' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 6, fontSize: 12, fontWeight: 700, color: statusColor }}>Margin: {margin}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABLE: Per Supplier ── */}
      {view === 'supplier' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><i className="fa-solid fa-truck" /> Laba Rugi per Supplier</div>
              <div className="card-subtitle">{displaySuppliers.length} supplier</div>
            </div>
          </div>
          <div style={{ padding: '8px 16px 12px' }}>
            <div className="form-input-icon">
              <i className="fa-solid fa-search" />
              <input className="form-input" placeholder="Cari nama supplier..." value={searchSupplier} onChange={e => setSearchSupplier(e.target.value)} id="lr-sup-search" />
            </div>
          </div>

          {/* Desktop table */}
          <div className="desktop-table-view">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Produk Terjual</th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('qty')}>Total Qty <SortIcon k="qty" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('omset')}>Total Omset <SortIcon k="omset" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('modal')}>Total Modal <SortIcon k="modal" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('laba')}>Total Laba <SortIcon k="laba" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('margin')}>Margin <SortIcon k="margin" /></th>
                  </tr>
                </thead>
                <tbody>
                  {displaySuppliers.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-truck" /><p>Belum ada data.</p></div></td></tr>
                  ) : displaySuppliers.map((s, idx) => {
                    const margin = parseFloat(pct(s.laba, s.omset));
                    const statusColor = s.laba < 0 ? 'var(--rose)' : margin >= 30 ? 'var(--emerald)' : margin >= 15 ? 'var(--amber)' : 'var(--text-secondary)';
                    return (
                      <tr key={idx} style={{ background: s.laba < 0 ? 'rgba(225,29,72,.04)' : undefined }}>
                        <td className="cell-main">
                          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                            <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand),var(--brand-dark))',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:800,flexShrink:0 }}>
                              {s.supplier.charAt(0).toUpperCase()}
                            </div>
                            {s.supplier}
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 180 }}>
                          {s.items.slice(0, 3).join(', ')}{s.items.length > 3 ? ` +${s.items.length - 3} lainnya` : ''}
                        </td>
                        <td style={{ textAlign:'center', fontWeight:700 }}>{s.qty}</td>
                        <td className="cell-amount cell-green">{formatRp(s.omset)}</td>
                        <td className="cell-amount" style={{ color:'var(--sky)' }}>{formatRp(s.modal)}</td>
                        <td className="cell-amount" style={{ color: s.laba < 0 ? 'var(--rose)' : 'var(--brand)', fontWeight:800 }}>{formatRp(s.laba)}</td>
                        <td style={{ textAlign:'center', fontWeight:700, color: statusColor }}>{margin}%</td>
                      </tr>
                    );
                  })}
                  {/* Total */}
                  {displaySuppliers.length > 0 && (
                    <tr style={{ background:'var(--brand-dim)', fontWeight:800 }}>
                      <td colSpan={2} style={{ fontWeight:800 }}>TOTAL</td>
                      <td style={{ textAlign:'center' }}>{totalQty}</td>
                      <td className="cell-amount cell-green">{formatRp(totalOmset)}</td>
                      <td className="cell-amount" style={{ color:'var(--sky)' }}>{formatRp(totalModal)}</td>
                      <td className="cell-amount" style={{ color:'var(--brand)', fontWeight:900, fontSize:14 }}>{formatRp(totalLaba)}</td>
                      <td style={{ textAlign:'center', fontWeight:800, color:'var(--brand)' }}>{pct(totalLaba,totalOmset)}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards supplier */}
          <div className="mobile-cards-view" style={{ padding:'0 12px 12px' }}>
            {displaySuppliers.map((s, idx) => {
              const margin = parseFloat(pct(s.laba, s.omset));
              const statusColor = s.laba < 0 ? 'var(--rose)' : margin >= 30 ? 'var(--emerald)' : margin >= 15 ? 'var(--amber)' : 'var(--text-secondary)';
              return (
                <div key={idx} className="trx-mobile-card" style={{ borderLeft:`3px solid ${statusColor}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={{ fontWeight:800, fontSize:14 }}>{s.supplier}</div>
                    <span style={{ fontSize:12, fontWeight:800, color:statusColor }}>{margin}%</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                    {s.items.slice(0,3).join(', ')}{s.items.length>3?` +${s.items.length-3} lainnya`:''}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {[['Omset', formatRp(s.omset),'var(--emerald)'],['Modal',formatRp(s.modal),'var(--sky)'],['Laba',formatRp(s.laba),statusColor]].map(([l,v,c]) => (
                      <div key={l} style={{ textAlign:'center', background:'var(--bg-hover)', borderRadius:6, padding:'6px 4px' }}>
                        <div style={{ fontSize:9, color:'var(--text-muted)' }}>{l}</div>
                        <div style={{ fontSize:11, fontWeight:800, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LabaRugiPage;
