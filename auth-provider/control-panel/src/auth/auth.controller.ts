import {
  Body,
  Controller,
  Get,
  Post,
  Render,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @Render('login')
  loginPage(@Req() req: Request) {
    if (req.session?.adminUser) {
      return { redirectTo: '/dashboard' };
    }
    return { error: null };
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const admin = await this.authService.validateAdminLogin(
        body.email,
        body.password,
      );
      req.session.adminUser = admin;
      return res.redirect('/dashboard');
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        return res.render('login', { error: err.message });
      }
      throw err;
    }
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
}
