import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { exportToCSV, printReportHTML } from '../services/exportUtils';
import { getTodayIso, normalizeDateStr, isoDate } from '../services/dataSync';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

const emptyForm = {
  nama: '',
  kontak: '',
  alamat: '',
  email: '',
  keterangan: '',
  tanggalDitambahkan: getTodayIso()
};

const SupplierPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [preset, setPreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const suppliers = appData.suppliers || [];

  const getRange = () => {
    const todayStr = getTodayIso();
    if (preset === 'today') { return { start: todayStr, end: todayStr }; }
    if (preset === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const d = isoDate(y);
      return { start: d, end: d };
    }
    if (preset === 'week') {
      const w = new Date(); w.setDate(w.getDate() - 6);
      return { start: isoDate(w), end: todayStr };
    }
    if (preset === 'month') {
      const m = new Date();
      const mStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: mStr, end: todayStr };
    }
    if (preset === 'custom') return { start: dateStart, end: dateEnd };
    return { start: '', end: '' };
  };

  const { start, end } = getRange();

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const sDate = normalizeDateStr(s.tanggalDitambahkan || s.tanggal);
      const matchSearch = !search || 
        (s.nama && s.nama.toLowerCase().includes(search.toLowerCase())) ||
        (s.kontak && s.kontak.includes(search)) ||
        (s.alamat && s.alamat.toLowerCase().includes(search.toLowerCase()));
      
      if (!start && !end) return matchSearch;
      if (start && !end) return sDate >= start && matchSearch;
      if (!start && end) return sDate <= end && matchSearch;
      return sDate >= start && sDate <= end && matchSearch;
    }).sort((a, b) => (b.nama || '').localeCompare(a.nama || ''));
  }, [suppliers, start, end, search]);

  const totalSuppliers = filteredSuppliers.length;

  // Open modal untuk tambah supplier baru
  const openAddModal = () => {
    setEditItem(null);
    setForm({ ...emptyForm, tanggalDitambahkan: getTodayIso() });
    setShowModal(true);
  };

  // Open modal untuk edit supplier
  const openEditModal = (item) => {
    setEditItem(item);
    setForm({
      nama: item.nama || '',
      kontak: item.kontak || '',
      alamat: item.alamat || '',
      email: item.email || '',
      keterangan: item.keterangan || '',
      tanggalDitambahkan: normalizeDateStr(item.tanggalDitambahkan || item.tanggal || getTodayIso())
    });
    setShowModal(true);
  };

  // Simpan supplier
  const handleSave = async () => {
    if (!form.nama.trim()) {
      toast('Nama supplier harus diisi!', 'error');
      return;
    }

    try {
      let newSuppliers = [...suppliers];
      
      if (editItem) {
        // Update existing supplier
        const index = newSuppliers.findIndex(s => 
          s.id === editItem.id || 
          (s.nama && s.nama.toLowerCase() === editItem.nama.toLowerCase())
        );
        if (index >= 0) {
          newSuppliers[index] = {
            ...newSuppliers[index],
            nama: form.nama.trim(),
            kontak: form.kontak.trim(),
            alamat: form.alamat.trim(),
            email: form.email.trim(),
            keterangan: form.keterangan.trim(),
            tanggalDitambahkan: form.tanggalDitambahkan
          };
        }
      } else {
        // Add new supplier
        newSuppliers.push({
          id: Date.now(),
          nama: form.nama.trim(),
          kontak: form.kontak.trim(),
          alamat: form.alamat.trim(),
          email: form.email.trim(),
          keterangan: form.keterangan.trim(),
          tanggalDitambahkan: form.tanggalDitambahkan
        });
      }

      await saveAndSync({ ...appData, suppliers: newSuppliers });
      toast(editItem ? '✅ Supplier berhasil diperbarui!' : '✅ Supplier baru berhasil ditambahkan!', 'success');
      setShowModal(false);
      setForm(emptyForm);
      setEditItem(null);
    } catch (e) {
      console.error('Save supplier error:', e);
      toast('Gagal menyimpan supplier', 'error');
    }
  };

  // Hapus supplier
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    
    try {
      // Cek apakah supplier digunakan di stok
      const stok = appData.stok || [];
      const isUsed = stok.some(item => 
        item.supplier === deleteConfirmId.nama ||
        (item.supplierList && item.supplierList.includes(deleteConfirmId.nama))
      );
      
      if (isUsed) {
        toast('Supplier tidak dapat dihapus karena masih digunakan di data stok!', 'error');
        setDeleteConfirmId(null);
        return;
      }

      const newSuppliers = suppliers.filter(s => 
        s.id !== deleteConfirmId.id && 
        !(s.nama && s.nama.toLowerCase() === deleteConfirmId.nama.toLowerCase())
      );
      
      await saveAndSync({ ...appData, suppliers: newSuppliers });
      toast(`🗑️ Supplier "${deleteConfirmId.nama}" berhasil dihapus`, 'success');
      setDeleteConfirmId(null);
    } catch (e) {
      console.error('Delete supplier error:', e);
      toast('Gagal menghapus supplier', 'error');
      setDeleteConfirmId(null);
    }
  };

  // Export CSV
  const exportSuppliersCSV = () => {
    let csv = 'Nama,Kontak,Alamat,Email,Keterangan,Tanggal Ditambahkan\n';
    filteredSuppliers.forEach(s => {
      csv += `"${s.nama || ''}","${s.kontak || ''}","${s.alamat || ''}","${s.email || ''}","${s.keterangan || ''}",${s.tanggalDitambahkan || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob);
    a.download = `daftar-supplier-${getTodayIso()}.csv`; 
    a.click();
    toast('File CSV daftar supplier berhasil diunduh', 'success');
  };

  // Print Report
  const printSuppliersReport = () => {
    let tableHtml = '<table border="1" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th>Nama Supplier</th><th>Kontak</th><th>Alamat</th><th>Email</th><th>Keterangan</th><th>Tanggal</th></tr></thead><tbody>';
    
    filteredSuppliers.forEach(s => {
      tableHtml += `<tr><td><strong>${s.nama || '-'}</strong></td><td>${s.kontak || '-'}</td><td>${s.alamat || '-'}</td><td>${s.email || '-'}</td><td>${s.keterangan || '-'}</td><td>${s.tanggalDitambahkan || '-'}</td></tr>`;
    });
    
    tableHtml += `</tbody></table>`;
    printReportHTML('DAFTAR SUPPLIER', `Total: ${totalSuppliers} supplier`, tableHtml);
  };

  // Save to PDF
  const saveSuppliersToPDF = () => {
    const s = appData.settings || {};
    
    const headerHtml = `
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#4c1d95;margin:0;font-size:18px;">${s.storeName?.toUpperCase() || 'MELAN JAYA POS'}</h2>
        <p style="color:#666;margin:5px 0 0 0;font-size:12px;">${s.storeAddress || ''}</p>
        <p style="color:#666;margin:0;font-size:12px;">${s.storePhone || ''}</p>
        <hr style="border:1px solid #ddd;margin:15px 0;"/>
        <h3 style="color:#7c3aed;margin:0;font-size:14px;">DAFTAR SUPPLIER</h3>
        <p style="color:#666;margin:5px 0 15px 0;font-size:11px;">Total: ${totalSuppliers} supplier</p>
      </div>
    `;

    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="border-bottom:2px solid #333;"><th style="text-align:left;padding:8px;">Nama Supplier</th><th style="text-align:left;padding:8px;">Kontak</th><th style="text-align:left;padding:8px;">Alamat</th><th style="text-align:left;padding:8px;">Email</th><th style="text-align:left;padding:8px;">Keterangan</th></tr></thead><tbody>';
    
    filteredSuppliers.forEach(s => {
      tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;font-weight:700;">${s.nama || '-'}</td><td style="padding:8px;">${s.kontak || '-'}</td><td style="padding:8px;">${s.alamat || '-'}</td><td style="padding:8px;">${s.email || '-'}</td><td style="padding:8px;">${s.keterangan || '-'}</td></tr>`;
    });
    
    tableHtml += '</tbody></table>';

    const fullHtml = `<html><head><meta charset="UTF-8"><title>Daftar Supplier - ${s.storeName || 'Melan Jaya'}</title></head><body>${headerHtml}${tableHtml}</body></html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    toast('📄 Daftar supplier disimpan sebagai PDF', 'success');
  };

  // Share via WhatsApp
  const shareSuppliersWA = () => {
    const s = appData.settings || {};
    let msg = `*DAFTAR SUPPLIER — ${s.storeName || 'Melan Jaya'}*\n`;
    msg += `Total: ${totalSuppliers} supplier\n`;
    msg += `────────────────────\n`;
    
    filteredSuppliers.slice(0, 10).forEach((sup, idx) => {
      msg += `${idx + 1}. *${sup.nama || '-'}*\n`;
      msg += `   Kontak: ${sup.kontak || '-'}\n`;
      msg += `   Alamat: ${sup.alamat || '-'}\n`;
      if (sup.email) msg += `   Email: ${sup.email}\n`;
      msg += `\n`;
    });
    
    if (filteredSuppliers.length > 10) {
      msg += `... dan ${filteredSuppliers.length - 10} supplier lainnya\n`;
    }
    
    msg += `────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;
    
    const no = (s.storePhone || '').replace(/\D/g, '');
    const url = no ? `https://wa.me/${no}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    toast('📤 Daftar supplier dibagikan ke WhatsApp!', 'success');
  };

  const setPresetBtn = (p) => { setPreset(p); };

  return (
    <div className="tab-page active fade-up">
      {/* Header */}
      <div className="card mb-16">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title"><i className="fa-solid fa-truck-field" style={{ color: 'var(--brand)' }} /> Data Supplier</div>
            <div className="card-subtitle">{totalSuppliers} supplier terdaftar</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button 
              className="btn btn-purple btn-sm" 
              onClick={shareSuppliersWA} 
              title="Bagikan via WhatsApp"
            >
              <i className="fa-brands fa-whatsapp" /> Share WA
            </button>
            <button className="btn btn-ghost btn-sm" onClick={saveSuppliersToPDF} title="Simpan sebagai PDF">
              <i className="fa-solid fa-file-pdf" style={{ color: 'var(--rose)' }} /> PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportSuppliersCSV} title="Export ke CSV">
              <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printSuppliersReport} title="Cetak Laporan">
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> Cetak
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="form-input-icon" style={{ width: '100%' }}>
              <i className="fa-solid fa-search" />
              <input
                className="form-input"
                placeholder="Cari supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="supplier-search"
              />
            </div>
          </div>
          <button 
            className="btn btn-green btn-sm" 
            onClick={openAddModal}
            id="btn-tambah-supplier"
            style={{
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.2s ease'
            }}
            title="Tambah supplier baru"
          >
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} /> Tambah Supplier
          </button>
        </div>

        {/* Date Filter */}
        <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[['all','Semua'],['today','Hari Ini'],['yesterday','Kemarin'],['week','7 Hari'],['month','Bulan Ini']].map(([p,l]) => (
            <button key={p} className={`date-preset-btn${preset === p ? ' active' : ''}`} onClick={() => setPresetBtn(p)}>{l}</button>
          ))}
          <button className={`date-preset-btn${preset === 'custom' ? ' active' : ''}`} onClick={() => setPresetBtn('custom')}>Custom</button>
          {preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <span>Dari</span>
              <input type="date" className="date-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <span>–</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Supplier Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Nama Supplier</th>
                <th style={{ width: '15%' }}>Kontak</th>
                <th style={{ width: '25%' }}>Alamat</th>
                <th style={{ width: '15%' }}>Email</th>
                <th style={{ width: '15%' }}>Keterangan</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <i className="fa-solid fa-truck-field" />
                    <p>Belum ada supplier terdaftar. Klik "Tambah Supplier" untuk memulai.</p>
                  </div>
                </td></tr>
              ) : filteredSuppliers.map((sup, idx) => (
                <tr key={sup.id || idx}>
                  <td className="cell-main" style={{ fontWeight: 700 }}>{sup.nama || '-'}</td>
                  <td>{sup.kontak || '-'}</td>
                  <td style={{ fontSize: 12 }}>{sup.alamat || '-'}</td>
                  <td style={{ fontSize: 12 }}>{sup.email || '-'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sup.keterangan || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        title="Edit supplier"
                        onClick={() => openEditModal(sup)}
                        style={{ padding: '4px 8px' }}
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        title="Hapus supplier"
                        onClick={() => setDeleteConfirmId(sup)}
                        style={{ padding: '4px 8px' }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="mobile-cards-view" style={{ padding: '0 12px 12px' }}>
        {filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-truck-field" />
            <p>Belum ada supplier terdaftar.</p>
          </div>
        ) : filteredSuppliers.map((sup, idx) => (
          <div key={sup.id || idx} className="trx-mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{sup.nama || '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sup.kontak || '-'}</div>
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alamat</div>
              <div style={{ fontSize: 12 }}>{sup.alamat || '-'}</div>
            </div>

            {sup.email && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Email</div>
                <div style={{ fontSize: 12 }}>{sup.email}</div>
              </div>
            )}

            {sup.keterangan && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keterangan</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sup.keterangan}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => openEditModal(sup)}
                style={{ padding: '7px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <i className="fa-solid fa-pen-to-square" /> Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setDeleteConfirmId(sup)}
                style={{ padding: '7px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <i className="fa-solid fa-trash" /> Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-truck-field" style={{ color: 'var(--brand)' }} />
                {editItem ? ' Edit Supplier' : ' Tambah Supplier Baru'}
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Nama Supplier *</label>
                <input
                  className="form-input"
                  value={form.nama}
                  onChange={e => setForm({ ...form, nama: e.target.value })}
                  placeholder="Nama supplier"
                  id="supplier-nama"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kontak (Telepon/WhatsApp)</label>
                <input
                  className="form-input"
                  value={form.kontak}
                  onChange={e => setForm({ ...form, kontak: e.target.value })}
                  placeholder="08123456789"
                  type="tel"
                  id="supplier-kontak"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alamat</label>
                <textarea
                  className="form-input"
                  value={form.alamat}
                  onChange={e => setForm({ ...form, alamat: e.target.value })}
                  placeholder="Alamat supplier"
                  rows={2}
                  id="supplier-alamat"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@supplier.com"
                  type="email"
                  id="supplier-email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan</label>
                <textarea
                  className="form-input"
                  value={form.keterangan}
                  onChange={e => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="Keterangan tambahan"
                  rows={2}
                  id="supplier-keterangan"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Ditambahkan</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.tanggalDitambahkan}
                  onChange={e => setForm({ ...form, tanggalDitambahkan: e.target.value })}
                  id="supplier-tanggal"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Batal
              </button>
              <button className="btn btn-green" onClick={handleSave}>
                <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteConfirmId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ background: 'var(--rose-dim)', borderColor: 'var(--rose)' }}>
              <div className="modal-title" style={{ color: 'var(--rose)' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Hapus Supplier
              </div>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Apakah Anda yakin ingin menghapus supplier <strong>"{deleteConfirmId.nama}"</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Supplier yang sudah digunakan di data stok tidak dapat dihapus.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                Batal
              </button>
              <button className="btn btn-rose" onClick={handleDelete}>
                <i className="fa-solid fa-trash" style={{ marginRight: 6 }} />
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPage;
