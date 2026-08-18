import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async handleLogoutWebhook(@Body() payload: any) {
    // Mengekstrak payload worker
    const { eventId, centralSessionId, userId, eventType } = payload;

    this.logger.log(`Menerima webhook logout untuk eventId: ${eventId}`);

    if (!eventId || (!centralSessionId && !userId)) {
      this.logger.warn(
        'Payload tidak valid: eventId atau identifier sesi hilang.',
      );
      return { status: 'error', message: 'Invalid payload' };
    }

    try {
      const existingEvent = await this.prisma.processedEvent.findUnique({
        where: { eventId },
      });

      if (existingEvent) {
        this.logger.log(`Event ${eventId} sudah pernah diproses. Melewati...`);
        return { status: 'ignored', reason: 'already_processed' };
      }

      await this.prisma.$transaction(async (tx) => {
        if (centralSessionId) {
          await tx.localSession.deleteMany({
            where: { centralSessionId },
          });
        } else if (userId) {
          await tx.localSession.deleteMany({
            where: { externalUserId: userId },
          });
        }

        // Memasukkan eventType dan result sesuai spesifikasi Prisma
        await tx.processedEvent.create({
          data: {
            eventId,
            eventType: eventType || 'SessionRevoked',
            processedAt: new Date(),
            result: 'success',
          },
        });
      });

      this.logger.log(
        `Berhasil mencabut sesi lokal untuk centralSessionId: ${centralSessionId}`,
      );
      return { status: 'success' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Gagal memproses webhook: ${errorMessage}`);

      throw new Error('Gagal memproses webhook sinkronisasi sesi');
    }
  }
}
