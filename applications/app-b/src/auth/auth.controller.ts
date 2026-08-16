import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import type { Request, Response } from 'express';

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

    await this.prisma.localSession.create({
      data: {
        sessionTokenHash: accessToken, // Idealnya ini di-hash lagi untuk keamanan ekstra
        externalUserId: userProfile.sub,
        centralSessionId:
          userProfile.sso_session_id || 'unknown-central-session',
        expiresAt: expiresAt,
      },
    });

    // 4. Tanam cookie dan arahkan ke dashboard
    // PERBAIKAN: Gunakan accessToken agar konsisten dengan pencarian database di fungsi logout
    res.cookie('app_b_session', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });

    return res.redirect('/dashboard');
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // 1. Ambil nilai token dari kuki
    const sessionToken = req.cookies['app_b_session'];

    if (sessionToken) {
      try {
        // 2. Tandai sesi sebagai revoked di dalam database sesuai spesifikasi
        await this.prisma.localSession.updateMany({
          where: {
            sessionTokenHash: sessionToken,
          },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
            revokeReason: 'local_logout',
          },
        });
      } catch (error) {
        // Abaikan eror jika sesi sudah tidak valid/dihapus
      }
    }

    // 3. Hapus kuki dari peramban pengguna
    res.clearCookie('app_b_session');

    // 4. Arahkan pengguna kembali ke halaman utama (login page)
    return res.redirect('/');
  }
}
