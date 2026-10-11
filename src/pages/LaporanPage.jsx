import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { getTodayIso, normalizeDateStr } from '../services/dataSync';

import { printReportHTML } from '../services/exportUtils';

const formatRp = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const formatRpShort = v => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}rb`;
  return String(v);
};

const LaporanPage = () => {
  const { appData, saveAndSync, toast } = useData();
  const [preset, setPreset] = useState('today');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [buySupplierFilter, setBuySupplierFilter] = useState('');

  // Edit & Delete state
  const [editTrx, setEditTrx] = useState(null);     // transaksi yang sedang diedit
  const [editForm, setEditForm] = useState({});      // form state edit
  const [deleteTrx, setDeleteTrx] = useState(null); // transaksi yang akan dihapus
  const [saving, setSaving] = useState(false);
  const [salesView, setSalesView] = useState('trx'); // 'trx' | 'item'
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  const getRange = () => {
    const todayStr = getTodayIso();
    if (preset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (preset === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const d = getTodayIso(y);
      return { start: d, end: d };
    }
    if (preset === 'week') {
      const w = new Date(); w.setDate(w.getDate() - 6);
      return { start: getTodayIso(w), end: todayStr };
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

  const filteredSales = useMemo(() => {
    return (appData.penjualan || []).filter(t => {
      const tDate = normalizeDateStr(t.tanggal);
      if (!start && !end) return true;
      if (start && !end) return tDate >= start;
      if (!start && end) return tDate <= end;
      return tDate >= start && tDate <= end;
    }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.waktu || '').localeCompare(a.waktu || ''));
  }, [appData.penjualan, start, end]);

  const filteredBuys = useMemo(() => {
    return (appData.pembelian || []).filter(t => {
      const tDate = normalizeDateStr(t.tanggal);
      const matchSupplier = !buySupplierFilter || (t.supplier || '') === buySupplierFilter;
      if (!matchSupplier) return false;
      if (!start && !end) return true;
      if (start && !end) return tDate >= start;
      if (!start && end) return tDate <= end;
      return tDate >= start && tDate <= end;
    }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  }, [appData.pembelian, start, end, buySupplierFilter]);

  const filteredExpenses = useMemo(() => {
    return (appData.pengeluaran || []).filter(e => {
      const eDate = normalizeDateStr(e.tanggal);
      if (!start && !end) return true;
      if (start && !end) return eDate >= start;
      if (!start && end) return eDate <= end;
      return eDate >= start && eDate <= end;
    }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  }, [appData.pengeluaran, start, end]);

  const totalOmset = filteredSales.reduce((s, t) => s + (t.totalPenjualan || 0), 0);
  const totalModal = filteredSales.reduce((s, t) => s + (t.totalModal || 0), 0);
  const totalLaba = filteredSales.reduce((s, t) => s + (t.laba || 0), 0);
  const totalBeli = filteredBuys.reduce((s, t) => s + (t.totalModal || 0), 0);
  const totalPengeluaran = filteredExpenses.reduce((s, e) => s + (e.nominal || 0), 0);
  const totalItemTerjual = filteredSales.reduce((s, t) => s + (t.items || []).reduce((ss, i) => ss + (i.jumlah || 0), 0), 0);
  const totalQtyBeli = filteredBuys.reduce((s, t) => s + (t.jumlah || 0), 0);
  const supplierOptions = useMemo(() => {
    return [...new Set((appData.pembelian || []).map(t => t.supplier).filter(Boolean))].sort();
  }, [appData.pembelian]);
  const labaBersihOperasional = totalLaba - totalPengeluaran;
  const marginPct = totalOmset > 0 ? ((totalLaba / totalOmset) * 100).toFixed(1) : 0;

  const expenseBreakdown = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      map[e.kategori] = (map[e.kategori] || 0) + (e.nominal || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const chartData = useMemo(() => {
    const byDate = {};
    filteredSales.forEach(t => {
      const normDate = normalizeDateStr(t.tanggal);
      if (!byDate[normDate]) byDate[normDate] = { tanggal: normDate, omset: 0, laba: 0, trx: 0 };
      byDate[normDate].omset += (t.totalPenjualan || 0);
      byDate[normDate].laba += (t.laba || 0);
      byDate[normDate].trx += 1;
    });
    return Object.values(byDate).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [filteredSales]);

  // ── Rincian Laba Rugi Per Item Barang ──────────────────────────────
  const salesItemBreakdown = useMemo(() => {
    const map = {};
    filteredSales.forEach(t => {
      (t.items || []).forEach(i => {
        const key = i.barang;
        if (!map[key]) {
          const itemStok = (appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName);
          map[key] = {
            barang: i.barang,
            kategori: itemStok?.kategori || 'Lainnya',
            totalQty: 0,
            totalOmset: 0,
            totalModal: 0,
            trxCount: 0
          };
        }
        const unitModal = i.hargaModal !== undefined
          ? Number(i.hargaModal)
          : Number((appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName)?.hargaModal || 0);
        const sub = Number(i.subtotal || i.hargaJual * i.jumlah);
        const mod = Number(unitModal * i.jumlah);

        map[key].totalQty += Number(i.jumlah || 0);
        map[key].totalOmset += sub;
        map[key].totalModal += mod;
        map[key].trxCount += 1;
      });
    });

    return Object.values(map).map(it => {
      const laba = it.totalOmset - it.totalModal;
      const margin = it.totalOmset > 0 ? ((laba / it.totalOmset) * 100).toFixed(1) : 0;
      const avgHargaJual = it.totalQty > 0 ? Math.round(it.totalOmset / it.totalQty) : 0;
      const avgHargaModal = it.totalQty > 0 ? Math.round(it.totalModal / it.totalQty) : 0;
      return {
        ...it,
        laba,
        margin,
        avgHargaJual,
        avgHargaModal
      };
    }).sort((a, b) => b.laba - a.laba);
  }, [filteredSales, appData.stok]);

  // ── OPEN EDIT MODAL ──────────────────────────────────────────────────
  const openEdit = (trx) => {
    setEditTrx(trx);
    setEditForm({
      pelanggan: trx.pelanggan || '',
      noWa: trx.noWa || '',
      tanggal: normalizeDateStr(trx.tanggal),
      waktu: trx.waktu || '',
      metodeBayar: trx.metodeBayar || 'Tunai',
      items: (trx.items || []).map(i => ({ ...i })),
    });
  };

  // ── UPDATE ITEM PRICE IN EDIT FORM ───────────────────────────────────
  const updateEditItemPrice = (idx, newPrice) => {
    setEditForm(prev => {
      const items = prev.items.map((it, i) =>
        i === idx ? { ...it, hargaJual: Math.max(0, parseFloat(newPrice) || 0), subtotal: Math.max(0, parseFloat(newPrice) || 0) * it.jumlah } : it
      );
      return { ...prev, items };
    });
  };

  // ── SAVE EDIT ────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editTrx) return;
    setSaving(true);
    try {
      const updatedItems = editForm.items.map(it => ({
        ...it,
        subtotal: (it.hargaJual || 0) * (it.jumlah || 1),
      }));
      const totalPenjualan = updatedItems.reduce((s, i) => s + i.subtotal, 0);
      const totalModalTrx = updatedItems.reduce((s, i) => s + (i.hargaModal || 0) * (i.jumlah || 1), 0);
      const laba = totalPenjualan - totalModalTrx;

      const targetId = String(editTrx.id);
      const targetKode = editTrx.kodeTrx;

      const newPenjualan = (appData.penjualan || []).map(t => {
        const isMatch = (t.id && editTrx.id && String(t.id) === targetId) || (t.kodeTrx && t.kodeTrx === targetKode);
        if (!isMatch) return t;
        return {
          ...t,
          pelanggan: editForm.pelanggan || 'Umum',
          noWa: editForm.noWa,
          tanggal: editForm.tanggal,
          waktu: editForm.waktu,
          metodeBayar: editForm.metodeBayar,
          items: updatedItems,
          totalPenjualan,
          totalModal: totalModalTrx,
          laba,
        };
      });
      await saveAndSync({ ...appData, penjualan: newPenjualan });
      toast('✅ Transaksi berhasil diperbarui!', 'success');
      setEditTrx(null);
    } catch (e) {
      console.error('Save edit error:', e);
      toast('Gagal menyimpan perubahan', 'error');
    }
    setSaving(false);
  };

  // ── DELETE TRANSACTION ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTrx) return;
    setSaving(true);
    try {
      const targetId = String(deleteTrx.id);
      const targetKode = deleteTrx.kodeTrx;

      // Restore stok dari item yang dihapus
      const newStok = (appData.stok || []).map(s => {
        const sold = (deleteTrx.items || []).find(i =>
          s.nama_barang === i.barang ||
          s.nama_barang === i.originalName ||
          (i.barang && i.barang.startsWith(s.nama_barang))
        );
        if (!sold) return s;
        return { ...s, stokTersedia: s.stokTersedia + (sold.jumlah || 1) };
      });

      const newPenjualan = (appData.penjualan || []).filter(t => {
        const isMatch = (t.id && deleteTrx.id && String(t.id) === targetId) || (t.kodeTrx && t.kodeTrx === targetKode);
        return !isMatch;
      });

      await saveAndSync({ ...appData, stok: newStok, penjualan: newPenjualan });
      toast(`🗑️ Transaksi ${deleteTrx.kodeTrx || ''} berhasil dihapus & stok dikembalikan`, 'success');
      setDeleteTrx(null);
    } catch (e) {
      console.error('Delete trx error:', e);
      toast('Gagal menghapus transaksi', 'error');
    }
    setSaving(false);
  };

  // ── KIRIM ULANG STRUK VIA WHATSAPP ────────────────────────────────────
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

  const sendStrukWA = (trx) => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'MELAN JAYA').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
    const footerText = (s.receiptFooter || 'Terima Kasih Telah Berbelanja di Melan Jaya! Barang yang sudah dibeli tidak dapat ditukar.')
      .replace(/Agnes\s*Fashion/gi, 'Melan Jaya')
      .replace(/Agnes/gi, 'Melan Jaya');

    let msg = `*STRUK BELANJA ${storeName.toUpperCase()}*\n`;
    if (s.storeAddress) msg += `${s.storeAddress}\n`;
    msg += `───────────────────\n`;
    msg += `No TRX : ${trx.kodeTrx}\n`;
    msg += `Tanggal: ${trx.tanggal} ${trx.waktu || ''}\n`;
    msg += `Pelanggan: ${trx.pelanggan || 'Umum'}\n`;
    msg += `───────────────────\n`;
    (trx.items || []).forEach(i => {
      msg += `${i.barang} x${i.jumlah}  ${formatRp(i.subtotal || i.hargaJual * i.jumlah)}\n`;
    });
    msg += `───────────────────\n`;
    if (trx.diskonAmt > 0) {
      msg += `Subtotal : ${formatRp(trx.subtotalSebelumDiskon || trx.totalPenjualan + trx.diskonAmt)}\n`;
      msg += `Diskon   : -${formatRp(trx.diskonAmt)}\n`;
    }
    msg += `*TOTAL: ${formatRp(trx.totalPenjualan)}*\n`;
    msg += `Metode: ${trx.metodeBayar}\n`;
    if (trx.metodeBayar === 'Tunai') {
      msg += `Bayar: ${formatRp(trx.uangDiterima)}\n`;
      msg += `Kembalian: ${formatRp(trx.kembalian)}\n`;
    } else if (trx.metodeBayar === 'Hutang') {
      if (trx.uangMuka > 0) msg += `Uang Muka / DP: ${formatRp(trx.uangMuka)}\n`;
      msg += `Sisa Tagihan: ${formatRp(trx.sisaHutang !== undefined ? trx.sisaHutang : trx.totalPenjualan)}\n`;
    }
    msg += `───────────────────\n`;
    msg += `${footerText}`;

    let targetNo = formatWaNumber(trx.noWa);

    if (!targetNo) {
      const inputNo = window.prompt(
        'Masukkan No WhatsApp Pelanggan (contoh: 08123456789)\nAtau kosongkan lalu klik OK untuk langsung bagikan via WhatsApp:',
        ''
      );
      if (inputNo === null) return; // Pengguna klik Cancel
      targetNo = formatWaNumber(inputNo);
    }

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = targetNo 
      ? `https://api.whatsapp.com/send?phone=${targetNo}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`;

    window.open(waUrl, '_blank');
    toast(targetNo ? `📲 Struk dikirim ke WhatsApp (${targetNo})!` : '📲 Membuka WhatsApp untuk bagikan struk!', 'success');
  };

  // ── SHARE / EXPORT ───────────────────────────────────────────────────
  const shareReportWA = () => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'Melan Jaya').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
    let msg = `*LAPORAN PENJUALAN — ${storeName}*\n`;
    msg += `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}\n`;
    msg += `────────────────────\n`;
    msg += `💰 Total Omset     : ${formatRp(totalOmset)}\n`;
    msg += `📦 Total Modal HPP : ${formatRp(totalModal)}\n`;
    msg += `✅ Laba Bersih     : ${formatRp(totalLaba)} (${marginPct}%)\n`;
    msg += `🧾 Total Transaksi : ${filteredSales.length} trx\n`;
    msg += `📦 Item Terjual    : ${totalItemTerjual} pcs\n`;
    msg += `────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;
    const no = (s.storePhone || '').replace(/\D/g, '');
    const url = no ? `https://wa.me/${no}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Save Sales Report to PDF (dengan logo & rincian laba rugi per item)
  const saveSalesToPDF = () => {
    const s = appData.settings || {};
    const storeName = (s.storeName || 'MELAN JAYA POS').replace(/Agnes\s*Fashion/gi, 'Melan Jaya').replace(/Agnes/gi, 'Melan Jaya');
    
    // Create header
    const headerHtml = `
      <div style="text-align:center;margin-bottom:20px;">
        <img src="${window.location.origin}${import.meta.env.BASE_URL}MJ-logo.jpg" alt="Logo" style="height:52px;max-width:180px;object-fit:contain;margin-bottom:8px;" onerror="this.style.display='none';"><br/>
        <h2 style="color:#4c1d95;margin:0;font-size:18px;">${storeName.toUpperCase()}</h2>
        <p style="color:#666;margin:4px 0 0 0;font-size:12px;">${s.storeAddress || ''}</p>
        <p style="color:#666;margin:0;font-size:12px;">${s.storePhone || ''}</p>
        <hr style="border:1px solid #ddd;margin:12px 0;"/>
        <h3 style="color:#059669;margin:0;font-size:15px;">LAPORAN PENJUALAN &amp; LABA RUGI PER ITEM</h3>
        <p style="color:#666;margin:4px 0 12px 0;font-size:11px;">Periode: ${start || 'Semua'} s/d ${end || 'Semua'}</p>
      </div>
    `;

    // Create summary table
    const summaryHtml = `
      <table style="width:100%;margin-bottom:15px;border:1px solid #e5e7eb;border-collapse:collapse;">
        <tr style="background:#f9fafb;">
          <td style="padding:6px 10px;font-weight:700;">Total Omset:</td>
          <td style="padding:6px 10px;text-align:right;color:#059669;font-weight:800;">${formatRp(totalOmset)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Total Modal (HPP):</td>
          <td style="padding:6px 10px;text-align:right;color:#0284c7;font-weight:800;">${formatRp(totalModal)}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:6px 10px;font-weight:700;">Laba Bersih Total:</td>
          <td style="padding:6px 10px;text-align:right;color:#7c3aed;font-weight:900;font-size:14px;">${formatRp(totalLaba)} (Margin ${marginPct}%)</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Jumlah Transaksi:</td>
          <td style="padding:6px 10px;text-align:right;font-weight:800;">${filteredSales.length} transaksi (${totalItemTerjual} pcs item)</td>
        </tr>
      </table>
    `;

    // Create transactions table with item profit/loss breakdown
    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;"><thead><tr style="border-bottom:2px solid #333;background:#f3f4f6;"><th style="text-align:left;padding:6px;">Kode TRX / Tgl</th><th style="text-align:left;padding:6px;">Pelanggan</th><th style="text-align:left;padding:6px;">Rincian Barang &amp; Laba Rugi per Item</th><th style="text-align:right;padding:6px;">Omset</th><th style="text-align:right;padding:6px;">Modal HPP</th><th style="text-align:right;padding:6px;">Laba Bersih</th></tr></thead><tbody>';
    
    filteredSales.forEach(t => {
      let itemsHtml = '';
      (t.items || []).forEach(i => {
        const unitModal = i.hargaModal !== undefined ? Number(i.hargaModal) : Number((appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName)?.hargaModal || 0);
        const sub = Number(i.subtotal || i.hargaJual * i.jumlah);
        const modTot = Number(unitModal * i.jumlah);
        const itemLaba = sub - modTot;
        itemsHtml += `<div style="margin-bottom:3px;">• <strong>${i.barang}</strong> x${i.jumlah} (Jual: ${formatRp(i.hargaJual)} | HPP: ${formatRp(unitModal)}) &rarr; <span style="color:${itemLaba >= 0 ? '#059669' : '#e11d48'};font-weight:bold;">${itemLaba >= 0 ? '+' : ''}${formatRp(itemLaba)}</span></div>`;
      });

      tableHtml += `<tr style="border-bottom:1px solid #eee;vertical-align:top;"><td style="padding:6px;"><strong>${t.kodeTrx}</strong><br/><span style="color:#666;font-size:10px;">${t.tanggal} ${t.waktu || ''}</span></td><td style="padding:6px;">${t.pelanggan || 'Umum'}</td><td style="padding:6px;">${itemsHtml}</td><td style="text-align:right;padding:6px;font-weight:bold;color:#059669;">${formatRp(t.totalPenjualan)}</td><td style="text-align:right;padding:6px;color:#0284c7;">${formatRp(t.totalModal)}</td><td style="text-align:right;padding:6px;font-weight:bold;color:${t.laba >= 0 ? '#7c3aed' : '#e11d48'};">${formatRp(t.laba)}</td></tr>`;
    });
    
    tableHtml += `<tr style="border-top:2px solid #333;font-weight:bold;background:#f3f4f6;"><td colspan="3" style="padding:8px;">TOTAL KESELURUHAN</td><td style="text-align:right;padding:8px;color:#059669;">${formatRp(totalOmset)}</td><td style="text-align:right;padding:8px;color:#0284c7;">${formatRp(totalModal)}</td><td style="text-align:right;padding:8px;color:#7c3aed;font-size:13px;">${formatRp(totalLaba)}</td></tr></tbody></table>`;

    const fullHtml = `<html><head><meta charset="UTF-8"><title>Laporan Penjualan - ${storeName}</title></head><body>${headerHtml}${summaryHtml}${tableHtml}</body></html>`;
    
    // Create PDF using browser print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    toast('📄 Laporan penjualan disimpan sebagai PDF', 'success');
  };

  const exportCSV = () => {
    let csv = '\uFEFFKode TRX,Tanggal,Waktu,Pelanggan,Metode Bayar,Nama Barang,Qty,Harga Jual,Harga Modal (HPP),Subtotal Omset,Total Modal Item,Laba Rugi Item,Status Item,Total Omset TRX,Total Modal TRX,Total Laba TRX\n';
    filteredSales.forEach(t => {
      (t.items || []).forEach(i => {
        const unitModal = i.hargaModal !== undefined ? Number(i.hargaModal) : Number((appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName)?.hargaModal || 0);
        const sub = Number(i.subtotal || i.hargaJual * i.jumlah);
        const modTot = Number(unitModal * i.jumlah);
        const itemLaba = sub - modTot;
        const statusItem = itemLaba >= 0 ? 'Untung' : 'Rugi';
        csv += `"${t.kodeTrx}","${t.tanggal}","${t.waktu || ''}","${(t.pelanggan || 'Umum').replace(/"/g, '""')}","${t.metodeBayar}","${(i.barang || '').replace(/"/g, '""')}",${i.jumlah},${i.hargaJual},${unitModal},${sub},${modTot},${itemLaba},"${statusItem}",${t.totalPenjualan},${t.totalModal},${t.laba}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `laporan-penjualan-melan-jaya-${start || 'semua'}.csv`; a.click();
    toast('File CSV Laporan Penjualan (Rugi Laba Per Item & Total) berhasil diunduh', 'success');
  };

  const exportExpensesCSV = () => {
    let csv = 'Tanggal,Kategori,Nominal,Keterangan,Pembayaran\n';
    filteredExpenses.forEach(e => {
      csv += `${e.tanggal},${e.kategori},${e.nominal},"${e.keterangan || ''}",${e.pembayaran}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `laporan-pengeluaran-${start || 'semua'}.csv`; a.click();
    toast('File CSV Laporan Pengeluaran berhasil diunduh', 'success');
  };

  const printExpenseReport = () => {
    let tableHtml = '<table border="1" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th>Tanggal</th><th>Kategori</th><th>Nominal</th><th>Keterangan</th><th>Pembayaran</th></tr></thead><tbody>';
    filteredExpenses.forEach(e => {
      tableHtml += `<tr><td>${e.tanggal}</td><td>${e.kategori}</td><td style="color:#e11d48;font-weight:bold">${formatRp(e.nominal)}</td><td>${e.keterangan || '-'}</td><td>${e.pembayaran}</td></tr>`;
    });
    tableHtml += `<tr style="font-weight:bold;background:#fee2e2"><td colspan="2">TOTAL PENGELUARAN OPERASIONAL</td><td style="color:#e11d48;font-size:14px">${formatRp(totalPengeluaran)}</td><td colspan="2"></td></tr></tbody></table>`;

    printReportHTML('LAPORAN PENGELUARAN OPERASIONAL', `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}`, tableHtml);
  };

  // Save Expenses Report to PDF
  const saveExpensesToPDF = () => {
    const s = appData.settings || {};
    
    // Create header
    const headerHtml = `
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#4c1d95;margin:0;font-size:18px;">${s.storeName?.toUpperCase() || 'MELAN JAYA POS'}</h2>
        <p style="color:#666;margin:5px 0 0 0;font-size:12px;">${s.storeAddress || ''}</p>
        <p style="color:#666;margin:0;font-size:12px;">${s.storePhone || ''}</p>
        <hr style="border:1px solid #ddd;margin:15px 0;"/>
        <h3 style="color:#e11d48;margin:0;font-size:14px;">LAPORAN PENGELUARAN OPERASIONAL</h3>
        <p style="color:#666;margin:5px 0 15px 0;font-size:11px;">Periode: ${start || 'Semua'} s/d ${end || 'Semua'}</p>
      </div>
    `;

    // Create summary table
    const summaryHtml = `
      <table style="width:100%;margin-bottom:15px;">
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Total Pengeluaran:</td>
          <td style="padding:6px 10px;text-align:right;color:#e11d48;font-weight:800;">${formatRp(totalPengeluaran)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Jumlah Catatan:</td>
          <td style="padding:6px 10px;text-align:right;font-weight:800;">${filteredExpenses.length} catatan</td>
        </tr>
      </table>
    `;

    // Create expenses table
    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="border-bottom:2px solid #333;"><th style="text-align:left;padding:6px;">Tanggal</th><th style="text-align:left;padding:6px;">Kategori</th><th style="text-align:left;padding:6px;">Keterangan</th><th style="text-align:left;padding:6px;">Pembayaran</th><th style="text-align:right;padding:6px;">Nominal</th></tr></thead><tbody>';
    
    filteredExpenses.forEach(e => {
      tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">${e.tanggal}</td><td style="padding:6px;">${e.kategori}</td><td style="padding:6px;">${e.keterangan || '-'}</td><td style="padding:6px;">${e.pembayaran}</td><td style="text-align:right;padding:6px;color:#e11d48;font-weight:bold;">${formatRp(e.nominal)}</td></tr>`;
    });
    
    tableHtml += `<tr style="border-bottom:2px solid #333;font-weight:bold;"><td style="padding:6px;" colspan="4">TOTAL PENGELUARAN OPERASIONAL</td><td style="text-align:right;padding:6px;color:#e11d48;font-size:14px;">${formatRp(totalPengeluaran)}</td></tr></tbody></table>`;

    const fullHtml = `<html><head><meta charset="UTF-8"><title>Laporan Pengeluaran - ${s.storeName || 'Melan Jaya'}</title></head><body>${headerHtml}${summaryHtml}${tableHtml}</body></html>`;
    
    // Create PDF using browser print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print to PDF
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    toast('📄 Laporan pengeluaran disimpan sebagai PDF', 'success');
  };

  // Share Expenses Report via WhatsApp
  const shareExpensesWA = () => {
    const s = appData.settings || {};
    let msg = `*LAPORAN PENGELUARAN OPERASIONAL — ${s.storeName || 'Melan Jaya'}*\n`;
    msg += `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}\n`;
    msg += `────────────────────\n`;
    msg += `💰 Total Pengeluaran: ${formatRp(totalPengeluaran)}\n`;
    msg += `🧾 Jumlah Catatan: ${filteredExpenses.length} catatan\n`;
    
    // Add breakdown by category
    if (expenseBreakdown.length > 0) {
      msg += `────────────────────\n`;
      msg += `*Breakdown Kategori:*\n`;
      expenseBreakdown.forEach(([cat, amt]) => {
        const pct = totalPengeluaran > 0 ? Math.round((amt / totalPengeluaran) * 100) : 0;
        msg += `• ${cat}: ${formatRp(amt)} (${pct}%)\n`;
      });
    }
    
    msg += `────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;
    const no = (s.storePhone || '').replace(/\D/g, '');
    const url = no ? `https://wa.me/${no}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    toast('📤 Laporan pengeluaran dibagikan ke WhatsApp!', 'success');
  };

  // Save Buys Report to PDF
  const saveBuysToPDF = () => {
    const s = appData.settings || {};
    
    // Create header
    const headerHtml = `
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#4c1d95;margin:0;font-size:18px;">${s.storeName?.toUpperCase() || 'MELAN JAYA POS'}</h2>
        <p style="color:#666;margin:5px 0 0 0;font-size:12px;">${s.storeAddress || ''}</p>
        <p style="color:#666;margin:0;font-size:12px;">${s.storePhone || ''}</p>
        <hr style="border:1px solid #ddd;margin:15px 0;"/>
        <h3 style="color:#d97706;margin:0;font-size:14px;">LAPORAN RIWAYAT PEMBELIAN & RESTOCK</h3>
        <p style="color:#666;margin:5px 0 15px 0;font-size:11px;">Periode: ${start || 'Semua'} s/d ${end || 'Semua'}</p>
      </div>
    `;

    // Create summary table
    const summaryHtml = `
      <table style="width:100%;margin-bottom:15px;">
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Total Pembelian:</td>
          <td style="padding:6px 10px;text-align:right;color:#d97706;font-weight:800;">${formatRp(totalBeli)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Jumlah Restock:</td>
          <td style="padding:6px 10px;text-align:right;font-weight:800;">${filteredBuys.length} transaksi</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-weight:700;">Total Jumlah:</td>
          <td style="padding:6px 10px;text-align:right;font-weight:800;">${totalQtyBeli} pcs</td>
        </tr>
      </table>
    `;

    // Create buys table
    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="border-bottom:2px solid #333;"><th style="text-align:left;padding:6px;">Tanggal</th><th style="text-align:left;padding:6px;">Supplier</th><th style="text-align:left;padding:6px;">Barang</th><th style="text-align:left;padding:6px;">Kategori</th><th style="text-align:right;padding:6px;">Qty</th><th style="text-align:right;padding:6px;">Harga Modal</th><th style="text-align:right;padding:6px;">Total Modal</th></tr></thead><tbody>';
    
    filteredBuys.forEach(t => {
      tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px;">${t.tanggal}</td><td style="padding:6px;">${t.supplier || '—'}</td><td style="padding:6px;">${t.barang}</td><td style="padding:6px;">${t.kategori || '—'}</td><td style="text-align:right;padding:6px;">${t.jumlah} pcs</td><td style="text-align:right;padding:6px;">${formatRp(t.hargaModal)}</td><td style="text-align:right;padding:6px;color:#d97706;">${formatRp(t.totalModal)}</td></tr>`;
    });
    
    tableHtml += `<tr style="border-bottom:2px solid #333;font-weight:bold;"><td style="padding:6px;" colspan="4">TOTAL PEMBELIAN & RESTOCK</td><td style="text-align:right;padding:6px;">${totalQtyBeli} pcs</td><td></td><td style="text-align:right;padding:6px;color:#d97706;font-size:14px;">${formatRp(totalBeli)}</td></tr></tbody></table>`;

    const fullHtml = `<html><head><meta charset="UTF-8"><title>Laporan Pembelian - ${s.storeName || 'Melan Jaya'}</title></head><body>${headerHtml}${summaryHtml}${tableHtml}</body></html>`;
    
    // Create PDF using browser print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print to PDF
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    toast('📄 Laporan pembelian disimpan sebagai PDF', 'success');
  };

  // Share Buys Report via WhatsApp
  const shareBuysWA = () => {
    const s = appData.settings || {};
    let msg = `*LAPORAN PEMBELIAN & RESTOCK — ${s.storeName || 'Melan Jaya'}*\n`;
    msg += `Periode: ${start || 'Semua'} s/d ${end || 'Semua'}\n`;
    msg += `────────────────────\n`;
    msg += `📦 Total Pembelian: ${formatRp(totalBeli)}\n`;
    msg += `📊 Total Jumlah: ${totalQtyBeli} pcs\n`;
    msg += `🧾 Jumlah Restock: ${filteredBuys.length} transaksi\n`;
    msg += `────────────────────\n`;
    msg += `Dikirim dari Melan Jaya POS`;
    const no = (s.storePhone || '').replace(/\D/g, '');
    const url = no ? `https://wa.me/${no}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    toast('📤 Laporan pembelian dibagikan ke WhatsApp!', 'success');
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

  // ── COMPUTED EDIT TOTALS ─────────────────────────────────────────────
  const editTotal = editForm.items?.reduce((s, i) => s + i.hargaJual * i.jumlah, 0) || 0;
  const editModal = editForm.items?.reduce((s, i) => s + (i.hargaModal || 0) * i.jumlah, 0) || 0;
  const editLaba  = editTotal - editModal;

  return (
    <div className="tab-page active fade-up">
      {/* Stat cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card emerald">
          <i className="stat-icon fa-solid fa-coins" />
          <div className="stat-label">Total Omset</div>
          <div className="stat-value" style={{ fontSize: 17 }}>{formatRp(totalOmset)}</div>
          <div className="stat-meta">{filteredSales.length} transaksi</div>
        </div>
        <div className="stat-card sky">
          <i className="stat-icon fa-solid fa-box" />
          <div className="stat-label">Total Modal (HPP)</div>
          <div className="stat-value" style={{ fontSize: 17 }}>{formatRp(totalModal)}</div>
          <div className="stat-meta">HPP produk terjual</div>
        </div>
        <div className="stat-card violet">
          <i className="stat-icon fa-solid fa-chart-line" />
          <div className="stat-label">Laba Kotor</div>
          <div className="stat-value" style={{ fontSize: 17 }}>{formatRp(totalLaba)}</div>
          <div className="stat-meta">Margin {marginPct}%</div>
        </div>
        <div className="stat-card rose">
          <i className="stat-icon fa-solid fa-receipt" />
          <div className="stat-label">Pengeluaran</div>
          <div className="stat-value" style={{ fontSize: 17 }}>{formatRp(totalPengeluaran)}</div>
          <div className="stat-meta">{filteredExpenses.length} operasional</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--brand)' }}>
          <i className="stat-icon fa-solid fa-scale-balanced" style={{ color: 'var(--brand)' }} />
          <div className="stat-label" style={{ color: 'var(--brand)' }}>Laba Bersih</div>
          <div className="stat-value" style={{ fontSize: 17, color: labaBersihOperasional >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
            {formatRp(labaBersihOperasional)}
          </div>
          <div className="stat-meta">Laba Kotor - Pengeluaran</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-chart-area" /> Grafik Omset &amp; Laba</div>
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
            <div className="card-subtitle">{filteredSales.length} transaksi ditemukan &middot; Total {totalItemTerjual} item</div>
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

        {/* View Switcher: Per Transaksi vs Rincian Per Item Barang */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Tampilan Laporan:</span>
          <button
            className={`btn btn-sm ${salesView === 'trx' ? 'btn-purple' : 'btn-ghost'}`}
            onClick={() => setSalesView('trx')}
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            <i className="fa-solid fa-receipt" /> Riwayat Transaksi (Laba Per Item &amp; Total)
          </button>
          <button
            className={`btn btn-sm ${salesView === 'item' ? 'btn-purple' : 'btn-ghost'}`}
            onClick={() => setSalesView('item')}
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            <i className="fa-solid fa-boxes-stacked" /> Rincian Laba Rugi Per Item Barang ({salesItemBreakdown.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="report-actions">
          <button className="btn btn-purple btn-sm" onClick={shareReportWA} title="Bagikan via WhatsApp">
            <i className="fa-brands fa-whatsapp" /> Share WA
          </button>
          <button className="btn btn-ghost btn-sm" onClick={saveSalesToPDF} title="Simpan sebagai PDF">
            <i className="fa-solid fa-file-pdf" style={{ color: 'var(--rose)' }} /> PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Export ke CSV">
            <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> CSV
          </button>
        </div>

        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-green">Omset {formatRp(totalOmset)}</span>
          <span className="badge badge-sky">Modal HPP {formatRp(totalModal)}</span>
          <span className="badge badge-violet" style={{ fontWeight: 800 }}>Laba Total {formatRp(totalLaba)} ({marginPct}%)</span>
          <span className="badge badge-amber">Total {totalItemTerjual} pcs item</span>
          <span className="badge badge-ghost">Transaksi {filteredSales.length} trx</span>
        </div>

        {/* ═════════ TAMPILAN 1: RIWAYAT TRANSAKSI DENGAN LABA PER ITEM ═════════ */}
        {salesView === 'trx' && (
          <>
            {/* ── DESKTOP TABLE ── */}
            <div className="desktop-table-view">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kode TRX</th>
                      <th>Tanggal &amp; Jam</th>
                      <th>Pelanggan</th>
                      <th style={{ minWidth: 260 }}>Rincian Barang &amp; Laba Rugi Per Item</th>
                      <th>Metode</th>
                      <th style={{ textAlign: 'right' }}>Omset</th>
                      <th style={{ textAlign: 'right' }}>Modal (HPP)</th>
                      <th style={{ textAlign: 'right' }}>Laba Kotor</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.length === 0 ? (
                      <tr><td colSpan={9}>
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
                          {(t.items || []).map((i, ix) => {
                            const modalUnit = i.hargaModal !== undefined
                              ? Number(i.hargaModal)
                              : Number((appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName)?.hargaModal || 0);
                            const itemSubtotal = Number(i.subtotal || (i.hargaJual * i.jumlah));
                            const itemModalTotal = Number(modalUnit * i.jumlah);
                            const itemLaba = itemSubtotal - itemModalTotal;
                            const isUntung = itemLaba >= 0;

                            return (
                              <div key={ix} style={{ fontSize: 11, padding: '4px 0', borderBottom: ix < t.items.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {i.barang} <span style={{ color: 'var(--brand)', fontWeight: 800 }}>×{i.jumlah}</span>
                                </div>
                                <div style={{ fontSize: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Jual: {formatRp(i.hargaJual)}</span>
                                  <span style={{ color: 'var(--sky)' }}>HPP: {formatRp(modalUnit)}</span>
                                  <span style={{
                                    fontWeight: 800,
                                    color: isUntung ? 'var(--emerald)' : 'var(--rose)',
                                    background: isUntung ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
                                    padding: '1px 6px',
                                    borderRadius: 4
                                  }}>
                                    {isUntung ? 'Laba: +' : 'Rugi: '}{formatRp(itemLaba)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </td>
                        <td><span className="badge badge-violet">{t.metodeBayar}</span></td>
                        <td className="cell-amount cell-green" style={{ fontWeight: 800 }}>{formatRp(t.totalPenjualan)}</td>
                        <td className="cell-amount" style={{ color: 'var(--sky)', fontSize: 11 }}>{formatRp(t.totalModal)}</td>
                        <td className="cell-amount" style={{ color: (t.laba || 0) >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 900 }}>
                          {(t.laba || 0) >= 0 ? '+' : ''}{formatRp(t.laba)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(t)} style={{ padding: '4px 8px' }}>
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                            <button className="btn btn-wa btn-sm" title={t.noWa ? `Kirim struk ke ${t.noWa}` : 'Bagikan struk via WhatsApp'} onClick={() => sendStrukWA(t)} style={{ padding: '4px 8px' }}>
                              <i className="fa-brands fa-whatsapp" />
                            </button>
                            <button className="btn btn-danger btn-sm" title="Hapus" onClick={() => setDeleteTrx(t)} style={{ padding: '4px 8px' }}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Grand Total Row */}
                    {filteredSales.length > 0 && (
                      <tr style={{ background: 'var(--brand-dim)', fontWeight: 800, borderTop: '2px solid var(--brand)' }}>
                        <td colSpan={5} style={{ fontWeight: 900, fontSize: 12 }}>
                          TOTAL KESELURUHAN ({filteredSales.length} TRANSAKSI · {totalItemTerjual} PCS)
                        </td>
                        <td className="cell-amount cell-green" style={{ fontSize: 13, fontWeight: 900 }}>{formatRp(totalOmset)}</td>
                        <td className="cell-amount" style={{ color: 'var(--sky)', fontSize: 12, fontWeight: 800 }}>{formatRp(totalModal)}</td>
                        <td className="cell-amount" style={{ color: totalLaba >= 0 ? 'var(--emerald)' : 'var(--rose)', fontSize: 14, fontWeight: 900 }}>
                          {totalLaba >= 0 ? '+' : ''}{formatRp(totalLaba)} ({marginPct}%)
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── MOBILE CARDS VIEW ── */}
            <div className="mobile-cards-view" style={{ padding: '0 12px 12px' }}>
              {filteredSales.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-receipt" />
                  <p>Belum ada transaksi di periode ini.</p>
                </div>
              ) : filteredSales.map(t => (
                <div key={t.id} className="trx-mobile-card">
                  {/* Header card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{t.kodeTrx}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.tanggal} · {t.waktu}</div>
                    </div>
                    <span className="badge badge-violet" style={{ fontSize: 10 }}>{t.metodeBayar}</span>
                  </div>

                  {/* Pelanggan */}
                  {(t.pelanggan && t.pelanggan !== 'Umum') && (
                    <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className="fa-solid fa-user" style={{ color: 'var(--text-muted)', fontSize: 10 }} />
                      <span style={{ fontWeight: 600 }}>{t.pelanggan}</span>
                      {t.noWa && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>· {t.noWa}</span>}
                    </div>
                  )}

                  {/* Items with Rugi Laba per item */}
                  <div style={{ marginBottom: 8, background: 'var(--bg-hover)', padding: '8px 10px', borderRadius: 8 }}>
                    {(t.items || []).map((i, ix) => {
                      const modalUnit = i.hargaModal !== undefined
                        ? Number(i.hargaModal)
                        : Number((appData.stok || []).find(s => s.nama_barang === i.barang || s.nama_barang === i.originalName)?.hargaModal || 0);
                      const itemSubtotal = Number(i.subtotal || (i.hargaJual * i.jumlah));
                      const itemModalTotal = Number(modalUnit * i.jumlah);
                      const itemLaba = itemSubtotal - itemModalTotal;
                      const isUntung = itemLaba >= 0;

                      return (
                        <div key={ix} style={{ fontSize: 11, padding: '4px 0', borderBottom: ix < t.items.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700 }}>{i.barang} ×{i.jumlah}</span>
                            <span style={{ fontWeight: 700, color: 'var(--emerald)' }}>{formatRp(itemSubtotal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            <span>HPP: {formatRp(itemModalTotal)}</span>
                            <span style={{ fontWeight: 800, color: isUntung ? 'var(--emerald)' : 'var(--rose)' }}>
                              {isUntung ? 'Laba +' : 'Rugi '}{formatRp(itemLaba)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Omset</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)' }}>{formatRp(t.totalPenjualan)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Modal HPP</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sky)' }}>{formatRp(t.totalModal)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Laba Bersih</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: (t.laba || 0) >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                        {(t.laba || 0) >= 0 ? '+' : ''}{formatRp(t.laba)}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(t)}
                      style={{ padding: '7px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <i className="fa-solid fa-pen-to-square" /> Edit
                    </button>
                    <button
                      className="btn btn-wa btn-sm"
                      onClick={() => sendStrukWA(t)}
                      style={{ padding: '7px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      title={t.noWa ? `Kirim ke ${t.noWa}` : 'Bagikan struk via WhatsApp'}
                    >
                      <i className="fa-brands fa-whatsapp" /> Struk
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTrx(t)}
                      style={{ padding: '7px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <i className="fa-solid fa-trash" /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═════════ TAMPILAN 2: RINCIAN LABA RUGI PER ITEM BARANG ═════════ */}
        {salesView === 'item' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ marginBottom: 12 }}>
              <div className="form-input-icon">
                <i className="fa-solid fa-search" />
                <input
                  className="form-input"
                  placeholder="Cari barang atau kategori..."
                  value={itemSearchTerm}
                  onChange={e => setItemSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="desktop-table-view">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>No</th>
                      <th>Nama Barang</th>
                      <th>Kategori</th>
                      <th style={{ textAlign: 'center' }}>Qty Terjual</th>
                      <th style={{ textAlign: 'right' }}>Rata2 HPP</th>
                      <th style={{ textAlign: 'right' }}>Rata2 Jual</th>
                      <th style={{ textAlign: 'right' }}>Total Omset</th>
                      <th style={{ textAlign: 'right' }}>Total Modal (HPP)</th>
                      <th style={{ textAlign: 'right' }}>Laba / Rugi</th>
                      <th style={{ textAlign: 'center' }}>Margin</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesItemBreakdown.filter(i => {
                      const s = itemSearchTerm.toLowerCase().trim();
                      if (!s) return true;
                      return i.barang.toLowerCase().includes(s) || (i.kategori && i.kategori.toLowerCase().includes(s));
                    }).length === 0 ? (
                      <tr><td colSpan={11}><div className="empty-state"><i className="fa-solid fa-box-open" /><p>Belum ada produk terjual di periode ini.</p></div></td></tr>
                    ) : salesItemBreakdown.filter(i => {
                      const s = itemSearchTerm.toLowerCase().trim();
                      if (!s) return true;
                      return i.barang.toLowerCase().includes(s) || (i.kategori && i.kategori.toLowerCase().includes(s));
                    }).map((it, idx) => {
                      const isUntung = it.laba >= 0;
                      return (
                        <tr key={it.barang}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{idx + 1}</td>
                          <td className="cell-main">{it.barang}</td>
                          <td><span className="badge badge-ghost" style={{ fontSize: 10 }}>{it.kategori}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>{it.totalQty} pcs</td>
                          <td className="cell-amount" style={{ color: 'var(--sky)', fontSize: 11 }}>{formatRp(it.avgHargaModal)}</td>
                          <td className="cell-amount" style={{ color: 'var(--text-primary)', fontSize: 11 }}>{formatRp(it.avgHargaJual)}</td>
                          <td className="cell-amount cell-green" style={{ fontWeight: 800 }}>{formatRp(it.totalOmset)}</td>
                          <td className="cell-amount" style={{ color: 'var(--sky)', fontWeight: 700 }}>{formatRp(it.totalModal)}</td>
                          <td className="cell-amount" style={{ fontWeight: 900, color: isUntung ? 'var(--emerald)' : 'var(--rose)', fontSize: 13 }}>
                            {isUntung ? '+' : ''}{formatRp(it.laba)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: isUntung ? 'var(--emerald)' : 'var(--rose)' }}>{it.margin}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${isUntung ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, fontWeight: 800 }}>
                              {isUntung ? 'Untung' : 'Rugi'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary Footer Row */}
                    <tr style={{ background: 'var(--brand-dim)', fontWeight: 800, borderTop: '2px solid var(--brand)' }}>
                      <td colSpan={3} style={{ fontWeight: 900 }}>TOTAL SELURUH ITEM ({salesItemBreakdown.length} SKU)</td>
                      <td style={{ textAlign: 'center', fontWeight: 900 }}>{totalItemTerjual} pcs</td>
                      <td colSpan={2}></td>
                      <td className="cell-amount cell-green" style={{ fontSize: 13, fontWeight: 900 }}>{formatRp(totalOmset)}</td>
                      <td className="cell-amount" style={{ color: 'var(--sky)', fontSize: 12, fontWeight: 800 }}>{formatRp(totalModal)}</td>
                      <td className="cell-amount" style={{ color: totalLaba >= 0 ? 'var(--emerald)' : 'var(--rose)', fontSize: 14, fontWeight: 900 }}>
                        {totalLaba >= 0 ? '+' : ''}{formatRp(totalLaba)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--brand)' }}>{marginPct}%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View for Items */}
            <div className="mobile-cards-view">
              {salesItemBreakdown.filter(i => {
                const s = itemSearchTerm.toLowerCase().trim();
                if (!s) return true;
                return i.barang.toLowerCase().includes(s) || (i.kategori && i.kategori.toLowerCase().includes(s));
              }).map((it, idx) => {
                const isUntung = it.laba >= 0;
                return (
                  <div key={idx} className="trx-mobile-card" style={{ borderLeft: `3px solid ${isUntung ? 'var(--emerald)' : 'var(--rose)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{it.barang}</div>
                        <span className="badge badge-ghost" style={{ fontSize: 9 }}>{it.kategori} · {it.totalQty} pcs terjual</span>
                      </div>
                      <span className={`badge ${isUntung ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, fontWeight: 800 }}>
                        {isUntung ? `+${it.margin}%` : `${it.margin}%`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8, background: 'var(--bg-hover)', padding: '6px 8px', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Omset</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--emerald)' }}>{formatRp(it.totalOmset)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Modal HPP</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sky)' }}>{formatRp(it.totalModal)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Laba Bersih</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: isUntung ? 'var(--emerald)' : 'var(--rose)' }}>
                          {isUntung ? '+' : ''}{formatRp(it.laba)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pembelian Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title"><i className="fa-solid fa-truck-ramp-box" /> Riwayat Pembelian &amp; Restock</div>
            <div className="card-subtitle">{filteredBuys.length} restock ditemukan &middot; Total {totalQtyBeli} pcs &middot; {formatRp(totalBeli)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-purple btn-sm" onClick={shareBuysWA} title="Bagikan via WhatsApp">
              <i className="fa-brands fa-whatsapp" /> Share WA
            </button>
            <button className="btn btn-ghost btn-sm" onClick={saveBuysToPDF} title="Simpan sebagai PDF">
              <i className="fa-solid fa-file-pdf" style={{ color: 'var(--rose)' }} /> PDF
            </button>
          </div>
        </div>
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
          <select className="date-input" value={buySupplierFilter} onChange={e => setBuySupplierFilter(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Semua Supplier</option>
            {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-amber">Total Modal {formatRp(totalBeli)}</span>
          <span className="badge badge-violet">Total Jumlah {totalQtyBeli} pcs</span>
          <span className="badge badge-sky">{filteredBuys.length} transaksi</span>
          {buySupplierFilter && <span className="badge badge-green">Supplier: {buySupplierFilter}</span>}
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
              {filteredBuys.length > 0 && (
                <tr style={{ background: 'var(--bg-hover)', fontWeight: 800 }}>
                  <td colSpan={4}>TOTAL PEMBELIAN & RESTOCK</td>
                  <td>{totalQtyBeli} pcs</td>
                  <td></td>
                  <td className="cell-amount cell-amber">{formatRp(totalBeli)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── LAPORAN PENGELUARAN OPERASIONAL ── */}
      <div className="card mt-16 mb-16">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title">
              <i className="fa-solid fa-receipt" style={{ color: 'var(--rose)' }} /> Laporan Pengeluaran Operasional
            </div>
            <div className="card-subtitle">{filteredExpenses.length} catatan pengeluaran &middot; Total jumlah {filteredExpenses.length} &middot; Total {formatRp(totalPengeluaran)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-purple btn-sm" onClick={shareExpensesWA} title="Bagikan via WhatsApp">
              <i className="fa-brands fa-whatsapp" /> Share WA
            </button>
            <button className="btn btn-ghost btn-sm" onClick={saveExpensesToPDF} title="Simpan sebagai PDF">
              <i className="fa-solid fa-file-pdf" style={{ color: 'var(--rose)' }} /> PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportExpensesCSV}>
              <i className="fa-solid fa-file-csv" style={{ color: 'var(--emerald)' }} /> CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printExpenseReport}>
              <i className="fa-solid fa-print" style={{ color: 'var(--brand)' }} /> Cetak
            </button>
          </div>
        </div>
        
        {/* Date Filter Bar for Expenses */}
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

        {/* Category breakdown bar if expenses exist */}
        {expenseBreakdown.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <i className="fa-solid fa-chart-pie" style={{ color: 'var(--amber)', marginRight: 4 }} /> Breakdown Kategori Pengeluaran
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {expenseBreakdown.map(([cat, amt]) => {
                const pct = totalPengeluaran > 0 ? Math.round((amt / totalPengeluaran) * 100) : 0;
                return (
                  <div key={cat} style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      <span>{cat}</span>
                      <span style={{ color: 'var(--rose)' }}>{formatRp(amt)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rose)', borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Pembayaran</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  <div className="empty-state">
                    <i className="fa-solid fa-folder-open" />
                    <p>Belum ada pengeluaran di periode ini.</p>
                  </div>
                </td></tr>
              ) : filteredExpenses.map(item => (
                <tr key={item.id}>
                  <td style={{ fontSize: 12, fontWeight: 700 }}>{item.tanggal}</td>
                  <td><span className="badge badge-amber">{item.kategori}</span></td>
                  <td style={{ fontSize: 12 }}>{item.keterangan || '—'}</td>
                  <td><span className="badge badge-sky">{item.pembayaran}</span></td>
                  <td className="cell-amount" style={{ color: 'var(--rose)', fontWeight: 800 }}>{formatRp(item.nominal)}</td>
                </tr>
              ))}
              {filteredExpenses.length > 0 && (
                <tr style={{ background: 'var(--bg-hover)', fontWeight: 800 }}>
                  <td colSpan={4}>TOTAL PENGELUARAN OPERASIONAL</td>
                  <td className="cell-amount" style={{ color: 'var(--rose)', fontSize: 14, fontWeight: 900 }}>{formatRp(totalPengeluaran)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══════════════════════════════════════════════════ */}
      {editTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setEditTrx(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--brand)' }} />
                Edit Transaksi — <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{editTrx.kodeTrx}</span>
              </div>
              <button className="modal-close" onClick={() => setEditTrx(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Info pelanggan */}
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan</label>
                  <input
                    className="form-input"
                    value={editForm.pelanggan}
                    onChange={e => setEditForm(f => ({ ...f, pelanggan: e.target.value }))}
                    placeholder="Umum"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">No WhatsApp</label>
                  <input
                    className="form-input"
                    value={editForm.noWa}
                    onChange={e => setEditForm(f => ({ ...f, noWa: e.target.value }))}
                    placeholder="0812..."
                  />
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.tanggal}
                    onChange={e => setEditForm(f => ({ ...f, tanggal: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Metode Bayar</label>
                  <select
                    className="form-input"
                    value={editForm.metodeBayar}
                    onChange={e => setEditForm(f => ({ ...f, metodeBayar: e.target.value }))}
                  >
                    {['Tunai', 'Transfer', 'QRIS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Items — editable harga jual */}
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Item Terjual</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(editForm.items || []).map((it, idx) => (
                    <div key={idx} style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{it.barang}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: {it.jumlah} pcs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Harga/pcs:</label>
                        <input
                          type="number"
                          className="form-input"
                          value={it.hargaJual}
                          onChange={e => updateEditItemPrice(idx, e.target.value)}
                          style={{ width: 110, fontSize: 13, fontWeight: 700, padding: '5px 8px', color: 'var(--brand)' }}
                          min="0"
                        />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)', minWidth: 90, textAlign: 'right' }}>
                        = {formatRp(it.hargaJual * it.jumlah)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary recalculated */}
              <div style={{ background: 'var(--brand-dim)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Omset</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{formatRp(editTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Modal</span>
                  <span style={{ fontWeight: 600 }}>{formatRp(editModal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 700 }}>Laba Bersih</span>
                  <span style={{ fontWeight: 800, color: editLaba >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>{formatRp(editLaba)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditTrx(null)} disabled={saving}>Batal</button>
              <button className="btn btn-purple" onClick={handleSaveEdit} disabled={saving} style={{ flex: 1 }}>
                {saving
                  ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menyimpan...</>
                  : <><i className="fa-solid fa-floppy-disk" /> Simpan Perubahan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM MODAL ═════════════════════════════════════════ */}
      {deleteTrx && (
        <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && setDeleteTrx(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--rose)' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Hapus Transaksi?
              </div>
              <button className="modal-close" onClick={() => setDeleteTrx(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 12 }}>
                Yakin ingin menghapus transaksi{' '}
                <b style={{ color: 'var(--brand)', fontFamily: 'monospace' }}>{deleteTrx.kodeTrx}</b>?
              </p>

              {/* Detail transaksi */}
              <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pelanggan</span>
                  <span style={{ fontWeight: 600 }}>{deleteTrx.pelanggan || 'Umum'}</span>
                </div>
                <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tanggal</span>
                  <span style={{ fontWeight: 600 }}>{deleteTrx.tanggal} {deleteTrx.waktu}</span>
                </div>
                <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total</span>
                  <span style={{ fontWeight: 700, color: 'var(--emerald)' }}>{formatRp(deleteTrx.totalPenjualan)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  {(deleteTrx.items || []).map((i, ix) => (
                    <div key={ix}>{i.barang} ×{i.jumlah} → {formatRp(i.subtotal)}</div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <i className="fa-solid fa-rotate-left" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>Stok barang yang terjual akan <b>dikembalikan otomatis</b> ke daftar stok.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTrx(null)} disabled={saving}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving} style={{ flex: 1 }}>
                {saving
                  ? <><i className="fa-solid fa-circle-notch animate-spin" /> Menghapus...</>
                  : <><i className="fa-solid fa-trash" /> Ya, Hapus Transaksi</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanPage;
