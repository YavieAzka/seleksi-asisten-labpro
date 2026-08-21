# **Spesifikasi Seleksi 2** **Calon Asisten Laboratorium Pemrograman 2026**

## Tim Asisten Laboratorium Pemrograman 2023

| Versi                | : 1                                    |
| :------------------- | :------------------------------------- |
| Tgl. Revisi Terakhir | : \-                                   |
| Deadline             | : **Jumat, 21 Agustus 2026 23.59 WIB** |

#

#

# **Daftar Revisi** {#daftar-revisi}

1.

# **Daftar Isi** {#daftar-isi}

[**Daftar Revisi 2**](#daftar-revisi)

[**Daftar Isi 3**](#daftar-isi)

[**Latar Belakang 5**](#latar-belakang)

[**Pengantar 7**](#pengantar)

[Model Client–Server & HTTP 7](#model-client–server-&-http)

[Stateless, Cookie, dan Session 8](#stateless,-cookie,-dan-session)

[REST API & JSON 9](#rest-api-&-json)

[Authentication vs Authorization 9](#authentication-vs-authorization)

[Password Hashing & Secret 10](#password-hashing-&-secret)

[Konsep SSO: Central vs Local Session 10](#konsep-sso:-central-vs-local-session)

[OAuth2 Authorization Code Flow & PKCE 10](#oauth2-authorization-code-flow-&-pkce)

[Token: Opaque vs JWT 12](#token:-opaque-vs-jwt)

[Policy & Authorization 12](#policy-&-authorization)

[Logout & Revocation 13](#logout-&-revocation)

[Asynchronous: Queue, Worker, Event 13](#asynchronous:-queue,-worker,-event)

[Idempotency, Retry, DLQ, & Transactional Outbox 14](#idempotency,-retry,-dlq,-&-transactional-outbox)

[**Ketentuan dan Batasan 15**](#ketentuan-dan-batasan)

[**Pengumpulan dan Deliverables 16**](#pengumpulan-dan-deliverables)

[**Demo 17**](#demo)

[**Spesifikasi Program 18**](#spesifikasi-program)

[F00 \- Arsitektur & Komponen 19](#f00---arsitektur-&-komponen)

[F01 \- Konfigurasi Dasar & Infrastruktur 20](#f01---konfigurasi-dasar-&-infrastruktur)

[F02 \- Auth Provider Platform \- Central Session Server & Control Panel 21](#f02---auth-provider-platform---central-session-server-&-control-panel)

[F04 \- Relying Applications (App A dan App B) 30](<#f04---relying-applications-(app-a-dan-app-b)>)

[F05 \- Auth Provider Platform \- Event Processing 35](#f05---auth-provider-platform---event-processing)

[**Spesifikasi BONUS 39**](#spesifikasi-bonus)

[B01 \- MFA atau WebAuthn 39](#b01---mfa-atau-webauthn)

[B02 \- Observability 40](#b02---observability)

[B03 \- Liveness dan Readiness Probe 41](#b03---liveness-dan-readiness-probe)

[B04 \- Graceful shutdown 42](#b04---graceful-shutdown)

[**Lampiran 44**](#lampiran)

[Format Error Standar 44](#format-error-standar)

[Siklus Pemrosesan Message (referensi) 44](<#siklus-pemrosesan-message-(referensi)>)

[**Referensi 45**](#referensi)

[**Extras 47**](#extras)

#

#

# **Pengantar** {#pengantar}

Anda diminta untuk membangun sebuah Identity & Authorization Provider terpusat yang mampu mengautentikasi user sekali, menyebar akses ke banyak aplikasi, serta mencabut sesi secara aman dan tahan gangguan melalui pemrosesan asinkron. Untuk membantu kalian dalam mengerjakan tugas seleksi ini, berikut adalah materi pengantar yang dapat membantu kalian lebih memahami web development.

## **Model Client–Server & HTTP** {#model-client–server-&-http}

Web bekerja dengan model client–server. Client (biasanya browser) yang berasal dari device user mengirim request, server memproses lalu mengirim response. Keduanya berkomunikasi memakai protokol HTTP (atau HTTPS \= HTTP dengan enkripsi TLS). Satu HTTP request terdiri dari: method, path/URL, sekumpulan header (metadata), dan opsional body. Contoh request mentah:

| `POST /login HTTP/1.1 Host: auth.example.com Content-Type: application/json Cookie: sid=abc123 { "email": "user@example.com", "password": "rahasia" }` |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- |

Server membalas dengan status code, header, dan body:

| `HTTP/1.1 200 OK Content-Type: application/json Set-Cookie: sid=xY9...; HttpOnly; Secure; SameSite=Lax { "user": { "email": "user@example.com" } }` |
| :-------------------------------------------------------------------------------------------------------------------------------------------------- |

HTTP Method yang penting

| Method | Fungsi                                     |
| ------ | ------------------------------------------ |
| GET    | Membaca resource                           |
| POST   | Membuat resource (atau trigger suatu aksi) |
| PUT    | Mengubah resource                          |
| PATCH  | Mengubah sebagian resource                 |
| DELETE | Menghapus resource                         |

Status Code

| Kode | Arti         | Contoh                                          |
| ---- | ------------ | ----------------------------------------------- |
| 2xx  | Success      | 200 OK, 201 Created, 204 No Content             |
| 3xx  | Redirect     | 302 Found (mengarahkan browser ke redirect_uri) |
| 4xx  | Client Error | 401 Unauthorized, 403 Forbidden, 404 Not Found  |
| 5xx  | Server Error | 500 Internal Server Error, 502 Bad Gateway      |

## **Stateless, Cookie, dan Session** {#stateless,-cookie,-dan-session}

HTTP bersifat stateless, server tidak "mengingat" request sebelumnya sehingga tidak bisa mengetahui suatu request berasal dari pengguna yang sudah terautentikasi. Oleh karena itu, situs mengetahui penggunanya sudah melakukan login menggunakan cookie \+ session. Setelah login sukses, server membuat session dan menyimpannya di sisi server (misal tabel sessions atau in-memory store). Session punya session ID yang opaque (nilai acak tanpa makna). Server mengirim ID itu ke browser lewat header Set-Cookie. Pada setiap request berikutnya ke domain yang sama, browser otomatis menyertakan cookie tersebut. Server memakai ID untuk mencari session dan mengenali user.

Atribut cookie penting

| Atribut         | Fungsi                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HttpOnly        | Jika true, cookie tidak bisa dibaca JavaScript untuk melindungi dari eksploitasi XSS.                                                                        |
| Secure          | Jika true, cookie hanya dikirim lewat HTTPS.                                                                                                                 |
| SameSite        | Strict/Lax/None, mengatur apakah cookie ikut terkirim pada request cross-site, penting dalam pertahanan CSRF dan penentu apakah redirect SSO membawa cookie. |
| Expires/Max-Age | Kapan cookie expired di browser.                                                                                                                             |
| Domain/Path     | Ruang lingkup pengiriman cookie.                                                                                                                             |

## **REST API & JSON** {#rest-api-&-json}

REST API adalah metode perancangan endpoint HTTP di sekitar resource (misalnya users, applications). Data dipertukarkan umumnya sebagai JSON. Contoh: GET /applications mengembalikan daftar aplikasi, POST /applications membuat aplikasi baru. Dua channel komunikasi yang penting dibedakan:

1. Browser channel (front channel): lewat browser user: redirect, cookie, halaman UI.
2. Back channel: komunikasi langsung server-ke-server tanpa melewati browser. Misalnya menukar code menjadi token, atau Sync Worker memanggil endpoint internal aplikasi.

## **Authentication vs Authorization** {#authentication-vs-authorization}

- Authentication (AuthN) adalah proses memverifikasi identitas suatu principal, yang dapat berupa user, device, service, atau aplikasi berdasarkan credential atau bukti yang dimilikinya. Dalam penggunaan umum, authentication sering dijelaskan sebagai **“Who are you?”**, misalnya dengan memverifikasi token atau session yang diperoleh setelah proses login.
- Authorization (AuthZ) \= **"What can you do?"**. Memutuskan hak akses (misal apakah user boleh membuka App A).

Keduanya berbeda dan diuji terpisah. Login yang berhasil (AuthN sukses) tidak berarti boleh mengakses semua aplikasi (AuthZ bisa saja menolak).

## **Password Hashing & Secret** {#password-hashing-&-secret}

Password tidak pernah disimpan sebagai plain text. Simpan hash-nya menggunakan algoritma password hashing & ber-salt seperti bcrypt, argon2, atau scrypt (yang paling disarankan sekarang argon2id karena memory hard (susah di paralelisasi), tapi tidak diwajibkan dipakai pada tugas ini, hanya informasi). Saat login, input di-hash lalu dibandingkan dengan hash tersimpan.

- Salt: nilai acak unik per user agar dua password identik menghasilkan hash berbeda dan aman dari rainbow table.
- Client secret: kredensial rahasia milik aplikasi confidential (backend). Disimpan sebagai secret (idealnya hash), tidak pernah masuk ke frontend. Nilai sensitif lain (session token, authorization code, access token) juga sebaiknya disimpan sebagai hash di database. Nilai mentahnya hanya berada di cookie.

## **Konsep SSO: Central vs Local Session** {#konsep-sso:-central-vs-local-session}

Single Sign-On (SSO) memungkinkan user login sekali di Auth Provider, lalu membuka beberapa aplikasi tanpa memasukkan password lagi. Inti SSO adalah adanya dua tingkat session:

1. Central session milik Auth Provider. Bukti bahwa sudah login yang dipakai bersama lintas aplikasi.
2. Local session milik masing-masing aplikasi (App A, App B) setelah callback berhasil. Cookie & penyimpanan berbeda per aplikasi.

## **OAuth2 Authorization Code Flow & PKCE** {#oauth2-authorization-code-flow-&-pkce}

App memperoleh identitas user dari Auth Provider secara aman melalui Authorization Code Flow. Pada dasarnya, browser hanya membawa sebuah authorization code sekali pakai berumur pendek. Penukaran code menjadi token dilakukan di back channel (server-ke-server) sehingga token tidak pernah bocor ke URL/browser.

![][image1]

Elemen-elemen penting:

- state, nilai acak yang dibuat App sebelum redirect dan divalidasi saat callback. Mencegah CSRF pada alur login dan mengikat callback ke request yang benar.
- redirect_uri, alamat callback aplikasi. Harus di-exact match dengan yang terdaftar (bukan pencocokan prefix) untuk mencegah open redirect.
- PKCE (Proof Key for Code Exchange): App membuat code_verifier acak, mengirim code_challenge \= hash(code_verifier) saat /authorize, lalu mengirim code_verifier asli saat /token. Auth Provider memverifikasi keduanya cocok. Ini mencegah code yang dicuri ditukar oleh pihak lain.
- Authorization code, kode acak, sekali pakai, TTL pendek (disarankan 2–5 menit), terikat pada aplikasi \+ redirect_uri \+ user \+ central session \+ PKCE challenge. Penukaran & penandaan used_at harus atomik untuk mencegah race/replay.

## **Token: Opaque vs JWT** {#token:-opaque-vs-jwt}

Setelah menukar code, App memperoleh access token untuk memanggil /userinfo. Ada dua strategi, Anda bebas memilih salah satu tetapi wajib menjelaskan konsekuensinya:

| Strategi     | Cara Kerja                                                                              |
| :----------- | :-------------------------------------------------------------------------------------- |
| Opaque token | Token adalah nilai acak. Validasi via lookup/introspection ke DB                        |
| JWT token    | Token adalah data dengan signature (self-contained). Validasi via verifikasi signature. |

Apapun strateginya, token minimal punya: subject (user), audience/client, expiry, dan hubungan ke session. Token hanya valid untuk client_id aplikasi yang menerimanya.

## **Policy & Authorization** {#policy-&-authorization}

Policy adalah aturan yang menentukan boleh/tidaknya user mengakses aplikasi. Contoh aturan minimal (semua harus terpenuhi untuk ALLOW):

| `ALLOW jika:     user.status == active AND application.status == active AND redirect_uri exact-match AND user memiliki group yang di-assign ke application AND central session valid (saat authorization) Selain itu: DENY + terbitkan event PolicyDenied` |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## **Logout & Revocation** {#logout-&-revocation}

Revocation artinya mencabut session/token sehingga tidak lagi dianggap valid. Ada dua jenis logout yang perilakunya berbeda:

1. Logout App, hanya menghapus satu local session (aplikasi tempat menekan logout). Central session & aplikasi lain tetap aktif.
2. SSO Logout, mencabut central session, lalu meng-invalidasi seluruh local session aplikasi terkait. Central cookie dibersihkan segera, aplikasi diberi tahu secara asinkron.

Back-channel logout: Auth Provider (via Sync Worker) memanggil endpoint internal aplikasi (POST /internal/logout) untuk menghapus local session tanpa melalui browser user.

## **Asynchronous: Queue, Worker, Event** {#asynchronous:-queue,-worker,-event}

Dalam SSO, Auth Provider dan aplikasi memiliki session yang berbeda. Auth Provider menyimpan central session, sedangkan App A dan App B masing-masing menyimpan local session. Karena itu, mencabut central session saja belum otomatis menghapus session yang sudah dibuat oleh setiap aplikasi.

Ketika user melakukan Logout SSO atau mengganti password, Auth Provider harus memberi tahu semua aplikasi agar local session user ikut dihapus. Cara paling sederhana adalah memanggil App A dan App B langsung dari endpoint. Masalahnya, proses tersebut dapat memakan waktu. Jika App A memerlukan 2 detik dan App B sedang tidak tersedia, endpoint harus menunggu atau gagal. Semakin banyak aplikasi, semakin lama dan rapuh response endpoint.

Queue dan worker memisahkan pekerjaan lanjutan dari pekerjaan utamanya. Auth Provider lebih dahulu mencabut session dan menyimpan pesan ke queue. Setelah pesan tersimpan, endpoint dapat segera memberi response. Sync Worker mengambil pesan tersebut di belakang layar, lalu memberi tahu App A dan App B secara terpisah. Jika salah satu aplikasi gagal, worker dapat mencoba lagi tanpa menghambat aplikasi lain dan tanpa meminta user mengulang logout.

| `Tanpa worker: User → /logout → tunggu App A → tunggu App B → response                          App lambat/mati = response ikut lambat/gagal`                                                                                                                                            |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dengan queue dan worker: User → /logout → revoke session → simpan event ke queue → response                                       ↓                                  Sync Worker                                   ├─→ App A logout                                   └─→ App B logout` |

## **Idempotency, Retry, DLQ, & Transactional Outbox** {#idempotency,-retry,-dlq,-&-transactional-outbox}

Sistem asinkron mengasumsikan pengiriman at-least-once (pesan bisa datang lebih dari sekali). Karena itu:

- Idempotent, operasi yang aman diproses berulang tanpa efek ganda. Contoh: menghapus session yang sudah terhapus tetap berakhir "terhapus". Gunakan idempotency key (mis. eventId) untuk mendeteksi duplikat.
- Retry, mencoba ulang otomatis ketika gagal karena gangguan sementara.
- Backoff, jeda yang membesar antar percobaan agar target tidak dibanjiri.
- Dead-Letter Queue (DLQ), antrean khusus untuk pesan yang tetap gagal setelah batas retry, agar bisa diperiksa/diproses ulang.
- Transactional Outbox, perubahan session dan penulisan baris events dilakukan dalam satu transaksi database. Sebuah publisher terpisah kemudian membaca event dengan published_at \= null, mengirimnya ke queue, lalu mengisi published_at setelah broker mengonfirmasi. Ini menjamin session tidak mungkin sudah dicabut sementara pekerjaan logout hilang hanya karena queue sedang tidak tersedia.

  #

  # **Ketentuan dan Batasan** {#ketentuan-dan-batasan}

  Folder terpusat: [Public](https://drive.google.com/drive/folders/185jr5wYGO1x1afJunBrSoGvkHfdaHtgh?usp=sharing)

1. Penggunaan AI tidak disarankan; apabila digunakan, gunakan secara bertanggung jawab. Anda tetap wajib memahami seluruh solusi yang dikumpulkan. **Pemahaman, keputusan teknis, dan kualitas kode akan diuji serta diperiksa secara langsung oleh asisten**.
2. Pengerjaan dilakukan secara mandiri dan individual. Setiap mahasiswa bertanggung jawab atas analisis, implementasi, pengujian, dokumentasi, dan demonstrasi sistemnya.
3. Segala jenis plagiarisme terhadap sesama peserta seleksi atau dalam bentuk apapun dapat menyebabkan diskualifikasi sebagai peserta.
4. UI tidak dinilai secara visual dan estetika. Yang dinilai adalah fungsionalitas UI dan keberhasilan alurnya (flow). Meski begitu, UI tetap harus intuitif agar mudah digunakan, diuji, dan didemonstrasikan.
5. Gunakan monorepo dengan pembagian folder berdasarkan komponen atau domain.
6. Anda hanya diperbolehkan menggunakan bahasa pemrograman Python, Typescript, dan/atau Go. Framework dan library dibebaskan.
7. Seluruh stack wajib dapat dijalankan dengan satu perintah melalui docker-compose.yml yang mencakup: Auth Provider, App A, App B, Sync Worker, Primary DB, Local DB, dan message broker.
8. Menggunakan relational database, seperti MySQL, PostgreSQL, MariaDB. Diwajibkan untuk menggunakan ORM (Object Relational Mapper) dan membuat automasi seeding dan migration agar mempermudah aplikasi ketika dijalankan.

   # **Pengumpulan dan Deliverables** {#pengumpulan-dan-deliverables}

9. Batas akhir pengerjaan adalah **Jumat, 21 Agustus 2026 pada jam 23.59 WIB**
10. Pengumpulan dilakukan melalui link yang akan diberikan di kemudian hari (maksimal H-6 sebelum tanggal deadline). Pastikan untuk mempersiapkan:
    1. Link GitHub Release
    2. Link Video Demo
11. Repository di-public setelah pengumpulan, maksimum sehari setelah deadline.
12. Wajib membuat README.md pada repository. Penjelasan mencakup:
    1. Identitas: Nama dan NIM;
    2. Cara menjalankan sistem (langkah docker compose up, migration, seed, dan URL tiap komponen);
    3. Arsitektur & alur;
    4. Keputusan teknis: pilihan token (opaque/JWT) \+ konsekuensinya, pilihan message broker, mekanisme autentikasi service-to-service untuk /internal/logout, serta pilihan soft-delete vs hard-delete;
    5. Technology stack beserta versi;
    6. Daftar endpoint yang dibuat;
    7. Bonus yang dikerjakan (bila ada);
    8. Screenshot.
13. Segala bentuk pertanyaan dapat ditanyakan melalui [link QnA](https://docs.google.com/spreadsheets/d/1DDlCBz7j8lzei2ksl7WFM4kErqKUA5aPN5ZGeYj2VJc/edit?usp=sharing)

    #

# **Demo** {#demo}

Demonstrasi program dilakukan secara mandiri dalam bentuk video yang menampilkan rekaman layar dan suara pribadi ketika menjelaskan. Spesifikasi dan aturan lengkap mengenai video akan diberikan di kemudian hari (maksimal H-6 sebelum tanggal deadline). Pengumpulan link video melalui [Pengumpulan dan Deliverables](https://docs.google.com/document/d/1m2LO0OPabMkv1HMuSJIyzCY290-mhRxsoLh3feJqiw4/edit?pli=1&tab=t.8q8083cuyoqc#heading=h.rxm5c6p3rhj).

#

# **Spesifikasi Program** {#spesifikasi-program}

Anda diminta untuk membangun sebuah **Identity & Authorization Provider terpusat** yang mampu mengautentikasi user sekali, menyebar akses ke banyak aplikasi, serta mencabut sesi secara aman dan tahan gangguan melalui pemrosesan asinkron. Berikut gambaran interaksinya:

##

## **F00 \- Arsitektur & Komponen** {#f00---arsitektur-&-komponen}

Anda diminta untuk membuat dua sistem yang memiliki tanggung jawabnya masing-masing.

1. **Auth Provider Platform**  
   Auth Provider Platform berperan sebagai control panel admin terhadap data user dan sebagai pusat identitas yang:

- Memverifikasi pengguna
- Memelihara central session
- Mengevaluasi policy akses
- Menerbitkan authorization code
- Menerbitkan access token
- Menyediakan informasi profil user pada aplikasi
- Mencabut session ketika terjadi logout atau perubahan keamanan  
  Auth Provider Platform **memiliki komponen sinkron dan asinkron**. Komponen sinkron menangani autentikasi, authorization, policy, central session, dan token. Komponen asinkron terdiri atas Message Queue dan Sync Worker yang bertugas menyebarkan pencabutan session ke seluruh aplikasi secara andal tanpa menghambat alur utama.

2. **Relying Applications (App A dan App B)** mewakili aplikasi yang mempercayakan autentikasinya kepada Auth Provider dan hanya memelihara local session masing-masing.

Seluruh sistem wajib dibuat dalam satu struktur **monorepo**. struktur minimum monorepo yang disarankan:

`project-root/`  
`├── auth-provider/`  
`│   ├── server/`  
`│   ├── control-panel/`  
`│   └── sync-worker/`  
`├── applications/`  
`│   ├── app-a/`  
`│   └── app-b/`  
`├── docs/`  
`├── docker-compose.yml`  
`└── README.md`

## **F01 \- Konfigurasi Dasar & Infrastruktur** {#f01---konfigurasi-dasar-&-infrastruktur}

Siapkan konfigurasi dasar untuk seluruh service, database, dan message broker. Proses pengembangan tidak wajib berlangsung di dalam container, tetapi hasil akhir wajib diverifikasi menggunakan Docker Compose.

Disarankan menggunakan ORM dan framework atau library untuk memudahkan pengembangan tugas.

Satu perintah berikut harus dapat menjalankan seluruh sistem:

| `docker compose up` |
| :------------------ |

Service minimum yang harus dapat dijalankan:

- Auth Provider Server
- Control Panel Admin
- App A
- App B
- Sync Worker
- Database
- Message broker

Setiap service harus memiliki konfigurasi environment yang terdokumentasi. Password database, client secret, signing key, dan secret lainnya tidak boleh ditulis langsung di dalam source code atau di-commit ke repository.

Auth Provider Server, App A, App B, dan Sync Worker disarankan memiliki health check agar kondisi setiap service dapat diperiksa.

## **F02 \- Auth Provider Platform \- Central Session Server & Control Panel** {#f02---auth-provider-platform---central-session-server-&-control-panel}

    Di dalam Auth Provider Platform terdapat beberapa komponen, yaitu Central Session Server, Control Panel Admin, dan Event Processing. Pada bagian ini fokus berada pada komponen sinkron Auth Provider Platform.

Admin dapat membuat user dan menentukan apakah user tersebut boleh masuk ke App A, App B, atau keduanya. Pemrosesan asinkron belum menjadi fokus bagian ini.

**Control Panel Admin**  
Control Panel Admin harus menyediakan fungsi berikut:

- Administrator dapat membuat, melihat, memperbarui, mengaktifkan, dan menonaktifkan user.
- Data minimum user terdiri atas nama, email, dan password.
- Administrator dapat membuat dan mengelola group.
- Data minimum group terdiri atas nama group.
- Administrator dapat memasukkan user ke dalam satu atau lebih group.
- Administrator dapat mendaftarkan App A dan App B beserta konfigurasi client masing-masing.
- Konfigurasi minimum aplikasi terdiri atas nama aplikasi, client_id, dan redirect_uri.
- Administrator dapat menentukan group yang diperbolehkan mengakses setiap aplikasi.
- Administrator dapat melihat status user, keanggotaan group, daftar aplikasi, dan policy aplikasi.
- Password user harus disimpan dalam bentuk hash yang aman dan tidak boleh disimpan sebagai plaintext.

**Central Session Server**  
Central Session Server harus menyediakan fungsi berikut:

- Memvalidasi credential user.
- Membuat dan memelihara central session setelah login berhasil.
- Mengevaluasi apakah user aktif dan memiliki akses ke aplikasi yang diminta.
- Memvalidasi client_id aplikasi.
- Memvalidasi apakah redirect_uri terdaftar untuk aplikasi tersebut.
- Menolak permintaan apabila redirect_uri tidak valid.
- Menerbitkan authorization code yang berumur pendek dan hanya dapat digunakan satu kali.
- Menukar authorization code yang valid menjadi access token.
- Menyediakan informasi profil user pada aplikasi melalui endpoint user information.
- Mencabut session ketika user logout, mengganti password, dinonaktifkan oleh admin, atau kehilangan hak akses akibat perubahan policy.

Berikut Acuan Tabel yang ada (bisa berbeda):

**Tabel users**

Tabel users menjadi sumber utama identitas dan credential user.

| Kolom         | Tipe Data yang Disarankan | Wajib | Keterangan                                                   |
| :------------ | :------------------------ | :---- | :----------------------------------------------------------- |
| id            | UUID                      | Ya    | Primary key dan identifier unik user.                        |
| name          | VARCHAR                   | Ya    | Nama user yang ditampilkan di aplikasi.                      |
| email         | VARCHAR                   | Ya    | Email user, digunakan untuk login, dan harus unik.           |
| password_hash | VARCHAR                   | Ya    | Hash password menggunakan algoritma hash password yang aman. |
| status        | ENUM/VARCHAR              | Ya    | Status user, minimal active atau inactive.                   |
| created_at    | TIMESTAMP                 | Ya    | Waktu user dibuat.                                           |
| updated_at    | TIMESTAMP                 | Ya    | Waktu user terakhir diperbarui.                              |

**Aturan:** email harus unik. Password tidak boleh disimpan sebagai plaintext. User berstatus inactive tidak boleh login atau memperoleh akses baru ke aplikasi.

**Tabel groups**

Tabel groups menyimpan kelompok yang digunakan untuk mengatur hak akses user.

| Kolom       | Tipe Data yang Disarankan | Wajib | Keterangan                             |
| :---------- | :------------------------ | :---- | :------------------------------------- |
| id          | UUID                      | Ya    | Primary key dan identifier unik group. |
| name        | VARCHAR                   | Ya    | Nama group dan harus unik.             |
| description | TEXT                      | Tidak | Penjelasan fungsi group.               |
| created_at  | TIMESTAMP                 | Ya    | Waktu group dibuat.                    |
| updated_at  | TIMESTAMP                 | Ya    | Waktu group terakhir diperbarui.       |

Contoh group adalah app-a-users, app-b-users, students, atau administrators.

**Tabel user_groups**

Tabel user_groups merupakan relasi many-to-many antara user dan group.

| Kolom      | Tipe Data yang Disarankan | Wajib | Keterangan                              |
| :--------- | :------------------------ | :---- | :-------------------------------------- |
| id         | UUID                      | Ya    | Primary key dan identifier unik relasi. |
| user_id    | UUID                      | Ya    | Foreign key ke users.id.                |
| group_id   | UUID                      | Ya    | Foreign key ke groups.id.               |
| created_at | TIMESTAMP                 | Ya    | Waktu user dimasukkan ke group.         |

**Aturan:** kombinasi user_id dan group_id harus unik. Satu user dapat menjadi anggota lebih dari satu group, dan satu group dapat memiliki banyak user.

**Tabel applications**

Tabel applications menyimpan konfigurasi App A dan App B sebagai client dari Auth Provider.

| Kolom                   | Tipe Data yang Disarankan | Wajib | Keterangan                                                 |
| :---------------------- | :------------------------ | :---- | :--------------------------------------------------------- |
| id                      | UUID                      | Ya    | Primary key dan identifier unik aplikasi.                  |
| name                    | VARCHAR                   | Ya    | Nama aplikasi.                                             |
| client_id               | VARCHAR                   | Ya    | Identifier client dan harus unik.                          |
| client_secret_hash      | VARCHAR                   | Tidak | Hash client secret jika autentikasi client menggunakannya. |
| status                  | ENUM/VARCHAR              | Ya    | Status aplikasi, minimal active atau inactive.             |
| launch_url              | TEXT                      | Tidak | Alamat halaman awal aplikasi.                              |
| logout_notification_url | TEXT                      | Ya    | Endpoint internal aplikasi untuk mencabut local session.   |
| created_at              | TIMESTAMP                 | Ya    | Waktu aplikasi dibuat.                                     |
| updated_at              | TIMESTAMP                 | Ya    | Waktu aplikasi terakhir diperbarui.                        |

**Aturan:** App A dan App B harus memiliki client_id yang berbeda. Aplikasi berstatus inactive tidak boleh memulai authorization flow atau menukar authorization code.

**Tabel application_redirect_uris**

Tabel ini menyimpan daftar callback URL yang diizinkan untuk setiap aplikasi.

| Kolom          | Tipe Data yang Disarankan | Wajib | Keterangan                                    |
| :------------- | :------------------------ | :---- | :-------------------------------------------- |
| id             | UUID                      | Ya    | Primary key dan identifier unik redirect URI. |
| application_id | UUID                      | Ya    | Foreign key ke applications.id.               |
| redirect_uri   | TEXT                      | Ya    | Callback URL yang diizinkan.                  |
| created_at     | TIMESTAMP                 | Ya    | Waktu redirect URI didaftarkan.               |

**Aturan:** Auth Provider hanya boleh mengirim authorization code ke redirect_uri yang terdaftar dan cocok secara tepat. Satu aplikasi dapat memiliki beberapa redirect URI.

**Tabel application_group_policies**

Tabel ini menghubungkan aplikasi dengan group dan menentukan group yang diperbolehkan mengakses setiap aplikasi.

| Kolom          | Tipe Data yang Disarankan | Wajib | Keterangan                              |
| :------------- | :------------------------ | :---- | :-------------------------------------- |
| id             | UUID                      | Ya    | Primary key dan identifier unik policy. |
| application_id | UUID                      | Ya    | Foreign key ke applications.id.         |
| group_id       | UUID                      | Ya    | Foreign key ke groups.id.               |
| effect         | ENUM/VARCHAR              | Ya    | Efek policy, minimal mendukung allow.   |
| created_at     | TIMESTAMP                 | Ya    | Waktu policy dibuat.                    |

**Aturan:** kombinasi application_id, group_id, dan effect harus unik.

**Evaluasi Group Policy**

1. Auth Provider mencari aplikasi berdasarkan client_id.
2. Auth Provider memastikan aplikasi berstatus active.
3. Auth Provider memastikan redirect_uri terdaftar.
4. Auth Provider memastikan user berstatus active.
5. Auth Provider mengambil seluruh group milik user.
6. Auth Provider mencari policy allow yang menghubungkan salah satu group user dengan aplikasi tujuan.
7. Jika policy ditemukan, authorization code dapat diterbitkan. Jika tidak, akses ditolak dan aktivitas PolicyDenied dicatat.

**Tabel sso_sessions**

Tabel sso_sessions menyimpan central session milik Auth Provider. Central session memungkinkan user mengakses beberapa aplikasi tanpa memasukkan password kembali.

| Kolom              | Tipe Data yang Disarankan | Wajib | Keterangan                                       |
| :----------------- | :------------------------ | :---- | :----------------------------------------------- |
| id                 | UUID                      | Ya    | Primary key dan identifier unik central session. |
| user_id            | UUID                      | Ya    | Foreign key ke user pemilik session.             |
| session_token_hash | VARCHAR                   | Ya    | Hash token session yang dikirim melalui cookie.  |
| status             | ENUM/VARCHAR              | Ya    | Status active, expired, atau revoked.            |
| created_at         | TIMESTAMP                 | Ya    | Waktu central session dibuat.                    |
| expires_at         | TIMESTAMP                 | Ya    | Waktu central session kedaluwarsa.               |
| last_activity_at   | TIMESTAMP                 | Tidak | Waktu aktivitas terakhir.                        |
| revoked_at         | TIMESTAMP                 | Tidak | Waktu session dicabut.                           |
| revoke_reason      | VARCHAR                   | Tidak | Alasan pencabutan session.                       |
| ip_address         | VARCHAR                   | Tidak | Alamat IP saat login untuk audit.                |
| user_agent         | TEXT                      | Tidak | Informasi browser atau perangkat.                |

**Session valid apabila:** user masih aktif, status session active, waktu expires_at belum terlewati, dan revoked_at masih kosong.

**Tabel authorization_codes**

Tabel ini menyimpan authorization code sementara sebelum ditukar menjadi access token.

| Kolom          | Tipe Data yang Disarankan | Wajib | Keterangan                                         |
| :------------- | :------------------------ | :---- | :------------------------------------------------- |
| id             | UUID                      | Ya    | Primary key dan identifier unik record.            |
| code_hash      | VARCHAR                   | Ya    | Hash authorization code.                           |
| user_id        | UUID                      | Ya    | User pemilik authorization code.                   |
| application_id | UUID                      | Ya    | Aplikasi tujuan authorization code.                |
| sso_session_id | UUID                      | Ya    | Central session yang menerbitkan code.             |
| redirect_uri   | TEXT                      | Ya    | Redirect URI yang digunakan saat authorization.    |
| created_at     | TIMESTAMP                 | Ya    | Waktu code dibuat.                                 |
| expires_at     | TIMESTAMP                 | Ya    | Waktu code kedaluwarsa.                            |
| used_at        | TIMESTAMP                 | Tidak | Waktu code digunakan; kosong jika belum digunakan. |

**Aturan:** authorization code hanya dapat digunakan satu kali. Code harus ditolak jika kedaluwarsa, sudah digunakan, client tidak cocok, redirect URI tidak cocok, atau central session sudah tidak valid.

**Tabel access_tokens**

Tabel ini menyimpan metadata access token yang diterbitkan oleh Auth Provider.

| Kolom               | Tipe Data yang Disarankan | Wajib | Keterangan                               |
| :------------------ | :------------------------ | :---- | :--------------------------------------- |
| id                  | UUID                      | Ya    | Primary key dan identifier unik token.   |
| token_hash atau jti | VARCHAR                   | Ya    | Hash opaque token atau identifier JWT.   |
| user_id             | UUID                      | Ya    | User pemilik token.                      |
| application_id      | UUID                      | Ya    | Aplikasi tujuan atau audience token.     |
| sso_session_id      | UUID                      | Ya    | Central session asal token.              |
| scopes              | JSON/TEXT                 | Tidak | Daftar izin yang diberikan kepada token. |
| status              | ENUM/VARCHAR              | Ya    | Status active, expired, atau revoked.    |
| issued_at           | TIMESTAMP                 | Ya    | Waktu token diterbitkan.                 |
| expires_at          | TIMESTAMP                 | Ya    | Waktu token kedaluwarsa.                 |
| revoked_at          | TIMESTAMP                 | Tidak | Waktu token dicabut.                     |

**Aturan:** token harus terikat pada aplikasi tujuan. Token App A tidak boleh digunakan sebagai token untuk App B.

**Tabel audit_logs**

Tabel ini menyimpan catatan aktivitas penting untuk kebutuhan audit dan penelusuran masalah.

| Kolom          | Tipe Data yang Disarankan | Wajib | Keterangan                                     |
| :------------- | :------------------------ | :---- | :--------------------------------------------- |
| id             | UUID                      | Ya    | Primary key dan identifier unik audit log.     |
| event_type     | VARCHAR                   | Ya    | Jenis aktivitas yang terjadi.                  |
| actor_id       | UUID                      | Tidak | Admin atau user yang melakukan tindakan.       |
| user_id        | UUID                      | Tidak | User yang menjadi target tindakan.             |
| application_id | UUID                      | Tidak | Aplikasi yang terkait.                         |
| session_id     | UUID                      | Tidak | Session yang terkait.                          |
| result         | VARCHAR                   | Ya    | Hasil aktivitas, misalnya success atau failed. |
| metadata       | JSON                      | Tidak | Data tambahan yang aman untuk dicatat.         |
| ip_address     | VARCHAR                   | Tidak | Alamat IP pemanggil.                           |
| created_at     | TIMESTAMP                 | Ya    | Waktu aktivitas terjadi.                       |

Aktivitas minimum yang dicatat meliputi login berhasil, login gagal, akses ditolak, authorization code diterbitkan, token diterbitkan, logout, perubahan password, perubahan user, perubahan group, dan perubahan policy.

## **F04 \- Relying Applications (App A dan App B)** {#f04---relying-applications-(app-a-dan-app-b)}

App A dan App B **tidak menyimpan credential user**. Identitas diperoleh dari Auth Provider, sementara aplikasi hanya menyimpan local session dan profile cache untuk kebutuhan operasionalnya.

**Alur Login**

1. Aplikasi mengarahkan browser ke Auth Provider.
2. Auth Provider memeriksa central session dan policy.
3. Apabila user belum login, Auth Provider menampilkan proses login.
4. Auth Provider mengarahkan browser ke callback aplikasi dengan authorization code.
5. Backend aplikasi memvalidasi state.
6. Backend aplikasi menukar authorization code menjadi access token melalui komunikasi server-to-server.
7. Backend aplikasi meminta identitas user melalui endpoint user information.
8. Backend aplikasi membuat local session.
9. Aplikasi menampilkan Hello, \<nama user\>.

_Identitas user tidak sebaiknya dikirim langsung sebagai data tepercaya melalui callback browser. Callback membawa authorization code, sedangkan backend memperoleh identitas user dari Auth Provider setelah code berhasil ditukar._

**Frontend Aplikasi**  
App A dan App B memiliki tampilan yang sepenuhnya dibebaskan berdasarkan kreativitas kalian, tetapi minimal memiliki komponen berikut:

- Identitas user yang sedang login. Misal `Hello, <nama user>` beserta data identitas yang diperoleh dari endpoint user information. Pastikan juga bahwa data ini berasal dari Auth Provider melalui profile cache, bukan credential yang disimpan aplikasi.
- Indikator aplikasi dan status local session. Penanda aplikasi mana yang sedang dibuka (Seperti tampilan judul besar di atas bertuliskan “APP A”) dan status local session saat ini (active, expired, atau revoked) lengkap dengan waktu dibuat dan waktu kedaluwarsa.
- Activity Log. Daftar log/peristiwa yang telah dilalui aplikasi. Misal pengalihan ke Auth Provider, penerimaan authorization code di callback, pengambilan identitas melalui endpoint user information, hingga pembuatan local session. Sertakan waktu dan, bila tersedia, correlation/request id.
- Daftar processed events. Tampilan dari tabel processed_events milik aplikasi: event id, jenis event (misalnya SessionRevoked, PasswordChanged, atau AccessPolicyChanged), waktu diproses, dan tindakan yang diambil (misalnya “local session dihapus”).
- Tombol Logout. Tombol yang akan digunakan untuk melakukan local logout yang mengakhiri local session aplikasi terkait. Tombol logout SSO (global) berada pada page Auth Provider.
- Tombol atau halaman Login. Ketika belum ada local session yang valid, tampilkan tombol untuk memulai login yang memicu authorization flow ke Auth Provider.
- Error handler. Ketika terjadi error (misal authorization code tidak valid), tampilkan pesan yang dapat dipahami user tanpa membocorkan detail sensitif, mengikuti format error standar.

**Penyimpanan Lokal**  
Setiap aplikasi hanya menyimpan:

- Local session milik aplikasi.
- Profile cache seperlunya.
- Referensi user dari Auth Provider.

Setiap aplikasi tidak boleh menyimpan:

- Password user.
- Password hash user.
- Credential utama user.
- Authorization code yang sudah digunakan.

Local session App A dan App B harus saling independen.

**Tabel local_sessions**

Tabel ini berada pada penyimpanan masing-masing aplikasi. Local session dibuat setelah backend aplikasi berhasil menukar authorization code, memperoleh identitas user, dan menyelesaikan proses callback.

| Kolom              | Tipe Data yang Disarankan | Wajib       | Keterangan                                                           |
| :----------------- | :------------------------ | :---------- | :------------------------------------------------------------------- |
| id                 | UUID                      | Ya          | Primary key dan identifier unik local session.                       |
| session_token_hash | VARCHAR                   | Ya          | Hash token session dari cookie browser.                              |
| external_user_id   | UUID/VARCHAR              | Ya          | Identifier user yang berasal dari Auth Provider.                     |
| central_session_id | UUID/VARCHAR              | Ya          | Identifier central session asal local session.                       |
| application_id     | UUID/VARCHAR              | Kondisional | Wajib jika beberapa aplikasi memakai database local session bersama. |
| status             | ENUM/VARCHAR              | Ya          | Status active, expired, atau revoked.                                |
| created_at         | TIMESTAMP                 | Ya          | Waktu local session dibuat.                                          |
| expires_at         | TIMESTAMP                 | Ya          | Waktu local session kedaluwarsa.                                     |
| last_activity_at   | TIMESTAMP                 | Tidak       | Waktu aktivitas terakhir untuk idle timeout.                         |
| revoked_at         | TIMESTAMP                 | Tidak       | Waktu local session dicabut.                                         |
| revoke_reason      | VARCHAR                   | Tidak       | Alasan seperti local_logout, sso_logout, atau password_changed.      |

**Local session valid apabila:** token session dari cookie cocok dengan session_token_hash, status session active, waktu expires_at belum terlewati, dan revoked_at masih kosong.

**Tabel profile_cache**

Profile cache dipisahkan dari local session karena satu user dapat memiliki beberapa local session. Profile cache bukan sumber utama identitas.

| Kolom            | Tipe Data yang Disarankan | Wajib | Keterangan                                                     |
| :--------------- | :------------------------ | :---- | :------------------------------------------------------------- |
| external_user_id | UUID/VARCHAR              | Ya    | Identifier user dari Auth Provider dan primary/unique key.     |
| name             | VARCHAR                   | Ya    | Nama user untuk ditampilkan, misalnya pada teks “Hello, Nama”. |
| email            | VARCHAR                   | Ya    | Email user yang diperoleh dari Auth Provider.                  |
| groups           | JSON/TEXT                 | Tidak | Salinan group jika diperlukan oleh aplikasi.                   |
| synced_at        | TIMESTAMP                 | Ya    | Waktu terakhir profil disinkronkan.                            |
| created_at       | TIMESTAMP                 | Ya    | Waktu cache pertama kali dibuat.                               |
| updated_at       | TIMESTAMP                 | Ya    | Waktu cache terakhir diperbarui.                               |

**Larangan:** App A dan App B tidak boleh menyimpan password, password hash, client secret di local session, authorization code yang sudah digunakan, atau token session asli dalam bentuk plain text di database.

**Tabel processed_events**

Tabel ini digunakan oleh aplikasi untuk memastikan event pencabutan session diproses secara idempotent.

| Kolom        | Tipe Data yang Disarankan | Wajib | Keterangan                                          |
| :----------- | :------------------------ | :---- | :-------------------------------------------------- |
| event_id     | UUID                      | Ya    | Identifier unik event dan harus unik pada aplikasi. |
| event_type   | VARCHAR                   | Ya    | Jenis event yang diproses.                          |
| processed_at | TIMESTAMP                 | Ya    | Waktu event selesai diproses.                       |
| result       | VARCHAR                   | Ya    | Hasil pemrosesan event.                             |

Jika aplikasi menerima kembali event_id yang sudah terdapat pada tabel ini, aplikasi tidak perlu mengulangi perubahan dan tetap dapat mengembalikan response sukses.

## **F05 \- Auth Provider Platform \- Event Processing** {#f05---auth-provider-platform---event-processing}

Ketika user logout, mengganti password, dinonaktifkan, atau kehilangan policy akses aplikasi melalui Auth Provider, central session terkait harus dicabut. Auth Provider kemudian menerbitkan event agar Sync Worker meminta App A dan App B menghapus local session user.

Pencabutan central session dilakukan secara sinkron. Penyebaran pencabutan local session dilakukan secara asinkron.

**Message Queue**  
Message Queue menyimpan event sampai event berhasil diproses oleh Sync Worker. Event tidak boleh hilang hanya karena aplikasi atau worker sedang tidak tersedia.

**Sync Worker**  
Sync Worker harus:

- Membaca event dari Message Queue.
- Menentukan aplikasi tujuan.
- Mengirim permintaan ke internal logout endpoint milik aplikasi.
- Mencatat status pengiriman untuk setiap aplikasi secara terpisah.
- Melakukan retry ketika terjadi kegagalan sementara.
- Memindahkan event ke Dead-Letter Queue apabila batas retry terlampaui.

**Kelebihannya**

- Endpoint utama tidak menunggu semua aplikasi merespons.
- Worker melakukan retry ketika aplikasi sementara tidak tersedia.
- Retry memiliki batas percobaan dan jeda atau backoff.
- Event diproses secara idempotent agar aman saat terkirim ulang.
- Kegagalan App A tidak boleh menghambat pemrosesan App B.
- Event gagal permanen dipindahkan ke Dead-Letter Queue.

**Event Minimum**

- SessionRevoked  
  Event ini diterbitkan ketika user melakukan logout SSO atau ketika session dicabut oleh admin.
- PasswordChanged  
  Event ini diterbitkan ketika password user berhasil diubah. Perubahan password harus mencabut seluruh central session dan seluruh local session user.
- AccessPolicyChanged  
  Event ini diterbitkan ketika perubahan group atau policy menyebabkan user tidak lagi memiliki akses ke aplikasi tertentu. Local session user pada aplikasi yang aksesnya dicabut harus dihapus.

**Payload Event Minimum**  
`{`  
 `"eventId": "uuid",`  
 `"eventType": "SessionRevoked",`  
 `"userId": "uuid",`  
 `"centralSessionId": "uuid",`  
 `"applicationId": null,`  
 `"reason": "sso_logout",`  
 `"occurredAt": "2026-07-28T10:00:00Z",`  
 `"metadata": {}`  
`}`

**Tabel events**

Tabel ini menyimpan event yang akan dipublikasikan ke Message Queue. Penggunaan pola transactional outbox disarankan agar perubahan database dan pencatatan event terjadi dalam transaksi yang sama.

| Kolom              | Tipe Data yang Disarankan | Wajib | Keterangan                                                    |
| :----------------- | :------------------------ | :---- | :------------------------------------------------------------ |
| id                 | UUID                      | Ya    | Primary key sekaligus identifier unik event.                  |
| event_type         | VARCHAR                   | Ya    | Jenis event, misalnya SessionRevoked.                         |
| user_id            | UUID                      | Ya    | User yang terkait dengan event.                               |
| central_session_id | UUID                      | Tidak | Central session yang terkait.                                 |
| application_id     | UUID                      | Tidak | Target aplikasi jika event hanya berlaku untuk satu aplikasi. |
| payload            | JSON                      | Ya    | Payload lengkap event.                                        |
| status             | VARCHAR                   | Ya    | Status publikasi event.                                       |
| created_at         | TIMESTAMP                 | Ya    | Waktu event dibuat.                                           |
| published_at       | TIMESTAMP                 | Tidak | Waktu event berhasil dikirim ke queue.                        |

**Tabel event_deliveries**

Tabel ini mencatat status pemrosesan satu event pada setiap aplikasi tujuan.

| Kolom           | Tipe Data yang Disarankan | Wajib | Keterangan                                             |
| :-------------- | :------------------------ | :---- | :----------------------------------------------------- |
| id              | UUID                      | Ya    | Primary key dan identifier unik delivery.              |
| event_id        | UUID                      | Ya    | Foreign key ke events.id.                              |
| application_id  | UUID                      | Ya    | Aplikasi tujuan event.                                 |
| status          | VARCHAR                   | Ya    | pending, processing, succeeded, retrying, atau failed. |
| attempt_count   | INTEGER                   | Ya    | Jumlah percobaan pengiriman.                           |
| last_attempt_at | TIMESTAMP                 | Tidak | Waktu percobaan terakhir.                              |
| next_retry_at   | TIMESTAMP                 | Tidak | Waktu retry berikutnya.                                |
| processed_at    | TIMESTAMP                 | Tidak | Waktu pemrosesan berhasil.                             |
| last_error      | TEXT                      | Tidak | Pesan kegagalan terakhir.                              |

**Aturan:** status delivery App A dan App B harus dicatat secara terpisah. Kegagalan pengiriman ke App A tidak boleh menghalangi pengiriman ke App B.

##

# **Spesifikasi BONUS** {#spesifikasi-bonus}

Pada bagian ini, Anda dapat mengimplementasikan bonus-bonus yang disediakan tanpa maksimal jumlah. Gunakan bonus ini sebagai sarana untuk mengeksplorasi berbagai aspek dalam web development untuk memperdalam pengetahuan dan pemahaman Anda.

## **B01 \- MFA atau WebAuthn** {#b01---mfa-atau-webauthn}

Authentication membuktikan "kamu siapa". Sejauh ini Program Utama hanya mengandalkan satu faktor, yaitu password (something you know). Masalahnya, password bisa bocor lewat phishing, reuse, atau kebocoran database pihak lain. Multi-Factor Authentication (MFA) menambah faktor kedua yang berbeda jenis, sehingga penyerang yang hanya mengetahui password tetap tidak bisa masuk.

Untuk bonus ini Anda boleh memilih salah satu dari dua pendekatan berikut:

- TOTP (Time-based One-Time Password). Saat enrollment, server & aplikasi authenticator (Google Authenticator, Authy, dll.) berbagi sebuah shared secret. Authenticator menghasilkan kode 6 digit yang berubah tiap \~30 detik dari secret \+ waktu sekarang. Server memverifikasi kode dengan menghitung nilai yang sama. Distandarkan pada RFC 6238\.
- WebAuthn/FIDO2/Passkey. Browser membuat sepasang kunci public/private yang terikat ke domain. Private key tidak pernah meninggalkan perangkat/authenticator sedangkan server hanya menyimpan public key. Login dilakukan dengan menandatangani sebuah challenge acak.

(Disarankan) sediakan mekanisme cadangan seperti recovery codes sekali pakai, agar user yang kehilangan perangkat tidak terkunci selamanya. Bila diimplementasikan, recovery code juga disimpan sebagai hash.

Integrasi dengan flow utama

| `POST /login (email + password)    └─ password valid?         ├─ tidak → 401 (pesan generik)         └─ ya, DAN user punya MFA aktif              └─ JANGAN buat central session.                 Buat "login pending / MFA challenge state" berumur pendek,                 lalu minta faktor kedua. POST /login/mfa (kode TOTP / assertion WebAuthn)    └─ faktor kedua valid?         ├─ tidak → tolak; catatkan audit MFA gagal         └─ ya    → BARU central session dibuat + cookie di-set;                    lanjut ke authorize seperti biasa.` |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

**Notes:**

- Endpoint yang menerbitkan central session tidak boleh bisa dipanggil hanya dengan password ketika user memiliki MFA aktif.
- "Pending MFA state" harus terikat ke user \+ berumur pendek, dan tidak boleh berupa central session yang sudah valid.
- Tambahkan pencatatan audit_logs untuk \`mfa_enrolled\`, \`mfa_success\`, dan \`mfa_failed\` (mengikuti pola audit Program Utama, tanpa data sensitif).
- Pastikan user dengan MFA aktif tidak dapat memperoleh central session hanya dengan password.
- Pastikan Alur enrollment dan verification dapat didemonstrasikan penuh dari UI.
- Pastikan kode/kredensial faktor kedua tersimpan aman dan tidak pernah muncul di log.
- (Bila ada) pastikan recovery code hanya bisa dipakai sekali.

## **B02 \- Observability** {#b02---observability}

Ketika sistem memiliki banyak komponen yang saling berinteraksi, observability membantu memahami apa yang sedang terjadi di dalam sistem tanpa harus memasang debugger. Secara umum observability berdiri di atas tiga pilar: metrics (angka teragregasi dari waktu ke waktu), logs (catatan peristiwa), dan traces (jejak satu request menembus banyak komponen). Bonus ini fokus pada pilar metrics. Metrics adalah angka numerik yang direkam terus-menerus, contohnya "berapa request per detik", "berapa persen yang error", "berapa pesan menumpuk di queue". Dua kerangka berpikir yang umum dipakai untuk memilih metrik:

- Metode RED: **R**ate (jumlah request), **E**rrors (jumlah/rasio yang gagal), **D**uration (latency/durasi request).
- Metode USE: **U**tilization, **S**aturation (mis. seberapa penuh antrean), **E**rrors.

Di dunia nyata, metrik biasanya di-expose oleh aplikasi lewat endpoint teks (misal /metrics format Prometheus), lalu Prometheus menariknya berkala (scraping).

Buatlah sebuah dashboard metrics yang berada di dalam Auth Provider webapp dan menampilkan kondisi sistem secara real-time atau mendekati real-time.

**Notes:**

- Dashboard berada di dalam Auth Provider webapp dan menampilkan minimal latency, error, dan queue depth.
- Lakukan beberapa login/logout dan matikan worker, lalu tunjukkan metrik ikut berubah (mis. queue depth naik saat worker dimatikan, lalu turun setelah worker hidup lagi).
- Metrik async benar-benar mencerminkan keadaan queue/worker/DLQ, bukan angka hardcoded.

## **B03 \- Liveness dan Readiness Probe** {#b03---liveness-dan-readiness-probe}

Di Program Utama sudah ada GET /health yang sederhana. Bonus ini memisahkannya menjadi dua jenis pemeriksaan berbeda: Liveness dan Readiness. Sediakan dua pemeriksaan dengan semantik berbeda (umumnya dua endpoint terpisah, misal GET /health/live dan GET /health/ready):

1. Liveness probe. Cukup membuktikan proses masih merespons dan event loop tidak macet. Jangan memeriksa dependency di sini. Bila DB sedang down, kita tidak ingin liveness gagal (itu tugas readiness). Balas \`200\` selama proses tidak macet.
2. Readiness probe. Memeriksa seluruh dependency yang membuat Auth Provider Server benar-benar bisa bekerja:
   1. Koneksi ke Primary DB (misal jalankan query ringan \`SELECT 1\`).
   2. Koneksi ke message broker (broker bisa dijangkau/di-ping).
   3. Komponen lain yang menjadi syarat operasional Auth Provider Server.

   Bila salah satu dependency tidak sehat, readiness harus membalas status not-ready (misal 503\) beserta rincian komponen mana yang bermasalah (tanpa membocorkan detail internal sensitif). Bila semua sehat, balas 200\.

**Notes:**

- Terdapat dua pemeriksaan yang perilakunya berbeda dan dapat dibedakan.
- Saat sebuah dependency dimatikan (misal docker compose stop pada database atau broker), readiness berubah menjadi not-ready sementara liveness tetap OK.
- Setelah dependency pulih, readiness kembali ready tanpa perlu me-restart Auth Provider Server.
- Readiness melaporkan komponen mana yang gagal secukupnya untuk diagnosis.

## **B04 \- Graceful shutdown** {#b04---graceful-shutdown}

Ketika sebuah service dihentikan (deploy versi baru, scaling turun, atau docker stop), sistem operasi mengirim sinyal SIGTERM untuk meminta proses berhenti. Bila proses langsung mati saat itu juga (hard/abrupt shutdown), request yang sedang diproses bisa terpotong di tengah jalan. Graceful shutdown artinya proses menyelesaikan pekerjaan yang sedang berlangsung dengan rapi sebelum benar-benar berhenti. Dalam konteks orchestrator seperti Kubernetes, siklusnya kira-kira: orchestrator mengirim SIGTERM → memberi grace period (tenggang waktu) agar aplikasi membersihkan diri → bila melewati tenggang, barulah dikirim \`SIGKILL\` yang mematikan paksa. Tugas aplikasi adalah memanfaatkan tenggang itu dengan benar.  
Pada Auth Provider Server, tangani sinyal terminasi (SIGTERM, dan biasanya SIGINT untuk Ctrl+C saat development):

- Tutup listener agar tidak ada request/koneksi baru yang diterima.
- Selesaikan pekerjaan yang sedang berjalan (block process from dying). Tahan proses agar tidak langsung mati; tunggu request in-flight selesai sampai batas waktu (shutdown timeout) yang wajar.
- Pastikan pekerjaan asinkron yang tertahan tidak hilang atau rusak: hentikan konsumsi pesan baru, tuntaskan/ack pesan yang sudah terlanjur diambil (atau kembalikan agar diproses ulang dengan aman karena idempotency), dan jangan sampai ada event yang "menggantung" di tengah pemrosesan.
- Tutup koneksi database dan koneksi ke message broker.

# **Lampiran** {#lampiran}

## **Format Error Standar** {#format-error-standar}

| `{   "error": {     "code": "INVALID_GRANT",     "message": "Authorization request tidak valid",     "requestId": "uuid"   } }` |
| :------------------------------------------------------------------------------------------------------------------------------ |

Response tidak boleh membocorkan apakah email tertentu terdaftar, password hash, stack trace, token, atau detail internal policy. OAuth redirect error hanya dikirim ke URI yang sudah terbukti valid.

## **Siklus Pemrosesan Message (referensi)** {#siklus-pemrosesan-message-(referensi)}

| `Logout atau change password   → revoke session + INSERT events di DB (satu transaksi / outbox)   → Event Publisher publish ke queue   → Sync Worker consume        → sukses         : UPDATE status = processed + ACK        → gagal sementara : UPDATE attempt + publish ke retry queue        → retry habis     : UPDATE status = dead_lettered + kirim ke DLQ` |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# **Referensi** {#referensi}

Berikut daftar kata kunci/istilah penting untuk dipelajari lebih lanjut.

**Protokol & Web Dasar**

- [HTTP request/response, HTTP methods, HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference)
- [HTTPS / TLS](https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/)
- [Cookie attributes: HttpOnly, Secure, SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
- [Session management (server-side session)](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [JSON](https://jsonapi.org)
- [REST API design](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [Front channel vs back channel](https://medium.com/@ajwardayyoob/authn-authz-for-dummies-series-part-3-back-channel-vs-front-channel-communication-caf4986206b7)

**Identitas, OAuth & OIDC**

- [Single Sign-On (SSO)](https://www.cloudflare.com/learning/access-management/what-is-sso/)
- [OAuth 2.0 Authorization Code Grant](https://www.oauth.com/oauth2-servers/server-side-apps/authorization-code/)
- [OpenID Connect (OIDC), claims, /userinfo](https://auth0.com/docs/get-started/apis/scopes/openid-connect-scopes)
- [PKCE (RFC 7636\)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Authorization code, access token, redirect URI, state parameter](https://datatracker.ietf.org/doc/html/rfc6749)
- [Opaque token vs JWT (JSON Web Token)](https://medium.com/identity-beyond-borders/jwt-vs-opaque-tokens-all-you-need-to-know-307bf19bade8)
- [Token introspection (RFC 7662\)](https://datatracker.ietf.org/doc/html/rfc7662)
- [Confidential vs public client, client_id, client_secret](https://www.oauth.com/oauth2-servers/client-registration/client-id-secret/)
- [Back-channel logout, session revocation](https://auth0.com/docs/authenticate/login/logout/back-channel-logout)
- [Policy / RBAC, group assignment](https://pathlock.com/blog/role-based-access-control-rbac/)

**Keamanan**

- [Password hashing: bcrypt, argon2, scrypt](https://stytch.com/blog/argon2-vs-bcrypt-vs-scrypt/)
- [CSRF, open redirect, replay attack](https://medium.com/@iamprovidence/avoid-those-vulnerabilities-ddos-sql-injection-open-redirect-xss-csrf-clickjacking-0d5de7c74569)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Secret management & environment variables](https://www.kern-it.be/en/definitions/environment-variable/)

**Asynchronous & Reliability**

- [Message queue, producer/consumer](https://www.geeksforgeeks.org/system-design/message-queues-system-design/)
- [RabbitMQ (AMQP), acknowledgement; Kafka, consumer group, offset](https://aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/)
- [Dead-Letter Queue (DLQ)](https://aws.amazon.com/what-is/dead-letter-queue/)
- [Idempotency & idempotency key](https://algomaster.io/learn/system-design/idempotency)
- [Retry, exponential backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
- [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Eventual consistency, at-least-once delivery](https://medium.com/@marton.waszlavik/demystifying-cap-theorem-eventual-consistency-and-exactly-once-delivery-guarantee-ed20cf7cc877)
- [Event-driven architecture, event schema versioning](https://event-driven.io/en/simple_events_versioning_patterns/)
- [Correlation ID / distributed tracing](https://microsoft.github.io/code-with-engineering-playbook/observability/correlation-id/)

**Data & Infrastruktur**

- [ORM (Object-Relational Mapper)](https://aws.amazon.com/what-is/object-relational-mapping/)
- [Database migration & seeding](https://medium.com/@hilalfauzan9/mastering-database-management-a-complete-guide-to-automatic-data-seeding-and-migration-59fdff63a0c3)
- [Docker, Dockerfile, Docker Compose](https://docs.docker.com)
- [Liveness vs readiness probe, graceful shutdown (Kubernetes)](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
- [Observability: metrics, Prometheus, Grafana, OpenTelemetry, queue depth](https://grafana.com/blog/a-practical-guide-to-data-collection-with-opentelemetry-and-prometheus/)
