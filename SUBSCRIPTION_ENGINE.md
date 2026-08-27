# CilikGo — Subscription Engine (ToyyibPay KIV)

## Struktur pelan
- **Starter:** RM69 / 4 bulan
- **Renewal:** RM15 / 1 bulan

## Status yang disediakan
- `inactive`
- `pending`
- `active`
- `expired`
- Order: `pending` → `paid` (atau `failed` apabila gateway disambungkan)

## Apa yang dibina
1. Helper frontend untuk membaca status langganan dan baki hari.
2. Paparan Penjaga membezakan aktif, tamat dan belum aktif.
3. Harga RM69/4 bulan dan RM15/bulan dipaparkan dengan jelas.
4. Butang pembayaran masih disabled kerana ToyyibPay KIV.
5. `functions/subscription-engine.js` menyediakan logik backend untuk:
   - validasi pelan/harga,
   - aktivasi selepas pembayaran disahkan,
   - tambah 4 bulan atau 1 bulan,
   - renewal daripada tarikh tamat sedia ada jika masih aktif,
   - idempotency supaya callback berulang tidak menggandakan tempoh.
6. Firestore `orders` kekal **backend-write-only**. Ini disengajakan untuk keselamatan.

## Kenapa order belum dibuat dari browser?
Selepas Security Audit, `orders` tidak boleh ditulis oleh client. Itu betul untuk production. Apabila ToyyibPay tersedia, Cloud Function akan mencipta order dan payment URL selepas mengesahkan pengguna dan pelan. Browser tidak patut menentukan sendiri jumlah RM69/RM15.

## Aliran production nanti
Penjaga → pilih pelan → Cloud Function cipta pending order → ToyyibPay → callback/verification server → `activatePaidOrder()` → subscription aktif → jika ada Agent, komisen direkod di backend.

## Ujian sekarang
- Login Penjaga tanpa langganan: paparan RM69 / 4 bulan.
- Akaun aktif: paparan tarikh tamat, baki hari dan RM15 / bulan.
- Akaun tamat: paparan `Langganan telah tamat`.
- Pastikan modul/CMS/Admin/Agent sedia ada masih berjalan.

## Apabila akaun ToyyibPay siap
Jangan masukkan secret key ke `app.js`, GitHub Pages atau Firebase config frontend. Credential ToyyibPay mesti disimpan sebagai Firebase Functions secret/environment configuration.
