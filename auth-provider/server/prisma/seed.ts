import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Auth Provider database...');

  // ── Groups ──────────────────────────────────────────
  const adminGroup = await prisma.group.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrator sistem dengan akses penuh ke Control Panel',
    },
  });

  const dosenGroup = await prisma.group.upsert({
    where: { name: 'Dosen' },
    update: {},
    create: {
      name: 'Dosen',
      description: 'Dosen pengajar ITB',
    },
  });

  const mahasiswaGroup = await prisma.group.upsert({
    where: { name: 'Mahasiswa' },
    update: {},
    create: {
      name: 'Mahasiswa',
      description: 'Mahasiswa aktif ITB',
    },
  });

  console.log('Groups created: Admin, Dosen, Mahasiswa');

  // ── Applications ────────────────────────────────────
  const siEks = await prisma.application.upsert({
    where: { clientId: 'sieks-client' },
    update: {},
    create: {
      name: 'SiEks - Sistem Akademik',
      clientId: 'sieks-client',
      status: 'active',
      launchUrl: 'http://localhost:3001',
      logoutNotificationUrl: 'http://localhost:3001/internal/logout',
      redirectUris: {
        create: [{ redirectUri: 'http://localhost:3001/auth/callback' }],
      },
    },
  });

  const edunek = await prisma.application.upsert({
    where: { clientId: 'edunek-client' },
    update: {},
    create: {
      name: 'Edunek - Learning Management System',
      clientId: 'edunek-client',
      status: 'active',
      launchUrl: 'http://localhost:3002',
      logoutNotificationUrl: 'http://localhost:3002/internal/logout',
      redirectUris: {
        create: [{ redirectUri: 'http://localhost:3002/auth/callback' }],
      },
    },
  });

  console.log('Applications created: SiEks, Edunek');

  // ── Application Group Policies ──────────────────────
  const allGroups = [adminGroup, dosenGroup, mahasiswaGroup];
  const allApplications = [siEks, edunek];

  for (const app of allApplications) {
    for (const group of allGroups) {
      await prisma.applicationGroupPolicy.upsert({
        where: {
          applicationId_groupId_effect: {
            applicationId: app.id,
            groupId: group.id,
            effect: 'allow',
          },
        },
        update: {},
        create: {
          applicationId: app.id,
          groupId: group.id,
          effect: 'allow',
        },
      });
    }
  }

  console.log('Application group policies created');

  // ── Users ────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@itb.ac.id' },
    update: {},
    create: {
      name: 'Admin ITB',
      email: 'admin@itb.ac.id',
      passwordHash: adminPasswordHash,
      status: 'active',
    },
  });

  const mahasiswaPasswordHash = await bcrypt.hash('Mahasiswa123!', 10);
  const mahasiswa = await prisma.user.upsert({
    where: { email: '13524001@mahasiswa.itb.ac.id' },
    update: {},
    create: {
      name: 'Mahasiswa1',
      email: '13524001@mahasiswa.itb.ac.id',
      passwordHash: mahasiswaPasswordHash,
      status: 'active',
    },
  });

  console.log('Users created: admin@itb.ac.id, 13524001@mahasiswa.itb.ac.id');

  // ── User-Group Assignments ──────────────────────────
  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: admin.id, groupId: adminGroup.id } },
    update: {},
    create: { userId: admin.id, groupId: adminGroup.id },
  });

  await prisma.userGroup.upsert({
    where: {
      userId_groupId: { userId: mahasiswa.id, groupId: mahasiswaGroup.id },
    },
    update: {},
    create: { userId: mahasiswa.id, groupId: mahasiswaGroup.id },
  });

  console.log('User-group assignments created');

  console.log('\nSeed completed successfully.');
  console.log('─────────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin      : admin@itb.ac.id / Admin123!');
  console.log('  Mahasiswa  : 13524001@mahasiswa.itb.ac.id / Mahasiswa123!');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
