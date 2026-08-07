// src/applications/applications.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.application.findMany({
      include: { redirectUris: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { redirectUris: true },
    });
    if (!app) throw new NotFoundException('Aplikasi tidak ditemukan');
    return app;
  }

  async create(dto: CreateApplicationDto) {
    const existing = await this.prisma.application.findUnique({
      where: { clientId: dto.clientId },
    });
    if (existing) throw new ConflictException('client_id sudah dipakai');

    return this.prisma.application.create({
      data: {
        name: dto.name,
        clientId: dto.clientId,
        logoutNotificationUrl: dto.logoutNotificationUrl,
        status: 'active',
        redirectUris: {
          create: [{ redirectUri: dto.redirectUri }],
        },
      },
    });
  }

  async update(id: string, dto: UpdateApplicationDto) {
    await this.findOne(id);
    return this.prisma.application.update({ where: { id }, data: dto });
  }

  async addRedirectUri(applicationId: string, redirectUri: string) {
    await this.findOne(applicationId);
    return this.prisma.applicationRedirectUri.create({
      data: { applicationId, redirectUri },
    });
  }

  async removeRedirectUri(redirectUriId: string) {
    return this.prisma.applicationRedirectUri.delete({
      where: { id: redirectUriId },
    });
  }
}
