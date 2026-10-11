import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { printReportHTML } from '../services/exportUtils';
import { getTodayIso, normalizeDateStr } from '../services/dataSync';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const CAT_EMOJI = { 'Pakaian Wanita': '👗', 'Pakaian Pria': '👕', 'Hijab': '🧕', 'Aksesoris': '💍', 'Lainnya': '📦' };

const KasirPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [cart, setCart] = useState([]);
  const [payMethod, setPayMethod] = useState('Tunai');
  const [cashInput, setCashInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerWa, setCustomerWa] = useState('');
  const [datetime, setDatetime] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTrx, setLastTrx] = useState(null);
  const [mobileTab, setMobileTab] = useState('catalog');
  // Diskon
  const [diskonType, setDiskonType] = useState('persen'); // 'persen' | 'nominal'
  const [diskonValue, setDiskonValue] = useState('');

  // ─── TRANSAKSI PENDING STATES ─────────────────────────────────────────
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [holdNoteModal, setHoldNoteModal] = useState(false);
  const [holdNoteInput, setHoldNoteInput] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');

  // ─── TRANSAKSI HUTANG & PELUNASAN / RETUR STATES ──────────────────────
  const [hutangDp, setHutangDp] = useState('');
  const [hutangJatuhTempo, setHutangJatuhTempo] = useState('');
  const [hutangCatatan, setHutangCatatan] = useState('');

  // Pelunasan & Retur Modal States
  const [showPelunasanModal, setShowPelunasanModal] = useState(false);
  const [pelunasanSearch, setPelunasanSearch] = useState('');
  const [pelunasanTarget, setPelunasanTarget] = useState(null); // Selected debt object
  const [pelunasanMode, setPelunasanMode] = useState(''); // 'bayar_full' | 'bayar_sebagian' | 'retur'
  const [pelunasanBayarNominal, setPelunasanBayarNominal] = useState('');
  const [pelunasanBayarMethod, setPelunasanBayarMethod] = useState('Tunai');
  const [pelunasanReturItems, setPelunasanReturItems] = useState([]);
  const [pelunasanReturAlasan, setPelunasanReturAlasan] = useState('');
  const [pelunasanSaving, setPelunasanSaving] = useState(false);

  const pendingList = appData.pendingTransactions || [];

  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDatetime(now.toISOString().slice(0, 16));
  }, []);

  const filtered = appData.stok.filter(i => {
    const sTerm = search.toLowerCase().trim();
    const matchSearch = !sTerm ||
      (i.nama_barang && i.nama_barang.toLowerCase().includes(sTerm)) ||
      (i.kategori && i.kategori.toLowerCase().includes(sTerm)) ||
      (i.supplier && i.supplier.toLowerCase().includes(sTerm)) ||
      (i.suplier && i.suplier.toLowerCase().includes(sTerm)) ||
      (i.nama_suplier && i.nama_suplier.toLowerCase().includes(sTerm)) ||
      (Array.isArray(i.supplierList) && i.supplierList.some(s => String(s).toLowerCase().includes(sTerm)));
    return matchSearch && (!category || i.kategori === category);
  });

  // State variant picker modal
  const [variantModalItem, setVariantModalItem] = useState(null);

  const addToCart = (item, selectedVariant = '') => {
    if (item.stokTersedia <= 0) return;
    const cartName = selectedVariant ? `${item.nama_barang} (${selectedVariant})` : item.nama_barang;

    setCart(prev => {
      const currentProductQty = prev.reduce((sum, c) => {
        const originalName = c.originalName || c.nama_barang;
        return originalName === item.nama_barang ? sum + (c.qty || 0) : sum;
      }, 0);
      const ex = prev.find(c => c.cartKey === cartName || c.nama_barang === cartName);
      if (ex) {
        if (currentProductQty + 1 > item.stokTersedia) { toast('Stok tidak mencukupi!', 'error'); return prev; }
        const newQty = ex.qty + 1;
        const isGrosir = item.minQtyGrosir > 0 && item.hargaGrosir > 0 && newQty >= item.minQtyGrosir;
        const effectivePrice = isGrosir ? item.hargaGrosir : item.hargaJual;
        return prev.map(c => (c.cartKey === cartName || c.nama_barang === cartName) ? { ...c, qty: newQty, hargaJual: effectivePrice, isGrosirActive: isGrosir } : c);
      }
      if (currentProductQty + 1 > item.stokTersedia) { toast('Stok tidak mencukupi!', 'error'); return prev; }
      const isGrosir = item.minQtyGrosir > 0 && item.hargaGrosir > 0 && 1 >= item.minQtyGrosir;
      const initialPrice = isGrosir ? item.hargaGrosir : item.hargaJual;
      return [...prev, { ...item, cartKey: cartName, nama_barang: cartName, originalName: item.nama_barang, qty: 1, hargaJual: initialPrice, isGrosirActive: isGrosir }];
    });
  };

  const handleProductCardClick = (item) => {
    if (item.stokTersedia <= 0) return;
    if (item.variasiText && item.variasiText.trim()) {
      setVariantModalItem(item);
    } else {
      addToCart(item);
    }
  };

  const updateQty = (name, d) => {
    setCart(prev => {
      const updated = prev.map(c => {
        if (c.nama_barang !== name) return c;
        const originalName = c.originalName || c.nama_barang;
        const maxStock = appData.stok.find(s => s.nama_barang === originalName || s.nama_barang === c.nama_barang)?.stokTersedia || 999;
        const otherVariantQty = prev.reduce((sum, item) => {
          if (item.nama_barang === c.nama_barang) return sum;
          const itemOriginalName = item.originalName || item.nama_barang;
          return itemOriginalName === originalName ? sum + (item.qty || 0) : sum;
        }, 0);
        const newQty = c.qty + d;
        if (newQty <= 0) return null;
        if (otherVariantQty + newQty > maxStock) { toast('Melebihi stok tersedia!', 'warning'); return c; }
        const isGrosir = c.minQtyGrosir > 0 && c.hargaGrosir > 0 && newQty >= c.minQtyGrosir;
        const effectivePrice = (c.isCustomPrice) ? c.hargaJual : (isGrosir ? c.hargaGrosir : (c.hargaJualNormal || c.hargaJual));
        return { ...c, qty: newQty, hargaJual: effectivePrice, isGrosirActive: isGrosir };
      }).filter(Boolean);
      return updated;
    });
  };

  const updatePrice = (name, newPrice) => {
    setCart(prev => prev.map(c => c.nama_barang === name ? { ...c, hargaJual: Math.max(0, newPrice), isCustomPrice: true } : c));
  };

  const subtotal  = cart.reduce((s, c) => s + c.hargaJual * c.qty, 0);
  const diskonNum  = parseFloat(diskonValue) || 0;
  const diskonAmt  = diskonType === 'persen'
    ? Math.round(subtotal * diskonNum / 100)
    : Math.min(diskonNum, subtotal);
  const total      = Math.max(0, subtotal - diskonAmt);
  const totalModal = cart.reduce((s, c) => s + (c.hargaModal || 0) * c.qty, 0);
  const laba       = total - totalModal;
  
  // Auto-fill cashInput dengan total jika payMethod adalah Tunai dan cashInput kosong
  useEffect(() => {
    if (payMethod === 'Tunai' && cart.length > 0) {
      if (!cashInput || cashInput === '0') {
        setCashInput(String(total));
      }
    }
  }, [total, payMethod, cart.length, cashInput]);
  
  const cashNum    = parseFloat(cashInput) || 0;
  const kembalian  = cashNum - total;

  const activePiutangList = (appData.hutang || []).filter(h => (h.type || 'piutang') === 'piutang' && (Number(h.sisaHutang || 0) > 0));

  const upsertPiutangEntry = (trxData) => {
    const targetName = (customerName || '').trim() || 'Pelanggan';
    const dpNum = Number(trxData.uangMuka || 0);
    const sisaHutangTrx = Number(trxData.sisaHutang !== undefined ? trxData.sisaHutang : trxData.totalPenjualan);

    const nextHutang = [...(appData.hutang || [])];
    const newDebtId = Date.now() + Math.floor(Math.random() * 1000);

    const newEntry = {
      id: newDebtId,
      trxId: trxData.id,
      kodeTrx: trxData.kodeTrx,
      type: 'piutang',
      tanggal: trxData.tanggal,
      waktu: trxData.waktu,
      pelanggan: targetName,
      nama: targetName,
      noWa: customerWa || '',
      jumlahAwal: trxData.totalPenjualan,
      uangMuka: dpNum,
      sisaHutang: sisaHutangTrx,
      keterangan: hutangCatatan ? `${hutangCatatan} (${trxData.kodeTrx})` : `Penjualan Kasir ${trxData.kodeTrx}`,
      tanggalJatuhTempo: hutangJatuhTempo || '',
      items: trxData.items.map(i => ({ ...i })),
      riwayatBayar: dpNum > 0 ? [
        { tanggal: trxData.tanggal, nominal: dpNum, keterangan: `Uang Muka (DP) Kasir ${trxData.kodeTrx}`, type: 'dp' }
      ] : []
    };

    nextHutang.unshift(newEntry);
    return nextHutang;
  };

  const handleCheckout = async () => {
    if (!cart.length) { toast('Keranjang masih kosong!', 'error'); return; }
    if (payMethod === 'Tunai' && cashNum < total) { toast('Uang tidak cukup!', 'error'); return; }

    if (payMethod === 'Hutang') {
      const custClean = (customerName || '').trim();
      if (!custClean || custClean.toLowerCase() === 'umum') {
        toast('Nama pelanggan wajib diisi untuk transaksi dengan metode Hutang!', 'error');
        return;
      }
    }

    const dpNum = payMethod === 'Hutang' ? Math.max(0, parseFloat(hutangDp) || 0) : 0;
    if (payMethod === 'Hutang' && dpNum > total) {
      toast('Uang muka (DP) tidak boleh melebihi total belanja!', 'error');
      return;
    }
    const sisaHutangTrx = payMethod === 'Hutang' ? Math.max(0, total - dpNum) : 0;

    const nowTime = new Date();
    const formattedTime = nowTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = datetime ? datetime.slice(0, 10) : getTodayIso();
    const kodeTrx = 'TRX-' + Math.floor(100000 + Math.random() * 900000);

    const trx = {
      id: Date.now(),
      kodeTrx,
      tanggal: formattedDate,
      waktu: formattedTime,
      pelanggan: customerName || 'Umum',
      noWa: customerWa,
      metodeBayar: payMethod,
      items: cart.map(c => ({
        barang: c.nama_barang,
        originalName: c.originalName || c.nama_barang,
        jumlah: c.qty,
        hargaModal: c.hargaModal || 0,
        hargaJual: c.hargaJual,
        subtotal: c.hargaJual * c.qty
      })),
      subtotalSebelumDiskon: subtotal,
      diskonType,
      diskonValue: diskonNum,
      diskonAmt,
      totalPenjualan: total,
      totalModal,
      laba,
      uangDiterima: payMethod === 'Tunai' ? cashNum : (payMethod === 'Hutang' ? dpNum : total),
      kembalian: payMethod === 'Tunai' ? kembalian : 0,
      uangMuka: payMethod === 'Hutang' ? dpNum : 0,
      sisaHutang: payMethod === 'Hutang' ? sisaHutangTrx : 0,
      tanggalJatuhTempo: payMethod === 'Hutang' ? hutangJatuhTempo : '',
      catatanHutang: payMethod === 'Hutang' ? hutangCatatan : ''
    };

    const debtLedger = payMethod === 'Hutang' ? upsertPiutangEntry(trx) : (appData.hutang || []);

    // Reduce stock
    const newStok = appData.stok.map(s => {
      const qtySold = cart.reduce((sum, c) => {
        const originalName = c.originalName || c.nama_barang;
        return originalName === s.nama_barang ? sum + (c.qty || 0) : sum;
      }, 0);
      if (!qtySold) return s;
      return { ...s, stokTersedia: Math.max(0, s.stokTersedia - qtySold) };
    });

    const newData = {
      ...appData,
      stok: newStok,
      penjualan: [...(appData.penjualan || []), trx],
      hutang: debtLedger
    };

    await saveAndSync(newData);
    setLastTrx(trx);
    setShowReceipt(true);
    setCart([]);
    setCashInput('');
    setCustomerName('');
    setCustomerWa('');
    setDiskonValue('');
    setDiskonType('persen');
    setHutangDp('');
    setHutangJatuhTempo('');
    setHutangCatatan('');

    // Kirim struk otomatis ke WhatsApp (jika diaktifkan di settings)
    if (autoSendWaEnabled) {
      setTimeout(() => {
        sendWhatsAppAuto(trx);
      }, 1000);
    }

    const resetNow = new Date();
    resetNow.setMinutes(resetNow.getMinutes() - resetNow.getTimezoneOffset());
    setDatetime(resetNow.toISOString().slice(0, 16));
  };

  const STORE_OWNER_WA = '6285117027358';

  const formatWaNumber = (inputNo) => {
    if (!inputNo) return '';
    let clean = String(inputNo).replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  };

  // Cek pengaturan auto-send WhatsApp dari settings
  const settings = appData.settings || {};
  const autoSendWaEnabled = settings.autoSendWa !== false; // default: true
  const sendWaToStoreEnabled = settings.sendWaToStore !== false; // default: true

  const sendWhatsApp = () => {
    if (!lastTrx) { toast('Tidak ada transaksi untuk dikirim', 'warning'); return; }
    const rawCustWa = lastTrx.noWa || customerWa;
    let custWa = formatWaNumber(rawCustWa);
    if (!custWa) {
      const inputNo = window.prompt(
        'Masukkan No WhatsApp Pelanggan (contoh: 08123456789)\nAtau kosongkan lalu klik OK untuk langsung bagikan via WhatsApp:',
        ''
      );
      if (inputNo === null) return;
      custWa = formatWaNumber(inputNo);
    }
    sendWhatsAppAuto({ ...lastTrx, noWa: custWa }, true);
  };

  // Fungsi untuk mengirim struk otomatis (dipanggil dari handleCheckout)
  const sendWhatsAppAuto = (trxData, isManual = false) => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'MELAN JAYA')
      .replace(/Agnes\s*Fashion/gi, 'Melan Jaya')
      .replace(/Agnes/gi, 'Melan Jaya');
    const footerText = (s.receiptFooter || 'Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.')
      .replace(/Agnes\s*Fashion/gi, 'Melan Jaya')
      .replace(/Agnes/gi, 'Melan Jaya');

    let msg = `*STRUK BELANJA ${storeName.toUpperCase()}*\n`;
    if (s.storeAddress) msg += `${s.storeAddress}\n`;
    msg += `───────────────────\n`;
    msg += `No TRX : ${trxData.kodeTrx}\n`;
    msg += `Tanggal: ${trxData.tanggal} ${trxData.waktu || ''}\n`;
    msg += `Pelanggan: ${trxData.pelanggan || 'Umum'}\n`;
    msg += `───────────────────\n`;
    (trxData.items || []).forEach(i => { msg += `${i.barang} x${i.jumlah}  ${formatRp(i.subtotal)}\n`; });
    msg += `───────────────────\n`;
    if (trxData.diskonAmt > 0) {
      msg += `Subtotal  : ${formatRp(trxData.subtotalSebelumDiskon || trxData.totalPenjualan + trxData.diskonAmt)}\n`;
      msg += `Diskon    : -${formatRp(trxData.diskonAmt)}${trxData.diskonType === 'persen' ? ` (${trxData.diskonValue}%)` : ''}\n`;
    }
    msg += `*TOTAL: ${formatRp(trxData.totalPenjualan)}*\n`;
    msg += `Metode: ${trxData.metodeBayar === 'Hutang' ? 'HUTANG / KASBON' : trxData.metodeBayar}\n`;
    if (trxData.metodeBayar === 'Tunai') {
      msg += `Bayar: ${formatRp(trxData.uangDiterima)}\n`;
      msg += `Kembalian: ${formatRp(trxData.kembalian)}\n`;
    } else if (trxData.metodeBayar === 'Hutang') {
      if (trxData.uangMuka > 0) {
        msg += `Uang Muka (DP): ${formatRp(trxData.uangMuka)}\n`;
      }
      msg += `*Sisa Tagihan : ${formatRp(trxData.sisaHutang !== undefined ? trxData.sisaHutang : trxData.totalPenjualan)}*\n`;
      if (trxData.tanggalJatuhTempo) {
        msg += `Jatuh Tempo   : ${trxData.tanggalJatuhTempo}\n`;
      }
      msg += `Status        : ${trxData.sisaHutang <= 0 ? 'LUNAS' : 'BELUM LUNAS'}\n`;
    }
    msg += `───────────────────\n`;
    msg += `${footerText}`;

    const encodedMsg = encodeURIComponent(msg);
    const rawCustWa = trxData.noWa || customerWa;
    const custWa = formatWaNumber(rawCustWa);
    const ownerWa = formatWaNumber(s.storePhone) || STORE_OWNER_WA;

    if (custWa) {
      // 1. Kirim ke nomor WhatsApp pelanggan
      window.open(`https://api.whatsapp.com/send?phone=${custWa}&text=${encodedMsg}`, '_blank');
      // 2. Kirim juga salinan ke nomor toko (jika diaktifkan)
      if (sendWaToStoreEnabled && !isManual) {
        setTimeout(() => {
          window.open(`https://api.whatsapp.com/send?phone=${ownerWa}&text=${encodedMsg}`, '_blank');
        }, 500);
        toast(`📲 Struk terkirim ke Pelanggan (${custWa}) & Toko (${ownerWa})`, 'success');
      } else {
        toast(`📲 Struk terkirim ke Pelanggan (${custWa})`, 'success');
      }
    } else if (isManual) {
      window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
      toast('📲 Membuka WhatsApp untuk bagikan struk!', 'success');
    } else {
      // Hanya kirim ke nomor toko (jika diaktifkan)
      if (sendWaToStoreEnabled) {
        window.open(`https://api.whatsapp.com/send?phone=${ownerWa}&text=${encodedMsg}`, '_blank');
        toast(`📲 Struk terkirim ke WhatsApp Toko (${ownerWa})`, 'info');
      } else {
        toast('✅ Transaksi selesai', 'success');
      }
    }
  };

  // ─── HANDLERS PELUNASAN HUTANG & RETUR ────────────────────────────────
  const handlePelunasanBayarFull = async (debtItem, method = 'Tunai') => {
    const nominal = Number(debtItem.sisaHutang || 0);
    if (nominal <= 0) {
      toast('Tagihan pelanggan ini sudah lunas!', 'info');
      return;
    }
    setPelunasanSaving(true);
    const today = getTodayIso();
    const updatedHutang = (appData.hutang || []).map(h => {
      if (h.id !== debtItem.id) return h;
      return {
        ...h,
        sisaHutang: 0,
        riwayatBayar: [
          ...(h.riwayatBayar || []),
          {
            tanggal: today,
            nominal,
            metode: method,
            keterangan: `Pelunasan Full (${method})`,
            type: 'pelunasan_full'
          }
        ]
      };
    });

    await saveAndSync({ ...appData, hutang: updatedHutang });
    setPelunasanSaving(false);
    toast(`✅ Pelunasan Full berhasil! Hutang ${debtItem.pelanggan || debtItem.nama} senilai ${formatRp(nominal)} telah LUNAS.`, 'success');
    sendPelunasanWA(debtItem, nominal, 0, method);
    setPelunasanMode('');
    setPelunasanTarget(null);
  };

  const handlePelunasanBayarSebagian = async (debtItem, bayarNominal, method = 'Tunai') => {
    const nominal = parseFloat(bayarNominal) || 0;
    if (nominal <= 0) {
      toast('Nominal pembayaran harus lebih dari 0!', 'error');
      return;
    }
    if (nominal > debtItem.sisaHutang) {
      toast('Nominal pembayaran melebihi sisa tagihan!', 'error');
      return;
    }
    setPelunasanSaving(true);
    const today = getTodayIso();
    const newSisa = Math.max(0, Number(debtItem.sisaHutang || 0) - nominal);
    const updatedHutang = (appData.hutang || []).map(h => {
      if (h.id !== debtItem.id) return h;
      return {
        ...h,
        sisaHutang: newSisa,
        riwayatBayar: [
          ...(h.riwayatBayar || []),
          {
            tanggal: today,
            nominal,
            metode: method,
            keterangan: `Pembayaran Cicilan (${method})`,
            type: 'cicilan'
          }
        ]
      };
    });

    await saveAndSync({ ...appData, hutang: updatedHutang });
    setPelunasanSaving(false);
    toast(`✅ Pembayaran ${formatRp(nominal)} berhasil! Sisa hutang: ${formatRp(newSisa)}.`, 'success');
    sendPelunasanWA(debtItem, nominal, newSisa, method);
    setPelunasanMode('');
    setPelunasanTarget(null);
    setPelunasanBayarNominal('');
  };

  const openReturDrawer = (debtItem) => {
    setPelunasanTarget(debtItem);
    if (Array.isArray(debtItem.items) && debtItem.items.length > 0) {
      setPelunasanReturItems(debtItem.items.map(it => ({
        barang: it.barang,
        originalName: it.originalName || it.barang,
        jumlah: it.jumlah,
        hargaJual: it.hargaJual,
        returQty: 0,
        maxQty: it.jumlah
      })));
    } else {
      setPelunasanReturItems([]);
    }
    setPelunasanReturAlasan('');
    setPelunasanMode('retur');
  };

  const handleConfirmRetur = async (debtItem) => {
    const itemsToReturn = pelunasanReturItems.filter(i => (parseInt(i.returQty) || 0) > 0);
    if (!itemsToReturn.length) {
      toast('Pilih minimal 1 barang untuk diretur!', 'warning');
      return;
    }
    const totalNilaiRetur = itemsToReturn.reduce((sum, it) => sum + (it.hargaJual * it.returQty), 0);
    if (totalNilaiRetur <= 0) {
      toast('Total nilai retur harus lebih dari 0', 'error');
      return;
    }

    setPelunasanSaving(true);
    const today = getTodayIso();
    const currentSisa = Number(debtItem.sisaHutang !== undefined ? debtItem.sisaHutang : debtItem.jumlahAwal);
    const newSisa = Math.max(0, currentSisa - totalNilaiRetur);

    // 1. Kembalikan stok barang ke inventori
    const nextStok = appData.stok.map(s => {
      const match = itemsToReturn.find(it =>
        it.barang === s.nama_barang ||
        it.originalName === s.nama_barang ||
        (it.barang && it.barang.startsWith(s.nama_barang))
      );
      if (!match) return s;
      return { ...s, stokTersedia: s.stokTersedia + match.returQty };
    });

    // 2. Buat catatan retur di riwayat retur toko
    const returEntry = {
      id: Date.now(),
      idTrxAsli: debtItem.trxId || debtItem.id,
      kodeTrxAsli: debtItem.kodeTrx || `HUTANG-${debtItem.id}`,
      tanggal: today,
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      pelanggan: debtItem.pelanggan || debtItem.nama || 'Umum',
      alasan: pelunasanReturAlasan.trim() || 'Pengembalian barang dan pemotongan hutang',
      items: itemsToReturn.map(it => ({
        barang: it.barang,
        jumlah: it.returQty,
        hargaJual: it.hargaJual,
        subtotal: it.hargaJual * it.returQty
      })),
      totalRetur: totalNilaiRetur,
      keterangan: `Pemotongan hutang pelanggan. Sisa hutang baru: ${formatRp(newSisa)}`
    };

    // 3. Update data hutang pelanggan
    const itemNames = itemsToReturn.map(it => `${it.barang} x${it.returQty}`).join(', ');
    const nextHutang = (appData.hutang || []).map(h => {
      if (h.id !== debtItem.id) return h;
      return {
        ...h,
        sisaHutang: newSisa,
        riwayatBayar: [
          ...(h.riwayatBayar || []),
          {
            tanggal: today,
            nominal: -totalNilaiRetur,
            keterangan: `Retur Barang: ${itemNames} (${pelunasanReturAlasan || 'Retur'})`,
            type: 'retur'
          }
        ]
      };
    });

    await saveAndSync({
      ...appData,
      stok: nextStok,
      hutang: nextHutang,
      retur: [...(appData.retur || []), returEntry]
    });

    setPelunasanSaving(false);
    toast(`✅ Retur berhasil! Stok dikembalikan & hutang ${debtItem.pelanggan || debtItem.nama} berkurang ${formatRp(totalNilaiRetur)}.`, 'success');
    sendReturNotaWA(debtItem, itemsToReturn, totalNilaiRetur, newSisa, pelunasanReturAlasan);
    setPelunasanMode('');
    setPelunasanTarget(null);
  };

  const sendPelunasanWA = (debtItem, nominal, newSisa, method) => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'MELAN JAYA').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
    let msg = `*BUKTI PEMBAYARAN / PELUNASAN HUTANG — ${storeName.toUpperCase()}*\n`;
    if (s.storeAddress) msg += `${s.storeAddress}\n`;
    msg += `───────────────────\n`;
    msg += `Pelanggan   : ${debtItem.pelanggan || debtItem.nama}\n`;
    if (debtItem.kodeTrx) msg += `No Transaksi: ${debtItem.kodeTrx}\n`;
    msg += `Tanggal     : ${getTodayIso()}\n`;
    msg += `───────────────────\n`;
    msg += `Jumlah Awal  : ${formatRp(debtItem.jumlahAwal)}\n`;
    msg += `Nominal Bayar: ${formatRp(nominal)}\n`;
    msg += `Metode Bayar : ${method}\n`;
    msg += `───────────────────\n`;
    if (newSisa <= 0) {
      msg += `*STATUS : LUNAS (SEMUA TAGIHAN SELESAI)* ✅\n`;
      msg += `*Sisa Tagihan: Rp 0*\n`;
    } else {
      msg += `*Sisa Tagihan: ${formatRp(newSisa)}*\n`;
      msg += `Status: Belum Lunas (Sisa tagihan aktif)\n`;
    }
    msg += `───────────────────\n`;
    msg += `Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.`;

    const encoded = encodeURIComponent(msg);
    const targetWa = formatWaNumber(debtItem.noWa || customerWa);
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encoded}`, '_blank');
      toast(`📲 Bukti pembayaran dikirim ke WhatsApp (${targetWa})`, 'info');
    }
  };

  const sendReturNotaWA = (debtItem, itemsRetur, totalNilaiRetur, newSisa, alasan) => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'MELAN JAYA').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
    let msg = `*NOTA RETUR & PENYESUAIAN HUTANG — ${storeName.toUpperCase()}*\n`;
    if (s.storeAddress) msg += `${s.storeAddress}\n`;
    msg += `───────────────────\n`;
    msg += `Pelanggan   : ${debtItem.pelanggan || debtItem.nama}\n`;
    if (debtItem.kodeTrx) msg += `No Transaksi: ${debtItem.kodeTrx}\n`;
    msg += `Tanggal     : ${getTodayIso()}\n`;
    if (alasan) msg += `Alasan      : ${alasan}\n`;
    msg += `───────────────────\n`;
    msg += `*Barang Yang Dikembalikan (Retur):*\n`;
    itemsRetur.forEach(it => {
      msg += `• ${it.barang} x${it.returQty} = ${formatRp(it.hargaJual * it.returQty)}\n`;
    });
    msg += `───────────────────\n`;
    msg += `Total Potongan Retur: -${formatRp(totalNilaiRetur)}\n`;
    msg += `*Sisa Hutang Baru   : ${formatRp(newSisa)}*\n`;
    msg += `Status Tagihan      : ${newSisa <= 0 ? 'LUNAS (Semua tagihan selesai) ✅' : 'Belum Lunas'}\n`;
    msg += `───────────────────\n`;
    msg += `Terima Kasih Atas Kerjasamanya di Melan Jaya! 🙏`;

    const encoded = encodeURIComponent(msg);
    const targetWa = formatWaNumber(debtItem.noWa || customerWa);
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encoded}`, '_blank');
      toast(`📲 Nota retur & penyesuaian hutang dikirim ke WhatsApp (${targetWa})`, 'info');
    }
  };

  // ─── HANDLERS TRANSAKSI PENDING ────────────────────────────────────────
  const confirmHoldCart = async (note = '') => {
    if (!cart.length) {
      toast('Keranjang masih kosong!', 'warning');
      return;
    }
    const pendingId = 'PEND-' + Date.now();
    const kodePending = 'PEND-' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date();

    const pendingItem = {
      id: pendingId,
      kodePending,
      tanggal: now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-'),
      waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      created_at: now.toISOString(),
      pelanggan: customerName.trim() || note.trim() || 'Pelanggan Umum',
      noWa: customerWa.trim(),
      catatan: note.trim() || customerName.trim() || 'Pending Kasir',
      items: [...cart],
      subtotalSebelumDiskon: subtotal,
      diskonType,
      diskonValue: diskonNum,
      diskonAmt,
      totalPenjualan: total,
      totalModal,
      metodeBayar: payMethod
    };

    const nextPending = [pendingItem, ...pendingList];
    await saveAndSync({ ...appData, pendingTransactions: nextPending });

    // Clear active cart & inputs
    setCart([]);
    setCustomerName('');
    setCustomerWa('');
    setDiskonValue('');
    setDiskonType('persen');
    setHoldNoteModal(false);
    setHoldNoteInput('');
    toast('⏸️ Transaksi berhasil disimpan di daftar Pending!', 'success');
  };

  const handleLoadPending = async (item, deleteAfterLoad = true) => {
    setCart(item.items || []);
    setCustomerName(item.pelanggan || '');
    setCustomerWa(item.noWa || '');
    setDiskonType(item.diskonType || 'persen');
    setDiskonValue(item.diskonValue ? String(item.diskonValue) : '');
    setPayMethod(item.metodeBayar || 'Tunai');

    if (deleteAfterLoad) {
      const nextPending = pendingList.filter(p => p.id !== item.id);
      await saveAndSync({ ...appData, pendingTransactions: nextPending });
    }

    setShowPendingModal(false);
    setMobileTab('cart');
    toast(`▶️ Transaksi pending (${item.pelanggan}) dimuat ke keranjang!`, 'info');
  };

  const handleDeletePending = async (id) => {
    const nextPending = pendingList.filter(p => p.id !== id);
    await saveAndSync({ ...appData, pendingTransactions: nextPending });
    toast('🗑️ Transaksi pending dihapus', 'info');
  };

  const handleSharePendingWA = (item) => {
    const s = appData.settings || {};
    let msg = `*TAGIHAN / NOTA PENDING ${s.storeName?.toUpperCase() || 'MELAN JAYA'}*\n`;
    if (s.storeAddress) msg += `${s.storeAddress}\n`;
    msg += `───────────────────\n`;
    msg += `No Pending : ${item.kodePending || item.id}\n`;
    msg += `Tanggal    : ${item.tanggal} ${item.waktu || ''}\n`;
    msg += `Pelanggan  : ${item.pelanggan || 'Umum'}\n`;
    if (item.catatan) msg += `Catatan    : ${item.catatan}\n`;
    msg += `───────────────────\n`;
    (item.items || []).forEach(i => {
      const itemSub = i.hargaJual * i.qty;
      msg += `${i.nama_barang} x${i.qty} = ${formatRp(itemSub)}\n`;
    });
    msg += `───────────────────\n`;
    if (item.diskonAmt > 0) {
      msg += `Subtotal : ${formatRp(item.subtotalSebelumDiskon || (item.totalPenjualan + item.diskonAmt))}\n`;
      msg += `Diskon   : -${formatRp(item.diskonAmt)}\n`;
    }
    msg += `*TOTAL TAGIHAN: ${formatRp(item.totalPenjualan || item.total)}*\n`;
    msg += `───────────────────\n`;
    msg += `Mohon konfirmasi pesanan jika sudah sesuai. Terima kasih! 🙏`;

    const encodedMsg = encodeURIComponent(msg);
    const custWa = formatWaNumber(item.noWa || customerWa);
    const ownerWa = formatWaNumber(s.storePhone) || '6285117027358';
    const targetWa = custWa || ownerWa;

    window.open(`https://wa.me/${targetWa}?text=${encodedMsg}`, '_blank');
    toast(`📲 Tagihan pending dikirim ke WhatsApp (${targetWa})`, 'success');
  };

  const handlePrintPending = (item) => {
    const s = appData.settings || {};
    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="border-bottom:2px solid #333;"><th style="text-align:left;padding:6px;">Barang</th><th style="text-align:center;padding:6px;">Qty</th><th style="text-align:right;padding:6px;">Harga</th><th style="text-align:right;padding:6px;">Subtotal</th></tr></thead><tbody>';
    (item.items || []).forEach(i => {
      const itemSub = i.hargaJual * i.qty;
      tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">${i.nama_barang}</td><td style="text-align:center;padding:6px;">${i.qty}</td><td style="text-align:right;padding:6px;">${formatRp(i.hargaJual)}</td><td style="text-align:right;padding:6px;">${formatRp(itemSub)}</td></tr>`;
    });
    if (item.diskonAmt > 0) {
      tableHtml += `<tr><td colSpan="3" style="text-align:right;padding:6px;font-weight:bold;">Subtotal:</td><td style="text-align:right;padding:6px;">${formatRp(item.subtotalSebelumDiskon || (item.totalPenjualan + item.diskonAmt))}</td></tr>`;
      tableHtml += `<tr><td colSpan="3" style="text-align:right;padding:6px;font-weight:bold;color:#d97706;">Diskon:</td><td style="text-align:right;padding:6px;color:#d97706;">-${formatRp(item.diskonAmt)}</td></tr>`;
    }
    tableHtml += `<tr style="font-weight:bold;background:#f3f4f6;"><td colSpan="3" style="text-align:right;padding:8px;font-size:14px;">TOTAL TAGIHAN:</td><td style="text-align:right;padding:8px;font-size:14px;color:#059669;">${formatRp(item.totalPenjualan || item.total)}</td></tr></tbody></table>`;

    if (item.catatan) {
      tableHtml += `<div style="margin-top:12px;padding:8px;background:#fef3c7;border-radius:6px;font-size:12px;"><strong>Catatan:</strong> ${item.catatan}</div>`;
    }

    printReportHTML(
      `NOTA PENDING / PRE-ORDER - ${item.kodePending || item.id}`,
      `Pelanggan: ${item.pelanggan || 'Umum'} ${item.noWa ? `(${item.noWa})` : ''} | Tgl: ${item.tanggal} ${item.waktu || ''}`,
      tableHtml
    );
  };

  const cartItemCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="tab-page active fade-up">
      {/* Mobile Tab Switcher */}
      <div className="kasir-mobile-tabs">
        <button
          className={`kasir-tab-btn${mobileTab === 'catalog' ? ' active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <i className="fa-solid fa-store" /> Katalog Produk
        </button>
        <button
          className={`kasir-tab-btn${mobileTab === 'cart' ? ' active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <i className="fa-solid fa-cart-shopping" /> Keranjang & Bayar
          {cartItemCount > 0 && <span className="kasir-tab-badge">{cartItemCount}</span>}
        </button>
      </div>

      <div className="pos-layout">
        {/* Product Grid Card */}
        <div className={`card pos-catalog-card${mobileTab !== 'catalog' ? ' desktop-and-mobile-hidden' : ''}`} style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-store" /> Katalog Produk</div>
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
              <div className="form-input-icon" style={{ flex: 1 }}>
                <i className="fa-solid fa-search" />
                <input
                  className="form-input"
                  placeholder="Cari barang / supplier..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  id="pos-search"
                />
              </div>
              <select className="form-input" style={{ width: 130 }} value={category} onChange={e => setCategory(e.target.value)} id="pos-category">
                <option value="">Kategori</option>
                {['Pakaian Wanita','Pakaian Pria','Hijab','Aksesoris','Lainnya'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="product-grid">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1', padding: '36px 20px' }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: 36, color: 'var(--brand)', marginBottom: 12 }} />
                <p style={{ fontSize: 13, marginBottom: 14 }}>Produk katalog belum tersedia.</p>
                <button
                  className="btn btn-purple"
                  onClick={() => {
                    const sample = {
                      appName: 'Melan Jaya POS',
                      lastUpdated: new Date().toISOString(),
                      stok: [
                        { nama_barang: 'Gamis Silk Premium', kategori: 'Pakaian Wanita', stokTersedia: 12, hargaModal: 120000, hargaJual: 175000, supplierList: ['Grosir Bandung'] },
                        { nama_barang: 'Kemeja Katun Pria', kategori: 'Pakaian Pria', stokTersedia: 15, hargaModal: 75000, hargaJual: 115000, supplierList: ['Tanah Abang'] },
                        { nama_barang: 'Hijab Bella Square', kategori: 'Hijab', stokTersedia: 30, hargaModal: 15000, hargaJual: 25000, supplierList: ['Grosir Hijab Solo'] },
                        { nama_barang: 'Bros Etnik Premium', kategori: 'Aksesoris', stokTersedia: 20, hargaModal: 10000, hargaJual: 20000, supplierList: ['Aksesoris Jogja'] }
                      ],
                      pembelian: [],
                      penjualan: appData.penjualan || [],
                      settings: appData.settings
                    };
                    saveAndSync(sample);
                    toast('✅ Katalog produk berhasil dimuat!', 'success');
                  }}
                >
                  <i className="fa-solid fa-rotate-right" /> Muat Katalog Produk Sampel
                </button>
              </div>
            ) : filtered.map(item => {
              const oos = item.stokTersedia <= 0;
              const low = !oos && item.stokTersedia <= 5;
              const supplierText = Array.isArray(item.supplierList) && item.supplierList.length > 0
                ? item.supplierList.join(', ')
                : (item.supplier || item.suplier || item.nama_suplier || '');

              return (
                <div
                  key={item.nama_barang}
                  className={`product-card${oos ? ' out-of-stock' : ''}`}
                  onClick={() => !oos && handleProductCardClick(item)}
                  title={oos ? 'Stok habis' : 'Klik untuk tambah ke keranjang'}
                >
                  <div className="product-stock-badge">
                    {oos ? <span className="badge badge-red">Habis</span>
                      : low ? <span className="badge badge-amber">Sisa {item.stokTersedia}</span>
                      : <span className="badge badge-green">{item.stokTersedia}</span>}
                  </div>
                  <div className="product-emoji">{CAT_EMOJI[item.kategori] || '📦'}</div>
                  <div className="product-name">{item.nama_barang}</div>
                  {item.minQtyGrosir > 0 && item.hargaGrosir > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, textAlign: 'center' }}>
                      ✨ Grosir ≥{item.minQtyGrosir} ({formatRp(item.hargaGrosir)})
                    </div>
                  )}
                  {item.variasiText && (
                    <div style={{ fontSize: 9, color: 'var(--brand)', fontWeight: 600, textAlign: 'center' }}>
                      🎨 {item.variasiText.split(',').length} variasi
                    </div>
                  )}
                  {supplierText && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🏭 {supplierText}
                    </div>
                  )}
                  <div className="product-price">{formatRp(item.hargaJual)}</div>
                  <div className="product-click-hint">
                    Klik untuk tambah ke keranjang
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className={`cart-panel${mobileTab !== 'cart' ? ' desktop-and-mobile-hidden' : ''}`}>
          <div className="cart-header">
            <div className="cart-header-title">
              <i className="fa-solid fa-shopping-cart" /> Keranjang
              {cart.length > 0 && (
                <span className="badge badge-violet">{cart.reduce((s,c) => s+c.qty, 0)}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 11, padding: '4px 8px', background: 'var(--brand-dim)', border: '1px solid rgba(124,58,237,0.2)' }}
                onClick={() => setShowPelunasanModal(true)}
                title="Sistem Pelunasan Hutang & Retur Barang Pelanggan"
              >
                <i className="fa-solid fa-hand-holding-dollar" /> Pelunasan ({activePiutangList.length})
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 11, padding: '4px 8px' }}
                onClick={() => setShowPendingModal(true)}
                title="Lihat transaksi pending"
              >
                <i className="fa-solid fa-clock-rotate-left" /> Pending ({pendingList.length})
              </button>
              {cart.length > 0 && (
                <button className="cart-clear-btn" onClick={() => setCart([])}>
                  <i className="fa-solid fa-trash" /> Kosongkan
                </button>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Nama pelanggan" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ fontSize: 11, flex: 1, minWidth: 120 }} id="cart-customer" />
            <input className="form-input" placeholder="No WA (opsional)" value={customerWa} onChange={e => setCustomerWa(e.target.value)} style={{ fontSize: 11, flex: 1, minWidth: 120 }} id="cart-wa" />
            <input type="datetime-local" className="form-input" value={datetime} onChange={e => setDatetime(e.target.value)} style={{ fontSize: 11, width: '100%' }} id="cart-datetime" />
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <i className="fa-solid fa-cart-shopping" />
                <p>Keranjang masih kosong.<br />Pilih produk di katalog.</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={item.nama_barang} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.nama_barang}</div>
                  <div className="cart-item-price-edit" style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Rp</span>
                    <input
                      type="number"
                      className="form-input cart-price-input"
                      value={item.hargaJual}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        updatePrice(item.nama_barang, isNaN(val) ? 0 : val);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '85px',
                        padding: '2px 5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        height: '24px',
                        color: 'var(--brand)',
                        borderRadius: '4px',
                        border: '1px solid var(--border)'
                      }}
                      title="Ubah harga jual per item"
                      placeholder="Harga"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>/pcs</span>
                  </div>
                </div>
                <div className="cart-item-qty">
                  <button className="qty-btn" onClick={() => updateQty(item.nama_barang, -1)}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.nama_barang, 1)}>+</button>
                </div>
                <div className="cart-item-subtotal">{formatRp(item.hargaJual * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="cart-footer">
            {/* Payment Method */}
            <div className="payment-methods">
              {['Tunai', 'Transfer', 'QRIS', 'Hutang'].map(m => (
                <button key={m} className={`pay-btn${payMethod === m ? ' active' : ''}`} onClick={() => setPayMethod(m)}>
                  {m === 'Tunai' ? '💵' : m === 'Transfer' ? '🏦' : m === 'QRIS' ? '📱' : '🧾'} {m}
                </button>
              ))}
            </div>

            {payMethod === 'Hutang' && (
              <div style={{ background: 'var(--brand-dim)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '10px 12px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>
                    <i className="fa-solid fa-receipt" style={{ marginRight: 6 }} /> Penjualan Metode Hutang / Bon
                  </span>
                  <span className="badge badge-amber" style={{ fontSize: 10, fontWeight: 700 }}>Nama Wajib Diisi</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>Uang Muka / DP (Rp)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0 (opsional)"
                      value={hutangDp}
                      onChange={e => setHutangDp(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 8px' }}
                      min="0"
                      max={total}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>Jatuh Tempo (Opsional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={hutangJatuhTempo}
                      onChange={e => setHutangJatuhTempo(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 8px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>Catatan Hutang (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Titip tetangga / Pelunasan akhir bulan"
                    value={hutangCatatan}
                    onChange={e => setHutangCatatan(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                </div>

                {/* Sisa Tagihan Preview */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 10px', fontSize: 11, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Total Belanja:</span>
                    <span>{formatRp(total)}</span>
                  </div>
                  {parseFloat(hutangDp) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--emerald)', fontWeight: 700 }}>
                      <span>Uang Muka (DP):</span>
                      <span>-{formatRp(parseFloat(hutangDp) || 0)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--rose)', fontSize: 12, borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
                    <span>Sisa Piutang Pelanggan:</span>
                    <span>{formatRp(Math.max(0, total - (parseFloat(hutangDp) || 0)))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Diskon */}
            {cart.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, padding: '8px 10px' }}>
                <i className="fa-solid fa-tag" style={{ color: 'var(--amber)', fontSize: 12 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', whiteSpace: 'nowrap' }}>Diskon</span>
                <select
                  className="form-input"
                  style={{ width: 70, padding: '4px 6px', fontSize: 11, height: 28 }}
                  value={diskonType}
                  onChange={e => setDiskonType(e.target.value)}
                >
                  <option value="persen">%</option>
                  <option value="nominal">Rp</option>
                </select>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1, padding: '4px 8px', fontSize: 11, height: 28 }}
                  placeholder={diskonType === 'persen' ? '0' : '0'}
                  value={diskonValue}
                  onChange={e => setDiskonValue(e.target.value)}
                  min="0"
                  max={diskonType === 'persen' ? 100 : undefined}
                  id="diskon-input"
                />
                {diskonAmt > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700, whiteSpace: 'nowrap' }}>-{formatRp(diskonAmt)}</span>
                )}
              </div>
            )}

            {/* Total */}
            <div className="total-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              {diskonAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Subtotal</span>
                  <span style={{ textDecoration: 'line-through' }}>{formatRp(subtotal)}</span>
                </div>
              )}
              {diskonAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--amber)', fontWeight: 700 }}>
                  <span>Diskon {diskonType === 'persen' ? `${diskonNum}%` : ''}</span>
                  <span>-{formatRp(diskonAmt)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="total-label">Total Bayar</span>
                <span className="total-value">{formatRp(total)}</span>
              </div>
            </div>

            {/* Cash input - auto-fill dengan total bayar */}
            {payMethod === 'Tunai' ? (
              <div className="kembalian-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="form-label">Uang Diterima (Rp)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0"
                    value={cashInput}
                    onChange={e => setCashInput(e.target.value)}
                    onFocus={e => {
                      // Jika input kosong, isi otomatis dengan total bayar
                      if (!cashInput || cashInput === '0') {
                        setCashInput(String(total));
                        // Auto-select text untuk mudah diedit
                        setTimeout(() => e.target.select(), 50);
                      } else {
                        // Auto-select text jika sudah ada nilai
                        setTimeout(() => e.target.select(), 50);
                      }
                    }}
                    onClick={e => {
                      // Jika input kosong, isi otomatis dengan total bayar
                      if (!cashInput || cashInput === '0') {
                        setCashInput(String(total));
                        setTimeout(() => e.target.select(), 50);
                      }
                    }}
                    id="cash-input"
                    style={{ fontSize: 14, fontWeight: 700, padding: '8px 12px' }}
                    autoComplete="off"
                  />
                </div>
                <div style={{ minWidth: 140, textAlign: 'right' }}>
                  <label className="form-label">Kembalian</label>
                  <div 
                    className="kembalian-display" 
                    style={{
                      fontSize: 14, 
                      fontWeight: 700, 
                      color: kembalian >= 0 ? 'var(--emerald)' : 'var(--rose)',
                      padding: '8px 12px',
                      background: 'var(--bg-hover)',
                      borderRadius: 6,
                      minHeight: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end'
                    }}
                  >
                    {cashNum >= total ? formatRp(kembalian) : '—'}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Action buttons: Pending / Hold & Checkout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, marginBottom: 8 }}>
              <button
                type="button"
                className="btn btn-amber"
                style={{ borderRadius: 10, fontWeight: 700, fontSize: 12, padding: '10px 8px' }}
                onClick={() => {
                  if (!cart.length) { toast('Keranjang masih kosong!', 'warning'); return; }
                  setHoldNoteInput(customerName || '');
                  setHoldNoteModal(true);
                }}
                disabled={!cart.length}
                title="Simpan keranjang ke daftar Pending"
              >
                <i className="fa-solid fa-pause-circle" /> Pending / Hold
              </button>

              <button
                type="button"
                className="btn btn-purple"
                style={{ borderRadius: 10, fontWeight: 700, fontSize: 12, padding: '10px 8px', position: 'relative' }}
                onClick={() => setShowPendingModal(true)}
                title="Buka daftar transaksi pending"
              >
                <i className="fa-solid fa-clock-rotate-left" /> Daftar Pending ({pendingList.length})
              </button>
            </div>

            <button 
              className={`btn ${payMethod === 'Hutang' ? 'btn-amber' : 'btn-green'} btn-full btn-lg btn-checkout-main`} 
              onClick={handleCheckout} 
              disabled={!cart.length} 
              id="btn-checkout"
              style={{
                fontSize: 16,
                fontWeight: 800,
                padding: '14px 20px',
                borderRadius: 12,
                marginTop: 12,
                boxShadow: payMethod === 'Hutang' ? '0 4px 12px rgba(217, 119, 6, 0.3)' : '0 4px 12px rgba(5, 150, 105, 0.3)',
                minHeight: 50
              }}
            >
              {payMethod === 'Hutang' ? (
                <>
                  <i className="fa-solid fa-receipt" style={{ fontSize: 18, marginRight: 8 }} /> 
                  Simpan Transaksi Hutang (Sisa: {formatRp(Math.max(0, total - (parseFloat(hutangDp) || 0)))})
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-circle" style={{ fontSize: 18, marginRight: 8 }} /> 
                  Proses Pembayaran ({formatRp(total)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Cart Quick Bar di Mobile (Langsung scroll ke area pembayaran) */}
      {cart.length > 0 && (
        <div
          className="mobile-cart-float-bar"
          onClick={() => {
            setMobileTab('cart');
            setTimeout(() => {
              const el = document.getElementById('btn-checkout');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
        >
          <div className="float-cart-info">
            <span className="float-cart-count">🛒 {cart.reduce((s, c) => s + c.qty, 0)} Item dipilih</span>
            <span className="float-cart-total">{formatRp(total)}</span>
          </div>
          <button className="btn btn-green btn-sm" style={{ fontWeight: 800, padding: '9px 16px', borderRadius: 8 }}>
            Bayar Sekarang <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setShowReceipt(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-receipt" style={{ color: 'var(--emerald)' }} /> Struk Pembayaran
              </div>
              <button className="modal-close" onClick={() => setShowReceipt(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body" id="print-area">
              <div className="receipt-paper">
                <img
                  src={appData.settings.logoUrl || `${import.meta.env.BASE_URL}MJ-logo.jpg`}
                  alt="Logo Toko"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  style={{
                    maxHeight: 50,
                    maxWidth: 180,
                    display: 'block',
                    margin: '0 auto 8px auto',
                    objectFit: 'contain'
                  }}
                />
                <div className="receipt-title">{appData.settings.storeName?.toUpperCase() || 'MELAN JAYA'}</div>
                <div className="receipt-subtitle">{appData.settings.storeAddress}</div>
                <div className="receipt-subtitle">{appData.settings.storePhone}</div>
                <hr className="receipt-divider" />
                <div className="receipt-row"><span>No TRX</span><span style={{ fontWeight: 700 }}>{lastTrx.kodeTrx}</span></div>
                <div className="receipt-row"><span>Tanggal</span><span>{lastTrx.tanggal} {lastTrx.waktu}</span></div>
                <div className="receipt-row"><span>Pelanggan</span><span>{lastTrx.pelanggan}</span></div>
                <div className="receipt-row"><span>Metode</span><span style={{ fontWeight: 700 }}>{lastTrx.metodeBayar}</span></div>
                <hr className="receipt-divider" />
                {lastTrx.items.map((it, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{it.barang}</div>
                    <div className="receipt-row" style={{ marginLeft: 8 }}>
                      <span>{it.jumlah}x {formatRp(it.hargaJual)}</span>
                      <span>{formatRp(it.subtotal)}</span>
                    </div>
                  </div>
                ))}
                <hr className="receipt-divider" />
                {lastTrx.diskonAmt > 0 && <>
                  <div className="receipt-row"><span>Subtotal</span><span>{formatRp(lastTrx.subtotalSebelumDiskon)}</span></div>
                  <div className="receipt-row" style={{ color: '#d97706', fontWeight: 700 }}>
                    <span>Diskon{lastTrx.diskonType === 'persen' ? ` ${lastTrx.diskonValue}%` : ''}</span>
                    <span>-{formatRp(lastTrx.diskonAmt)}</span>
                  </div>
                </>}
                <hr className="receipt-divider" />
                <div className="receipt-row bold"><span>TOTAL BAYAR</span><span style={{ color: '#059669' }}>{formatRp(lastTrx.totalPenjualan)}</span></div>
                {lastTrx.metodeBayar === 'Tunai' && <>
                  <div className="receipt-row"><span>Uang Diterima</span><span>{formatRp(lastTrx.uangDiterima)}</span></div>
                  <div className="receipt-row"><span>Kembalian</span><span>{formatRp(lastTrx.kembalian)}</span></div>
                </>}
                {lastTrx.metodeBayar === 'Hutang' && <>
                  {lastTrx.uangMuka > 0 && (
                    <div className="receipt-row"><span>Uang Muka (DP)</span><span>{formatRp(lastTrx.uangMuka)}</span></div>
                  )}
                  <div className="receipt-row" style={{ color: '#dc2626', fontWeight: 700 }}>
                    <span>Sisa Tagihan (Hutang)</span><span>{formatRp(lastTrx.sisaHutang !== undefined ? lastTrx.sisaHutang : lastTrx.totalPenjualan)}</span>
                  </div>
                  {lastTrx.tanggalJatuhTempo && (
                    <div className="receipt-row" style={{ fontSize: 11 }}>
                      <span>Jatuh Tempo</span><span>{lastTrx.tanggalJatuhTempo}</span>
                    </div>
                  )}
                </>}
                <hr className="receipt-divider" />
                <div className="receipt-footer-text">{appData.settings.receiptFooter || 'Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.'}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <i className="fa-solid fa-print" /> Print
              </button>
              <button className="btn btn-wa" style={{ flex: 1 }} onClick={sendWhatsApp}>
                <i className="fa-brands fa-whatsapp" /> Kirim WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Chooser Modal */}
      {variantModalItem && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setVariantModalItem(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-palette" style={{ color: 'var(--brand)' }} /> Pilih Variasi: {variantModalItem.nama_barang}
              </div>
              <button className="modal-close" onClick={() => setVariantModalItem(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Pilih varian warna / ukuran untuk ditambahkan ke keranjang:
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(variantModalItem.variasiText || '').split(',').map(v => v.trim()).filter(Boolean).map(variant => (
                  <button
                    key={variant}
                    className="btn btn-ghost"
                    style={{
                      border: '1.5px solid var(--brand)',
                      color: 'var(--brand)',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'var(--brand-dim)'
                    }}
                    onClick={() => {
                      addToCart(variantModalItem, variant);
                      setVariantModalItem(null);
                      toast(`✅ ${variantModalItem.nama_barang} (${variant}) ditambahkan`, 'success');
                    }}
                  >
                    🎨 {variant}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-full" onClick={() => setVariantModalItem(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Input Catatan Pending (Hold Cart) ── */}
      {holdNoteModal && (
        <div className="modal-overlay show" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-sm" style={{ background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', padding: 0 }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(245,158,11,0.05))' }}>
              <div className="modal-title" style={{ fontSize: 15, fontWeight: 800 }}>
                <i className="fa-solid fa-pause-circle" style={{ color: 'var(--amber)', marginRight: 8 }} />
                Simpan Ke Transaksi Pending
              </div>
              <button className="btn-icon" onClick={() => setHoldNoteModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Simpan keranjang saat ini ({cartItemCount} item - {formatRp(total)}) agar bisa dilanjutkan nanti.
              </p>
              
              <div style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Nama Pelanggan / Catatan Meja</label>
                <input
                  className="form-input"
                  placeholder="Contoh: Ibu Ani / Meja 3"
                  value={holdNoteInput}
                  onChange={e => setHoldNoteInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>No. WhatsApp (Opsional)</label>
                <input
                  className="form-input"
                  placeholder="Contoh: 08123456789"
                  value={customerWa}
                  onChange={e => setCustomerWa(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', background: 'var(--bg-hover)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setHoldNoteModal(false)}>
                Batal
              </button>
              <button
                className="btn btn-amber btn-sm"
                style={{ fontWeight: 800, padding: '8px 18px' }}
                onClick={() => confirmHoldCart(holdNoteInput)}
              >
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }} /> Simpan Pending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Daftar Transaksi Pending ── */}
      {showPendingModal && (
        <div className="modal-overlay show" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-lg" style={{ background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header Modal */}
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(2,132,199,0.05))', padding: '16px 20px' }}>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,58,237,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--brand)', fontSize: 16 }} />
                </div>
                Daftar Transaksi Pending ({pendingList.length})
              </div>
              <button className="btn-icon" onClick={() => setShowPendingModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Filter Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
              <div className="form-input-icon">
                <i className="fa-solid fa-search" />
                <input
                  className="form-input"
                  placeholder="Cari pelanggan, catatan, atau kode pending..."
                  value={pendingSearch}
                  onChange={e => setPendingSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Body - Pending List */}
            <div className="modal-body" style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {pendingList.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <i className="fa-solid fa-pause-circle" style={{ fontSize: 40, color: 'var(--text-muted)', marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, fontSize: 14 }}>Belum ada transaksi pending.</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gunakan tombol <strong>"Pending / Hold"</strong> di keranjang kasir untuk menyimpan pesanan sementara.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {pendingList.filter(p => {
                    const sTerm = pendingSearch.toLowerCase().trim();
                    if (!sTerm) return true;
                    return (p.pelanggan && p.pelanggan.toLowerCase().includes(sTerm)) ||
                           (p.catatan && p.catatan.toLowerCase().includes(sTerm)) ||
                           (p.kodePending && p.kodePending.toLowerCase().includes(sTerm));
                  }).map(item => {
                    const itemCount = (item.items || []).reduce((s, i) => s + i.qty, 0);
                    return (
                      <div
                        key={item.id}
                        style={{
                          background: 'var(--card-bg, #fff)',
                          border: '1px solid var(--border)',
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          justify: 'space-between',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                      >
                        {/* Header Item Card */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                                👤 {item.pelanggan || 'Umum'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                🏷️ {item.kodePending || item.id} · 🕒 {item.tanggal} {item.waktu || ''}
                              </div>
                            </div>
                            <span className="badge badge-amber" style={{ fontWeight: 700 }}>
                              {itemCount} pcs
                            </span>
                          </div>

                          {/* Catatan jika ada */}
                          {item.catatan && item.catatan !== item.pelanggan && (
                            <div style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: 6, marginBottom: 8, color: 'var(--text-secondary)' }}>
                              📝 {item.catatan}
                            </div>
                          )}

                          {/* Brief item list */}
                          <div style={{ borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '8px 0', margin: '8px 0', fontSize: 11 }}>
                            {(item.items || []).map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {it.nama_barang} <strong style={{ color: 'var(--brand)' }}>x{it.qty}</strong>
                                </span>
                                <span style={{ fontWeight: 700 }}>{formatRp(it.hargaJual * it.qty)}</span>
                              </div>
                            ))}
                            {item.diskonAmt > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--amber)', fontWeight: 700, marginTop: 4 }}>
                                <span>Diskon</span>
                                <span>-{formatRp(item.diskonAmt)}</span>
                              </div>
                            )}
                          </div>

                          {/* Total Pending */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Total Tagihan:</span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--emerald)' }}>{formatRp(item.totalPenjualan || item.total)}</span>
                          </div>
                        </div>

                        {/* Action Buttons: Edit/Load, Share WA, Print, Hapus */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                          <button
                            className="btn btn-purple btn-sm"
                            style={{ fontWeight: 800, fontSize: 11, padding: '7px' }}
                            onClick={() => handleLoadPending(item)}
                            title="Muat ke keranjang kasir untuk diedit / dilanjutkan pembayaran"
                          >
                            <i className="fa-solid fa-play" style={{ marginRight: 4 }} /> Edit / Lanjut
                          </button>

                          <button
                            className="btn btn-green btn-sm"
                            style={{ fontWeight: 700, fontSize: 11, padding: '7px' }}
                            onClick={() => handleSharePendingWA(item)}
                            title="Kirim rincian nota pending ke WhatsApp"
                          >
                            <i className="fa-brands fa-whatsapp" style={{ marginRight: 4 }} /> Kirim WA
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontWeight: 700, fontSize: 11, padding: '7px', color: 'var(--brand)' }}
                            onClick={() => handlePrintPending(item)}
                            title="Cetak struk nota pending"
                          >
                            <i className="fa-solid fa-print" style={{ marginRight: 4 }} /> Print Struk
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontWeight: 700, fontSize: 11, padding: '7px', color: 'var(--rose)' }}
                            onClick={() => handleDeletePending(item.id)}
                            title="Hapus transaksi pending ini"
                          >
                            <i className="fa-solid fa-trash" style={{ marginRight: 4 }} /> Hapus
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="modal-footer" style={{ padding: '12px 20px', background: 'var(--bg-hover)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Total: <strong>{pendingList.length}</strong> transaksi pending tersimpan.
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPendingModal(false)}>
                Tutup Modal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal Pelunasan Hutang & Retur Barang Pelanggan ── */}
      {showPelunasanModal && (
        <div className="modal-overlay show" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-lg" style={{ background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header Modal */}
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(2,132,199,0.08))', padding: '16px 20px' }}>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-hand-holding-dollar" style={{ color: 'var(--brand)', fontSize: 18 }} />
                </div>
                <div>
                  <div>Pelunasan Piutang &amp; Retur Barang</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                    Kelola pelunasan full, cicilan, dan pengembalian barang (retur) pelanggan
                  </div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setShowPelunasanModal(false); setPelunasanMode(''); setPelunasanTarget(null); }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Total Banner & Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="badge badge-amber" style={{ fontSize: 12, fontWeight: 800, padding: '5px 10px' }}>
                    {activePiutangList.length} Pelanggan Belum Lunas
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rose)' }}>
                    Total Piutang: {formatRp(activePiutangList.reduce((s, h) => s + (Number(h.sisaHutang) || 0), 0))}
                  </span>
                </div>
                {pelunasanMode && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setPelunasanMode(''); setPelunasanTarget(null); }}
                    style={{ fontSize: 11, fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-arrow-left" style={{ marginRight: 4 }} /> Kembali ke Daftar
                  </button>
                )}
              </div>

              {!pelunasanMode && (
                <div className="form-input-icon">
                  <i className="fa-solid fa-search" />
                  <input
                    className="form-input"
                    placeholder="Cari nama pelanggan, nomor WhatsApp, atau nomor transaksi..."
                    value={pelunasanSearch}
                    onChange={e => setPelunasanSearch(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>

              {/* ── MODE 1: RETUR BARANG ── */}
              {pelunasanMode === 'retur' && pelunasanTarget && (() => {
                const totalNilaiRetur = pelunasanReturItems.reduce((s, it) => s + (it.hargaJual * (parseInt(it.returQty) || 0)), 0);
                const currentSisa = Number(pelunasanTarget.sisaHutang !== undefined ? pelunasanTarget.sisaHutang : pelunasanTarget.jumlahAwal);
                const newSisa = Math.max(0, currentSisa - totalNilaiRetur);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                            🔄 Retur Barang — {pelunasanTarget.pelanggan || pelunasanTarget.nama}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            No TRX: {pelunasanTarget.kodeTrx || ('HUTANG-' + pelunasanTarget.id)} · Sisa Hutang Saat Ini: <strong style={{ color: 'var(--rose)' }}>{formatRp(currentSisa)}</strong>
                          </div>
                        </div>
                        <span className="badge badge-red" style={{ fontWeight: 700 }}>Mode Retur</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                        Pilih jumlah barang yang dikembalikan. Stok barang akan otomatis dikembalikan ke inventori dan sisa hutang pelanggan akan dipotong.
                      </p>
                    </div>

                    {/* Daftar Item Yang Dibeli */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 800, marginBottom: 8, fontSize: 12 }}>
                        Pilih Barang &amp; Jumlah Yang Dikembalikan:
                      </label>

                      {pelunasanReturItems.length === 0 ? (
                        <div className="empty-state" style={{ padding: 20 }}>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Transaksi ini tidak memiliki rincian item barang spesifik (misal dibuat manual dari menu hutang). Silakan gunakan pembayaran sebagian / potongan langsung di menu cicilan.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pelunasanReturItems.map((it, idx) => {
                            const returVal = parseInt(it.returQty) || 0;
                            const subRetur = it.hargaJual * returVal;

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: returVal > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-hover)',
                                  border: returVal > 0 ? '1.5px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                                  borderRadius: 10,
                                  gap: 12
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                    {it.barang}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Dibeli: <strong>{it.maxQty} pcs</strong> · Harga: {formatRp(it.hargaJual)}/pcs
                                  </div>
                                </div>

                                {/* Qty Stepper */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    onClick={() => {
                                      setPelunasanReturItems(prev => prev.map((item, i) => i === idx ? { ...item, returQty: Math.max(0, (parseInt(item.returQty) || 0) - 1) } : item));
                                    }}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ width: 55, textAlign: 'center', padding: '4px', fontSize: 12, fontWeight: 800 }}
                                    min="0"
                                    max={it.maxQty}
                                    value={it.returQty}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(it.maxQty, parseInt(e.target.value) || 0));
                                      setPelunasanReturItems(prev => prev.map((item, i) => i === idx ? { ...item, returQty: val } : item));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    onClick={() => {
                                      setPelunasanReturItems(prev => prev.map((item, i) => i === idx ? { ...item, returQty: Math.min(item.maxQty, (parseInt(item.returQty) || 0) + 1) } : item));
                                    }}
                                  >
                                    +
                                  </button>
                                </div>

                                <div style={{ width: 100, textAlign: 'right', fontWeight: 800, fontSize: 12, color: returVal > 0 ? 'var(--rose)' : 'var(--text-muted)' }}>
                                  {returVal > 0 ? `-${formatRp(subRetur)}` : 'Rp 0'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Alasan Retur */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
                        Alasan Retur / Keterangan:
                      </label>
                      <input
                        className="form-input"
                        placeholder="Contoh: Ukuran kekecilan / Baju cacat jahitan / Pelanggan tukar pikiran"
                        value={pelunasanReturAlasan}
                        onChange={e => setPelunasanReturAlasan(e.target.value)}
                      />
                    </div>

                    {/* Ringkasan Potongan Retur */}
                    <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>Sisa Hutang Sebelum Retur:</span>
                        <span>{formatRp(currentSisa)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--rose)', fontWeight: 800 }}>
                        <span>Total Nilai Retur Barang:</span>
                        <span>-{formatRp(totalNilaiRetur)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: newSisa <= 0 ? 'var(--emerald)' : 'var(--text-primary)', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                        <span>Sisa Hutang Setelah Retur:</span>
                        <span>{newSisa <= 0 ? 'LUNAS (Semua tagihan selesai) ✅' : formatRp(newSisa)}</span>
                      </div>
                    </div>

                    {/* Tombol Aksi Retur */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => { setPelunasanMode(''); setPelunasanTarget(null); }}
                        disabled={pelunasanSaving}
                      >
                        Batal
                      </button>
                      <button
                        className="btn btn-red"
                        style={{ fontWeight: 800, padding: '10px 20px' }}
                        onClick={() => handleConfirmRetur(pelunasanTarget)}
                        disabled={pelunasanSaving || totalNilaiRetur <= 0}
                      >
                        {pelunasanSaving ? (
                          <><i className="fa-solid fa-circle-notch animate-spin" /> Memproses...</>
                        ) : (
                          <><i className="fa-solid fa-check-circle" style={{ marginRight: 6 }} /> Konfirmasi Retur ({formatRp(totalNilaiRetur)})</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── MODE 2: BAYAR FULL (LUNAS) ── */}
              {pelunasanMode === 'bayar_full' && pelunasanTarget && (
                <div style={{ maxWidth: 480, margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(5, 150, 105, 0.12)', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>
                      <i className="fa-solid fa-bolt" />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                      Konfirmasi Pelunasan Full (Lunas)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Pelanggan: <strong>{pelunasanTarget.pelanggan || pelunasanTarget.nama}</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nominal Pelunasan:</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--emerald)', marginTop: 2 }}>
                      {formatRp(pelunasanTarget.sisaHutang)}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>
                      Pilih Metode Pembayaran:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {['Tunai', 'Transfer', 'QRIS'].map(m => (
                        <button
                          key={m}
                          type="button"
                          className={`btn ${pelunasanBayarMethod === m ? 'btn-green' : 'btn-ghost'}`}
                          style={{ fontWeight: 700, fontSize: 12, padding: '8px 10px' }}
                          onClick={() => setPelunasanBayarMethod(m)}
                        >
                          {m === 'Tunai' ? '💵' : m === 'Transfer' ? '🏦' : '📱'} {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => { setPelunasanMode(''); setPelunasanTarget(null); }}
                      disabled={pelunasanSaving}
                    >
                      Batal
                    </button>
                    <button
                      className="btn btn-green"
                      style={{ fontWeight: 800, flex: 1, padding: '10px 16px' }}
                      onClick={() => handlePelunasanBayarFull(pelunasanTarget, pelunasanBayarMethod)}
                      disabled={pelunasanSaving}
                    >
                      {pelunasanSaving ? (
                        <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                      ) : (
                        <><i className="fa-solid fa-check" style={{ marginRight: 6 }} /> Bayar Lunas Sekarang</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── MODE 3: BAYAR SEBAGIAN (CICILAN) ── */}
              {pelunasanMode === 'bayar_sebagian' && pelunasanTarget && (
                <div style={{ maxWidth: 480, margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(124, 58, 237, 0.12)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>
                      <i className="fa-solid fa-hand-holding-dollar" />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                      Pembayaran Sebagian / Cicilan
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Pelanggan: <strong>{pelunasanTarget.pelanggan || pelunasanTarget.nama}</strong> · Sisa Tagihan: <strong style={{ color: 'var(--rose)' }}>{formatRp(pelunasanTarget.sisaHutang)}</strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
                      Nominal Pembayaran (Rp) *
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Masukkan nominal bayar..."
                      value={pelunasanBayarNominal}
                      onChange={e => setPelunasanBayarNominal(e.target.value)}
                      style={{ fontSize: 16, fontWeight: 800, padding: '10px 14px' }}
                      autoFocus
                    />

                    {/* Quick fill chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {[Math.round(pelunasanTarget.sisaHutang / 2), 50000, 100000, 200000]
                        .filter(v => v > 0 && v < pelunasanTarget.sisaHutang)
                        .map(v => (
                          <button
                            key={v}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => setPelunasanBayarNominal(String(v))}
                          >
                            {formatRp(v)}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'var(--emerald)', fontWeight: 700 }}
                        onClick={() => setPelunasanBayarNominal(String(pelunasanTarget.sisaHutang))}
                      >
                        Bayar Full ({formatRp(pelunasanTarget.sisaHutang)})
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>
                      Metode Pembayaran:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {['Tunai', 'Transfer', 'QRIS'].map(m => (
                        <button
                          key={m}
                          type="button"
                          className={`btn ${pelunasanBayarMethod === m ? 'btn-purple' : 'btn-ghost'}`}
                          style={{ fontWeight: 700, fontSize: 12, padding: '8px 10px' }}
                          onClick={() => setPelunasanBayarMethod(m)}
                        >
                          {m === 'Tunai' ? '💵' : m === 'Transfer' ? '🏦' : '📱'} {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {parseFloat(pelunasanBayarNominal) > 0 && (
                    <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sisa Hutang Setelah Bayar:</span>
                      <strong style={{ color: (pelunasanTarget.sisaHutang - parseFloat(pelunasanBayarNominal)) <= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                        {formatRp(Math.max(0, pelunasanTarget.sisaHutang - parseFloat(pelunasanBayarNominal)))}
                      </strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => { setPelunasanMode(''); setPelunasanTarget(null); }}
                      disabled={pelunasanSaving}
                    >
                      Batal
                    </button>
                    <button
                      className="btn btn-purple"
                      style={{ fontWeight: 800, flex: 1, padding: '10px 16px' }}
                      onClick={() => handlePelunasanBayarSebagian(pelunasanTarget, pelunasanBayarNominal, pelunasanBayarMethod)}
                      disabled={pelunasanSaving || !pelunasanBayarNominal || parseFloat(pelunasanBayarNominal) <= 0}
                    >
                      {pelunasanSaving ? (
                        <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                      ) : (
                        <><i className="fa-solid fa-check" style={{ marginRight: 6 }} /> Catat Pembayaran ({formatRp(parseFloat(pelunasanBayarNominal) || 0)})</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── MODE DEFAULT: DAFTAR PIUTANG PELANGGAN ── */}
              {!pelunasanMode && (
                <div>
                  {activePiutangList.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <i className="fa-solid fa-circle-check" style={{ fontSize: 42, color: 'var(--emerald)', marginBottom: 12 }} />
                      <p style={{ fontWeight: 800, fontSize: 15 }}>Semua Tagihan Pelanggan Lunas!</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada hutang aktif yang perlu dilunasi saat ini.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                      {activePiutangList.filter(p => {
                        const term = (pelunasanSearch || '').toLowerCase().trim();
                        if (!term) return true;
                        const name = (p.pelanggan || p.nama || '').toLowerCase();
                        const wa = (p.noWa || '').toLowerCase();
                        const kode = (p.kodeTrx || '').toLowerCase();
                        const ket = (p.keterangan || '').toLowerCase();
                        return name.includes(term) || wa.includes(term) || kode.includes(term) || ket.includes(term);
                      }).map(item => {
                        const sisa = Number(item.sisaHutang !== undefined ? item.sisaHutang : item.jumlahAwal);
                        const itemsCount = (item.items || []).reduce((s, it) => s + (it.jumlah || 1), 0);

                        return (
                          <div
                            key={item.id}
                            style={{
                              background: 'var(--card-bg, #fff)',
                              border: '1px solid var(--border)',
                              borderRadius: 14,
                              padding: 14,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div>
                              {/* Header Card */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                                    👤 {item.pelanggan || item.nama}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    🏷️ {item.kodeTrx || ('TRX-' + item.id)} · 📅 {item.tanggal}
                                  </div>
                                  {item.noWa && (
                                    <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 2 }}>
                                      📱 {item.noWa}
                                    </div>
                                  )}
                                </div>
                                <span className="badge badge-red" style={{ fontWeight: 800, fontSize: 12 }}>
                                  {formatRp(sisa)}
                                </span>
                              </div>

                              {/* Catatan & Jatuh Tempo */}
                              {(item.keterangan || item.tanggalJatuhTempo) && (
                                <div style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '6px 8px', borderRadius: 6, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                  {item.keterangan && <div>📝 {item.keterangan}</div>}
                                  {item.tanggalJatuhTempo && <div style={{ color: 'var(--rose)', fontWeight: 700 }}>⏳ Jatuh Tempo: {item.tanggalJatuhTempo}</div>}
                                </div>
                              )}

                              {/* Item list jika ada */}
                              {Array.isArray(item.items) && item.items.length > 0 && (
                                <div style={{ borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '6px 0', margin: '6px 0', fontSize: 11 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Rincian Barang ({itemsCount} pcs):
                                  </div>
                                  {item.items.slice(0, 3).map((it, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                      <span style={{ color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        • {it.barang} <strong style={{ color: 'var(--brand)' }}>x{it.jumlah}</strong>
                                      </span>
                                      <span style={{ fontWeight: 600 }}>{formatRp(it.subtotal || (it.hargaJual * it.jumlah))}</span>
                                    </div>
                                  ))}
                                  {item.items.length > 3 && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      +{item.items.length - 3} barang lainnya...
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Riwayat Bayar / DP / Retur jika ada */}
                              {Array.isArray(item.riwayatBayar) && item.riwayatBayar.length > 0 && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                                  <span style={{ fontWeight: 700 }}>Riwayat: </span>
                                  {item.riwayatBayar.map((r, ri) => (
                                    <span key={ri} style={{ marginRight: 6, color: r.type === 'retur' ? 'var(--rose)' : 'var(--emerald)' }}>
                                      {r.type === 'retur' ? '🔄' : '💰'} {formatRp(Math.abs(r.nominal))} ({r.tanggal})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons: Bayar Full, Bayar Sebagian, Retur Barang */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                              <button
                                className="btn btn-green btn-sm"
                                style={{ fontWeight: 800, fontSize: 11, padding: '7px' }}
                                onClick={() => {
                                  setPelunasanTarget(item);
                                  setPelunasanBayarMethod('Tunai');
                                  setPelunasanMode('bayar_full');
                                }}
                                title="Pelunasan penuh tagihan ini hingga lunas"
                              >
                                <i className="fa-solid fa-bolt" style={{ marginRight: 4 }} /> Bayar Full
                              </button>

                              <button
                                className="btn btn-purple btn-sm"
                                style={{ fontWeight: 700, fontSize: 11, padding: '7px' }}
                                onClick={() => {
                                  setPelunasanTarget(item);
                                  setPelunasanBayarNominal('');
                                  setPelunasanBayarMethod('Tunai');
                                  setPelunasanMode('bayar_sebagian');
                                }}
                                title="Bayar cicilan / sebagian"
                              >
                                <i className="fa-solid fa-hand-holding-dollar" style={{ marginRight: 4 }} /> Cicilan
                              </button>

                              <button
                                className="btn btn-red btn-sm"
                                style={{ fontWeight: 700, fontSize: 11, padding: '7px' }}
                                onClick={() => openReturDrawer(item)}
                                title="Pelanggan mengembalikan barang (retur) untuk memotong hutang"
                              >
                                <i className="fa-solid fa-rotate-left" style={{ marginRight: 4 }} /> Retur Barang
                              </button>

                              <button
                                className="btn btn-wa btn-sm"
                                style={{ fontWeight: 700, fontSize: 11, padding: '7px' }}
                                onClick={() => {
                                  const s = appData.settings || {};
                                  const storeName = (s.storeName || 'MELAN JAYA').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
                                  let msg = `Halo *${item.pelanggan || item.nama}*,\n`;
                                  msg += `Kami menginformasikan rincian tagihan di *${storeName.toUpperCase()}*:\n\n`;
                                  msg += `No Transaksi: ${item.kodeTrx || '-'}\n`;
                                  msg += `Tanggal     : ${item.tanggal}\n`;
                                  msg += `Jumlah Awal : ${formatRp(item.jumlahAwal)}\n`;
                                  msg += `*Sisa Tagihan: ${formatRp(sisa)}*\n`;
                                  if (item.tanggalJatuhTempo) msg += `Jatuh Tempo : ${item.tanggalJatuhTempo}\n`;
                                  msg += `\n───────────────────\n`;
                                  msg += `Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.`;
                                  const targetWa = formatWaNumber(item.noWa);
                                  if (targetWa) {
                                    window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(msg)}`, '_blank');
                                  } else {
                                    window.open(`https://wa.me/6285117027358?text=${encodeURIComponent(msg)}`, '_blank');
                                  }
                                }}
                                title="Kirim pengingat tagihan ke WhatsApp"
                              >
                                <i className="fa-brands fa-whatsapp" style={{ marginRight: 4 }} /> Ingatkan WA
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Modal */}
            <div className="modal-footer" style={{ padding: '12px 20px', background: 'var(--bg-hover)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Total: <strong>{activePiutangList.length}</strong> piutang aktif tersimpan.
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowPelunasanModal(false); setPelunasanMode(''); setPelunasanTarget(null); }}
              >
                Tutup Modal
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default KasirPage;

