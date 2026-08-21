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

  @Get('observability')
  @UseGuards(AuthGuard)
  async observability(@Req() req: Request, @Res() res: Response) {
    return res.render('observability', {
      admin: req.session.adminUser,
    });
  }

  @Get('api/metrics')
  @UseGuards(AuthGuard)
  async getMetrics(@Req() req: Request, @Res() res: Response) {
    try {
      const authServerUrl = process.env.AUTH_PROVIDER_URL || 'http://localhost:3000';
      // Fetch metrics from Auth Server internal API
      const response = await fetch(`${authServerUrl}/internal/metrics`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve metrics from Auth Server' });
    }
  }
}
