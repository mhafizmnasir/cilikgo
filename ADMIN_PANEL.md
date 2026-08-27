# CilikGo Admin Panel

Versi ini menambah pusat kawalan Admin dengan paparan:
- Overview
- User / Penjaga
- Agent
- Profil Anak
- Prestasi 3M
- Langganan
- Transaksi
- Komisen
- CMS Modul 3M (koleksi Firestore `modules`)
- Settings

ToyyibPay kekal KIV. Paparan transaksi hanya membaca rekod yang wujud dan tidak memerlukan ToyyibPay untuk fungsi Admin lain.

## Firestore Rules
Gunakan `firestore.rules` yang disertakan. Rule sedia ada membenarkan Admin membaca data sistem dan menulis koleksi `modules`.

## Nota CMS
CMS dalam versi ini menyediakan pengurusan metadata kandungan dalam Firestore tanpa menggantikan bank soalan 3M terbina dalam yang sudah stabil. Penyambungan penuh soalan CMS kepada permainan boleh dibuat sebagai fasa seterusnya.
