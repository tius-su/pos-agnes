import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { printReportHTML } from '../services/exportUtils';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const isoDate = d => d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

export const EXPENSE_CATEGORIES = [
  'Sewa Tempat',
  'Listrik & Air',
  'Gaji Karyawan',
  'Plastik & Struk',
  'Transportasi & Logistik',
  'Pemasaran & Iklan',
  'Makan & Minum Karyawan',
  'Perlengkapan Toko',
  'Biaya Pengiriman',
  'Kebersihan & Keamanan',
  'Lain-lain'
];

const emptyForm = {
  tanggal: isoDate(new Date()),
  kategori: 'Plastik & Struk',
  nominal: '',
  keterangan: '',
  pembayaran: 'Tunai'
};

const PengeluaranPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [preset, setPreset] = useState('month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const pengeluaran = appData.pengeluaran || [];

  const getRange = () => {
    const today = new Date();
    if (preset === 'today') { const d = isoDate(today); return { start: d, end: d }; }
    if (preset === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: isoDate(y), end: isoDate(y) }; }
    if (preset === 'week') { const w = new Date(today); w.setDate(w.getDate() - 6); return { start: isoDate(w), end: isoDate(today) }; }
    if (preset === 'month') { const m = new Date(today.getFullYear(), today.getMonth(), 1); return { start: isoDate(m), end: isoDate(today) }; }
    if (preset === 'custom') return { start: dateStart, end: dateEnd };
    return { start: '', end: '' };
  };

  const { start, end } = getRange();

  const filteredExpenses = useMemo(() => {
    return pengeluaran.filter(e => {
      const matchDate = (!start && !end) || (e.tanggal >= start && e.tanggal <= end);
      const sTerm = search.toLowerCase().trim();
      const matchSearch = !sTerm ||
        (e.kategori && e.kategori.toLowerCase().includes(sTerm)) ||
        (e.keterangan && e.keterangan.toLowerCase().includes(sTerm)) ||
        (e.pembayaran && e.pembayaran.toLowerCase().includes(sTerm));
      return matchDate && matchSearch;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at?.localeCompare(a.created_at || ''));
  }, [pengeluaran, start, end, search]);

  const totalPengeluaran = filteredExpenses.reduce((sum, e) => sum + (e.nominal || 0), 0);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      map[e.kategori] = (map[e.kategori] || 0) + (e.nominal || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const openAddModal = () => {
    setEditItem(null);
    setForm({ ...emptyForm, tanggal: isoDate(new Date()) });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setForm({
      tanggal: item.tanggal || isoDate(new Date()),
      kategori: item.kategori || 'Lain-lain',
      nominal: String(item.nominal || ''),
      keterangan: item.keterangan || '',
      pembayaran: item.pembayaran || 'Tunai'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nominal = parseFloat(form.nominal) || 0;
    if (nominal <= 0) {
      toast('Nominal pengeluaran harus lebih dari 0', 'error');
      return;
    }

    let nextPengeluaran = [...pengeluaran];

    if (editItem) {
      // Update
      nextPengeluaran = nextPengeluaran.map(e =>
        e.id === editItem.id
          ? { ...e, ...form, nominal }
          : e
      );
      toast('✅ Pengeluaran berhasil diperbarui!', 'success');
    } else {
      // Create
      const newItem = {
        id: 'EXP-' + Date.now(),
        tanggal: form.tanggal,
        kategori: form.kategori,
        nominal,
        keterangan: form.keterangan,
        pembayaran: form.pembayaran,
        created_at: new Date().toISOString()
      };
      nextPengeluaran.push(newItem);
      toast('✅ Pengeluaran baru berhasil dicatat!', 'success');
    }

    await saveAndSync({ ...appData, pengeluaran: nextPengeluaran });
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const nextPengeluaran = pengeluaran.filter(e => e.id !== deleteConfirmId);
    await saveAndSync({ ...appData, pengeluaran: nextPengeluaran });
    toast('Pengeluaran berhasil dihapus', 'success');
    setDeleteConfirmId(null);
  };

  const exportCSV = () => {
    const rows = [
      ['Tanggal', 'Kategori', 'Nominal', 'Keterangan', 'Metode Bayar'],
      ...filteredExpenses.map(e => [e.tanggal, e.kategori, e.nominal, `"${e.keterangan || ''}"`, e.pembayaran])
    ];
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pengeluaran-${start || 'semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPDF = () => {
    let tableHtml = '<table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Nominal</th><th>Keterangan</th><th>Metode</th></tr></thead><tbody>';
    filteredExpenses.forEach(e => {
      tableHtml += `<tr><td>${e.tanggal}</td><td>${e.kategori}</td><td>${formatRp(e.nominal)}</td><td>${e.keterangan || '-'}</td><td>${e.pembayaran}</td></tr>`;
    });
    tableHtml += `<tr style="font-weight:bold;background:#f3f4f6"><td colspan="2">TOTAL PENGELUARAN</td><td>${formatRp(totalPengeluaran)}</td><td colspan="2"></td></tr></tbody></table>`;

    printReportHTML('LAPORAN PENGELUARAN OPERASIONAL', `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}`, tableHtml);
  };

  const PRESET_BTNS = [['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['week', '7 Hari'], ['month', 'Bulan Ini'], ['all', 'Semua'], ['custom', 'Custom']];

  return (
    <div className="tab-page active fade-up">
      
      {/* ── KPI Cards ── */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card rose">
          <i className="stat-icon fa-solid fa-receipt" />
          <div className="stat-label">Total Pengeluaran</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{formatRp(totalPengeluaran)}</div>
          <div className="stat-meta">{filteredExpenses.length} kali transaksi</div>
        </div>

        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-chart-pie" />
          <div className="stat-label">Pengeluaran Terbesar</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {categoryBreakdown[0] ? categoryBreakdown[0][0] : '—'}
          </div>
          <div className="stat-meta">
            {categoryBreakdown[0] ? formatRp(categoryBreakdown[0][1]) : 'Belum ada data'}
          </div>
        </div>

        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-wallet" />
          <div className="stat-label">Metode Pembayaran</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {filteredExpenses.filter(e => e.pembayaran === 'Tunai').length} Tunai
          </div>
          <div className="stat-meta">
            {filteredExpenses.filter(e => e.pembayaran === 'Transfer').length} Transfer Bank
          </div>
        </div>
      </div>

      {/* ── Filter & Actions Header ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ padding: '12px 16px', flexWrap: 'wrap', gap: 10 }}>
          <div className="card-title">
            <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--rose)' }} />
            Catatan Pengeluaran Operasional
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
              <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printPDF}>
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> Print
            </button>
            <button className="btn btn-purple btn-sm" onClick={openAddModal} id="btn-tambah-pengeluaran">
              <i className="fa-solid fa-plus" /> Tambah Pengeluaran
            </button>
          </div>
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

        <div style={{ padding: '0 16px 14px' }}>
          <div className="form-input-icon">
            <i className="fa-solid fa-search" />
            <input
              className="form-input"
              placeholder="Cari kategori atau keterangan pengeluaran..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-pengeluaran"
            />
          </div>
        </div>
      </div>

      {/* ── Desktop Table ── */}
      <div className="card desktop-table-view" style={{ marginBottom: 12 }}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Metode Bayar</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-folder-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                    Belum ada catatan pengeluaran. Klik "+ Tambah Pengeluaran" untuk mulai.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{item.tanggal}</td>
                    <td>
                      <span className="badge badge-amber">{item.kategori}</span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{item.keterangan || '—'}</td>
                    <td>
                      <span className="badge badge-sky">{item.pembayaran}</span>
                    </td>
                    <td className="cell-amount" style={{ color: 'var(--rose)', fontWeight: 800 }}>
                      {formatRp(item.nominal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(item)}>
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirmId(item.id)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {filteredExpenses.length > 0 && (
                <tr style={{ background: 'var(--bg-hover)', fontWeight: 800 }}>
                  <td colSpan={4}>TOTAL PENGELUARAN</td>
                  <td className="cell-amount" style={{ color: 'var(--rose)', fontSize: 15, fontWeight: 900 }}>
                    {formatRp(totalPengeluaran)}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Card View ── */}
      <div className="mobile-cards-view">
        {filteredExpenses.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: 30, marginBottom: 10, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Belum ada pengeluaran</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Tap "+ Tambah Pengeluaran" untuk mulai mencatat</div>
          </div>
        ) : (
          filteredExpenses.map(item => (
            <div key={item.id} className="card" style={{
              marginBottom: 10,
              borderLeft: '4px solid var(--rose)',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {item.kategori}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.tanggal} &middot; <span style={{ color: item.pembayaran === 'Tunai' ? 'var(--emerald)' : 'var(--brand)' }}>{item.pembayaran}</span>
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--rose)' }}>
                  -{formatRp(item.nominal)}
                </div>
              </div>

              {item.keterangan && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-hover)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  marginBottom: 8,
                  fontStyle: 'italic'
                }}>
                  📝 {item.keterangan}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(item)}>
                  <i className="fa-solid fa-pen-to-square" /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirmId(item.id)}>
                  <i className="fa-solid fa-trash" /> Hapus
                </button>
              </div>
            </div>
          ))
        )}

        {/* Total footer mobile */}
        {filteredExpenses.length > 0 && (
          <div className="card" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--rose)' }}>
              <i className="fa-solid fa-receipt" style={{ marginRight: 6 }} />
              Total Pengeluaran
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--rose)' }}>
              {formatRp(totalPengeluaran)}
            </div>
          </div>
        )}
      </div>

      {/* ── Breakdown per Kategori ── */}
      {categoryBreakdown.length > 0 && (
        <div className="card" style={{ marginTop: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <i className="fa-solid fa-chart-pie" style={{ color: 'var(--amber)', marginRight: 6 }} />
            Breakdown per Kategori
          </div>
          {categoryBreakdown.map(([cat, total]) => {
            const pct = totalPengeluaran > 0 ? Math.round((total / totalPengeluaran) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <span>{cat}</span>
                  <span style={{ color: 'var(--rose)' }}>{formatRp(total)} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--rose), #fb7185)', borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Expense Modal ── */}
      {showModal && (
        <div className="modal-overlay show" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-md">
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--rose)', marginRight: 8 }} />
                {editItem ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
              </div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.tanggal}
                  onChange={e => setForm({ ...form, tanggal: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Kategori Pengeluaran</label>
                <select
                  className="form-input"
                  value={form.kategori}
                  onChange={e => setForm({ ...form, kategori: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Nominal (Rp)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Contoh: 150000"
                  value={form.nominal}
                  onChange={e => setForm({ ...form, nominal: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Metode Pembayaran</label>
                <select
                  className="form-input"
                  value={form.pembayaran}
                  onChange={e => setForm({ ...form, pembayaran: e.target.value })}
                >
                  <option value="Tunai">Tunai / Kas Toko</option>
                  <option value="Transfer">Transfer / Bank</option>
                </select>
              </div>

              <div>
                <label className="form-label">Keterangan / Catatan (Opsional)</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Contoh: Bayar sewa lapak pasar, kantong plastik 10 pack..."
                  value={form.keterangan}
                  onChange={e => setForm({ ...form, keterangan: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ padding: 0, marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-purple">
                  <i className="fa-solid fa-floppy-disk" /> Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="modal-overlay show" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-sm" style={{ textAlign: 'center', padding: 24 }}>
            <i className="fa-solid fa-trash-can" style={{ fontSize: 36, color: 'var(--rose)', marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px 0' }}>Hapus Catatan Pengeluaran?</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Tindakan ini akan menghapus catatan pengeluaran secara permanen.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmId(null)}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete}>Hapus Sekarang</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PengeluaranPage;
