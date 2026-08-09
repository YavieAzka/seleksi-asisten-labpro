# Progress — SSO Identity & Authorization Provider

**Tugas:** Seleksi 2 Calon Asisten Laboratorium Pemrograman 2026
**Nama:** Yavie | **NIM:** 13524077
**Deadline:** Jumat, 21 Agustus 2026, 23:59 WIB
**Terakhir diupdate:** dokumen ini dibuat setelah Milestone 2 selesai

---

## 1. Ringkasan Arsitektur

Monorepo dengan 6 komponen utama:

```
sso-project/
├── auth-provider/
│   ├── server/          # Auth Provider Server (NestJS) — BELUM DIKERJAKAN
│   ├── control-panel/   # Control Panel Admin (NestJS) — SELESAI (Milestone 2)
│   └── sync-worker/     # Sync Worker (NestJS standalone) — BELUM DISCAFFOLD
├── applications/
│   ├── app-a/            # SiEks - Sistem Akademik (NestJS) — scaffolding + DB selesai
│   └── app-b/             # Edunek - LMS (NestJS) — scaffolding + DB selesai
├── infra/
│   └── postgres-init-multi-db.sh
├── docs/
│   └── PROGRESS.md (file ini)
└── docker-compose.yml
```

**Stack:**

- Bahasa: TypeScript, framework NestJS
- ORM: Prisma **v7.9.1** (breaking changes penting, lihat bagian 5)
- Database: PostgreSQL 16 (2 instance Docker: `primary-db` untuk Auth Provider, `local-db` untuk App A + App B)
- Message broker: Redis + BullMQ (rencana, belum diimplementasi — untuk Milestone 5)
- Session store Control Panel: Redis (via `connect-redis` + `express-session`)
- View engine Control Panel: EJS (server-rendered, bukan SPA)
- Token strategy: **Opaque token** (bukan JWT) — keputusan sudah final
- Tema seed data: ITB — App A = **SiEks** (terinspirasi Sixty ITB), App B = **Edunek** (terinspirasi Edunex ITB)

---

## 2. Status per Milestone

### Milestone 0-1: Infrastruktur & Fondasi — ✅ SELESAI

- Struktur monorepo lengkap
- `docker-compose.yml` jalan penuh: `primary-db`, `local-db`, `redis`, `auth-server`, `control-panel`, `app-a`, `app-b` (semua `Healthy`/`Up`)
- `sync-worker` di-**comment-out** sementara di `docker-compose.yml` (belum di-scaffold, direncanakan Milestone 5)
- Auth Provider Server: schema Prisma lengkap (11 tabel + PKCE fields + events/event_deliveries), migration jalan, seed data ITB
- App A & App B: schema Prisma (local_sessions, profile_cache, processed_events), migration jalan
- Skema database sudah divalidasi terhadap tabel acuan spesifikasi tugas (1 perbaikan: `scopes` di `access_tokens` diubah dari `String?` ke `Json?`)

### Milestone 2: Control Panel Admin — ✅ SELESAI

Modul lengkap dengan UI EJS + REST-style routes (form POST, bukan JSON API murni):

- **Auth**: login/logout admin dengan session Redis, `AuthGuard` melindungi semua route CRUD
- **Users**: CRUD lengkap + kelola keanggotaan group (assign/remove)
- **Groups**: CRUD lengkap + lihat anggota
- **Applications**: CRUD lengkap + kelola redirect URI (tambah/hapus)
- **Policies**: create/delete application-group policy
- **Dashboard**: ringkasan statistik real-time (jumlah users, groups, applications, policies) dari database

Sudah diverifikasi end-to-end lewat browser (`http://localhost:3010`), login berhasil dengan `admin@itb.ac.id` / `Admin123!`.

### Milestone 3: Central Session Server (OAuth2 + PKCE) — ⬜ BELUM DIMULAI

Akan mencakup:

- Endpoint `/login` (validasi credential, buat central session + cookie)
- Endpoint `/authorize` (validasi client_id, redirect_uri, evaluasi policy, PKCE challenge, buat authorization code)
- Endpoint `/token` (tukar code → access token, validasi PKCE verifier, tandai `used_at` atomik)
- Endpoint `/userinfo` (profil user by token)
- Endpoint revocation dasar (logout central session)
- Audit logging untuk event penting

### Milestone 4: App A & App B (Relying Applications) — ⬜ BELUM DIMULAI

- Alur login OAuth2 lengkap (redirect ke Auth Provider → callback → tukar code → local session)
- UI minimal: identitas user, status local session, activity log, daftar processed events
- Tombol logout/login, error handler standar

### Milestone 5: Event Processing (Message Queue + Sync Worker) — ⬜ BELUM DIMULAI

- Scaffold `sync-worker` (belum ada sama sekali, masih placeholder)
- Transactional outbox saat revoke session
- Sync Worker: consume queue (BullMQ), retry+backoff, Dead Letter Queue
- Event: `SessionRevoked`, `PasswordChanged`, `AccessPolicyChanged`

### Bonus (B01-B04) — ⬜ BELUM DIMULAI

Prioritas realistis kalau waktu terbatas: B03 (Liveness/Readiness) → B04 (Graceful shutdown) → B02 (Observability) → B01 (MFA/TOTP, paling memakan waktu)

---

## 3. Kredensial & Data Seed (Auth Provider — `primary-db`)

**Login admin Control Panel:**

- Email: `admin@itb.ac.id`
- Password: `Admin123!`

**User contoh (mahasiswa):**

- Email: `13524001@mahasiswa.itb.ac.id` (NIM contoh)
- Password: `Mahasiswa123!`

**Groups:** Admin, Dosen, Mahasiswa

**Applications:**

- **SiEks** — Sistem Akademik — `client_id: sieks-client` — redirect URI: `http://localhost:3001/auth/callback` — logout notification URL: `http://localhost:3001/internal/logout`
- **Edunek** — Learning Management System — `client_id: edunek-client` — redirect URI: `http://localhost:3002/auth/callback` — logout notification URL: `http://localhost:3002/internal/logout`

**Policies:** SiEks dan Edunek masing-masing bisa diakses oleh ketiga group (Admin, Dosen, Mahasiswa) — effect `allow`.

Seed script ada di `auth-provider/server/prisma/seed.ts`, jalankan dengan `npx prisma db seed` (otomatis jalan setelah `prisma migrate dev` juga, karena terdaftar di `prisma.config.mjs` dan `package.json`).

---

## 4. Port & Endpoint

| Service               | Port (host) | URL                                   |
| --------------------- | ----------- | ------------------------------------- |
| Auth Provider Server  | 3000        | http://localhost:3000                 |
| Control Panel Admin   | 3010        | http://localhost:3010                 |
| App A (SiEks)         | 3001        | http://localhost:3001                 |
| App B (Edunek)        | 3002        | http://localhost:3002                 |
| Primary DB (Postgres) | 5432        | localhost:5432 (db: `auth_provider`)  |
| Local DB (Postgres)   | 5433        | localhost:5433 (db: `app_a`, `app_b`) |
| Redis                 | 6379        | localhost:6379                        |

---

## 5. Catatan Teknis Penting (Prisma 7 & Environment)

### Prisma 7 breaking changes

Prisma yang ter-install adalah **v7.9.1**, yang punya perubahan signifikan dari versi sebelumnya:

1. **`url` di blok `datasource` di `schema.prisma` sudah tidak didukung.** Harus dihapus:
   ```prisma
   datasource db {
     provider = "postgresql"
     // url = env("DATABASE_URL")  ← DIHAPUS, tidak boleh ada
   }
   ```
2. **Wajib ada file `prisma.config.mjs`** di root tiap service, format:

   ```javascript
   import "dotenv/config";
   import { defineConfig, env } from "prisma/config";

   export default defineConfig({
     schema: "prisma/schema.prisma",
     migrations: {
       path: "prisma/migrations",
       seed: "ts-node prisma/seed.ts", // hanya di Auth Provider Server yang punya seed
     },
     datasource: {
       url: env("DATABASE_URL"),
     },
   });
   ```

   Butuh package `dotenv` sebagai dev dependency.

3. **`PrismaClient` butuh driver adapter eksplisit saat instansiasi di runtime.** `DATABASE_URL` di `prisma.config.mjs` HANYA dipakai oleh Prisma CLI (`generate`, `migrate`), BUKAN oleh aplikasi yang berjalan. Setiap kali membuat `PrismaService`, wajib:

   ```typescript
   import { PrismaClient } from "@prisma/client";
   import { PrismaPg } from "@prisma/adapter-pg";

   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   const prisma = new PrismaClient({ adapter });
   ```

   Butuh package `@prisma/adapter-pg` di-install di SETIAP service yang pakai Prisma Client (server, control-panel, app-a, app-b — nanti sync-worker juga).

4. Pola `PrismaService` NestJS yang sudah dipakai di Control Panel (dan harus direplikasi di Auth Provider Server nanti):
   ```typescript
   @Injectable()
   export class PrismaService
     extends PrismaClient
     implements OnModuleInit, OnModuleDestroy
   {
     constructor() {
       const adapter = new PrismaPg({
         connectionString: process.env.DATABASE_URL,
       });
       super({ adapter });
     }
     async onModuleInit() {
       await this.$connect();
     }
     async onModuleDestroy() {
       await this.$disconnect();
     }
   }
   ```
   Dibungkus `PrismaModule` dengan `@Global()` supaya bisa di-inject di module manapun tanpa import berulang.

### Docker build — hal yang WAJIB diperhatikan untuk service baru

Berdasarkan debugging panjang di Milestone 2, setiap kali scaffold service baru (Auth Provider Server nanti), **checklist wajib** ini harus dipastikan:

1. **`.dockerignore` harus ada** di root tiap service (sejajar `Dockerfile`), isi minimal:

   ```
   node_modules
   dist
   .env
   *.log
   npm-debug.log*
   .git
   .gitignore
   ```

   Tanpa ini, build context bisa mencapai 300+ MB dan build jadi sangat lambat (200+ detik hanya untuk transfer context).

2. **Dockerfile builder stage butuh dummy `DATABASE_URL`** sebelum `npx prisma generate`, karena `.env` sengaja tidak ikut ter-copy ke image (ada di `.dockerignore`), sehingga `prisma.config.mjs` yang pakai `dotenv/config` gagal resolve `DATABASE_URL` saat build:

   ```dockerfile
   COPY . .
   ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
   RUN npx prisma generate
   RUN npm run build
   ```

   Nilai dummy ini AMAN — hanya dipakai saat proses build (generate Prisma Client dari schema, bukan koneksi database sungguhan), dan runtime akan pakai `DATABASE_URL` asli dari `docker-compose.yml` yang meng-override.

3. **Kalau service punya folder `views/` dan/atau `public/` (server-rendered dengan EJS), WAJIB di-copy ke stage final Dockerfile:**

   ```dockerfile
   COPY --from=builder /app/views ./views
   COPY --from=builder /app/public ./public
   ```

   Ini sempat missing di Control Panel dan menyebabkan error `Failed to lookup view "login" in views directory`.

4. **`prisma.config.mjs` WAJIB ikut di-copy ke stage final juga** (bukan cuma folder `prisma/`):

   ```dockerfile
   COPY --from=builder /app/prisma.config.mjs ./
   ```

5. **`docker-compose.yml` — kalau service butuh Redis, jangan lupa `REDIS_HOST` dan `REDIS_PORT`** di block `environment:`. Ini sempat missing di `control-panel` dan menyebabkan `ECONNREFUSED 127.0.0.1:6379` (fallback ke localhost karena env var tidak ter-set).

### Environment lokal (Windows) — isu yang sudah pernah muncul & solusinya

- **Port 5432 bentrok** dengan PostgreSQL native Windows (`postgresql-x64-18` service) — kalau service itu tidak dipakai project lain, cukup `Stop-Service -Name "postgresql-x64-18"` (butuh PowerShell as Administrator). User sudah konfirmasi tidak ada project lain yang pakai Postgres native ini (website lain pakai Supabase).
- **Docker Desktop WSL2 disk sempat corrupt** karena drive `C:` penuh (sempat 0.00 GB free). Sudah diselesaikan dengan memindahkan disk image Docker Desktop ke drive `D:` lewat Settings → Resources → Advanced → Disk image location.
- **File yang di-generate lewat tool Claude kadang tidak benar-benar tersimpan ke disk lokal user** (folder `views/` dan `public/` di Control Panel sempat kosong meski sudah "diberikan" sebelumnya). Kalau ada folder/file yang hilang secara misterius, cara paling reliable adalah PowerShell heredoc (`@'...'@ | Set-Content -Encoding UTF8 path\to\file`) yang dieksekusi langsung oleh user, bukan sekadar menampilkan kode di chat.

---

## 6. Perintah Referensi Cepat

```powershell
# Jalankan seluruh stack
cd D:\Kulyeah\Seleksi-Asisten-Labpro\sso-project
docker compose up -d

# Build ulang satu service tertentu setelah ubah kode
docker compose up -d --build <nama-service>
# contoh: docker compose up -d --build control-panel

# Lihat log satu service
docker compose logs <nama-service>
docker compose logs <nama-service> --tail 50

# Migration + seed (dari dalam folder service masing-masing)
npx prisma generate
npx prisma migrate dev --name <nama_migration>
npx prisma db seed          # khusus Auth Provider Server

# Cek semua container jalan
docker compose ps
```

---

## 7. Rencana Lanjutan (Urutan Prioritas)

1. **Milestone 3 — Central Session Server**: OAuth2 Authorization Code Flow + PKCE di Auth Provider Server. Ini bagian paling krusial dan kompleks dari seluruh tugas, karena jadi inti sistem SSO.
2. **Milestone 4 — App A & App B**: implementasi sisi client dari OAuth2 flow, redirect ke Auth Provider, tukar code jadi token, buat local session.
3. **Milestone 5 — Event Processing**: scaffold `sync-worker`, BullMQ, transactional outbox, event SessionRevoked dkk.
4. **Testing end-to-end & hardening**: skenario negatif (code dipakai 2x, redirect_uri salah, token App A dipakai di App B, dll).
5. **Bonus** (kalau waktu memungkinkan): B03 → B04 → B02 → B01.
6. **README.md final, video demo, GitHub Release**.

---

## 8. Preferensi Kerja (untuk konteks percakapan lanjutan)

- Bahasa komunikasi: Indonesia, formal namun santai
- User lebih suka menerima kode dalam bentuk **blok kode langsung** (bukan file zip) karena lebih mudah diterapkan manual satu per satu
- User baru pertama kali pakai NestJS (familiar dengan Node.js dan React sebelumnya) — penjelasan konsep NestJS (module, DI, decorator) kadang masih dibutuhkan
- User sudah cukup mahir TypeScript, Prisma ORM, dan PostgreSQL
- Preferensi debugging: **instruksi satu per satu**, jangan berikan banyak langkah paralel sekaligus — ini sempat jadi keluhan eksplisit saat debugging session Redis di Milestone 2
- User mengerjakan sendirian (individual project), dengan bantuan AI, selama masa liburan dengan alokasi waktu sekitar 4-6 jam/hari
- Utamakan meminta file atau isi dari folder yang dibutuhkan kepada user terlebih dahulu jika diperlukan konteks.
