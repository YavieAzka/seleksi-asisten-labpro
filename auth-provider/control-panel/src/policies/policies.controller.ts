// src/policies/policies.controller.ts
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
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';

@Controller('policies')
@UseGuards(AuthGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  @Render('policies/index')
  async index() {
    const policies = await this.policiesService.findAll();
    return { policies };
  }

  @Get('new')
  @Render('policies/new')
  async newForm() {
    const { applications, groups } =
      await this.policiesService.getAllApplicationsAndGroups();
    return { applications, groups };
  }

  @Post()
  async create(@Body() dto: CreatePolicyDto, @Res() res: Response) {
    await this.policiesService.create(dto.applicationId, dto.groupId);
    return res.redirect('/policies');
  }

  @Post(':id/remove')
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.policiesService.remove(id);
    return res.redirect('/policies');
  }
}
