import { Controller, Get, Render, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  @Get()
  @Render('index')
  index() {
    return { title: 'SiEks - Sistem Akademik' };
  }

  @Get('dashboard')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies['app_a_session'];

    if (!token) {
      return res.redirect('/');
    }

    try {
      const profileResponse = await fetch(
        'http://localhost:3000/auth/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!profileResponse.ok) throw new Error('Token invalid');

      const profile = await profileResponse.json();

      // --- MOCK DATA UNTUK UI (Akan diganti dengan query Database Lokal nanti) ---

      const sessionInfo = {
        status: 'Active',
        createdAt: new Date().toLocaleString('id-ID'),
        expiresAt: new Date(Date.now() + 3600000).toLocaleString('id-ID'), // +1 jam
      };

      const activityLogs = [
        {
          time: new Date().toLocaleString('id-ID'),
          action: 'Membuat local session berhasil',
        },
        {
          time: new Date(Date.now() - 1000).toLocaleString('id-ID'),
          action: 'Mengambil identitas melalui endpoint user information',
        },
        {
          time: new Date(Date.now() - 2000).toLocaleString('id-ID'),
          action: 'Menukar authorization code menjadi access token',
        },
        {
          time: new Date(Date.now() - 4000).toLocaleString('id-ID'),
          action: 'Menerima authorization code di callback',
        },
        {
          time: new Date(Date.now() - 8000).toLocaleString('id-ID'),
          action: 'Mengarahkan ke Auth Provider untuk otorisasi',
        },
      ];

      const processedEvents = [
        // Kosong untuk saat ini, akan terisi saat Milestone 5 berjalan
        // { id: 'evt-1234', type: 'SessionRevoked', processedAt: '...', result: 'local session dihapus' }
      ];

      // --------------------------------------------------------------------------

      return res.render('dashboard', {
        profile,
        sessionInfo,
        activityLogs,
        processedEvents,
      });
    } catch (error) {
      res.clearCookie('app_a_session');
      return res.redirect('/');
    }
  }
}
