import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthorizeDto } from './dto/authorize.dto';
import type { Request, Response } from 'express';
import { BadRequestException } from '@nestjs/common/exceptions';
import { TokenDto } from './dto/token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const {
      email,
      password,
      client_id,
      redirect_uri,
      response_type,
      state,
      code_challenge,
      code_challenge_method,
    } = loginDto;

    const { user, mfaRequired, challengeId } = await this.authService.validateUser(email, password);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (redirect_uri) {
      const queryString = new URLSearchParams({
        client_id: client_id || '',
        redirect_uri: redirect_uri || '',
        response_type: response_type || '',
        state: state || '',
        code_challenge: code_challenge || '',
        code_challenge_method: code_challenge_method || '',
      }).toString();

      if (mfaRequired) {
        return res.redirect(`/auth/mfa-page?challenge_id=${challengeId}&${queryString}`);
      }

      const { rawToken, session } = await this.authService.createCentralSession(
        user.id,
        ipAddress,
        userAgent,
      );

      res.cookie('sso_session', rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: session.expiresAt,
      });

      return res.redirect(`/auth/authorize?${queryString}`);
    }

    if (mfaRequired) {
      return res.redirect(`/auth/mfa-page?challenge_id=${challengeId}`);
    }

    const { rawToken, session } = await this.authService.createCentralSession(
      user.id,
      ipAddress,
      userAgent,
    );

    res.cookie('sso_session', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
    });

    return res.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  }

  @Get('mfa-page')
  renderMfaPage(@Query() query: any, @Res() res: Response) {
    return res.render('mfa-challenge', { query });
  }

  @Post('mfa-verify')
  async mfaVerify(
    @Body('challenge_id') challengeId: string,
    @Body('code') code: string,
    @Body('client_id') clientId: string,
    @Body('redirect_uri') redirectUri: string,
    @Body('response_type') responseType: string,
    @Body('state') state: string,
    @Body('code_challenge') codeChallenge: string,
    @Body('code_challenge_method') codeChallengeMethod: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { rawToken, session } = await this.authService.verifyMfa(
      challengeId,
      code,
      ipAddress,
      userAgent,
    );

    res.cookie('sso_session', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
    });

    if (redirectUri) {
      const queryString = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri || '',
        response_type: responseType || '',
        state: state || '',
        code_challenge: codeChallenge || '',
        code_challenge_method: codeChallengeMethod || '',
      }).toString();

      return res.redirect(`/auth/authorize?${queryString}`);
    }

    return res.json({ message: 'Login MFA berhasil' });
  }

  @Get('authorize')
  async authorize(
    @Query() query: AuthorizeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawToken = req.cookies['sso_session'];

    // 1. Jika tidak ada cookie sama sekali, langsung arahkan ke halaman login
    if (!rawToken) {
      const queryString = new URLSearchParams(query as any).toString();
      return res.redirect(`/auth/login-page?${queryString}`);
    }

    // 2. Validasi status cookie di database
    const session = await this.authService.validateCentralSession(rawToken);

    // 3. PERBAIKAN: Jika sesi sudah dicabut/kedaluwarsa (null)
    // Jangan lempar 401. Hapus cookie lama dan paksa login ulang!
    if (!session) {
      res.clearCookie('sso_session'); // Bersihkan cookie yang sudah revoked
      const queryString = new URLSearchParams(query as any).toString();
      return res.redirect(`/auth/login-page?${queryString}`);
    }

    // 4. Evaluasi Policy dan Klien
    const app = await this.authService.validateClientAndPolicy(
      query.client_id,
      query.redirect_uri,
      session.user.userGroups,
    );

    // 5. Terbitkan Authorization Code
    const code = await this.authService.generateAuthorizationCode(
      session.userId,
      app.id,
      session.id,
      query.redirect_uri,
      query.code_challenge,
      query.code_challenge_method,
    );

    // 6. Redirect kembali ke aplikasi (App A / App B)
    const redirectUrl = new URL(query.redirect_uri);
    redirectUrl.searchParams.append('code', code);
    redirectUrl.searchParams.append('state', query.state);

    return res.redirect(302, redirectUrl.toString());
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() tokenDto: TokenDto) {
    if (tokenDto.grant_type !== 'authorization_code') {
      throw new BadRequestException('Grant type tidak didukung');
    }

    return this.authService.exchangeCodeForToken(
      tokenDto.client_id,
      tokenDto.redirect_uri,
      tokenDto.code,
      tokenDto.code_verifier,
    );
  }

  @Get('userinfo')
  async userinfo(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token tidak ditemukan di header');
    }

    const token = authHeader.split(' ')[1];
    return this.authService.getUserInfoByToken(token);
  }

  @Get('login-page')
  renderLogin(@Query() query: any, @Res() res: Response) {
    return res.render('login', { query });
  }

  // --- ENDPOINT BARU: Global Logout SSO ---
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies['sso_session'];

    if (rawToken) {
      // Cabut sesi secara sinkron dan publikasikan event secara asinkron
      await this.authService.revokeCentralSession(rawToken, 'sso_logout');
    }

    // Bersihkan cookie peramban
    res.clearCookie('sso_session');

    // Kembalikan ke halaman login agar pengguna tahu mereka sudah keluar
    return res.redirect('/auth/login-page');
  }

  @Post('change-password')
  async changePasswordSelf(
    @Req() req: Request,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
    @Res() res: Response,
  ) {
    // 1. Ambil session ID dari cookie pengguna yang sedang login
    const sessionId = req.cookies['sso_session'];
    //console.log('>>> DEBUG GANTI SANDI - Isi sessionId:', sessionId);
    if (!sessionId) {
      return res.status(401).json({ error: 'Tidak ada sesi aktif' });
    }

    // 2. Panggil service untuk eksekusi
    await this.authService.changePasswordSelf(
      sessionId,
      oldPassword,
      newPassword,
    );

    // 3. Bersihkan cookie karena sesinya sudah dicabut global
    res.clearCookie('sso_session');

    // 4. Redirect pengguna kembali ke halaman login
    return res.redirect(
      '/auth/login-page?message=Sandi berhasil diubah. Silakan login kembali.',
    );
  }

  @Get('change-password')
  renderChangePasswordPage(@Req() req: Request, @Res() res: Response) {
    // Pastikan pengguna memiliki sesi sebelum bisa melihat form ini
    if (!req.cookies['sso_session']) {
      return res.redirect(
        '/auth/login-page?error=Silakan login terlebih dahulu',
      );
    }
    // Render file template change-password.ejs
    return res.render('change-password');
  }
}
