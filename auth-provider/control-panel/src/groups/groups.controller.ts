// src/groups/groups.controller.ts
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
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @Render('groups/index')
  async index() {
    const groups = await this.groupsService.findAll();
    return { groups };
  }

  @Get('new')
  @Render('groups/new')
  newForm() {
    return {};
  }

  @Post()
  async create(@Body() dto: CreateGroupDto, @Res() res: Response) {
    await this.groupsService.create(dto);
    return res.redirect('/groups');
  }

  @Get(':id/edit')
  @Render('groups/edit')
  async editForm(@Param('id') id: string) {
    const group = await this.groupsService.findOne(id);
    return { group };
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @Res() res: Response,
  ) {
    await this.groupsService.update(id, dto);
    return res.redirect('/groups');
  }
}
