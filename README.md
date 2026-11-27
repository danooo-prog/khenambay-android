# Khenambay untuk Android (Android Studio)

Aplikasi Android Khenambay yang **berdiri sendiri**: cukup dipasang lalu dibuka, seperti aplikasi biasa.
Tidak perlu XAMPP, alamat IP laptop, port, atau kabel.

- **Tampilan:** ada di dalam APK (folder `app/src/main/assets/www`).
- **Data:** disimpan di HP. Data contoh untuk lomba langsung tersedia saat aplikasi pertama dibuka.
- **Internet:** hanya dipakai untuk peta satelit/jalan dan membaca nama tempat dari koordinat foto. Tanpa internet,
  peta otomatis pindah ke peta 3D/2D bawaan, dan nama kampung diambil dari daftar offline.

Fitur bawaan HP yang dipakai:

- **GPS** untuk mengunci lokasi potensi, cap lokasi pada foto, dan fitur "Lokasi saya".
- **Kamera** untuk foto lapangan (langsung dari kamera) dan foto KTP/swafoto saat verifikasi investor.
- **Pengenal suara** untuk mengisi formulir lewat cerita dan bertanya ke Cenra.
- **Google Authenticator:** tombol **Buka di Google Authenticator** saat aktivasi login pendata.
- **Aplikasi lain:** tautan WhatsApp, email, dan telepon dibuka di aplikasi yang sesuai.

Admin DPMPTSP tetap hanya lewat website di komputer, jadi di aplikasi ini kartu Admin tidak muncul dan login admin ditolak.

## Cara menjalankan

1. Buka Android Studio, pilih *File › Open*, lalu pilih folder `khenambay-android`.
   Tunggu *Gradle sync* selesai. Pertama kali butuh internet untuk mengunduh Gradle dan pustaka.
2. Pilih HP (USB debugging) atau emulator, lalu tekan ▶ **Run 'app'**.

## Membuat APK untuk dibagikan

1. Pilih *Build › Build App Bundle(s) / APK(s) › Build APK(s)*.
2. Hasilnya ada di `app/build/outputs/apk/debug/app-debug.apk`.
3. Kirim APK itu ke HP mana saja, lalu pasang. Izinkan "pasang dari sumber tidak dikenal" bila diminta.

## Membagikan link download (tanpa Android Studio)

**Cara cepat (Google Drive):**
1. Build sekali di Android Studio (*Build › Build APK(s)*).
2. Upload `app-debug.apk` ke Google Drive dan ganti namanya jadi `Khenambay.apk`.
3. Klik kanan › *Bagikan* › *Siapa saja yang memiliki link*, lalu salin link-nya.

**Cara otomatis (GitHub, APK dibuat di server GitHub):**
1. Buat repository **publik** baru di GitHub, lalu upload seluruh isi folder `khenambay-android`,
   termasuk folder `.github`.
2. Buka tab *Actions*. Workflow **Buat APK** berjalan sendiri dan selesai dalam sekitar 5–8 menit.
3. APK muncul di tab *Releases*. Link download yang selalu menunjuk ke versi terbaru:
   `https://github.com/<akun-github>/<nama-repo>/releases/latest/download/Khenambay.apk`
4. Setiap kali ada perubahan dan di-push ke `main`, APK baru dibuat otomatis dan link di atas ikut ke versi baru.

**Saat memasang di HP:**
- Buka link, unduh `Khenambay.apk`, lalu ketuk file itu.
- Izinkan "Instal aplikasi tidak dikenal" bila diminta.
- Play Protect mungkin memberi peringatan karena aplikasi tidak berasal dari Play Store. Pilih *Tetap instal*.
- Bila sebelumnya sudah memasang versi dari Android Studio atau versi GitHub yang lain, hapus dulu aplikasi
  lama, karena kunci tanda tangannya berbeda.

## Akun demo

| Peran | Email | Kata sandi |
|---|---|---|
| Pendata lapangan | markus@jayapurakab.go.id | pendata123 |
| Investor (terverifikasi) | investor@demo.id | investor123 |
| Investor (menunggu verifikasi) | kenji@demo.id | investor123 |
| Investor (belum verifikasi) | baru@demo.id | investor123 |

Ketik email dan kata sandi di atas di halaman masuk.

## Login pendata dengan Google Authenticator

Pendata lapangan masuk dengan email dan kata sandi, lalu kode 6 angka dari **Google Authenticator**.

1. Pasang **Google Authenticator** dari Play Store di HP yang sama.
2. Login pertama memunculkan kode QR. QR tidak bisa dipindai dari layar HP sendiri, jadi ketuk
   **Buka di Google Authenticator**. Akun "Khenambay DPMPTSP" langsung ditambahkan.
   - Cara lain: ketuk **Salin kunci**, lalu di Google Authenticator pilih *+ › Masukkan kunci penyiapan*.
3. Kembali ke Khenambay dan ketik 6 angka yang muncul. Login berikutnya cukup memasukkan 6 angka.

Bila Google Authenticator belum terpasang, aplikasi menawarkan membuka Play Store.
Di emulator, pakai image "Google Play" agar Google Authenticator bisa dipasang.

Investor yang lupa kata sandi meminta kode 6 angka. Aplikasi belum tersambung ke server email,
jadi kodenya ditampilkan di layar dengan label "Mode demo".

## Keamanan data di HP

Aturannya sama dengan website PHP:

- **Kata sandi:** disimpan sebagai hash PBKDF2-SHA256, tidak pernah dalam bentuk asli.
- **Percobaan masuk:** akun dikunci 15 menit setelah 5 kali salah.
- **Sesi:** token login disimpan sebagai hash dan punya masa berlaku.
- **Google Authenticator:** satu kode tidak bisa dipakai dua kali.
- **Data diri investor (KYC):** biodata dan foto dokumen dienkripsi AES-256-GCM. Kuncinya dibuat di HP dan tidak bisa diekspor.

## Hubungannya dengan website PHP

Tampilan aplikasi diambil dari folder website `khenambay-php`. Di website, data dikirim ke API PHP. Di aplikasi,
`local-api.js` menjalankan API yang sama langsung di HP.

Data di HP **tidak otomatis muncul di website admin**. Untuk demo verifikasi oleh admin, pakai website di laptop.

Bila tampilan website diubah, salin ulang ke aplikasi:

```
python siapkan-aset-web.py                    (memakai folder ../khenambay-php)
python siapkan-aset-web.py C:\xampp\htdocs\khenambay
```

Lalu tekan ▶ Run lagi.

## Struktur

```
siapkan-aset-web.py   menyalin tampilan website ke dalam aplikasi
app/src/main/java/id/khenambay/app/
  MainActivity.kt     layar pembuka, WebView yang membuka tampilan dari dalam APK, izin, kamera/berkas
  NativeBridge.kt     objek KhenambayNative yang dipanggil halaman web
  NativeLocation.kt   GPS HP (LocationManager)
  NativeSpeech.kt     pengenal suara HP (SpeechRecognizer)
app/src/main/assets/
  www/                tampilan Khenambay (HTML, CSS, JS, gambar) + local-api.js (API di HP)
  bridge.js           menyambungkan pengenal suara (dan GPS bila perlu) ke fitur HP
app/src/main/res/     ikon & layar pembuka (logo cenderawasih), warna, tema, keamanan jaringan
```

## Catatan untuk rilis sungguhan

- **Sinkron ke DPMPTSP:** pasang API PHP di hosting HTTPS, lalu kirim data pendata dari HP ke server itu.
- **Rilis ke Play Store:** buat kunci tanda tangan rilis lewat *Build › Generate Signed Bundle / APK*.
