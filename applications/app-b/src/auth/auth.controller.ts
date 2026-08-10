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

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code) {
      throw new UnauthorizedException('Authorization code tidak ditemukan');
    }

    const { accessToken, userProfile } =
      await this.authService.exchangeCodeAndGetProfile(code);

    // Simpan sesi lokal khusus untuk App B
    res.cookie('app_b_session', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });

    return res.json({
      message: 'Login Edunek Berhasil!',
      profile: userProfile,
    });
  }
}
