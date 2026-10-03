import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

import { exportToCSV, printReportHTML } from '../services/exportUtils';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const formatRpShort = v => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}rb`;
  return String(v);
};

const CAT_EMOJI = { 'Pakaian Wanita': '👗', 'Pakaian Pria': '👕', 'Hijab': '🧕', 'Aksesoris': '💍', 'Lainnya': '📦' };
const PIE_COLORS = ['#7c3aed', '#0284c7', '#059669', '#d97706', '#e11d48', '#8b5cf6'];

const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

const StokLaporanPage = () => {
  const { appData } = useData();
  const allStok = appData.stok || [];
  const allPenjualan = appData.penjualan || [];
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchFilter, setSearchFilter]     = useState('');
  const [catFilter, setCatFilter]           = useState('');
  const [datePreset, setDatePreset]         = useState('month');
  const [dateStart, setDateStart]           = useState('');
  const [dateEnd, setDateEnd]               = useState('');

  // Unique supplier list dari semua stok
  const supplierList = useMemo(() => {
    const set = new Set();
    allStok.forEach(i => {
      (i.supplierList || []).forEach(s => { if (s) set.add(s); });
      if (i.supplier)     set.add(i.supplier);
      if (i.suplier)      set.add(i.suplier);
      if (i.nama_suplier) set.add(i.nama_suplier);
    });
    return [...set].sort();
  }, [allStok]);

  // Filtered stok berdasarkan supplier, search, dan kategori
  const stok = useMemo(() => {
    return allStok.filter(i => {
      const suppliers = [
        ...(i.supplierList || []),
        i.supplier, i.suplier, i.nama_suplier
      ].filter(Boolean);
      const matchSupplier = !supplierFilter || suppliers.includes(supplierFilter);
      const sTerm = searchFilter.toLowerCase().trim();
      const matchSearch = !sTerm ||
        (i.nama_barang && i.nama_barang.toLowerCase().includes(sTerm)) ||
        suppliers.some(s => s.toLowerCase().includes(sTerm));
      const matchCat = !catFilter || i.kategori === catFilter;
      return matchSupplier && matchSearch && matchCat;
    });
  }, [allStok, supplierFilter, searchFilter, catFilter]);

  // Summary stats (dari stok terfilter)
  const totalSkus   = stok.length;
  const totalItems  = stok.reduce((s, i) => s + i.stokTersedia, 0);
  const nilaiModal  = stok.reduce((s, i) => s + i.hargaModal * i.stokTersedia, 0);
  const nilaiJual   = stok.reduce((s, i) => s + i.hargaJual * i.stokTersedia, 0);
  const potensiLaba = nilaiJual - nilaiModal;
  const habis       = stok.filter(i => i.stokTersedia <= 0).length;
  const menipis     = stok.filter(i => i.stokTersedia > 0 && i.stokTersedia <= 5).length;

  // 🚀 Fast Moving List
  const fastMovingList = useMemo(() => {
    const soldMap = {};
    allPenjualan.forEach(t => {
      (t.items || []).forEach(i => {
        soldMap[i.barang] = (soldMap[i.barang] || 0) + i.jumlah;
      });
    });
    return allStok
      .map(s => ({ ...s, terjual: soldMap[s.nama_barang] || 0 }))
      .filter(s => s.terjual >= 2)
      .sort((a, b) => b.terjual - a.terjual)
      .slice(0, 8);
  }, [allStok, allPenjualan]);

  // 🐢 Slow Moving List (Stok Mati)
  const slowMovingList = useMemo(() => {
    const soldMap = {};
    allPenjualan.forEach(t => {
      (t.items || []).forEach(i => {
        soldMap[i.barang] = (soldMap[i.barang] || 0) + i.jumlah;
      });
    });
    return allStok
      .map(s => ({ ...s, terjual: soldMap[s.nama_barang] || 0 }))
      .filter(s => s.stokTersedia > 0 && s.terjual <= 1)
      .sort((a, b) => b.stokTersedia - a.stokTersedia)
      .slice(0, 8);
  }, [allStok, allPenjualan]);

  // Stok per kategori (pie chart)
  const byCategory = useMemo(() => {
    const map = {};
    stok.forEach(i => {
      if (!map[i.kategori]) map[i.kategori] = { name: i.kategori, items: 0, nilai: 0 };
      map[i.kategori].items += i.stokTersedia;
      map[i.kategori].nilai += i.hargaModal * i.stokTersedia;
    });
    return Object.values(map).sort((a, b) => b.nilai - a.nilai);
  }, [stok]);

  // Date range for penjualan filter
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

  // Filter penjualan by date
  const penjualan = useMemo(() => allPenjualan.filter(t => {
    if (!dStart && !dEnd) return true;
    return t.tanggal >= dStart && t.tanggal <= dEnd;
  }), [allPenjualan, dStart, dEnd]);

  // Produk terlaris — difilter by nama produk yang ada di stok terfilter
  const filteredStokNames = useMemo(() => new Set(stok.map(i => i.nama_barang)), [stok]);
  const topProducts = useMemo(() => {
    const map = {};
    penjualan.forEach(t => {
      (t.items || []).forEach(i => {
        if ((supplierFilter || catFilter || searchFilter) && !filteredStokNames.has(i.barang)) return;
        if (!map[i.barang]) map[i.barang] = { nama: i.barang, qty: 0, omset: 0, laba: 0 };
        map[i.barang].qty   += i.jumlah;
        map[i.barang].omset += i.subtotal;
        map[i.barang].laba  += (i.hargaJual - i.hargaModal) * i.jumlah;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [penjualan, supplierFilter, catFilter, searchFilter, filteredStokNames]);

  // Stok rendah / warning list
  const warningList = stok
    .filter(i => i.stokTersedia <= 5)
    .sort((a, b) => a.stokTersedia - b.stokTersedia);

  // Stok per produk (bar chart)
  const stokChartData = stok
    .slice()
    .sort((a, b) => b.stokTersedia - a.stokTersedia)
    .slice(0, 15)
    .map(i => ({ nama: i.nama_barang.length > 14 ? i.nama_barang.slice(0, 14) + '…' : i.nama_barang, stok: i.stokTersedia, nilai: i.hargaModal * i.stokTersedia }));

  const CATEGORIES = ['Pakaian Wanita','Pakaian Pria','Hijab','Aksesoris','Lainnya'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.name === 'Nilai Stok' ? formatRp(p.value) : `${p.value} pcs`}
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ fontWeight: 700 }}>{payload[0].name}</div>
        <div>{payload[0].value} item</div>
        <div>{formatRp(payload[0].payload.nilai)}</div>
      </div>
    );
  };

  return (
    <div className="tab-page active fade-up">

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ padding: '12px 16px' }}>
          <div className="card-title"><i className="fa-solid fa-filter" /> Filter Laporan Stok</div>
          {(supplierFilter || searchFilter || catFilter || datePreset !== 'month') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSupplierFilter(''); setSearchFilter(''); setCatFilter(''); setDatePreset('month'); }}
            >
              <i className="fa-solid fa-xmark" /> Reset
            </button>
          )}
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Cari barang */}
          <div className="form-input-icon" style={{ flex: 1, minWidth: 160 }}>
            <i className="fa-solid fa-search" />
            <input
              className="form-input"
              placeholder="Cari nama barang..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              id="stok-laporan-search"
            />
          </div>
          {/* Filter Supplier */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <i className="fa-solid fa-truck" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }} />
            <select
              className="form-input"
              style={{ paddingLeft: 32 }}
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              id="stok-laporan-supplier"
            >
              <option value="">Semua Supplier</option>
              {supplierList.map(s => <option key={s} value={s}>🏭 {s}</option>)}
            </select>
          </div>
          {/* Filter Kategori */}
          <select
            className="form-input"
            style={{ flex: 1, minWidth: 150 }}
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            id="stok-laporan-cat"
          >
            <option value="">Semua Kategori</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const headers = ['Nama Barang', 'Kategori', 'Stok Tersedia', 'Harga Modal', 'Harga Jual', 'Nilai Stok Modal', 'Nilai Stok Jual', 'Supplier'];
                const rows = stok.map(i => [
                  i.nama_barang,
                  i.kategori,
                  i.stokTersedia,
                  i.hargaModal,
                  i.hargaJual,
                  i.hargaModal * i.stokTersedia,
                  i.hargaJual * i.stokTersedia,
                  i.supplierList?.join(', ') || i.supplier || i.suplier || ''
                ]);
                exportToCSV('Laporan_Stok_Barang', headers, rows);
              }}
              title="Unduh CSV/Excel"
            >
              <i className="fa-solid fa-file-excel" style={{ color: 'var(--emerald)' }} /> Excel
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                let html = '<table><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Harga Modal</th><th>Harga Jual</th><th>Nilai Stok</th></tr></thead><tbody>';
                stok.forEach(i => {
                  html += `<tr><td>${i.nama_barang}</td><td>${i.kategori}</td><td>${i.stokTersedia} pcs</td><td>${formatRp(i.hargaModal)}</td><td>${formatRp(i.hargaJual)}</td><td>${formatRp(i.hargaModal * i.stokTersedia)}</td></tr>`;
                });
                html += '</tbody></table>';
                printReportHTML('LAPORAN ANALITIK STOK BARANG', 'Rincian seluruh stok produk Agnes Fashion POS', html);
              }}
              title="Cetak PDF / Print"
            >
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> PDF
            </button>
          </div>
        </div>
        {/* Date range for produk terlaris */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            <i className="fa-solid fa-calendar" style={{ marginRight: 4 }} /> Periode Produk Terlaris:
          </div>
          <div className="date-filter-bar">
            {[['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini'],['year','Tahun Ini'],['all','Semua'],['custom','Custom']].map(([p,l]) => (
              <button key={p} className={`date-preset-btn${datePreset === p ? ' active' : ''}`} onClick={() => setDatePreset(p)}>{l}</button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="date-range-inputs" style={{ marginTop: 6 }}>
              <span>Dari</span>
              <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
        </div>
        {/* Active filter badges */}
        {(supplierFilter || catFilter) && (
          <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {supplierFilter && (
              <span className="badge badge-violet" style={{ fontSize: 11, padding: '4px 10px' }}>
                🏭 {supplierFilter}
                <button onClick={() => setSupplierFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, color: 'inherit', fontSize: 11, padding: 0 }}>×</button>
              </span>
            )}
            {catFilter && (
              <span className="badge badge-sky" style={{ fontSize: 11, padding: '4px 10px' }}>
                {catFilter}
                <button onClick={() => setCatFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, color: 'inherit', fontSize: 11, padding: 0 }}>×</button>
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {totalSkus} produk ditemukan
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="stok-laporan-stats-grid">
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-tags" />
          <div className="stat-label">Total SKU</div>
          <div className="stat-value">{totalSkus}</div>
          <div className="stat-meta">{totalItems} item tersedia</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Nilai Modal Stok</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(nilaiModal)}</div>
          <div className="stat-meta">Total investasi stok</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-store" />
          <div className="stat-label">Nilai Jual Stok</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(nilaiJual)}</div>
          <div className="stat-meta">Potensi omset</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-chart-line" />
          <div className="stat-label">Potensi Laba</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(potensiLaba)}</div>
          <div className="stat-meta">Jika semua terjual</div>
        </div>
      </div>

      {/* Alert Row */}
      {(habis > 0 || menipis > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {habis > 0 && (
            <div style={{ flex: 1, minWidth: 200, background: 'var(--rose-dim)', border: '1px solid rgba(225,29,72,.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fa-solid fa-ban" style={{ color: 'var(--rose)', fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--rose)', fontSize: 13 }}>{habis} Produk HABIS</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Segera lakukan restock</div>
              </div>
            </div>
          )}
          {menipis > 0 && (
            <div style={{ flex: 1, minWidth: 200, background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--amber)', fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 13 }}>{menipis} Produk MENIPIS</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok ≤ 5 unit</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="stok-laporan-charts-grid">
        {/* Bar chart stok per produk */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-bar" /> Stok per Produk (Top 15)</div>
          </div>
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stokChartData} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nama" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="stok" name="Stok (pcs)" fill="#7c3aed" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart per kategori */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-pie" /> Distribusi Kategori</div>
          </div>
          <div style={{ height: 220, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="items" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byCategory.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{CAT_EMOJI[c.name] || '📦'} {c.name}</span>
                <span style={{ fontWeight: 700 }}>{c.items} pcs</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🚀 Fast-Moving vs 🐢 Slow-Moving Analysis */}
      <div className="card mb-16" style={{ border: '1px solid var(--border)' }}>
        <div className="card-header">
          <div className="card-title">
            <i className="fa-solid fa-gauge-high" style={{ color: 'var(--brand)' }} /> Analisis Perputaran Barang (Fast vs Slow Moving)
          </div>
          <span className="badge badge-violet">30 Hari Terakhir</span>
        </div>
        <div className="card-body" style={{ padding: 16 }}>
          <div className="form-grid form-grid-2" style={{ gap: 16 }}>

            {/* Fast Moving */}
            <div style={{ background: 'var(--emerald-dim)', border: '1px solid rgba(5,150,105,.2)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-bolt" /> 🚀 Fast-Moving (Perputaran Cepat)
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Produk paling laris dengan tingkat penjualan tinggi. Segera persiapkan restok!
              </p>
              {fastMovingList.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Belum ada data transaksi yang cukup.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fastMovingList.map(item => (
                    <div key={item.nama_barang} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{CAT_EMOJI[item.kategori] || '📦'} {item.nama_barang}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="badge badge-green">Terjual {item.terjual}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Stok: {item.stokTersedia}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slow Moving (Stok Mati) */}
            <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-turtle" /> 🐢 Slow-Moving / Stok Mati
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Barang dengan penjualan lambat (≤1 unit). Rekomendasi: Adakan promo / discount sale!
              </p>
              {slowMovingList.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tidak ada stok mati yang terdeteksi.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slowMovingList.map(item => (
                    <div key={item.nama_barang} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{CAT_EMOJI[item.kategori] || '📦'} {item.nama_barang}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="badge badge-amber">Sisa {item.stokTersedia} pcs</span>
                        <span style={{ fontSize: 10, color: 'var(--rose)', fontWeight: 700 }}>💡 Discount Sale</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Produk Terlaris */}
      {topProducts.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-trophy" style={{ color: '#d97706' }} /> Produk Terlaris</div>
          </div>
          
          {/* Desktop Table */}
          <div className="overflow-x-auto desktop-table-view">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produk</th>
                  <th>Total Terjual</th>
                  <th>Total Omset</th>
                  <th>Total Laba</th>
                  <th>Stok Tersisa</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, idx) => {
                  const stokItem = stok.find(s => s.nama_barang === p.nama);
                  return (
                    <tr key={p.nama}>
                      <td>
                        <span style={{ fontWeight: 800, color: idx < 3 ? '#d97706' : 'var(--text-muted)', fontSize: idx < 3 ? 15 : 12 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                        </span>
                      </td>
                      <td className="cell-main">{p.nama}</td>
                      <td><span className="badge badge-violet">{p.qty} pcs</span></td>
                      <td className="cell-amount cell-green">{formatRp(p.omset)}</td>
                      <td className="cell-amount cell-violet">{formatRp(p.laba)}</td>
                      <td>
                        {stokItem ? (
                          <span className={`badge ${stokItem.stokTersedia <= 0 ? 'badge-red' : stokItem.stokTersedia <= 5 ? 'badge-amber' : 'badge-green'}`}>
                            {stokItem.stokTersedia} pcs
                          </span>
                        ) : <span className="badge badge-gray">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="mobile-cards-view">
            {topProducts.map((p, idx) => {
              const stokItem = stok.find(s => s.nama_barang === p.nama);
              return (
                <div key={p.nama} className="stok-mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nama}
                      </span>
                    </div>
                    <span className="badge badge-violet">{p.qty} pcs terjual</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>OMSET</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>{formatRp(p.omset)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>LABA</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{formatRp(p.laba)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>SISA STOK</span>
                      {stokItem ? (
                        <span className={`badge ${stokItem.stokTersedia <= 0 ? 'badge-red' : stokItem.stokTersedia <= 5 ? 'badge-amber' : 'badge-green'}`} style={{ marginTop: 2 }}>
                          {stokItem.stokTersedia} pcs
                        </span>
                      ) : <span className="badge badge-gray">—</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning List */}
      {warningList.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--amber)' }} /> Perlu Perhatian — Stok Rendah</div>
            <span className="badge badge-amber">{warningList.length} produk</span>
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto desktop-table-view">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Sisa Stok</th>
                  <th>Harga Jual</th>
                  <th>Supplier Terakhir</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {warningList.map(item => (
                  <tr key={item.nama_barang}>
                    <td><span style={{ marginRight: 8 }}>{CAT_EMOJI[item.kategori] || '📦'}</span><span className="cell-main">{item.nama_barang}</span></td>
                    <td><span className="badge badge-violet">{item.kategori}</span></td>
                    <td><b style={{ color: item.stokTersedia <= 0 ? 'var(--rose)' : 'var(--amber)' }}>{item.stokTersedia} pcs</b></td>
                    <td className="cell-amount">{formatRp(item.hargaJual)}</td>
                    <td style={{ fontSize: 11 }}>{item.supplierList?.[0] || '—'}</td>
                    <td>
                      {item.stokTersedia <= 0
                        ? <span className="badge badge-red">🚫 Habis</span>
                        : <span className="badge badge-amber">⚠️ Menipis</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="mobile-cards-view">
            {warningList.map(item => (
              <div key={item.nama_barang} className="stok-mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{CAT_EMOJI[item.kategori] || '📦'}</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nama_barang}
                    </span>
                  </div>
                  {item.stokTersedia <= 0
                    ? <span className="badge badge-red">🚫 Habis</span>
                    : <span className="badge badge-amber">⚠️ Sisa {item.stokTersedia}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>KATEGORI</span>
                    <span className="badge badge-violet" style={{ marginTop: 2 }}>{item.kategori}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>HARGA JUAL</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{formatRp(item.hargaJual)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>SUPPLIER</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {item.supplierList?.[0] || '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StokLaporanPage;
