# CilikGo — Fix Navbar Admin, Agent & Penjaga

## Punca ralat
Tiga portal menggunakan corak responsive berbeza:
- Penjaga menukar sidebar kepada bottom navigation.
- Admin/Agent menukar sidebar kepada horizontal bar.
- App topbar pula mempunyai menu akaun berasingan.

Apabila CSS responsive lama bertindih, navbar boleh kelihatan sempit, terpotong atau mengambil terlalu banyak ruang pada tablet/telefon.

## Pembetulan
Semua role kini menggunakan corak yang sama pada skrin <= 1024px:
1. Sidebar disembunyikan sepenuhnya.
2. Butang ☰ pada kiri app bar membuka menu dashboard dari kiri.
3. Butang 👤 pada kanan membuka menu akaun.
4. Klik pautan, backdrop, X atau Escape akan menutup drawer.
5. Penjaga tidak lagi menggunakan fixed bottom navigation.
6. Admin/Agent tidak lagi menggunakan horizontal role menu pada mobile.
7. Desktop >1024px masih menggunakan sidebar penuh.

Tiada perubahan Firebase atau Firestore Rules.
