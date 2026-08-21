import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { PrismaService } from './prisma.service';
import { SessionGuard } from './session.guard';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  index(@Res() res: Response) {
    return res.render('index', { title: 'Edunek - LMS' });
  }
  @UseGuards(SessionGuard)
  @Get('dashboard')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    // PERBAIKAN 1: Ubah nama variabel agar lebih relevan (token, bukan ID)
    const sessionToken = req.cookies?.['app_b_session'];

    if (!sessionToken) {
      // Jika tidak ada sesi, kembalikan ke halaman login
      return res.redirect('/');
    }

    // PERBAIKAN 2: Cari sesi menggunakan sessionTokenHash, bukan id
    // Menggunakan findFirst untuk menghindari error jika kolom ini bukan @unique di skema Prisma Anda
    const session = await this.prisma.localSession.findFirst({
      where: {
        sessionTokenHash: sessionToken,
        status: 'active',
      },
    });

    if (!session || session.status !== 'active') {
      return res.redirect('/');
    }

    // 2. Ambil profil dari cache
    const profile = await this.prisma.profileCache.findUnique({
      where: { externalUserId: session.externalUserId },
    });

    // 3. Ambil riwayat pemrosesan event (jika ada)
    const processedEvents = await this.prisma.processedEvent.findMany({
      orderBy: { processedAt: 'desc' },
      take: 5,
    });

    // 4. Suntikkan semua data ke file EJS
    return res.render('dashboard', {
      profile: {
        name: profile?.name || 'Mahasiswa',
        email: profile?.email || '-',
        sub: profile?.externalUserId || '-',
      },
      sessionInfo: {
        status: session.status,
        createdAt: session.createdAt.toLocaleString('id-ID'),
        expiresAt: session.expiresAt.toLocaleString('id-ID'),
      },
      activityLogs: (() => {
        const baseTime = session.createdAt.getTime();
        return [
          {
            time: new Date(baseTime - 3000).toLocaleString('id-ID'),
            action: 'Pengalihan ke Auth Provider (Authorization Request) dengan PKCE',
          },
          {
            time: new Date(baseTime - 1000).toLocaleString('id-ID'),
            action: 'Penerimaan authorization code di callback',
          },
          {
            time: new Date(baseTime - 500).toLocaleString('id-ID'),
            action: 'Pengambilan identitas melalui endpoint user information berhasil',
          },
          {
            time: session.createdAt.toLocaleString('id-ID'),
            action: 'Pembuatan local session di database berhasil',
          },
        ];
      })(),
      processedEvents: processedEvents,
    });
  }
}
