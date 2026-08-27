# CilikGo — Setup Agent, Referral, ToyyibPay & Langganan

Versi ini menyediakan aliran:
**Link Agent → daftar Penjaga → referral disimpan → bayar ToyyibPay → callback disahkan → langganan aktif → komisen Agent direkodkan.**

## 1. Jangan simpan secret di GitHub
Jangan letakkan User Secret Key ToyyibPay dalam `firebase.js`, `app.js` atau repository.

## 2. Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase use cilikgo-web
cd functions
npm install
cd ..
```

## 3. Mulakan dengan ToyyibPay Sandbox
Gunakan akaun sandbox ToyyibPay dan cipta Category. Kemudian:
```bash
firebase functions:secrets:set TOYYIB_SECRET
firebase functions:secrets:set TOYYIB_CATEGORY
```
Masukkan User Secret Key dan Category Code sandbox apabila diminta.

Kod menggunakan `TOYYIB_ENV=sandbox` secara default.

## 4. Deploy
```bash
firebase deploy --only functions,firestore:rules
```

Frontend GitHub Pages memanggil:
`https://asia-southeast1-cilikgo-web.cloudfunctions.net/createBill`

Callback:
`https://asia-southeast1-cilikgo-web.cloudfunctions.net/toyyibCallback`

## 5. Uji referral
1. Login Agent dan salin link affiliate.
2. Buka link dalam incognito.
3. Daftar akaun Penjaga.
4. Semak `users/{uid}.referredByCode`.
5. Klik Langgan dan buat pembayaran sandbox.
6. Semak `orders`, `users.subscriptionEndsAt`, dan `commissions`.

## 6. Harga
- Starter: RM69 → 4 bulan.
- Renewal: RM15 → 1 bulan.
- Renewal menyambung dari tarikh tamat jika langganan masih aktif.
- RM15 versi ini ialah pembaharuan manual, bukan auto-debit.

## 7. Komisen
Default contoh ialah 15%. Ubah parameter `COMMISSION_PERCENT` mengikut polisi sebenar sebelum production.

## 8. Production
Selepas sandbox lulus, gunakan credential production dan tukar `TOYYIB_ENV` kepada `production`, kemudian deploy semula.

## Keselamatan
Callback mengesahkan hash ToyyibPay. Pemprosesan pembayaran idempotent, self-referral disekat, dan client tidak boleh menulis terus ke `orders`/`commissions`.
