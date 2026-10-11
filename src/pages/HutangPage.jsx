import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { exportToCSV, printReportHTML } from '../services/exportUtils';
import { isoDate } from '../services/dataSync';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
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
  const [pelunasanTarget, setPelunasanTarget] = useState(null);
  const [pelunasanTab, setPelunasanTab] = useState('bayar'); // 'bayar' | 'retur' | 'kombinasi'
  const [bayarNominal, setBayarNominal] = useState('');
  const [bayarMetode, setBayarMetode] = useState('Tunai');
  const [bayarCatatan, setBayarCatatan] = useState('');
  const [returItems, setReturItems] = useState([]);
  const [alasanRetur, setAlasanRetur] = useState('');
  
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
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  
  // Date Presets
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart]   = useState('');
  const [dateEnd, setDateEnd]       = useState('');

  const isOverdue = (h) => {
    if (!h.tanggalJatuhTempo || h.sisaHutang <= 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jt = new Date(h.tanggalJatuhTempo);
    jt.setHours(0, 0, 0, 0);
    return jt < today;
  };

  const getOverdueDays = (h) => {
    if (!h.tanggalJatuhTempo) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jt = new Date(h.tanggalJatuhTempo);
    jt.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((today - jt) / (1000 * 60 * 60 * 24)));
  };

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
      if (statusFilter === 'lunas' && h.sisaHutang > 0)    return false;
      if (statusFilter === 'belum' && h.sisaHutang <= 0)   return false;
      if (statusFilter === 'overdue' && !isOverdue(h))     return false;

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
  const overdueList = rawList.filter(h => isOverdue(h));
  const totalOverdueNominal = overdueList.reduce((s, h) => s + (h.sisaHutang || 0), 0);
  const countOverdue = overdueList.length;

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

  const openPelunasan = (h) => {
    setPelunasanTarget(h);
    setPelunasanTab('bayar');
    setBayarNominal('');
    setBayarMetode('Tunai');
    setBayarCatatan('');
    setAlasanRetur('');

    // Inisialisasi daftar barang yang pernah dibeli jika tercatat
    if (h.items && Array.isArray(h.items) && h.items.length > 0) {
      setReturItems(h.items.map(it => ({
        barang: it.barang || it.nama_barang || 'Barang',
        hargaJual: Number(it.hargaJual || it.harga || 0),
        returQty: 0,
        maxQty: Number(it.jumlah || 99)
      })));
    } else {
      setReturItems([]);
    }
  };

  const handleAddStokToRetur = (stokItem) => {
    if (!stokItem) return;
    const existing = returItems.find(it => it.barang === stokItem.nama_barang);
    if (existing) {
      setReturItems(prev => prev.map(it => it.barang === stokItem.nama_barang ? { ...it, returQty: it.returQty + 1 } : it));
    } else {
      setReturItems(prev => [...prev, {
        barang: stokItem.nama_barang,
        hargaJual: Number(stokItem.hargaJual || 0),
        returQty: 1,
        maxQty: Number(stokItem.stokTersedia || 999)
      }]);
    }
  };

  const handleRemoveReturItem = (index) => {
    setReturItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateReturQty = (index, val) => {
    setReturItems(prev => prev.map((it, i) => i === index ? { ...it, returQty: Math.max(0, parseInt(val) || 0) } : it));
  };

  const adjustReturQty = (index, delta) => {
    setReturItems(prev => prev.map((it, i) => i === index ? { ...it, returQty: Math.max(0, (parseInt(it.returQty) || 0) + delta) } : it));
  };

  // Kirim Bukti Transaksi Pelunasan & Retur ke WhatsApp
  const sendPelunasanReturWA = (target, uangBayar, returnedItems, totalRetur, newSisa, alasan) => {
    const rawNo = target.noWa || '';
    const no = formatWaNumber(rawNo);
    const s = appData.settings || {};
    const nama = target.pelanggan || target.nama || target.supplier;

    let msg = `Halo *${nama}*,\n`;
    msg += `Berikut bukti transaksi *Pelunasan / Pengembalian Barang* di *${s.storeName || 'MELAN JAYA'}*:\n\n`;
    msg += `📋 *Rincian Transaksi:*\n`;
    msg += `• Tanggal      : ${new Date().toLocaleDateString('id-ID')}\n`;
    if (target.keterangan) msg += `• Keterangan   : ${target.keterangan}\n`;
    msg += `• Tagihan Awal : ${formatRp(target.sisaHutang)}\n`;

    if (uangBayar > 0) {
      msg += `• 💵 Bayar Uang : ${formatRp(uangBayar)}\n`;
    }

    if (totalRetur > 0 && returnedItems.length > 0) {
      msg += `• 🔄 Retur Barang : ${formatRp(totalRetur)}\n`;
      returnedItems.forEach(it => {
        msg += `   - ${it.barang} (${it.returQty} pcs @ ${formatRp(it.hargaJual)})\n`;
      });
      if (alasan) msg += `   Alasan: ${alasan}\n`;
    }

    msg += `─────────────────────────\n`;
    if (newSisa <= 0) {
      msg += `✅ *STATUS: LUNAS PENUH*\n`;
    } else {
      msg += `🔴 *SISA TAGIHAN: ${formatRp(newSisa)}*\n`;
    }
    msg += `─────────────────────────\n`;
    msg += `Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.`;

    const encoded = encodeURIComponent(msg);
    if (no) {
      window.open(`https://wa.me/${no}?text=${encoded}`, '_blank');
      toast(`📲 Bukti transaksi dikirim ke WA ${nama}`, 'success');
    } else {
      window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encoded}`, '_blank');
      toast(`📲 Bukti transaksi dikirim ke WA Toko (${STORE_OWNER_WA})`, 'info');
    }
  };

  const handleSimpanPelunasan = async () => {
    if (!pelunasanTarget) return;

    const totalReturNilai = returItems.reduce((sum, it) => sum + ((Number(it.hargaJual) || 0) * (Number(it.returQty) || 0)), 0);
    const nominalUang = pelunasanTab === 'retur' ? 0 : (parseFloat(bayarNominal) || 0);
    const effectiveRetur = pelunasanTab === 'bayar' ? 0 : totalReturNilai;
    const totalPotongan = nominalUang + effectiveRetur;
    const currentSisa = Number(pelunasanTarget.sisaHutang || 0);
    const newSisa = Math.max(0, currentSisa - totalPotongan);

    if (totalPotongan <= 0) {
      toast('Tentukan nominal pembayaran uang atau jumlah barang yang diretur!', 'warning');
      return;
    }
    if (totalPotongan > currentSisa) {
      toast(`Total potongan (${formatRp(totalPotongan)}) melebihi sisa tagihan (${formatRp(currentSisa)})!`, 'error');
      return;
    }
    if ((pelunasanTab === 'retur' || pelunasanTab === 'kombinasi') && effectiveRetur > 0 && !alasanRetur.trim()) {
      toast('Alasan pengembalian barang wajib diisi!', 'warning');
      return;
    }

    setSaving(true);
    const today = isoDate(new Date());
    const returnedItemsActive = returItems.filter(it => (Number(it.returQty) || 0) > 0);

    // 1. Kembalikan stok barang ke inventori toko jika ada barang yang diretur
    let nextStok = appData.stok || [];
    if (returnedItemsActive.length > 0) {
      nextStok = (appData.stok || []).map(s => {
        const match = returnedItemsActive.find(it =>
          it.barang === s.nama_barang ||
          it.originalName === s.nama_barang ||
          (it.barang && it.barang.startsWith(s.nama_barang))
        );
        if (!match) return s;
        return { ...s, stokTersedia: (s.stokTersedia || 0) + Number(match.returQty) };
      });
    }

    // 2. Buat catatan di riwayat retur toko jika ada barang yang diretur
    let nextRetur = appData.retur || [];
    if (returnedItemsActive.length > 0) {
      const returEntry = {
        id: Date.now(),
        idTrxAsli: pelunasanTarget.trxId || pelunasanTarget.id,
        kodeTrxAsli: pelunasanTarget.kodeTrx || `HUTANG-${pelunasanTarget.id}`,
        tanggal: today,
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        pelanggan: pelunasanTarget.pelanggan || pelunasanTarget.nama || 'Pelanggan',
        alasan: alasanRetur.trim() || 'Pengembalian barang & pemotongan hutang',
        items: returnedItemsActive.map(it => ({
          barang: it.barang,
          jumlah: it.returQty,
          hargaJual: it.hargaJual,
          subtotal: it.hargaJual * it.returQty
        })),
        totalRetur: effectiveRetur,
        keterangan: `Pemotongan hutang pelanggan. Sisa hutang baru: ${formatRp(newSisa)}`
      };
      nextRetur = [returEntry, ...nextRetur];
    }

    // 3. Update data hutang pelanggan
    const newBayarLogs = [];
    if (nominalUang > 0) {
      newBayarLogs.push({
        tanggal: today,
        nominal: nominalUang,
        type: 'bayar',
        metode: bayarMetode,
        keterangan: `Pembayaran ${bayarMetode}${bayarCatatan ? ` - ${bayarCatatan}` : ''}`
      });
    }
    if (effectiveRetur > 0 && returnedItemsActive.length > 0) {
      const itemNames = returnedItemsActive.map(it => `${it.barang} (${it.returQty} pcs)`).join(', ');
      newBayarLogs.push({
        tanggal: today,
        nominal: effectiveRetur,
        type: 'retur',
        keterangan: `Retur Barang: ${itemNames} (${alasanRetur || 'Retur'})`
      });
    }

    const nextHutang = (appData.hutang || []).map(h => {
      if (h.id !== pelunasanTarget.id) return h;
      return {
        ...h,
        sisaHutang: newSisa,
        riwayatBayar: [...(h.riwayatBayar || []), ...newBayarLogs]
      };
    });

    await saveAndSync({
      ...appData,
      stok: nextStok,
      retur: nextRetur,
      hutang: nextHutang
    });

    setSaving(false);
    toast(`✅ Transaksi berhasil! Sisa hutang ${pelunasanTarget.pelanggan || pelunasanTarget.nama}: ${newSisa <= 0 ? 'LUNAS PENUH' : formatRp(newSisa)}`, 'success');

    // Kirim nota bukti transaksi ke WhatsApp
    sendPelunasanReturWA(pelunasanTarget, nominalUang, returnedItemsActive, effectiveRetur, newSisa, alasanRetur);

    setPelunasanTarget(null);
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
    msg += `───────────────────\n`;
    msg += `Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.`;

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
    msg += `⚠️ *Total Overdue (Jatuh Tempo)*: ${formatRp(totalOverdueNominal)} (${countOverdue} data)\n`;
    msg += `─────────────────────────\n`;
    msg += `📋 Total Record  : ${filtered.length} data\n`;
    msg += `⏳ Belum Lunas   : ${countBelumLunas} data\n`;
    msg += `✅ Lunas         : ${countLunas} data\n`;
    msg += `─────────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;

    window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encodeURIComponent(msg)}`, '_blank');
    toast(`📲 Rangkuman laporan dikirim ke WA Toko (${STORE_OWNER_WA})`, 'success');
  };

  // Kirim Reminder Khusus Overdue ke Pelanggan / Debitur
  const sendOverdueReminderWA = (h) => {
    const rawNo = h.noWa || '';
    const no = formatWaNumber(rawNo);
    const s = appData.settings || {};
    const diffDays = getOverdueDays(h);
    const nama = h.pelanggan || h.nama || h.supplier;

    let msg = `Halo *${nama}*,\n`;
    msg += `Pemberitahuan dari *${s.storeName || 'MELAN JAYA'}*:\n\n`;
    msg += `⚠️ Tagihan Anda telah *MELEWATI JATUH TEMPO* (*terlambat ${diffDays} hari*).\n\n`;
    msg += `📋 *Rincian Tagihan:*\n`;
    msg += `• Keterangan   : ${h.keterangan || '-'}\n`;
    msg += `• Tgl Catat    : ${h.tanggal}\n`;
    msg += `• Jatuh Tempo  : *${h.tanggalJatuhTempo}*\n`;
    msg += `• Jumlah Awal  : ${formatRp(h.jumlahAwal)}\n`;
    msg += `• Total Dibayar: ${formatRp(h.jumlahAwal - h.sisaHutang)}\n`;
    msg += `• *Sisa Tagihan: ${formatRp(h.sisaHutang)}*\n\n`;
    msg += `Mohon segera melakukan konfirmasi dan penyelesaian pembayaran. Terima kasih atas pengertian dan kerjasamanya! 🙏\n`;
    msg += `───────────────────\n`;
    msg += `Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.`;

    const encoded = encodeURIComponent(msg);
    if (no) {
      window.open(`https://wa.me/${no}?text=${encoded}`, '_blank');
      toast(`📲 Reminder Overdue terkirim ke WA ${nama}`, 'success');
    } else {
      window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encoded}`, '_blank');
      toast(`📲 No WA debitur belum ada, pesan dialihkan ke WA Toko`, 'info');
    }
  };

  // Kirim Rekap Semua Tagihan Overdue ke WA Toko
  const sendOverdueRekapWA = () => {
    const s = appData.settings || {};
    let msg = `*⚠️ LAPORAN TAGIHAN OVERDUE (JATUH TEMPO) — ${s.storeName?.toUpperCase() || 'MELAN JAYA'}*\n`;
    msg += `Per Tanggal: ${new Date().toLocaleDateString('id-ID')}\n`;
    msg += `Total Tagihan Overdue: *${formatRp(totalOverdueNominal)}* (${countOverdue} tagihan)\n`;
    msg += `─────────────────────────\n`;
    overdueList.forEach((h, i) => {
      const diff = getOverdueDays(h);
      msg += `${i + 1}. *${h.pelanggan || h.nama || h.supplier}* (Lewat ${diff} hr)\n`;
      msg += `   Sisa: *${formatRp(h.sisaHutang)}* | JT: ${h.tanggalJatuhTempo}\n`;
      if (h.noWa) msg += `   WA: ${h.noWa}\n`;
    });
    msg += `─────────────────────────\n`;
    msg += `Harap segera difollow-up.\nDikirim dari Melan Jaya POS`;

    window.open(`https://wa.me/${STORE_OWNER_WA}?text=${encodeURIComponent(msg)}`, '_blank');
    toast(`📲 Rekap Overdue terkirim ke WA Toko (${STORE_OWNER_WA})`, 'success');
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

      {/* Overdue Alert Banner */}
      {countOverdue > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1.5px solid var(--rose)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--rose)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--rose)', fontSize: 14 }}>
                Peringatan: {countOverdue} Tagihan Melewati Jatuh Tempo (Overdue)!
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Total nominal tertunggak: <strong>{formatRp(totalOverdueNominal)}</strong>. Segera kirim reminder pembayaran ke pelanggan.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ border: '1px solid var(--rose)', color: 'var(--rose)', fontWeight: 700 }}
              onClick={() => setShowOverdueModal(true)}
            >
              <i className="fa-solid fa-bell" /> Buka Reminder Overdue
            </button>
            <button
              className="btn btn-sm btn-wa"
              onClick={sendOverdueRekapWA}
            >
              <i className="fa-brands fa-whatsapp" /> Rekap ke WA Toko
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title"><i className="fa-solid fa-scale-balanced" /> Laporan Hutang &amp; Piutang</div>
            <div className="card-subtitle">{filtered.length} data ditemukan</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {countOverdue > 0 && (
              <button
                className="btn btn-sm"
                onClick={() => setShowOverdueModal(true)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700 }}
                title="Kelola & Kirim Reminder Tagihan Overdue"
              >
                <i className="fa-solid fa-bell" /> Reminder Overdue ({countOverdue})
              </button>
            )}
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
                ['overdue', `⚠️ Overdue (${countOverdue})`],
                ['lunas', '✅ Lunas']
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={`btn btn-sm ${statusFilter === k ? (k === 'overdue' ? 'btn-danger' : 'btn-purple') : 'btn-ghost'}`}
                  onClick={() => setStatusFilter(k)}
                  style={{ fontSize: 11 }}
                >
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

                const isOd = isOverdue(h);

                return (
                  <tr key={h.id} style={{ background: isOd ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
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
                          <button className="btn btn-purple btn-sm" title="Catat Pelunasan / Retur Barang" onClick={() => openPelunasan(h)} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700 }}>
                            <i className="fa-solid fa-hand-holding-dollar" /> Pelunasan / Retur
                          </button>
                        )}
                        {isOd ? (
                          <button className="btn btn-sm" title="Kirim Reminder Overdue WA" onClick={() => sendOverdueReminderWA(h)} style={{ padding: '4px 8px', fontSize: 11, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700 }}>
                            <i className="fa-brands fa-whatsapp" /> Reminder
                          </button>
                        ) : (
                          <button className="btn btn-wa btn-sm" title="Kirim Notifikasi WA" onClick={() => sendTagihanWA(h)} style={{ padding: '4px 8px', fontSize: 11 }}>
                            <i className="fa-brands fa-whatsapp" /> WA
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
            const isOd = isOverdue(h);

            return (
              <div key={h.id} className="trx-mobile-card" style={{ borderLeft: `3px solid ${h.sisaHutang <= 0 ? 'var(--emerald)' : isOd ? '#ef4444' : isPiutang ? 'var(--brand)' : 'var(--amber)'}`, background: isOd ? 'rgba(239, 68, 68, 0.03)' : undefined }}>
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
                    <button className="btn btn-purple btn-sm" onClick={() => openPelunasan(h)} style={{ flex: 1, fontWeight: 700 }}>
                      <i className="fa-solid fa-hand-holding-dollar" /> Pelunasan / Retur
                    </button>
                  )}
                  {isOd ? (
                    <button className="btn btn-sm" onClick={() => sendOverdueReminderWA(h)} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700 }}>
                      <i className="fa-brands fa-whatsapp" /> Reminder WA
                    </button>
                  ) : (
                    <button className="btn btn-wa btn-sm" onClick={() => sendTagihanWA(h)} style={{ flex: 1 }}>
                      <i className="fa-brands fa-whatsapp" /> WA Notif
                    </button>
                  )}
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

      {/* ═══ PELUNASAN & RETUR BARANG MODAL ════════════════════════ */}
      {pelunasanTarget && (() => {
        const totalReturNilai = returItems.reduce((sum, it) => sum + ((Number(it.hargaJual) || 0) * (Number(it.returQty) || 0)), 0);
        const nominalUang = pelunasanTab === 'retur' ? 0 : (parseFloat(bayarNominal) || 0);
        const effectiveRetur = pelunasanTab === 'bayar' ? 0 : totalReturNilai;
        const totalPotongan = nominalUang + effectiveRetur;
        const currentSisa = Number(pelunasanTarget.sisaHutang || 0);
        const newSisa = Math.max(0, currentSisa - totalPotongan);
        const namaDisp = pelunasanTarget.pelanggan || pelunasanTarget.nama || pelunasanTarget.supplier;
        const returnedItemsActive = returItems.filter(it => (Number(it.returQty) || 0) > 0);

        return (
          <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setPelunasanTarget(null)}>
            <div className="modal" style={{ maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <div className="modal-title">
                  <i className="fa-solid fa-hand-holding-dollar" style={{ color: 'var(--brand)' }} /> Pelunasan &amp; Retur Barang
                </div>
                <button className="modal-close" onClick={() => setPelunasanTarget(null)}><i className="fa-solid fa-xmark" /></button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Info Pelanggan & Tagihan */}
                <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{namaDisp}</div>
                      {pelunasanTarget.noWa && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📱 {pelunasanTarget.noWa}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Tgl: {pelunasanTarget.tanggal} {pelunasanTarget.tanggalJatuhTempo ? `· JT: ${pelunasanTarget.tanggalJatuhTempo}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>SISA TAGIHAN</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--rose)' }}>{formatRp(currentSisa)}</div>
                    </div>
                  </div>
                </div>

                {/* Pilihan Metode Pelunasan / Tab Switcher */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${pelunasanTab === 'bayar' ? 'btn-purple' : 'btn-ghost'}`}
                    onClick={() => setPelunasanTab('bayar')}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-money-bill-wave" /> 💵 Bayar Uang
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${pelunasanTab === 'retur' ? 'btn-purple' : 'btn-ghost'}`}
                    onClick={() => setPelunasanTab('retur')}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-rotate-left" /> 🔄 Retur Barang
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${pelunasanTab === 'kombinasi' ? 'btn-purple' : 'btn-ghost'}`}
                    onClick={() => setPelunasanTab('kombinasi')}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-layer-group" /> ⚡ Bayar + Retur
                  </button>
                </div>

                {/* ─── SECTION 1: RETUR BARANG (jika tab retur / kombinasi) ─── */}
                {(pelunasanTab === 'retur' || pelunasanTab === 'kombinasi') && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderRadius: 10, padding: '12px 14px', border: '1.5px solid rgba(245, 158, 11, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--amber)' }}>
                        <i className="fa-solid fa-boxes-stacked" style={{ marginRight: 6 }} /> Barang yang Dikembalikan (Retur)
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Stok otomatis di-restore (+stok)</span>
                    </div>

                    {/* List Item Retur */}
                    {returItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: 11, background: 'var(--bg-card)', borderRadius: 6, marginBottom: 8 }}>
                        Belum ada barang di daftar retur. Pilih barang dari stok toko di bawah.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {returItems.map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{it.barang}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatRp(it.hargaJual)} / pcs</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => adjustReturQty(idx, -1)} style={{ padding: '2px 6px', height: 26 }}>-</button>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: 44, textAlign: 'center', height: 26, fontSize: 11, padding: 2 }}
                                value={it.returQty}
                                onChange={e => updateReturQty(idx, e.target.value)}
                                min="0"
                                max={it.maxQty}
                              />
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => adjustReturQty(idx, 1)} style={{ padding: '2px 6px', height: 26 }}>+</button>
                              <span style={{ fontSize: 11, fontWeight: 800, minWidth: 65, textAlign: 'right', color: 'var(--amber)' }}>
                                {formatRp(it.hargaJual * it.returQty)}
                              </span>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveReturItem(idx)} style={{ color: 'var(--rose)', padding: '2px 6px' }}>
                                <i className="fa-solid fa-trash" style={{ fontSize: 10 }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dropdown tambah barang dari stok toko */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        + TAMBAH BARANG DARI STOK TOKO:
                      </label>
                      <select
                        className="form-input"
                        style={{ fontSize: 11, height: 32 }}
                        value=""
                        onChange={e => {
                          const found = (appData.stok || []).find(s => String(s.id) === e.target.value || s.nama_barang === e.target.value);
                          if (found) handleAddStokToRetur(found);
                        }}
                      >
                        <option value="">-- Cari / pilih barang dari katalog stok toko --</option>
                        {(appData.stok || []).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nama_barang} ({formatRp(s.hargaJual)}) · Sisa Stok: {s.stokTersedia} pcs
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input Alasan Retur */}
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        ALASAN PENGEMBALIAN BARANG *
                      </label>
                      <input
                        className="form-input"
                        style={{ fontSize: 11, height: 32 }}
                        placeholder="Contoh: Ukuran tidak muat, barang dikembalikan, tidak cocok"
                        value={alasanRetur}
                        onChange={e => setAlasanRetur(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {['Ukuran tidak pas', 'Barang dikembalikan', 'Cacat / Rusak', 'Tidak jadi beli'].map(t => (
                          <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => setAlasanRetur(t)} style={{ fontSize: 9, padding: '2px 6px' }}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── SECTION 2: PEMBAYARAN UANG (jika tab bayar / kombinasi) ─── */}
                {(pelunasanTab === 'bayar' || pelunasanTab === 'kombinasi') && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', borderRadius: 10, padding: '12px 14px', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald)', marginBottom: 6, fontSize: 12 }}>
                      <i className="fa-solid fa-money-bill-wave" style={{ marginRight: 6 }} /> Nominal Pembayaran Uang (Rp)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ fontSize: 14, fontWeight: 700 }}
                      value={bayarNominal}
                      onChange={e => setBayarNominal(e.target.value)}
                      placeholder="0"
                      min="0"
                      max={currentSisa - (pelunasanTab === 'kombinasi' ? totalReturNilai : 0)}
                    />

                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {[
                        currentSisa - (pelunasanTab === 'kombinasi' ? totalReturNilai : 0),
                        Math.round((currentSisa - (pelunasanTab === 'kombinasi' ? totalReturNilai : 0)) / 2),
                        50000,
                        100000
                      ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).slice(0, 4).map(v => (
                        <button key={v} type="button" className="btn btn-ghost btn-sm" onClick={() => setBayarNominal(String(v))} style={{ fontSize: 10, padding: '3px 8px' }}>
                          {formatRp(v)}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>METODE BAYAR</label>
                        <select className="form-input" style={{ fontSize: 11, height: 30 }} value={bayarMetode} onChange={e => setBayarMetode(e.target.value)}>
                          <option value="Tunai">💵 Tunai / Cash</option>
                          <option value="Transfer Bank">🏦 Transfer Bank</option>
                          <option value="QRIS">📱 QRIS</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>CATATAN (OPSIONAL)</label>
                        <input className="form-input" style={{ fontSize: 11, height: 30 }} placeholder="Contoh: BCA / Kasir" value={bayarCatatan} onChange={e => setBayarCatatan(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── SECTION 3: RINGKASAN PEMOTONGAN HUTANG ─── */}
                <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tagihan Hutang Saat Ini:</span>
                    <span style={{ fontWeight: 700 }}>{formatRp(currentSisa)}</span>
                  </div>
                  {pelunasanTab !== 'retur' && nominalUang > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--emerald)' }}>
                      <span>(-) Pembayaran Uang ({bayarMetode}):</span>
                      <span style={{ fontWeight: 700 }}>{formatRp(nominalUang)}</span>
                    </div>
                  )}
                  {pelunasanTab !== 'bayar' && effectiveRetur > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--amber)' }}>
                      <span>(-) Retur Barang ({returnedItemsActive.length} item):</span>
                      <span style={{ fontWeight: 700 }}>{formatRp(effectiveRetur)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Sisa Tagihan Baru:</span>
                    <span style={{ fontWeight: 900, fontSize: 16, color: newSisa <= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                      {newSisa <= 0 ? '✅ LUNAS PENUH' : formatRp(newSisa)}
                    </span>
                  </div>
                </div>

                {/* Riwayat Transaksi Sebelumnya */}
                {pelunasanTarget.riwayatBayar?.length > 0 && (
                  <div>
                    <div className="form-label" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Riwayat Pembayaran &amp; Retur Sebelumnya</div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
                      {pelunasanTarget.riwayatBayar.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                          <span>
                            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{r.tanggal}</span>
                            <span style={{ color: r.type === 'retur' ? 'var(--amber)' : 'var(--text-secondary)' }}>
                              {r.type === 'retur' ? '🔄 ' : '💵 '}{r.keterangan || (r.type === 'retur' ? 'Retur Barang' : 'Pembayaran')}
                            </span>
                          </span>
                          <span style={{ fontWeight: 700, color: r.type === 'retur' ? 'var(--amber)' : 'var(--emerald)' }}>
                            {formatRp(Math.abs(r.nominal))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPelunasanTarget(null)} disabled={saving}>Batal</button>
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={handleSimpanPelunasan}
                  disabled={saving || totalPotongan <= 0}
                  style={{ flex: 1 }}
                >
                  {saving ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</> : <><i className="fa-brands fa-whatsapp" /> Simpan &amp; Kirim Nota ke WhatsApp</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* ═══ OVERDUE REMINDER MODAL ══════════════════════════════════ */}
      {showOverdueModal && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowOverdueModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Daftar Tagihan Overdue &amp; Reminder WhatsApp
              </div>
              <button className="modal-close" onClick={() => setShowOverdueModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--rose)', borderRadius: 8, padding: '10px 14px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{overdueList.length} tagihan lewat jatuh tempo</strong> · Total: <span style={{ color: 'var(--rose)', fontWeight: 800 }}>{formatRp(totalOverdueNominal)}</span>
                </div>
                <button className="btn btn-wa btn-sm" onClick={sendOverdueRekapWA}>
                  <i className="fa-brands fa-whatsapp" /> Rekap ke WA Toko
                </button>
              </div>
              {overdueList.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <i className="fa-solid fa-circle-check" style={{ color: 'var(--emerald)' }} />
                  <p>Tidak ada tagihan yang melewati jatuh tempo saat ini.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {overdueList.map(h => {
                    const diffDays = getOverdueDays(h);
                    const nama = h.pelanggan || h.nama || h.supplier;
                    return (
                      <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{nama}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            📱 {h.noWa || 'Tanpa no WA'} · JT: {h.tanggalJatuhTempo} (<span style={{ color: 'var(--rose)', fontWeight: 700 }}>Lewat {diffDays} hari</span>)
                          </div>
                          {h.keterangan && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📌 {h.keterangan}</div>}
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>SISA TAGIHAN</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--rose)' }}>{formatRp(h.sisaHutang)}</div>
                          </div>
                          <button
                            className="btn btn-wa btn-sm"
                            onClick={() => sendOverdueReminderWA(h)}
                            title={`Kirim reminder tagihan ke ${nama}`}
                          >
                            <i className="fa-brands fa-whatsapp" /> Kirim Reminder
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowOverdueModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HutangPage;
