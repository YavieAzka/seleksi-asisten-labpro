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
}
