# CilikGo — Pelajar Blank Screen Fix

Punca:
Selector CSS `body.app-mode main>section:not(#portal)` terlalu umum.
Ia bukan sahaja menyembunyikan section landing page, malah turut menyembunyikan
semua `<section>` di dalam `<main class="student-main">`.

Kesan:
Header Ruang Pelajar kelihatan tetapi semua kandungan utama di bawahnya kosong.

Pembetulan:
- Scope selector kepada top-level `body > main > section`.
- Scope rule untuk top-level main sahaja.
- Tambah defensive override untuk Student Portal.
- Tiada perubahan Firestore atau bank soalan.
