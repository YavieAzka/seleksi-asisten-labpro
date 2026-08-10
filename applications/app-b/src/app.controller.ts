import { Controller, Get, Render, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  @Get()
  @Render('index')
  index() {
    return { title: 'Edunek - Learning Management System' };
  }

  @Get('dashboard')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    // Mengecek cookie milik App B
    const token = req.cookies['app_b_session'];

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

      return res.render('dashboard', { profile });
    } catch (error) {
      res.clearCookie('app_b_session');
      return res.redirect('/');
    }
  }
}
