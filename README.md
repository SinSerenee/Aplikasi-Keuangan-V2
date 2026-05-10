```markdown
# 💸 SinTrack V2 — Personal Finance Tracker (Multi-User)

[![Live Demo](https://img.shields.io/badge/demo-vercel-black?logo=vercel)](https://aplikasi-keuangan-v2.vercel.app)
[![Supabase](https://img.shields.io/badge/supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **SinTrack V2** adalah aplikasi pencatat keuangan pribadi multi-user yang memungkinkan Anda mencatat pemasukan/pengeluaran, membuat kategori kustom, mengunggah avatar, dan melihat statistik dengan grafik — dibangun dengan HTML/CSS/JS murni + Supabase.

🔗 **Live Demo:** [https://aplikasi-keuangan-v2.vercel.app](https://aplikasi-keuangan-v2.vercel.app)

---

## ✨ Fitur Unggulan

- 🔐 **Autentikasi** – Registrasi/login dengan email, verifikasi email, session tetap.
- 🔄 **Reset Password** – Lupa password dengan email reset (SMTP Resend).
- 👤 **Profil Pengguna** – Edit nama, upload avatar, atau pilih dari 6 avatar emoji default.
- 🏷️ **Kategori Kustom** – Tambah kategori sendiri (khusus untuk pengeluaran).
- 📊 **Grafik Pengeluaran** – Pie chart per kategori menggunakan Chart.js.
- 💰 **CRUD Transaksi** – Tambah, lihat, edit, hapus transaksi dengan catatan opsional.
- 📱 **Tampilan Responsif** – Dark theme, cocok untuk desktop, tablet, dan HP.
- 🧪 **Validasi Client-side** – Peringatan email tidak valid, konfirmasi password, cegah duplikat kategori.

---

## 🛠️ Tech Stack

| Lapisan        | Teknologi                            |
|----------------|--------------------------------------|
| Frontend       | HTML5, CSS3, Vanilla JavaScript (ES6) |
| Backend (BaaS) | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Grafik         | Chart.js CDN                         |
| Hosting        | Vercel                               |
| Email SMTP     | Resend (email profesional custom)    |

---

## 🗄️ Skema Database (Supabase)

```sql
-- Profil pengguna (melengkapi auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Kategori kustom per user
CREATE TABLE user_categories (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

-- Transaksi
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  type TEXT CHECK (type IN ('income','expense')),
  category TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Row Level Security (RLS)** – Setiap user hanya bisa melihat/mengedit data miliknya sendiri.

---

## 📁 Struktur Proyek

```
SinTrack-V2/
├── index.html       # UI utama, modal, galeri avatar
├── style.css        # Tema gelap, responsif, gaya galeri
├── script.js        # Semua logika – auth, CRUD, grafik, avatar, reset password
└── README.md        # File ini
```

---

## 🚀 Menjalankan di Lokal

### Prasyarat
- Proyek Supabase (free tier cukup)
- Server statis (disarankan VS Code Live Server)

### Langkah-langkah

1. **Clone repositori**
   ```bash
   git clone https://github.com/username/SinTrack-V2.git
   cd SinTrack-V2
   ```

2. **Setup Supabase**
   - Buat proyek baru di [supabase.com](https://supabase.com)
   - Jalankan skema SQL di atas di SQL Editor Supabase
   - Aktifkan **Email Auth** (Authentication → Providers → Email)
   - Buat bucket **public** bernama `avatars` di Storage
   - Isi **Site URL** (contoh: `http://localhost:5500` atau URL production) di Authentication → Email Templates

3. **Konfigurasi kredensial**
   - Buka `script.js`
   - Ganti `supabaseUrl` dan `supabaseKey` dengan nilai dari proyek Supabase Anda (Settings → API)

4. **Jalankan lokal**
   ```bash
   # Klik kanan index.html → "Open with Live Server" (VS Code)
   ```

5. **Registrasi & uji coba** – Buat akun, verifikasi email (atau nonaktifkan sementara), lalu mulai catat keuangan.

---

## ☁️ Deployment ke Vercel

1. Push kode ke repositori GitHub.
2. Import repo di [vercel.com](https://vercel.com).
3. Deploy – Vercel akan otomatis build dan serve file statis.
4. Update **CORS** di Supabase → API → CORS → tambahkan domain Vercel Anda (`https://nama-app-anda.vercel.app`).

---

## 📧 Konfigurasi Email (SMTP Kustom)

Agar email verifikasi dan reset password terlihat profesional:

1. Daftar di [Resend](https://resend.com) (gratis: 100 email/hari).
2. Dapatkan API key.
3. Di Supabase → Authentication → Email Templates → SMTP settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: *(API key Resend Anda)*
   - Sender email: `noreply@domainanda.com` (atau `noreply@resend.dev` untuk testing)
4. Kustomisasi template HTML email (tersedia di dalam Supabase).

---

## 🧪 Daftar Uji Coba

| Skenario uji | Hasil yang diharapkan |
|--------------|----------------------|
| Registrasi dengan email valid | Alert sukses + email verifikasi terkirim |
| Login dengan kredensial benar | Dashboard muncul, tidak ada error |
| Tambah transaksi pemasukan | Saldo bertambah, kategori nonaktif (otomatis "Pemasukan") |
| Tambah transaksi pengeluaran | Dropdown kategori aktif |
| Upload foto profil / pilih avatar emoji | Avatar langsung berubah |
| Lupa password | Email reset terkirim → ganti password → login berhasil |
| Tambah kategori duplikat | Muncul pesan error |

---

## 🤝 Kontribusi

Pull request dipersilakan. Untuk perubahan besar, harap buka issue terlebih dahulu untuk diskusi.

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat file `LICENSE` untuk informasi lebih lanjut.

---

## 👤 Penulis

**@cceasenn**  
[GitHub](https://github.com/SinSerenee) • [Live Demo](https://aplikasi-keuangan-v2.vercel.app)

> Dibuat dengan ☕ dan terminal di Linux Mint XFCE.  
> *“Keep track, stay wealthy!”*
```
