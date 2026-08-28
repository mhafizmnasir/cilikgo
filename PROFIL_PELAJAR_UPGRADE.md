# CilikGo — Profil Pelajar Upgrade

Perubahan:
- Tambah field Jantina: Lelaki / Perempuan.
- Avatar dipelbagaikan kepada pelajar, cita-cita dan haiwan comel.
- Avatar preview ditambah dalam modal.
- Ruang Pelajar hanya menunjukkan tahun profil yang dipilih. Tahun lain tidak lagi dipaparkan sebagai roadmap.
- Kad profil Penjaga mempunyai butang Padam.
- Padam profil turut memadam rekod progress milik profil tersebut sebelum memadam dokumen `children`.

## Firestore Rules
Rules turut dikemas kini:
- Profil Tahun 1–6 baharu memerlukan `gender` = `male` atau `female`.
- Penjaga dibenarkan memadam rekod `progress` miliknya sendiri supaya fungsi padam profil boleh membersihkan data pembelajaran.

Selepas deploy website, jalankan:
`firebase deploy --only firestore:rules`

Profil Tahun 1–6 lama yang belum mempunyai field `gender` masih boleh dibaca dan dipadam. Ia hanya tidak akan mempunyai label jantina sehingga profil baharu dibuat.
