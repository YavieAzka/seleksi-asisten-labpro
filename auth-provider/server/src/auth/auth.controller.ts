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
    @Body() loginDto: LoginDto, // Kembali menggunakan DTO yang rapi
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Destrukturisasi semua nilai dari DTO
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

    const user = await this.authService.validateUser(email, password);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

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

    // 1. Jika ada redirect_uri (login dari layar browser SSO)
    if (redirect_uri) {
      const queryString = new URLSearchParams({
        client_id: client_id || '',
        redirect_uri: redirect_uri || '',
        response_type: response_type || '',
        state: state || '',
        code_challenge: code_challenge || '',
        code_challenge_method: code_challenge_method || '',
      }).toString();

      return res.redirect(`/auth/authorize?${queryString}`);
    }

    // 2. Jika tidak ada redirect_uri (login manual dari API/PowerShell)
    return res.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  }

  @Get('authorize')
  async authorize(
    @Query() query: AuthorizeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sessionId = req.cookies['sso_session'];

    if (!sessionId) {
      // Jika belum login, ubah objek query jadi string URL dan redirect ke form login
      const queryString = new URLSearchParams(query as any).toString();
      return res.redirect(`/auth/login-page?${queryString}`);
    }
    // Ambil cookie sso_session dari request
    const rawToken = req.cookies['sso_session'];
    if (!rawToken) {
      throw new UnauthorizedException('Harap login terlebih dahulu');
      // Nantinya, jika diakses via browser, bagian ini bisa diubah menjadi
      // res.redirect('/halaman-login') sesuai kebutuhan UI.
    }

    // Validasi central session
    const session = await this.authService.validateCentralSession(rawToken);
    if (!session) {
      throw new UnauthorizedException(
        'Sesi tidak valid atau telah kedaluwarsa',
      );
    }

    // Validasi Client ID, Redirect URI, dan Policy akses
    const app = await this.authService.validateClientAndPolicy(
      query.client_id,
      query.redirect_uri,
      session.user.userGroups,
    );

    // Buat Authorization Code
    const code = await this.authService.generateAuthorizationCode(
      session.userId,
      app.id,
      session.id,
      query.redirect_uri,
      query.code_challenge,
      query.code_challenge_method,
    );

    // Redirect kembali ke App A / App B dengan membawa parameter code dan state
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
    // Ambil token dari header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token tidak ditemukan di header');
    }

    const token = authHeader.split(' ')[1];
    return this.authService.getUserInfoByToken(token);
  }

  @Get('login-page')
  renderLogin(@Query() query: any, @Res() res: Response) {
    // Teruskan semua query parameters ke EJS agar nanti bisa dikirim ulang lewat form
    return res.render('login', { query });
  }
}
