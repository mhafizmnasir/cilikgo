# CilikGo — KSSR Learning Architecture Fasa 1

Perubahan asas:
- Profil anak kini memilih Tahun 1–6.
- Learning Hub berubah daripada Modul 3M kepada Tahun → Subjek → Topik.
- Tahun 1 menjadi pilot: Bahasa Melayu, Bahasa Inggeris, Matematik dan Sains.
- Struktur data masa depan untuk soalan: year, subject, topic, contentStandard, learningStandard, difficulty, questionType, prompt, answers, correct, explanation, sourceType.
- Akaun, Firebase Auth, subscription, Agent, Admin dan sistem 3M lama dikekalkan di belakang untuk migrasi berperingkat.
- Kandungan Tahun 2–6 belum diaktifkan pada Fasa 1.
- Soalan yang akan dimasukkan hendaklah original/dibenarkan dan dipetakan kepada kurikulum KPM.

Nota: medan `age` masih disimpan secara kompatibiliti (year + 6) sementara sistem lama dimigrasikan.
