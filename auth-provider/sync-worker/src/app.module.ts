import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WorkerProcessor } from './worker/worker.processor';

@Module({
  imports: [
    PrismaModule,
    // Konfigurasi koneksi Redis untuk BullMQ
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    // Mendaftarkan queue yang akan didengarkan
    BullModule.registerQueue({
      name: 'sso-events',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, WorkerProcessor],
})
export class AppModule {}
