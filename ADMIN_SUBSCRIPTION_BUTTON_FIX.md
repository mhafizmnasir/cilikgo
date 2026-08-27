# Fix Admin Langganan

Punca:
- Menu Admin sebenar menggunakan sistem `mount(view)`.
- Paparan `subscriptions` lama masih dirender oleh `views.subscriptions`.
- Renderer baharu pula mencari `#adminView`, sedangkan elemen itu tidak wujud.

Fix:
- Menu `Langganan` sebenar kini diarahkan ke `renderAdminSubscriptions()`.
- Renderer menggunakan `.dash-main` yang memang wujud dalam Admin shell.
- Sidebar Admin dikekalkan ketika paparan pengurusan langganan dibuka.

Selepas deploy, Admin > Langganan mesti memaparkan:
Penjaga | Status | Tamat | Baki | Transaksi | Tindakan

Tindakan:
+4 bulan | +1 bulan | Tamatkan

Deploy Firestore Rules juga kerana audit log `subscriptionAudit` diperlukan.
