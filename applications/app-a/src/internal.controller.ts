import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service'; // Sesuaikan path ini dengan letak PrismaService kamu

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async handleBackChannelLogout(@Body() payload: any) {
    const { eventId, eventType, userId, centralSessionId, reason } = payload;
    this.logger.log(`Menerima webhook internal logout: Event ID ${eventId}`);

    // 1. Cek Idempotency: Pastikan event ini tidak dieksekusi ganda
    const existingEvent = await this.prisma.processedEvent.findUnique({
      where: { eventId: eventId },
    });

    if (existingEvent) {
      this.logger.log(`Event ${eventId} sudah pernah diproses. (Idempotent).`);
      return { success: true, message: 'Already processed' };
    }

    // 2. Skenario Pencabutan Sesi
    if (centralSessionId) {
      // Skenario 1: Logout SSO biasa
      await this.prisma.localSession.updateMany({
        where: {
          centralSessionId: centralSessionId,
          status: 'active',
        },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: reason,
        },
      });
    } else if (userId) {
      // Skenario 2: Global Kill-Switch (Ganti Password, dsb)
      await this.prisma.localSession.updateMany({
        where: {
          externalUserId: userId,
          status: 'active',
        },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: reason,
        },
      });
    }

    // 3. Catat event agar tidak diproses ulang di masa depan
    await this.prisma.processedEvent.create({
      data: {
        eventId: eventId,
        eventType: eventType || 'SessionRevoked',
        processedAt: new Date(),
        result: 'success',
      },
    });

    this.logger.log(`Berhasil mencabut local session untuk event ${eventId}`);
    return { success: true, message: 'Local session(s) revoked successfully' };
  }
}
