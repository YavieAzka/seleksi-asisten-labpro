# SSO Identity & Authorization Provider

> Tugas Seleksi 2 | Calon Asisten Laboratorium Pemrograman 2026
> Nama: Yavie | NIM: 13524077

## Status

🚧 Scaffolding awal | struktur monorepo, dependency inti, dan docker-compose
dasar sudah tersedia. Implementasi fitur mengikuti rencana milestone di
`docs/`.

## Struktur Monorepo

```
project-root/
├── auth-provider/
│   ├── server/          # Auth Provider Server (NestJS) | sinkron: login, OAuth2, token, userinfo
│   ├── control-panel/   # Control Panel Admin (NestJS) | CRUD user/group/aplikasi/policy
│   └── sync-worker/     # Sync Worker (NestJS standalone) | konsumsi queue, panggil /internal/logout
├── applications/
│   ├── app-a/           # Relying Application A (NestJS)
│   └── app-b/           # Relying Application B (NestJS)
├── infra/               # Script pendukung infrastruktur (init multi-db, dll.)
├── docs/                # Dokumen pendukung
└── docker-compose.yml
```

## Stack

- **Bahasa & Framework:** TypeScript + NestJS
- **ORM:** Prisma
- **Database:** PostgreSQL (dua instance: Primary DB untuk Auth Provider, Local DB untuk App A & App B)
- **Message Broker:** Redis + BullMQ
- **Token Strategy:** Opaque token (keputusan & alasan lengkap akan didokumentasikan di sini)

## Menjalankan Sistem

```bash
docker compose up
```

_(Instruksi lengkap | migration, seeding, dan URL tiap komponen | akan
dilengkapi seiring implementasi berjalan.)_

## Keputusan Teknis

_(Akan diisi bertahap: opaque vs JWT, pilihan message broker, autentikasi
service-to-service untuk `/internal/logout`, soft-delete vs hard-delete.)_

## CATATAN PENTING Cara Menjalankan Aplikasi

1. Pastikan port 3000, 3001, dan 5434 di komputer Anda tidak sedang digunakan.
2. Buka terminal di root directory proyek.
3. Jalankan perintah: `docker compose up --build`
4. Tunggu hingga semua container statusnya _healthy_.
5. Buka `http://localhost:3000` di browser.
