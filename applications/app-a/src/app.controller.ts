import { Controller, Get, Render, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from './prisma.service';
import { SessionGuard } from './auth/session.guard';

@Controller()
export class AppController {
  // Suntikkan PrismaService
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('index')
  index() {
    return { title: 'SiEks - Sistem Akademik' };
  }
  @UseGuards(SessionGuard)
  @Get('dashboard')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies['app_a_session'];

    if (!token) return res.redirect('/');

    try {
      // 1. Validasi Local Session di Database
      const session = await this.prisma.localSession.findFirst({
        where: {
          sessionTokenHash: token,
          status: 'active',
        },
      });

      // Jika tidak ada di DB, atau sudah melewati batas waktu
      if (!session || session.expiresAt < new Date()) {
        throw new Error('Sesi lokal tidak valid atau kedaluwarsa');
      }

      // 2. Ambil Identitas dari Profile Cache Lokal
      const profile = await this.prisma.profileCache.findUnique({
        where: { externalUserId: session.externalUserId },
      });

      if (!profile) throw new Error('Profil tidak ditemukan di cache lokal');

      // 3. Ambil riwayat event pencabutan dari DB (jika ada)
      const processedEvents = await this.prisma.processedEvent.findMany({
        orderBy: { processedAt: 'desc' },
        take: 5,
      });

      // Format data untuk antarmuka EJS
      const sessionInfo = {
        status: session.status.toUpperCase(),
        createdAt: session.createdAt.toLocaleString('id-ID'),
        expiresAt: session.expiresAt.toLocaleString('id-ID'),
      };

      const activityLogs = [
        {
          time: session.createdAt.toLocaleString('id-ID'),
          action: 'Membuat local session di database berhasil',
        },
        {
          time: profile.updatedAt.toLocaleString('id-ID'),
          action: 'Sinkronisasi Profile Cache dari Auth Provider berhasil',
        },
      ];

      return res.render('dashboard', {
        profile: {
          name: profile.name,
          email: profile.email,
          sub: profile.externalUserId,
        },
        sessionInfo,
        activityLogs,
        processedEvents,
      });
    } catch (error) {
      // Jika validasi gagal, bersihkan cookie dan paksa login ulang
      res.clearCookie('app_a_session');
      return res.redirect('/');
    }
  }
}
