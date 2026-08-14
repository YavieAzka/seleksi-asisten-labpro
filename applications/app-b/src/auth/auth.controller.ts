import {
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  // Suntikkan PrismaService ke dalam konstruktor
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('login')
  login(@Res() res: Response) {
    const authUrl =
      'http://localhost:3000/auth/authorize?client_id=edunek-client&redirect_uri=http://localhost:3002/auth/callback&response_type=code&state=xyz123&code_challenge=n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg&code_challenge_method=S256';
    return res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code)
      throw new UnauthorizedException('Authorization code tidak ditemukan');

    // 1. Tukar kode dengan token & ambil profil dari Auth Provider
    const { accessToken, userProfile } =
      await this.authService.exchangeCodeAndGetProfile(code);

    // 2. Simpan atau Perbarui Profile Cache Lokal
    await this.prisma.profileCache.upsert({
      where: { externalUserId: userProfile.sub },
      update: {
        name: userProfile.name,
        email: userProfile.email,
        syncedAt: new Date(),
      },
      create: {
        externalUserId: userProfile.sub,
        name: userProfile.name,
        email: userProfile.email,
        syncedAt: new Date(),
      },
    });

    // 3. Buat Local Session baru
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Berlaku 1 jam

    // PERBAIKAN: Tangkap hasil pembuatan sesi ke dalam variabel 'localSession'
    const localSession = await this.prisma.localSession.create({
      data: {
        sessionTokenHash: accessToken, // Idealnya ini di-hash lagi untuk keamanan ekstra
        externalUserId: userProfile.sub,
        centralSessionId:
          userProfile.sso_session_id || 'unknown-central-session',
        expiresAt: expiresAt,
      },
    });

    // 4. Tanam cookie dan arahkan ke dashboard
    res.cookie('app_b_session', localSession.id, {
      httpOnly: true,
      sameSite: 'lax',
    });

    return res.redirect('/dashboard');
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('app_b_session');
    return res.redirect('/');
  }
}
