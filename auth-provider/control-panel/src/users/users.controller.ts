import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Render,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Render('users/index')
  async index() {
    const users = await this.usersService.findAll();
    return { users };
  }

  @Get('new')
  @Render('users/new')
  newForm() {
    return {};
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Res() res: Response) {
    await this.usersService.create(dto);
    return res.redirect('/users');
  }

  @Get(':id/edit')
  @Render('users/edit')
  async editForm(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    const allGroups = await this.prisma.group.findMany();
    return { user, allGroups };
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Res() res: Response,
  ) {
    await this.usersService.update(id, dto);
    return res.redirect('/users');
  }

  @Post(':id/groups')
  async assignGroup(
    @Param('id') id: string,
    @Body('groupId') groupId: string,
    @Res() res: Response,
  ) {
    await this.usersService.assignGroup(id, groupId);
    return res.redirect(`/users/${id}/edit`);
  }

  @Post(':id/groups/:groupId/remove')
  async removeGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Res() res: Response,
  ) {
    await this.usersService.removeGroup(id, groupId);
    return res.redirect(`/users/${id}/edit`);
  }

  @Post(':id/sessions/:sessionId/revoke')
  async revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    await this.usersService.revokeSession(id, sessionId);
    return res.redirect(`/users/${id}/edit`);
  }

  @Post(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Kata sandi baru minimal 6 karakter' };
    }
    return this.usersService.changePassword(id, newPassword);
  }

  @Get(':id/mfa/setup')
  async mfaSetupForm(@Param('id') id: string, @Res() res: Response) {
    const user = await this.usersService.findOne(id);
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'SSO ITB', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    return res.render('users/mfa-setup', {
      user,
      secret,
      qrCodeUrl,
    });
  }

  @Post(':id/mfa/setup')
  async mfaSetup(
    @Param('id') id: string,
    @Body('secret') secret: string,
    @Body('code') code: string,
    @Res() res: Response,
  ) {
    const user = await this.usersService.findOne(id);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      // Re-render dengan error
      const otpauthUrl = authenticator.keyuri(user.email, 'SSO ITB', secret);
      const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);
      return res.render('users/mfa-setup', {
        user,
        secret,
        qrCodeUrl,
        error: 'Kode salah. Silakan coba lagi.',
      });
    }

    // Aktifkan MFA
    await this.prisma.user.update({
      where: { id },
      data: { mfaEnabled: true, mfaSecret: secret },
    });

    // Catat log audit
    await this.prisma.auditLog.create({
      data: {
        eventType: 'MfaEnrolled',
        userId: user.id,
        result: 'success',
        metadata: { action: 'admin_setup' },
      },
    });

    return res.redirect(`/users/${id}/edit`);
  }

  @Post(':id/mfa/disable')
  async mfaDisable(@Param('id') id: string, @Res() res: Response) {
    await this.prisma.user.update({
      where: { id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return res.redirect(`/users/${id}/edit`);
  }
}
