import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from './auth/auth.guard';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  redirectRoot(@Req() req: Request, @Res() res: Response) {
    if (req.session?.adminUser) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/login');
  }

  @Get('dashboard')
  @UseGuards(AuthGuard)
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const [userCount, groupCount, applicationCount, policyCount] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.group.count(),
        this.prisma.application.count(),
        this.prisma.applicationGroupPolicy.count(),
      ]);

    return res.render('dashboard', {
      admin: req.session.adminUser,
      stats: { userCount, groupCount, applicationCount, policyCount },
    });
  }
}
