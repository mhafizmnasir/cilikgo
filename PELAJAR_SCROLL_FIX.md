# CilikGo — Fix Scroll Ruang Pelajar

## Punca
`#dashboard` dan `#portal` menggunakan `overflow:hidden`, sementara `.interactive-student`
hanya mempunyai `min-height:100dvh`. Ini menyebabkan halaman Pelajar membesar melebihi
viewport tetapi bahagian bawah dipotong oleh parent yang tidak boleh scroll.

## Pembetulan
- `.interactive-student` kini mempunyai `height:100dvh`.
- `.interactive-student` menjadi scroll container utama dengan `overflow-y:auto`.
- `#dashboard` kekal sebagai frame viewport dan tidak memotong scroll child.
- Tambah ruang bawah supaya kad Pencapaian dan Tip CilikGo boleh dilihat sepenuhnya.
- Sokongan smooth scrolling pada peranti sentuh melalui `-webkit-overflow-scrolling: touch`.

Tiada perubahan Firebase, Firestore Rules atau bank soalan.
