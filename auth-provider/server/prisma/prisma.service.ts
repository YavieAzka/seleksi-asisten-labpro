import 'dotenv/config'; // Pastikan ini ada di baris paling atas
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Sesuaikan "postgres:postgres" dengan kredensial yang sama persis seperti di Control Panel
    const dbUrl =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/auth_provider?schema=public';

    console.log('Mencoba koneksi ke:', dbUrl); // Kita cek apa yang dibaca oleh sistem

    const adapter = new PrismaPg({
      connectionString: dbUrl,
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
