# CilikGo — Fix Warna Butang Seterusnya

Punca sebenar:
- Paparan reference menggunakan `.quiz-ref-progress-track`.
- Handler jawapan betul masih cuba mengakses `.quiz-progress-track`.
- Ini menghasilkan JavaScript error sebelum class `ready` sempat ditambah.
- Oleh sebab `answeredCorrectly` sudah true, butang masih boleh ditekan walaupun rupa kekal kelabu.

Pembetulan:
- Progress selector kini menggunakan `.quiz-ref-progress-track`.
- Pengaktifan butang Seterusnya dibuat lebih awal dan secara defensif.
- Warna aktif dipaksa kepada gradient ungu terang dengan teks putih.
- Status locked kekal kelabu hanya sebelum jawapan betul.

Tiada perubahan Firestore Rules.
