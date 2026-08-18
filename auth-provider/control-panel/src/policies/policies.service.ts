// src/policies/policies.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('sso-events') private readonly eventQueue: Queue,
  ) {}

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
    const policy = await this.prisma.applicationGroupPolicy.findUnique({
      where: { id },
    });

    if (!policy) return null;

    const savedEvents = await this.prisma.$transaction(async (tx) => {
      await tx.applicationGroupPolicy.delete({ where: { id } });

      const userGroups = await tx.userGroup.findMany({
        where: { groupId: policy.groupId },
      });

      const newEvents: any[] = [];
      
      for (const ug of userGroups) {
        // Cabut token yang mengarah ke aplikasi ini
        await tx.accessToken.updateMany({
          where: { userId: ug.userId, applicationId: policy.applicationId, status: 'active' },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
          },
        });

        const eventPayload = {
          eventId: crypto.randomUUID(),
          eventType: 'AccessPolicyChanged',
          userId: ug.userId,
          centralSessionId: null,
          applicationId: policy.applicationId,
          reason: 'policy_removed',
          occurredAt: new Date().toISOString(),
          metadata: { groupId: policy.groupId },
        };

        const newEvent = await tx.event.create({
          data: {
            eventType: 'AccessPolicyChanged',
            userId: ug.userId,
            applicationId: policy.applicationId,
            payload: eventPayload,
            status: 'pending',
          },
        });
        
        newEvents.push(newEvent);
        
        await tx.auditLog.create({
          data: {
            eventType: 'AccessPolicyChanged',
            userId: ug.userId,
            applicationId: policy.applicationId,
            result: 'success',
            metadata: { action: 'policy_removed', groupId: policy.groupId },
          },
        });
      }

      return newEvents;
    });

    for (const event of savedEvents) {
      await this.eventQueue.add('AccessPolicyChanged', event.payload, {
        jobId: event.id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      });

      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: 'published', publishedAt: new Date() },
      });
    }

    return policy;
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
