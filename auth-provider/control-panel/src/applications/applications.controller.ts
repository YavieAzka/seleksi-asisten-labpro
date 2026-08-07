// src/applications/applications.controller.ts
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
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { AddRedirectUriDto } from './dto/add-redirect-uri.dto';

@Controller('applications')
@UseGuards(AuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Render('applications/index')
  async index() {
    const applications = await this.applicationsService.findAll();
    return { applications };
  }

  @Get('new')
  @Render('applications/new')
  newForm() {
    return {};
  }

  @Post()
  async create(@Body() dto: CreateApplicationDto, @Res() res: Response) {
    await this.applicationsService.create(dto);
    return res.redirect('/applications');
  }

  @Get(':id/edit')
  @Render('applications/edit')
  async editForm(@Param('id') id: string) {
    const application = await this.applicationsService.findOne(id);
    return { application };
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @Res() res: Response,
  ) {
    await this.applicationsService.update(id, dto);
    return res.redirect('/applications');
  }

  @Post(':id/redirect-uris')
  async addRedirectUri(
    @Param('id') id: string,
    @Body() dto: AddRedirectUriDto,
    @Res() res: Response,
  ) {
    await this.applicationsService.addRedirectUri(id, dto.redirectUri);
    return res.redirect(`/applications/${id}/edit`);
  }

  @Post(':id/redirect-uris/:redirectUriId/remove')
  async removeRedirectUri(
    @Param('id') id: string,
    @Param('redirectUriId') redirectUriId: string,
    @Res() res: Response,
  ) {
    await this.applicationsService.removeRedirectUri(redirectUriId);
    return res.redirect(`/applications/${id}/edit`);
  }
}
