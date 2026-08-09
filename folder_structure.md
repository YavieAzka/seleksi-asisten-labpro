📦 sso-project
├── applications
│   ├── app-a
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   │   ├── 20260807020129_init
│   │   │   │   │   └── migration.sql
│   │   │   │   └── migration_lock.toml
│   │   │   └── schema.prisma
│   │   ├── src
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.service.ts
│   │   │   └── main.ts
│   │   ├── test
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── .env.example
│   │   ├── .gitignore
│   │   ├── .prettierrc
│   │   ├── Dockerfile
│   │   ├── eslint.config.mjs
│   │   ├── nest-cli.json
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── prisma.config.mjs
│   │   ├── README.md
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   └── app-b
│       ├── prisma
│       │   ├── migrations
│       │   │   ├── 20260807020210_init
│       │   │   │   └── migration.sql
│       │   │   └── migration_lock.toml
│       │   └── schema.prisma
│       ├── src
│       │   ├── app.controller.ts
│       │   ├── app.module.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── test
│       │   ├── app.e2e-spec.ts
│       │   └── jest-e2e.json
│       ├── .env.example
│       ├── .gitignore
│       ├── .prettierrc
│       ├── Dockerfile
│       ├── eslint.config.mjs
│       ├── nest-cli.json
│       ├── package-lock.json
│       ├── package.json
│       ├── prisma.config.mjs
│       ├── README.md
│       ├── tsconfig.build.json
│       └── tsconfig.json
├── auth-provider
│   ├── control-panel
│   │   ├── prisma
│   │   │   └── schema.prisma
│   │   ├── public
│   │   │   └── styles.css
│   │   ├── src
│   │   │   ├── applications
│   │   │   │   ├── dto
│   │   │   │   │   ├── add-redirect-uri.dto.ts
│   │   │   │   │   ├── create-application.dto.ts
│   │   │   │   │   └── update-application.dto.ts
│   │   │   │   ├── applications.controller.ts
│   │   │   │   ├── applications.module.ts
│   │   │   │   └── applications.service.ts
│   │   │   ├── auth
│   │   │   │   ├── dto
│   │   │   │   │   └── login.dto.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── auth.service.ts
│   │   │   ├── groups
│   │   │   │   ├── dto
│   │   │   │   │   ├── create-group.dto.ts
│   │   │   │   │   └── update-group.dto.ts
│   │   │   │   ├── groups.controller.ts
│   │   │   │   ├── groups.module.ts
│   │   │   │   └── groups.service.ts
│   │   │   ├── policies
│   │   │   │   ├── dto
│   │   │   │   │   └── create-policy.dto.ts
│   │   │   │   ├── policies.controller.ts
│   │   │   │   ├── policies.module.ts
│   │   │   │   └── policies.service.ts
│   │   │   ├── prisma
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── types
│   │   │   │   └── session.d.ts
│   │   │   ├── users
│   │   │   │   ├── dto
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   └── update-user.dto.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.module.ts
│   │   │   │   └── users.service.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.service.ts
│   │   │   └── main.ts
│   │   ├── test
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── views
│   │   │   ├── applications
│   │   │   │   ├── edit.ejs
│   │   │   │   ├── index.ejs
│   │   │   │   └── new.ejs
│   │   │   ├── groups
│   │   │   │   ├── edit.ejs
│   │   │   │   ├── index.ejs
│   │   │   │   └── new.ejs
│   │   │   ├── policies
│   │   │   │   ├── index.ejs
│   │   │   │   └── new.ejs
│   │   │   ├── users
│   │   │   │   ├── edit.ejs
│   │   │   │   ├── index.ejs
│   │   │   │   └── new.ejs
│   │   │   ├── dashboard.ejs
│   │   │   └── login.ejs
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── .gitignore
│   │   ├── .prettierrc
│   │   ├── Dockerfile
│   │   ├── eslint.config.mjs
│   │   ├── nest-cli.json
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── prisma.config.mjs
│   │   ├── README.md
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   ├── server
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   │   ├── 20260807014949_init
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260807015950_change_scopes_to_json
│   │   │   │   │   └── migration.sql
│   │   │   │   └── migration_lock.toml
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.service.ts
│   │   │   └── main.ts
│   │   ├── test
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── .env.example
│   │   ├── .gitignore
│   │   ├── .prettierrc
│   │   ├── Dockerfile
│   │   ├── eslint.config.mjs
│   │   ├── nest-cli.json
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── prisma.config.mjs
│   │   ├── README.md
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   └── sync-worker
│       ├── .env.example
│       ├── .gitignore
│       └── README.md
├── docs
│   └── PROGRESS.md
├── infra
│   └── postgres-init-multi-db.sh
├── .gitignore
├── docker-compose.yml
├── folder_structure.md
└── README.md
