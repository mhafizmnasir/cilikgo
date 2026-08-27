# Dashboard Penjaga — Status Langganan

Paparan Langganan kini mengikut status sebenar pengguna:

- **active**: Langganan Aktif, tarikh mula, tarikh tamat, baki hari dan renewal RM15.
- **inactive**: Pakej Permulaan RM69 / 4 bulan.
- **expired**: Langganan Tamat dan renewal RM15 / 1 bulan.
- ToyyibPay kekal KIV; butang pembayaran disabled.
- Butang kembali membawa Penjaga ke Dashboard.
- Butang subscription pada dashboard tidak lagi memanggil Firebase Function pembayaran semasa ToyyibPay KIV.

Ujian:
1. Admin +4 bulan → login Penjaga → Langganan → mesti papar Aktif.
2. Admin Tamatkan → login/refresh Penjaga → Langganan → mesti papar Tamat.
3. Akaun inactive → mesti papar RM69 / 4 bulan.
