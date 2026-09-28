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
  const { appData, toast } = useData();
  const [preset, setPreset] = useState('today');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

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
    return { start: '', end: '' }; // all
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

  // Chart data — group by date
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

  // Share via WA
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
            <div className="card-title"><i className="fa-solid fa-chart-area" /> Grafik Omset & Laba</div>
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
                <th>Tanggal & Jam</th>
                <th>Pelanggan</th>
                <th>Item</th>
                <th>Metode</th>
                <th>Omset</th>
                <th>Laba</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={7}>
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
            <div className="card-title"><i className="fa-solid fa-truck-ramp-box" /> Riwayat Pembelian & Restock</div>
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
    </div>
  );
};

export default LaporanPage;
