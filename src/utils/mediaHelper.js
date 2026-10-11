import { useState, useEffect } from 'react';

// ─── MEDIA HELPER & RESOLVER (MELAN JAYA POS) ──────────────────────────────────
// Mendukung gambar & video (direct video, YouTube), resolusi link ImgBB (ibb.co),
// Google Drive, Dropbox, separator '+', dan share WhatsApp dengan media.

const RESOLVER_CACHE_KEY = 'mj_media_resolved_cache';

// Load memory cache from localStorage
const loadCache = () => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(RESOLVER_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(RESOLVER_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[mediaHelper] Cache save failed:', e);
  }
};

const memoryCache = loadCache();

/**
 * Memecah string URL media yang dipisahkan tanda '+', koma, atau baris baru
 * Contoh: "https://ibb.co/abc + https://youtu.be/xyz" -> ["https://ibb.co/abc", "https://youtu.be/xyz"]
 */
export const splitMediaUrls = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s || '').trim()).filter(Boolean);
  }
  return String(input)
    .split(/[\n+]+/)
    .map(s => s.trim())
    .filter(Boolean);
};

/**
 * Menggabungkan array URL kembali menjadi string dengan separator ' + '
 */
export const joinMediaUrls = (urls) => {
  if (!Array.isArray(urls)) return String(urls || '').trim();
  return urls.map(s => String(s || '').trim()).filter(Boolean).join(' + ');
};

/**
 * Cek apakah URL adalah video langsung (.mp4, .webm, .mov, dll)
 */
export const isDirectVideoUrl = (url) => {
  if (!url) return false;
  const clean = String(url).split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|ogg|m4v|mkv)$/i.test(clean) || clean.startsWith('blob:');
};

/**
 * Cek dan ekstrak ID video YouTube
 */
export const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const str = String(url).trim();
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
};

/**
 * Cek apakah URL adalah video YouTube
 */
export const isYouTubeUrl = (url) => {
  return Boolean(getYouTubeVideoId(url));
};

/**
 * Dapatkan URL embed YouTube
 */
export const getYouTubeEmbedUrl = (url) => {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
};

/**
 * Dapatkan URL thumbnail YouTube
 */
export const getYouTubeThumbnail = (url) => {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

/**
 * Cek apakah suatu URL adalah media video (Direct Video atau YouTube)
 */
export const isMediaVideo = (url) => {
  if (!url) return false;
  return isDirectVideoUrl(url) || isYouTubeUrl(url);
};

/**
 * Normalisasi URL instan secara sinkron (Google Drive, Dropbox, Imgur)
 */
export const normalizeMediaUrl = (url) => {
  if (!url) return '';
  let str = String(url).trim();

  // 1. Google Drive view/share link -> direct image view
  // Format: https://drive.google.com/file/d/FILE_ID/view...
  const gDriveMatch = str.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
                      str.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  // 2. Dropbox share link -> direct download (raw=1)
  if (str.includes('dropbox.com')) {
    str = str.replace(/[?&]dl=0/g, '').replace(/[?&]raw=1/g, '');
    return str.includes('?') ? `${str}&raw=1` : `${str}?raw=1`;
  }

  // 3. Imgur page -> direct image
  const imgurMatch = str.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/i);
  if (imgurMatch && imgurMatch[1]) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  // 4. Postimages page link (postimg.cc/xxx) -> tetap atau cek i.postimg.cc
  return str;
};

/**
 * Cek apakah URL adalah halaman viewer ImgBB (misal https://ibb.co.com/3yFQ0gVP atau https://ibb.co/3yFQ0gVP)
 * yang BUKAN direct image (bukan i.ibb.co)
 */
export const isImgBBViewerUrl = (url) => {
  if (!url) return false;
  const str = String(url).trim();
  // Cocok dengan ibb.co atau ibb.co.com tapi bukan i.ibb.co / i.ibb.co.com
  return /^https?:\/\/(?!i\.)(?:[a-zA-Z0-9-]+\.)?ibb\.co(?:\.com)?\/[a-zA-Z0-9]+/i.test(str);
};

/**
 * Resolver asinkron untuk link ImgBB viewer -> Direct image URL (https://i.ibb.co.com/...)
 */
export const resolveImgBBUrl = async (url) => {
  if (!url) return '';
  const cleanUrl = String(url).trim();

  // Jika sudah direct image atau bukan viewer ImgBB, kembalikan langsung
  if (!isImgBBViewerUrl(cleanUrl)) {
    return normalizeMediaUrl(cleanUrl);
  }

  // Cek memory/localStorage cache
  if (memoryCache[cleanUrl]) {
    return memoryCache[cleanUrl];
  }

  try {
    // Gunakan r.jina.ai (CORS-friendly markdown reader yang sangat cepat)
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
    const res = await fetch(jinaUrl, { method: 'GET' });
    if (res.ok) {
      const text = await res.text();
      // Cari direct image link ImgBB dari teks markdown
      // Contoh: https://i.ibb.co.com/sv1zF8cX/IMG-20261011-WA0011.jpg atau https://i.ibb.co/...
      const match = text.match(/https?:\/\/i\.ibb\.co(?:\.com)?\/[^\s)"'\\]+/i);
      if (match && match[0]) {
        let directUrl = match[0];
        // Pastikan ekstensi gambar bersih
        directUrl = directUrl.replace(/[),;]+$/, '');
        // Simpan di cache
        memoryCache[cleanUrl] = directUrl;
        saveCache(memoryCache);
        return directUrl;
      }
    }
  } catch (err) {
    console.warn('[mediaHelper] Jina resolve failed:', err);
  }

  // Fallback: kembalikan URL yang dinormalisasi
  return normalizeMediaUrl(cleanUrl);
};

/**
 * Normalisasi dan resolusi lengkap untuk satu URL media
 */
export const resolveSingleMedia = async (url) => {
  if (!url) return '';
  const normalized = normalizeMediaUrl(url);
  if (isImgBBViewerUrl(normalized)) {
    return await resolveImgBBUrl(normalized);
  }
  return normalized;
};

/**
 * Resolusi batch untuk array atau string media
 */
export const resolveAllMediaList = async (input) => {
  const urls = splitMediaUrls(input);
  const resolved = await Promise.all(urls.map(u => resolveSingleMedia(u)));
  return resolved.filter(Boolean);
};

/**
 * Dapatkan primary image URL (1 gambar utama)
 * Dipakai di Kasir dan Share WhatsApp agar hanya 1 gambar yang diambil
 */
export const getPrimaryImageUrl = (mediaInput) => {
  const urls = splitMediaUrls(mediaInput);
  if (urls.length === 0) return '';

  // Cari yang pertama kali berformat gambar (bukan YouTube & bukan direct video)
  const imageItem = urls.find(u => !isMediaVideo(u));
  if (imageItem) {
    return normalizeMediaUrl(imageItem);
  }

  // Jika semua video dan ada YouTube, pakai thumbnail YouTube
  const ytItem = urls.find(u => isYouTubeUrl(u));
  if (ytItem) {
    return getYouTubeThumbnail(ytItem) || '';
  }

  // Default ke item pertama yang dinormalisasi
  return normalizeMediaUrl(urls[0] || '');
};

/**
 * Fallback URL via images.weserv.nl jika gambar gagal dimuat (CORS / SSL / Hotlink block)
 */
export const getWeservFallbackUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  // Jangan proxy YouTube atau video
  if (isMediaVideo(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  // Hapus protokol untuk weserv jika perlu, atau encode
  const clean = url.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&default=${encodeURIComponent(url)}`;
};

/**
 * Helper error handler untuk elemen <img>
 * Coba weserv.nl sekali jika direct load gagal
 */
export const handleImageErrorWithFallback = (e, originalUrl) => {
  const target = e.currentTarget;
  if (!target) return;

  // Jika belum dicoba via weserv fallback
  if (!target.dataset.triedWeserv && originalUrl && !isMediaVideo(originalUrl)) {
    target.dataset.triedWeserv = 'true';
    target.src = getWeservFallbackUrl(originalUrl);
  } else {
    // Sembunyikan elemen jika tetap gagal
    target.style.display = 'none';
  }
};

/**
 * Share Produk ke WhatsApp dengan foto ikut terkirim:
 * 1. Jika browser mendukung navigator.share dengan File (Android & iOS Safari), fetch blob dan kirim file gambar langsung ke WA.
 * 2. Jika tidak mendukung file share, buka wa.me dengan teks rincian + direct link gambar agar WA menampilkan link preview gambar.
 */
export const shareProductToWhatsApp = async ({
  product,
  storeName = 'Melan Jaya',
  targetPhone = '',
  catalogUrl = '',
  variant = ''
}) => {
  if (!product) return { success: false, mode: 'none' };

  const primaryImage = getPrimaryImageUrl(product.imageUrl || product.r_image_url);
  const hargaFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.hargaJual || 0);

  // Buat pesan teks WhatsApp yang rapi
  let text = `Halo *${storeName}*, saya tertarik memesan produk berikut dari E-Katalog:\n\n`;
  text += `👗 *Produk:* ${product.nama_barang}\n`;
  text += `🏷️ *Kategori:* ${product.kategori || 'Pakaian'}\n`;
  text += `💰 *Harga:* ${hargaFormatted}\n`;

  if (variant) {
    text += `🎨 *Pilihan Variasi:* ${variant}\n`;
  } else if (product.variasiText) {
    text += `🎨 *Variasi Tersedia:* ${product.variasiText}\n`;
  }

  if (product.hargaGrosir > 0) {
    const grosirFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.hargaGrosir);
    text += `✨ *Harga Grosir:* ${grosirFormatted} (Min. ${product.minQtyGrosir || 3} pcs)\n`;
  }

  if (primaryImage) {
    text += `\n📸 *Lihat Foto Produk:*\n${primaryImage}\n`;
  }

  if (catalogUrl) {
    text += `\n🛍️ *Link E-Katalog:*\n${catalogUrl}\n`;
  }

  text += `\nApakah stok ini masih tersedia? Terima kasih!`;

  // Coba Web Share API dengan File jika tersedia
  if (primaryImage && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      // Fetch gambar sebagai blob
      // Gunakan weserv agar bypass CORS jika server gambar tidak mengizinkan direct fetch
      const fetchUrl = primaryImage.startsWith('http')
        ? `https://images.weserv.nl/?url=${encodeURIComponent(primaryImage)}`
        : primaryImage;

      const res = await fetch(fetchUrl, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        const file = new File([blob], `${(product.nama_barang || 'produk').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`, {
          type: blob.type || 'image/jpeg'
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${product.nama_barang} — ${storeName}`,
            text: text
          });
          return { success: true, mode: 'web_share_file' };
        }
      }
    } catch (shareErr) {
      console.warn('[mediaHelper] Native file share skipped/cancelled:', shareErr);
    }
  }

  // Fallback: Kirim melalui URL WhatsApp API resmi
  const cleanPhone = String(targetPhone || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(waUrl, '_blank');
  return { success: true, mode: 'wa_link' };
};

/**
 * Custom React Hook untuk mendapatkan daftar media yang otomatis ter-resolve
 * Membantu halaman E-Katalog dan Kasir menampilkan gambar dari link ImgBB lama secara otomatis
 */
export const useResolvedMedia = (rawInput) => {
  const [mediaList, setMediaList] = useState(() => {
    const raw = splitMediaUrls(rawInput);
    return raw.map(u => memoryCache[u] || normalizeMediaUrl(u));
  });

  useEffect(() => {
    let isMounted = true;
    const raw = splitMediaUrls(rawInput);
    if (raw.length === 0) {
      setMediaList([]);
      return;
    }

    const hasUnresolved = raw.some(u => isImgBBViewerUrl(u) && !memoryCache[u]);

    if (hasUnresolved) {
      resolveAllMediaList(rawInput).then(resolved => {
        if (isMounted) setMediaList(resolved);
      });
    } else {
      setMediaList(raw.map(u => memoryCache[u] || normalizeMediaUrl(u)));
    }

    return () => { isMounted = false; };
  }, [rawInput]);

  return mediaList;
};
