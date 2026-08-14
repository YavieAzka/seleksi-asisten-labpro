import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Processor('sso-events')
export class WorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkerProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Menerima Job ID: ${job.id}, Tipe: ${job.name}`);

    const payload = job.data;
    const internalEventId = job.id as string;

    if (!internalEventId) {
      throw new Error('Job ID tidak ditemukan di dalam payload BullMQ');
    }

    const applications = await this.prisma.application.findMany({
      where: { status: 'active' },
    });

    let hasError = false;

    for (const app of applications) {
      if (!app.logoutNotificationUrl) continue;

      let delivery = await this.prisma.eventDelivery.findFirst({
        where: { eventId: internalEventId, applicationId: app.id },
      });

      if (delivery && delivery.status === 'succeeded') {
        this.logger.log(
          `Event sudah pernah berhasil dikirim ke ${app.name}, skip.`,
        );
        continue;
      }

      if (!delivery) {
        delivery = await this.prisma.eventDelivery.create({
          data: {
            eventId: internalEventId,
            applicationId: app.id,
            status: 'processing',
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });
      } else {
        delivery = await this.prisma.eventDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'processing',
            attemptCount: delivery.attemptCount + 1,
            lastAttemptAt: new Date(),
          },
        });
      }

      try {
        // Modifikasi Docker Network Bridge
        const targetUrl = app.logoutNotificationUrl.replace(
          'localhost',
          'host.docker.internal',
        );

        this.logger.log(`Mengirim webhook ke ${app.name} -> ${targetUrl}`);

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await this.prisma.eventDelivery.update({
            where: { id: delivery.id },
            data: { status: 'succeeded', processedAt: new Date() },
          });
          this.logger.log(`Berhasil mengirim event ke ${app.name}`);
        } else {
          throw new Error(`HTTP Error: Status ${response.status}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Gagal mengirim event ke ${app.name}: ${errorMessage}`,
        );

        await this.prisma.eventDelivery.update({
          where: { id: delivery.id },
          data: { status: 'failed', lastError: errorMessage },
        });

        hasError = true;
      }
    }

    if (hasError) {
      throw new Error(
        'Ada satu atau lebih aplikasi yang gagal diproses. Memicu mekanisme retry...',
      );
    }

    return { status: 'processed' };
  }
}
