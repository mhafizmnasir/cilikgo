# Subscription Enforcement
- Penjaga boleh login dan melihat dashboard tanpa langganan.
- Permainan 3M dengan progress memerlukan subscription aktif dan belum tamat.
- Inactive: paywall RM69 / 4 bulan.
- Expired: paywall renewal RM15 / 1 bulan.
- Gate dibuat pada pemilih Level dan `startLevel` sebagai perlindungan berganda.
- Admin dan Agent tidak dikunci.
- ToyyibPay masih KIV, jadi butang pembayaran sengaja disabled.

Uji akaun inactive, expired dan active. Frontend gate ialah UX enforcement; apabila API premium/payment aktif, backend juga mesti menyemak subscription.
