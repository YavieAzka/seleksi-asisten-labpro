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
    // Cek apakah user punya cookie sesi
    const token = req.cookies['app_a_session'];

    // Jika tidak ada, tendang kembali ke halaman depan
    if (!token) {
      return res.redirect('/');
    }

    try {
      // Ambil profil dari Auth Server menggunakan token
      const profileResponse = await fetch(
        'http://localhost:3000/auth/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!profileResponse.ok) throw new Error('Token invalid');

      const profile = await profileResponse.json();

      // Render halaman dashboard dengan data profil
      return res.render('dashboard', { profile });
    } catch (error) {
      res.clearCookie('app_a_session');
      return res.redirect('/');
    }
  }
}
