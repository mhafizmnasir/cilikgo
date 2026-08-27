# CilikGo — Child Selection + Paywall Fix

Dua bug dibetulkan:

1. **Tidak boleh tukar profil anak**
   - Sebelum ini klik profil hanya mengubah `activeChild` sementara.
   - `renderUser()` memanggil `loadChildren()` semula dan memilih semula anak lama dari `localStorage`.
   - Sekarang pilihan anak baharu disimpan ke `cilikgo_active_child` sebelum dashboard dirender semula.

2. **Butang “Mulakan Membaca/Menulis/Mengira” tidak bertindak**
   - Subscription gate merujuk `#gameDialog`.
   - HTML sebenar menggunakan `#gameModal`.
   - Semua rujukan paywall kini menggunakan `#gameModal`.

## Ujian
- Klik profil anak kedua → border pilihan dan laporan mesti bertukar.
- Refresh browser → anak terakhir yang dipilih mesti kekal dipilih.
- Akaun tanpa subscription → klik “Mulakan Membaca” → paywall 🔒 mesti terbuka.
- Tekan “Kembali” pada paywall → modal mesti tertutup.
