import {
  Controller,
  Get,
  Query,
  Res,
  Req,
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

    // Tukarkan kode dengan token dan dapatkan profil
    const { accessToken, userProfile } =
      await this.authService.exchangeCodeAndGetProfile(code);

    // Di sinilah App A menyimpan sesi lokalnya!
    // Untuk saat ini, kita set cookie sederhana dan kembalikan JSON profil
    res.cookie('app_a_session', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });

    // Idealnya di-redirect ke halaman Dashboard Frontend App A.
    // Sementara kita return JSON untuk memastikan datanya masuk.
    return res.json({
      message: 'Login SiEks Berhasil!',
      profile: userProfile,
    });
  }
}
