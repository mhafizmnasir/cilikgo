# CilikGo — Fix Paparan Blur Selepas Pilih Menu

## Punca sebenar
Backdrop menu (`roleNavBackdrop`) kekal dengan class `show` selepas sesetengah menu Admin/Agent dirender semula.

Ini berlaku kerana menu dinamik menggantikan sidebar terlebih dahulu. Fungsi penutup lama akan berhenti jika drawer tidak lagi ditemui, lalu backdrop kekal aktif. Sebab itu paparan kelihatan blur sehingga pengguna klik kawasan luar.

## Pembetulan
- `setRoleNav(false)` kini sentiasa membersihkan body, backdrop dan aria state walaupun drawer telah diganti.
- Admin dan Agent menutup drawer **sebelum** render menu baru.
- Penjaga menutup drawer sebelum Ruang Pelajar, Langganan dan Tambah Profil.
- Setiap render role membersihkan stale overlay.
- Backdrop yang tidak aktif tidak boleh menangkap klik dan tidak menggunakan blur.

Tiada perubahan Firebase atau Firestore Rules.
