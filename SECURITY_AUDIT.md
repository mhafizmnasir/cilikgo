# CilikGo — Security & Production Readiness Audit

## Isu kritikal yang dibetulkan

1. **Pengguna boleh cuba mengubah medan langganan sendiri**
   - Rule lama hanya mengunci `role`.
   - Rule baharu mengehadkan update sendiri kepada `name`, `email`, `phone`, `updatedAt`.
   - `subscriptionStatus`, tarikh langganan, `agentCode` dan `referredByCode` tidak boleh diubah oleh browser.

2. **Pemilikan profil anak boleh dipindahkan**
   - Rule baharu memastikan `ownerUid` tidak boleh berubah semasa update.
   - Umur profil baharu dihadkan kepada 4–6 tahun dan nama divalidasi.

3. **Progress boleh ditulis untuk childId milik orang lain**
   - Create progress kini mesti merujuk profil anak milik pengguna yang sedang login.
   - Level, stars dan attempts turut divalidasi.
   - Update progress dari client ditutup; permainan menggunakan rekod append-only.

4. **Kod Agent baharu terlalu pendek**
   - Agent baharu kini menggunakan `CG-<Firebase UID>` sebagai kod unik.
   - Agent sedia ada dengan kod lama masih boleh membaca referral lama, tetapi jangan cuba daftar semula menggunakan frontend lama selepas rules baharu diterbitkan.

5. **Dashboard Agent cuba membaca semua pengguna**
   - Ditukar kepada query `users where referredByCode == agentCode`.
   - Firestore Rules hanya membenarkan Agent membaca Penjaga yang benar-benar berada di bawah referral mereka.

6. **Stored HTML daripada CMS**
   - `q.prompt` kini di-escape sebelum dimasukkan ke permainan untuk mengurangkan risiko stored XSS.

7. **Referral browser**
   - Format kod referral divalidasi.
   - Attribution referral client disimpan maksimum 30 hari.
   - Toast tidak lagi memaparkan nilai referral mentah.

8. **Fail projek pendua**
   - Folder projek lama bersarang `cilikgo-main/` dibuang daripada pakej release untuk mengurangkan fail lama yang boleh tersiar secara tidak sengaja.

## Masih perlu dibuat sebelum production sebenar

- **Publish `firestore.rules` baharu**. Upload GitHub sahaja TIDAK mengemas kini Firestore Rules.
- Aktifkan **Firebase App Check** untuk Web apabila domain production sudah tetap.
- Pertimbangkan Cloud Function untuk pendaftaran Agent jika anda mahu approval Agent sebelum aktif.
- Apabila ToyyibPay diaktifkan, uji callback, idempotency, jumlah pembayaran dan komisen di sandbox dahulu.
- Untuk production berskala, pindahkan penciptaan progress penting ke backend jika bintang/ganjaran mempunyai nilai kewangan.
- GitHub Pages tidak boleh menetapkan semua HTTP security headers seperti hosting server penuh. Pertimbangkan Firebase Hosting/Cloudflare apabila mahu hardening tambahan.

## Deploy Rules

Dari folder projek:

```bash
firebase login
firebase use cilikgo-web
firebase deploy --only firestore:rules
```

Selepas deploy rules, uji:
1. Penjaga boleh login, tambah anak dan main modul.
2. Penjaga tidak boleh melihat data Penjaga lain.
3. Agent hanya nampak referral sendiri.
4. Admin masih boleh membaca dashboard keseluruhan.
5. Admin masih boleh tambah/edit/padam CMS.
