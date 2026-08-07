// src/policies/policies.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.applicationGroupPolicy.findMany({
      include: { application: true, group: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(applicationId: string, groupId: string) {
    const existing = await this.prisma.applicationGroupPolicy.findUnique({
      where: {
        applicationId_groupId_effect: {
          applicationId,
          groupId,
          effect: 'allow',
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Policy untuk kombinasi aplikasi dan group ini sudah ada',
      );
    }

    return this.prisma.applicationGroupPolicy.create({
      data: { applicationId, groupId, effect: 'allow' },
    });
  }

  async remove(id: string) {
    return this.prisma.applicationGroupPolicy.delete({ where: { id } });
  }

  // Dipakai untuk mengisi dropdown di form "Tambah Policy"
  async getAllApplicationsAndGroups() {
    const [applications, groups] = await Promise.all([
      this.prisma.application.findMany(),
      this.prisma.group.findMany(),
    ]);
    return { applications, groups };
  }
}
