import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

const DashboardPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const today = isoDate(new Date());
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingMonthlyTarget, setEditingMonthlyTarget] = useState(false);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState('');

  const penjualan = appData.penjualan || [];
  const stok = appData.stok || [];
  const settings = appData.settings || {};
  const targets = appData.targets || {};
  const todayTarget = targets[today] || 0;

  // Today's sales
  const todaySales = penjualan.filter(t => t.tanggal === today);
  const omsetHariIni = todaySales.reduce((s, t) => s + t.totalPenjualan, 0);
  const labaHariIni  = todaySales.reduce((s, t) => s + t.laba, 0);
  const trxHariIni   = todaySales.length;

  // Monthly sales
  const currentMonthPrefix = today.slice(0, 7);
  const monthlySales = penjualan.filter(t => t.tanggal && t.tanggal.startsWith(currentMonthPrefix));
  const omsetBulanIni = monthlySales.reduce((s, t) => s + t.totalPenjualan, 0);
  const monthlyTarget = settings.monthlyTarget || 50000000;
  const monthlyPct = monthlyTarget > 0 ? Math.round((omsetBulanIni / monthlyTarget) * 100) : 0;
  const monthlyProgressColor = monthlyPct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : monthlyPct >= 60 ? 'linear-gradient(90deg, #7c3aed, #6366f1)' : 'linear-gradient(90deg, #f59e0b, #ec4899)';

  // Yesterday
  const yesterday = isoDate(new Date(Date.now() - 86400000));
  const omsetKemarin = penjualan.filter(t => t.tanggal === yesterday).reduce((s, t) => s + t.totalPenjualan, 0);
  const growthPct = omsetKemarin > 0 ? (((omsetHariIni - omsetKemarin) / omsetKemarin) * 100).toFixed(0) : null;

  // Target progress
  const targetPct = todayTarget > 0 ? Math.min(100, Math.round((omsetHariIni / todayTarget) * 100)) : 0;

  // Stok kritis
  const stokHabis   = stok.filter(i => i.stokTersedia <= 0);
  const stokMenipis = stok.filter(i => i.stokTersedia > 0 && i.stokTersedia <= 5);

  // Top produk hari ini
  const topToday = useMemo(() => {
    const map = {};
    todaySales.forEach(t => {
      (t.items || []).forEach(i => {
        if (!map[i.barang]) map[i.barang] = { nama: i.barang, qty: 0, omset: 0 };
        map[i.barang].qty   += i.jumlah;
        map[i.barang].omset += i.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [todaySales]);

  // Recent transactions (last 5)
  const recentTrx = [...penjualan]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.waktu || '').localeCompare(a.waktu || ''))
    .slice(0, 5);

  const saveTarget = async () => {
    const val = parseFloat(targetInput) || 0;
    await saveAndSync({ ...appData, targets: { ...targets, [today]: val } });
    toast(`🎯 Target hari ini diset: ${formatRp(val)}`, 'success');
    setEditingTarget(false);
  };

  const saveMonthlyTarget = async () => {
    const val = parseFloat(monthlyTargetInput) || 0;
    await saveAndSync({
      ...appData,
      settings: { ...settings, monthlyTarget: val }
    });
    toast(`🎯 Target omset bulanan diset: ${formatRp(val)}`, 'success');
    setEditingMonthlyTarget(false);
  };

  const progressColor = targetPct >= 100 ? 'var(--emerald)' : targetPct >= 60 ? 'var(--amber)' : 'var(--rose)';

  return (
    <div className="tab-page active fade-up">

      {/* ── Greeting ── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', background: 'linear-gradient(135deg, #4c1d95, #7c3aed)', borderRadius: 14, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Selamat datang, {settings.storeName || 'Agnes Fashion'}! 👋</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '10px 16px', textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: .8 }}>Omset Hari Ini</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{formatRp(omsetHariIni)}</div>
          <div style={{ fontSize: 11, opacity: .8 }}>{trxHariIni} transaksi</div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Omset Hari Ini</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(omsetHariIni)}</div>
          <div className="stat-meta">
            {growthPct !== null
              ? <span style={{ color: parseFloat(growthPct) >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 700 }}>
                  {parseFloat(growthPct) >= 0 ? '▲' : '▼'} {Math.abs(growthPct)}% vs kemarin
                </span>
              : 'Belum ada data kemarin'}
          </div>
        </div>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-chart-line" />
          <div className="stat-label">Laba Hari Ini</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(labaHariIni)}</div>
          <div className="stat-meta">{trxHariIni} transaksi selesai</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-triangle-exclamation" />
          <div className="stat-label">Stok Menipis</div>
          <div className="stat-value">{stokMenipis.length + stokHabis.length}</div>
          <div className="stat-meta">{stokHabis.length} habis · {stokMenipis.length} kritis</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-boxes-stacked" />
          <div className="stat-label">Total SKU</div>
          <div className="stat-value">{stok.length}</div>
          <div className="stat-meta">{stok.reduce((s, i) => s + i.stokTersedia, 0)} item tersedia</div>
        </div>
      </div>

      {/* ── Progress Bar Dashboard: Target Omset Bulanan & Harian ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        
        {/* Target Omset Bulanan */}
        <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="card-header" style={{ padding: '12px 16px' }}>
            <div className="card-title" style={{ fontSize: 14 }}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#7c3aed' }} /> Target Omset Bulanan
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setMonthlyTargetInput(monthlyTarget); setEditingMonthlyTarget(e => !e); }}>
              <i className="fa-solid fa-pen-to-square" /> {editingMonthlyTarget ? 'Batal' : 'Ubah'}
            </button>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {editingMonthlyTarget ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Contoh: 50000000"
                  value={monthlyTargetInput}
                  onChange={e => setMonthlyTargetInput(e.target.value)}
                  id="monthly-target-input"
                />
                <button className="btn btn-purple" onClick={saveMonthlyTarget}>
                  Simpan
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {formatRp(omsetBulanIni)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Target: {formatRp(monthlyTarget)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 99,
                    background: monthlyPct >= 100 ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)',
                    color: monthlyPct >= 100 ? '#059669' : '#7c3aed'
                  }}>
                    {monthlyPct}%
                  </span>
                </div>

                {/* Main Progress Bar */}
                <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden', margin: '10px 0 6px 0', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, monthlyPct)}%`,
                    background: monthlyProgressColor,
                    borderRadius: 99,
                    transition: 'width .6s ease',
                    minWidth: monthlyPct > 0 ? 8 : 0
                  }} />
                </div>

                {monthlyPct < 100 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sisa omset: <strong>{formatRp(Math.max(0, monthlyTarget - omsetBulanIni))}</strong></span>
                    <span>{monthlySales.length} transaksi bulan ini</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 800 }}>
                    🎉 Target bulan ini tercapai! Terlampaui +{formatRp(omsetBulanIni - monthlyTarget)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Target Penjualan Harian */}
        <div className="card" style={{ borderLeft: '4px solid #059669' }}>
          <div className="card-header" style={{ padding: '12px 16px' }}>
            <div className="card-title" style={{ fontSize: 14 }}>
              <i className="fa-solid fa-bullseye" style={{ color: '#059669' }} /> Target Penjualan Harian
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setTargetInput(todayTarget || ''); setEditingTarget(e => !e); }}>
              <i className="fa-solid fa-pen-to-square" /> {editingTarget ? 'Batal' : 'Ubah'}
            </button>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {editingTarget ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Contoh: 1000000"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  id="target-input"
                />
                <button className="btn btn-purple" onClick={saveTarget}>
                  Simpan
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {formatRp(omsetHariIni)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {todayTarget > 0 ? `Target: ${formatRp(todayTarget)}` : 'Belum diset'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 99,
                    background: targetPct >= 100 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: targetPct >= 100 ? '#059669' : '#d97706'
                  }}>
                    {todayTarget > 0 ? `${targetPct}%` : '0%'}
                  </span>
                </div>

                <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden', margin: '10px 0 6px 0' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, targetPct)}%`,
                    background: progressColor,
                    borderRadius: 99,
                    transition: 'width .6s ease',
                    minWidth: targetPct > 0 ? 8 : 0
                  }} />
                </div>

                {todayTarget > 0 && targetPct < 100 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Sisa: {formatRp(todayTarget - omsetHariIni)} lagi untuk mencapai target hari ini
                  </div>
                ) : targetPct >= 100 ? (
                  <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 800 }}>
                    🎉 Target hari ini tercapai!
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Klik 'Ubah' untuk memasang target harian
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* ── Top Produk Hari Ini ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: 13 }}><i className="fa-solid fa-fire" style={{ color: 'var(--amber)' }} /> Top Produk Hari Ini</div>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            {topToday.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0', fontSize: 12 }}>
                Belum ada penjualan hari ini
              </div>
            ) : topToday.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < topToday.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, background: i === 0 ? 'var(--amber)' : i === 1 ? '#9ca3af' : i === 2 ? '#92400e' : 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: i < 3 ? '#fff' : 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{p.nama}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald)' }}>{p.qty}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stok Kritis ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: 13 }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--rose)' }} /> Stok Kritis</div>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            {stokHabis.length + stokMenipis.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--emerald)', padding: '16px 0', fontSize: 12 }}>
                ✅ Semua stok aman
              </div>
            ) : [...stokHabis, ...stokMenipis].slice(0, 5).map((i, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx < 4 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{i.nama_barang}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: i.stokTersedia <= 0 ? 'var(--rose)' : 'var(--amber)', background: i.stokTersedia <= 0 ? 'var(--rose-dim)' : 'var(--amber-dim)', padding: '2px 8px', borderRadius: 99 }}>
                  {i.stokTersedia <= 0 ? 'HABIS' : `${i.stokTersedia} pcs`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><i className="fa-solid fa-clock-rotate-left" /> Transaksi Terbaru</div>
        </div>
        {recentTrx.length === 0 ? (
          <div className="empty-state"><i className="fa-solid fa-receipt" /><p>Belum ada transaksi.</p></div>
        ) : recentTrx.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{t.kodeTrx}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.tanggal} · {t.waktu} · {t.pelanggan || 'Umum'}</div>
              <div style={{ fontSize: 11 }}>{(t.items || []).map(i => `${i.barang}×${i.jumlah}`).join(', ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)' }}>{formatRp(t.totalPenjualan)}</div>
              <span className="badge badge-violet" style={{ fontSize: 9 }}>{t.metodeBayar}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
