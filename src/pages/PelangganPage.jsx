import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

const PelangganPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // pelanggan detail
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: '', noWa: '', alamat: '', catatan: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Gabungkan pelanggan dari database manual + otomatis dari riwayat transaksi
  const pelangganDB = appData.pelanggan || [];

  const pelangganFromTrx = useMemo(() => {
    const map = {};
    (appData.penjualan || []).forEach(t => {
      if (!t.pelanggan || t.pelanggan === 'Umum') return;
      const key = t.noWa || t.pelanggan;
      if (!map[key]) {
        map[key] = {
          id: key,
          nama: t.pelanggan,
          noWa: t.noWa || '',
          fromTrx: true,
          totalBelanja: 0,
          jumlahTrx: 0,
          terakhirBelanja: '',
          riwayat: [],
        };
      }
      map[key].totalBelanja += t.totalPenjualan;
      map[key].jumlahTrx += 1;
      if (!map[key].terakhirBelanja || t.tanggal > map[key].terakhirBelanja) {
        map[key].terakhirBelanja = t.tanggal;
      }
      map[key].riwayat.push(t);
    });
    return Object.values(map);
  }, [appData.penjualan]);

  // Merge DB manual dengan dari transaksi (DB manual priority)
  const allPelanggan = useMemo(() => {
    const merged = [...pelangganDB];
    pelangganFromTrx.forEach(pt => {
      const exists = merged.find(p => (p.noWa && p.noWa === pt.noWa) || p.nama === pt.nama);
      if (!exists) merged.push(pt);
      else {
        // Enrich dari transaksi
        const idx = merged.indexOf(exists);
        merged[idx] = {
          ...merged[idx],
          totalBelanja: pt.totalBelanja,
          jumlahTrx: pt.jumlahTrx,
          terakhirBelanja: pt.terakhirBelanja,
          riwayat: pt.riwayat,
        };
      }
    });
    return merged.sort((a, b) => (b.totalBelanja || 0) - (a.totalBelanja || 0));
  }, [pelangganDB, pelangganFromTrx]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allPelanggan;
    const s = search.toLowerCase();
    return allPelanggan.filter(p =>
      (p.nama || '').toLowerCase().includes(s) ||
      (p.noWa && p.noWa.includes(s)) ||
      (p.alamat && p.alamat.toLowerCase().includes(s))
    );
  }, [allPelanggan, search]);

  const openAdd = () => {
    setEditId(null);
    setForm({ nama: '', noWa: '', alamat: '', catatan: '' });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setForm({ nama: p.nama, noWa: p.noWa || '', alamat: p.alamat || '', catatan: p.catatan || '' });
    setShowForm(true);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) { toast('Nama pelanggan wajib diisi', 'error'); return; }
    setSaving(true);
    const existing = appData.pelanggan || [];
    let newList;
    if (editId) {
      newList = existing.map(p => p.id === editId ? { ...p, ...form } : p);
    } else {
      newList = [...existing, { id: Date.now(), ...form, createdAt: new Date().toISOString() }];
    }
    await saveAndSync({ ...appData, pelanggan: newList });
    toast(editId ? '✅ Data pelanggan diperbarui' : '✅ Pelanggan baru ditambahkan', 'success');
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const newList = (appData.pelanggan || []).filter(p => p.id !== deleteId);
    await saveAndSync({ ...appData, pelanggan: newList });
    toast('🗑️ Pelanggan dihapus', 'success');
    setDeleteId(null);
    setSelected(null);
    setSaving(false);
  };

  const sendWA = (noWa, nama) => {
    if (!noWa) { toast('No WA tidak tersedia', 'warning'); return; }
    const no = noWa.replace(/\D/g, '');
    const msg = `Halo ${nama}, terima kasih sudah berbelanja di ${appData.settings?.storeName || 'Melan Jaya'}! 😊`;
    window.open(`https://wa.me/${no}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Top 3 pelanggan (by total belanja)
  const top3 = [...allPelanggan].sort((a, b) => (b.totalBelanja || 0) - (a.totalBelanja || 0)).slice(0, 3);

  return (
    <div className="tab-page active fade-up">

      {/* Stats row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-users" />
          <div className="stat-label">Total Pelanggan</div>
          <div className="stat-value">{allPelanggan.length}</div>
          <div className="stat-meta">terdaftar</div>
        </div>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Total Omset Pelanggan</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatRp(allPelanggan.reduce((s, p) => s + (p.totalBelanja || 0), 0))}</div>
          <div className="stat-meta">dari semua pelanggan</div>
        </div>
        <div className="stat-card amber">
          <i className="stat-icon fa-solid fa-receipt" />
          <div className="stat-label">Total Transaksi</div>
          <div className="stat-value">{allPelanggan.reduce((s, p) => s + (p.jumlahTrx || 0), 0)}</div>
          <div className="stat-meta">semua pelanggan</div>
        </div>
      </div>

      {/* Main card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-users" /> Database Pelanggan</div>
            <div className="card-subtitle">{filtered.length} pelanggan</div>
          </div>
          <button className="btn btn-purple btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Tambah Pelanggan
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px 12px' }}>
          <div className="form-input-icon">
            <i className="fa-solid fa-search" />
            <input
              className="form-input"
              placeholder="Cari nama, nomor WA, alamat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="pelanggan-search"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pelanggan</th>
                <th>No WhatsApp</th>
                <th>Alamat</th>
                <th>Trx</th>
                <th>Total Belanja</th>
                <th>Terakhir Belanja</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <i className="fa-solid fa-users" />
                    <p>Belum ada data pelanggan.<br />Klik "Tambah Pelanggan" untuk mulai.</p>
                  </div>
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                  <td className="cell-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0
                      }}>
                        {(p.nama || '?').charAt(0).toUpperCase()}
                      </div>
                      <span>{p.nama}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.noWa || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.alamat || '—'}</td>
                  <td style={{ textAlign: 'center' }}><b>{p.jumlahTrx || 0}</b></td>
                  <td className="cell-amount cell-green">{formatRp(p.totalBelanja || 0)}</td>
                  <td style={{ fontSize: 12 }}>{p.terakhirBelanja || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-wa btn-sm" title="Kirim WA" onClick={() => sendWA(p.noWa, p.nama)} style={{ padding: '4px 8px', opacity: p.noWa ? 1 : 0.4 }}>
                        <i className="fa-brands fa-whatsapp" />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(p)} style={{ padding: '4px 8px' }}>
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      {!p.fromTrx && (
                        <button className="btn btn-danger btn-sm" title="Hapus" onClick={() => setDeleteId(p.id)} style={{ padding: '4px 8px' }}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAIL MODAL ═══════════════════════════════════════════════ */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-user" style={{ color: 'var(--brand)' }} /> Detail Pelanggan
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {/* Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 24, fontWeight: 800
                }}>
                  {(selected.nama || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.nama}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.noWa || 'No WA tidak tersedia'}</div>
                  {selected.alamat && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.alamat}</div>}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Total Belanja', val: formatRp(selected.totalBelanja || 0), color: 'var(--emerald)' },
                  { label: 'Jumlah Trx', val: `${selected.jumlahTrx || 0}x`, color: 'var(--brand)' },
                  { label: 'Terakhir', val: selected.terakhirBelanja || '—', color: 'var(--amber)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Riwayat belanja */}
              {selected.riwayat?.length > 0 && (
                <div>
                  <div className="form-label" style={{ marginBottom: 8 }}>Riwayat Belanja Terakhir</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {[...selected.riwayat].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '')).slice(0, 8).map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{t.kodeTrx}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.tanggal} · {t.metodeBayar}</div>
                          <div style={{ fontSize: 11 }}>{(t.items || []).map(i => `${i.barang}×${i.jumlah}`).join(', ')}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)' }}>{formatRp(t.totalPenjualan)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.catatan && (
                <div style={{ marginTop: 12, background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-note-sticky" style={{ marginRight: 6 }} /> {selected.catatan}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selected.noWa && (
                <button className="btn btn-wa" onClick={() => sendWA(selected.noWa, selected.nama)}>
                  <i className="fa-brands fa-whatsapp" /> Chat WA
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => openEdit(selected)}>
                <i className="fa-solid fa-pen-to-square" /> Edit
              </button>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FORM MODAL ═════════════════════════════════════════════════ */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-user-plus" style={{ color: 'var(--brand)' }} />
                {editId ? ' Edit Pelanggan' : ' Tambah Pelanggan Baru'}
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nama Pelanggan *</label>
                <input className="form-input" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap" id="form-pelanggan-nama" />
              </div>
              <div className="form-group">
                <label className="form-label">No WhatsApp</label>
                <input className="form-input" value={form.noWa} onChange={e => setForm(f => ({ ...f, noWa: e.target.value }))} placeholder="0812xxxx" id="form-pelanggan-wa" />
              </div>
              <div className="form-group">
                <label className="form-label">Alamat</label>
                <input className="form-input" value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} placeholder="Alamat pengiriman (opsional)" />
              </div>
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input className="form-input" value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Catatan tambahan (opsional)" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Batal</button>
              <button className="btn btn-purple" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> {editId ? 'Simpan' : 'Tambah Pelanggan'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM ═════════════════════════════════════════════ */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}><i className="fa-solid fa-triangle-exclamation" /> Hapus Pelanggan?</div>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body"><p style={{ fontSize: 14 }}>Data pelanggan ini akan dihapus dari database. Riwayat transaksi tidak terpengaruh.</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)} disabled={saving}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving} style={{ flex: 1 }}>
                {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menghapus...</> : <><i className="fa-solid fa-trash" /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PelangganPage;
