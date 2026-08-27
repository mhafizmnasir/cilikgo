# CilikGo — QA/UAT Fix

## Pemeriksaan automatik
- `app.js` lulus semakan sintaks Node.
- Semua selector `#id` statik yang digunakan oleh JavaScript ditemui sama ada dalam HTML atau UI dinamik.
- Struktur Firebase frontend dan Cloud Functions diperiksa.
- Folder projek lama bersarang dibuang daripada pakej release.

## Bug yang ditemui dan dibetulkan

### 1. Agent Dashboard vs Firestore Rules
Selepas Security Audit, Agent hanya dibenarkan membaca order/komisen miliknya. Tetapi dashboard masih cuba membaca seluruh koleksi `orders` dan `commissions`. Firestore akan menolak query seperti itu.

**Fix:** Agent kini query terus:
- `orders where agentUid == currentAgentUid`
- `commissions where agentUid == currentAgentUid`

Ini penting apabila ToyyibPay diaktifkan nanti.

### 2. Fallback profil Firebase
Jika akaun Firebase Authentication wujud tetapi dokumen `users/{uid}` tiada, fallback profile tidak mempunyai `agentCode` dan `referredByCode`. Hardened Firestore Rules boleh menolak bentuk dokumen yang tidak lengkap.

**Fix:** fallback Penjaga kini menetapkan kedua-duanya kepada `null`.

### 3. Validasi edit profil anak
Create sudah mengehadkan umur 4–6, tetapi update belum mengulangi validasi tersebut.

**Fix:** update profil anak juga memerlukan nama sah dan umur 4–6.

### 4. Folder release lama
ZIP yang diterima masih mempunyai folder `cilikgo-main/` bersarang yang mengandungi versi kod lama.

**Fix:** folder pendua dibuang daripada pakej QA ini.

## UAT yang perlu dibuat di GitHub

1. **Authentication**
   - Daftar Penjaga baharu.
   - Login/logout.
   - Reset password.
   - Daftar Agent baharu.

2. **Penjaga**
   - Tambah anak umur 4, 5 dan 6.
   - Pilih anak.
   - Main Membaca, Menulis, Mengira.
   - Jawab salah kemudian betul.
   - Semak progress, bintang, audio dan laporan.

3. **CMS/Admin**
   - Login Admin.
   - Tambah satu soalan CMS.
   - Edit dan padam.
   - Pastikan soalan aktif muncul dalam permainan.

4. **Agent**
   - Salin link referral.
   - Daftar Penjaga melalui Incognito.
   - Pastikan referral muncul pada Agent.
   - Jualan/komisen akan kekal kosong selagi ToyyibPay KIV.

5. **Akses role**
   - Penjaga tidak patut boleh membuka data Agent/Admin.
   - Agent hanya patut nampak referral sendiri.
   - Admin patut masih nampak dashboard keseluruhan.

## Penting
`firestore.rules` berubah sedikit dalam versi ini. Deploy semula rules selepas upload:

```bash
firebase deploy --only firestore:rules
```

ToyyibPay masih tidak perlu diaktifkan untuk UAT ini.
