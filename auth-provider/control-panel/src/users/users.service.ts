import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    // Menginjeksi antrean 'sso-events' yang sudah didaftarkan di UsersModule
    @InjectQueue('sso-events') private readonly eventQueue: Queue,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: { userGroups: { include: { group: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userGroups: { include: { group: true } },
        ssoSessions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        status: 'active',
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (user.status === 'active' && dto.status === 'inactive') {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: dto,
        });

        await tx.ssoSession.updateMany({
          where: { userId: id, status: 'active' },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
            revokeReason: 'admin_deactivated',
          },
        });

        await tx.accessToken.updateMany({
          where: { userId: id, status: 'active' },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
          },
        });

        const eventPayload = {
          eventId: crypto.randomUUID(),
          eventType: 'AccessPolicyChanged',
          userId: id,
          centralSessionId: null,
          applicationId: null,
          reason: 'admin_deactivated',
          occurredAt: new Date().toISOString(),
          metadata: {},
        };

        const newEvent = await tx.event.create({
          data: {
            eventType: 'AccessPolicyChanged',
            userId: id,
            payload: eventPayload,
            status: 'pending',
          },
        });

        await tx.auditLog.create({
          data: {
            eventType: 'UserDeactivated',
            userId: id,
            result: 'success',
            metadata: { action: 'admin_deactivated' },
          },
        });

        return { updatedUser, newEvent };
      });

      await this.eventQueue.add('AccessPolicyChanged', result.newEvent.payload, {
        jobId: result.newEvent.id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      });

      await this.prisma.event.update({
        where: { id: result.newEvent.id },
        data: { status: 'published', publishedAt: new Date() },
      });

      return result.updatedUser;
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
    });
  }

  async assignGroup(userId: string, groupId: string) {
    await this.findOne(userId);
    return this.prisma.userGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId },
    });
  }

  async removeGroup(userId: string, groupId: string) {
    const savedEvents = await this.prisma.$transaction(async (tx) => {
      await tx.userGroup.deleteMany({
        where: { userId, groupId },
      });

      const policies = await tx.applicationGroupPolicy.findMany({
        where: { groupId },
      });

      const newEvents: any[] = [];
      for (const policy of policies) {
        await tx.accessToken.updateMany({
          where: { userId, applicationId: policy.applicationId, status: 'active' },
          data: { status: 'revoked', revokedAt: new Date() },
        });

        const eventPayload = {
          eventId: crypto.randomUUID(),
          eventType: 'AccessPolicyChanged',
          userId: userId,
          centralSessionId: null,
          applicationId: policy.applicationId,
          reason: 'removed_from_group',
          occurredAt: new Date().toISOString(),
          metadata: { groupId },
        };

        const newEvent = await tx.event.create({
          data: {
            eventType: 'AccessPolicyChanged',
            userId: userId,
            applicationId: policy.applicationId,
            payload: eventPayload,
            status: 'pending',
          },
        });
        newEvents.push(newEvent);

        await tx.auditLog.create({
          data: {
            eventType: 'AccessPolicyChanged',
            userId: userId,
            applicationId: policy.applicationId,
            result: 'success',
            metadata: { action: 'removed_from_group', groupId },
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

    return { success: true };
  }

  // --- PERBAIKAN: Pencabutan Sesi dengan Transactional Outbox ---
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.ssoSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Sesi tidak ditemukan atau tidak valid');
    }

    if (session.status !== 'active') {
      return session; // Jika sudah dicabut/kedaluwarsa, keluar lebih awal
    }

    // 1. Terapkan Transactional Outbox untuk konsistensi data
    const savedEvent = await this.prisma.$transaction(async (tx) => {
      // Cabut sesi sentral
      await tx.ssoSession.update({
        where: { id: sessionId },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: 'admin_revoked',
        },
      });

      // Cabut juga seluruh token aktif agar tidak bisa lagi menembus endpoint /userinfo
      await tx.accessToken.updateMany({
        where: { ssoSessionId: sessionId, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      });

      // Siapkan payload event sesuai spesifikasi SSO
      const eventPayload = {
        eventId: crypto.randomUUID(),
        eventType: 'SessionRevoked',
        userId: userId,
        centralSessionId: sessionId,
        applicationId: null, // null karena ini Global Logout
        reason: 'admin_revoked',
        occurredAt: new Date().toISOString(),
        metadata: {},
      };

      // Simpan event ke tabel outbox
      const newEvent = await tx.event.create({
        data: {
          eventType: 'SessionRevoked',
          userId: userId,
          centralSessionId: sessionId,
          payload: eventPayload,
          status: 'pending',
        },
      });

      // Catat ke audit log
      await tx.auditLog.create({
        data: {
          eventType: 'Logout',
          userId: userId,
          sessionId: sessionId,
          result: 'success',
          metadata: { reason: 'admin_revoked' },
        },
      });

      return newEvent;
    });

    // 2. Publikasikan pesan ke Message Queue (BullMQ)
    await this.eventQueue.add('SessionRevoked', savedEvent.payload, {
      jobId: savedEvent.id, // Menjamin idempotensi, mencegah duplikasi tugas di antrean
      attempts: 5, // Maksimal 5 kali percobaan ulang jika gagal
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // 3. Tandai status event menjadi 'published' setelah sukses terkirim ke broker
    await this.prisma.event.update({
      where: { id: savedEvent.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    return savedEvent;
  }

  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const savedEvent = await this.prisma.$transaction(async (tx) => {
      // Perbarui sandi pengguna
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Cabut SEMUA central session aktif (SsoSession)
      await tx.ssoSession.updateMany({
        where: { userId: userId, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: 'admin_forced_password_change',
        },
      });

      // Cabut SEMUA access token aktif (AccessToken)
      await tx.accessToken.updateMany({
        where: { userId: userId, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      });

      const eventPayload = {
        eventId: crypto.randomUUID(),
        eventType: 'PasswordChanged',
        userId: userId,
        centralSessionId: null,
        applicationId: null,
        reason: 'admin_forced_password_change',
        occurredAt: new Date().toISOString(),
        metadata: {},
      };

      const newEvent = await tx.event.create({
        data: {
          eventType: 'PasswordChanged',
          userId: userId,
          payload: eventPayload,
          status: 'pending',
        },
      });

      // Catat ke audit log (AuditLog)
      await tx.auditLog.create({
        data: {
          eventType: 'PasswordChanged',
          userId: userId,
          result: 'success',
          metadata: { action: 'admin_forced' },
        },
      });

      return newEvent;
    });

    await this.eventQueue.add('PasswordChanged', savedEvent.payload, {
      jobId: savedEvent.id,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });

    await this.prisma.event.update({
      where: { id: savedEvent.id },
      data: { status: 'published', publishedAt: new Date() },
    });

    return {
      message: 'Kata sandi berhasil diubah dan sesi global telah dicabut',
    };
  }
}
