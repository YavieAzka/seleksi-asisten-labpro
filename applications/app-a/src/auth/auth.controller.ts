import {
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 1. Endpoint untuk trigger SSO Login
  @Get('login')
  login(@Res() res: Response) {
    // URL ini mengarah ke Auth Server dengan kredensial milik SiEks (App A)
    const authUrl =
      'http://localhost:3000/auth/authorize?client_id=sieks-client&redirect_uri=http://localhost:3001/auth/callback&response_type=code&state=xyz123&code_challenge=n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg&code_challenge_method=S256';
    return res.redirect(authUrl);
  }

  // 2. Callback yang dimodifikasi
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code)
      throw new UnauthorizedException('Authorization code tidak ditemukan');

    const { accessToken, userProfile } =
      await this.authService.exchangeCodeAndGetProfile(code);

    res.cookie('app_a_session', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });

    // Arahkan ke dashboard alih-alih mengembalikan JSON
    return res.redirect('/dashboard');
  }

  // 3. Endpoint Logout lokal
  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('app_a_session');
    return res.redirect('/');
  }
}
