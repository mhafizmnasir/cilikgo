# Admin Subscription Management

Ditambah:
- Senarai semua Penjaga dan status subscription.
- Tarikh tamat dan baki hari.
- Bilangan transaksi/order.
- Carian nama/e-mel dan filter status.
- Admin boleh tambah 4 bulan, tambah 1 bulan atau tamatkan langganan.
- Setiap perubahan manual direkod dalam `subscriptionAudit`.
- Dialog confirmation sebelum perubahan.

## Firestore
`subscriptionAudit` hanya boleh dibaca/dicipta oleh Admin. User/Agent tidak mempunyai akses.

## Penting
Deploy `firestore.rules` selepas push:
```bash
firebase deploy --only firestore:rules
```

Fungsi manual ini untuk testing/customer support. Apabila ToyyibPay aktif, pembayaran sebenar masih perlu diproses oleh backend, bukan melalui fungsi manual Admin.
