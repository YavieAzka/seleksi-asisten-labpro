import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common/exceptions';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    // Menginjeksi antrean 'sso-events' yang sudah didaftarkan di AppModule
    @InjectQueue('sso-events') private readonly eventQueue: Queue,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Kredensial tidak valid');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const isPasswordMatching = await bcrypt.compare(pass, user.passwordHash);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Kredensial tidak valid');
    }

    return user;
  }

  async createCentralSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const sessionTokenHash = crypto
      .createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const session = await this.prisma.ssoSession.create({
      data: {
        userId,
        sessionTokenHash,
        status: 'active',
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
    return { rawToken: sessionToken, session };
  }

  async validateCentralSession(rawToken: string) {
    if (!rawToken) return null;

    const sessionTokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const session = await this.prisma.ssoSession.findFirst({
      where: {
        sessionTokenHash,
        status: 'active',
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: {
        user: {
          include: { userGroups: true },
        },
      },
    });

    if (!session || session.user.status !== 'active') {
      return null;
    }

    return session;
  }

  async validateClientAndPolicy(
    clientId: string,
    redirectUri: string,
    userGroups: any[],
  ) {
    const app = await this.prisma.application.findUnique({
      where: { clientId },
      include: { redirectUris: true, groupPolicies: true },
    });

    if (!app || app.status !== 'active') {
      throw new UnauthorizedException(
        'Client ID tidak valid atau aplikasi tidak aktif',
      );
    }

    const isValidUri = app.redirectUris.some(
      (uri) => uri.redirectUri === redirectUri,
    );
    if (!isValidUri) {
      throw new UnauthorizedException('Redirect URI tidak terdaftar');
    }

    const userGroupIds = userGroups.map((ug) => ug.groupId);
    const hasAccess = app.groupPolicies.some(
      (policy) =>
        policy.effect === 'allow' && userGroupIds.includes(policy.groupId),
    );

    if (!hasAccess) {
      await this.prisma.auditLog.create({
        data: {
          eventType: 'PolicyDenied',
          applicationId: app.id,
          result: 'failed',
          metadata: { reason: 'User group not allowed' },
        },
      });
      throw new UnauthorizedException('Akses ditolak oleh policy');
    }

    return app;
  }

  async generateAuthorizationCode(
    userId: string,
    applicationId: string,
    ssoSessionId: string,
    redirectUri: string,
    codeChallenge: string,
    codeChallengeMethod: string,
  ) {
    const code = crypto.randomBytes(32).toString('hex');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.prisma.authorizationCode.create({
      data: {
        codeHash,
        userId,
        applicationId,
        ssoSessionId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        expiresAt,
      },
    });

    return code;
  }

  async exchangeCodeForToken(
    clientId: string,
    redirectUri: string,
    code: string,
    codeVerifier: string,
  ) {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const authCode = await this.prisma.authorizationCode.findFirst({
      where: {
        codeHash,
        redirectUri,
        application: { clientId },
      },
    });

    if (!authCode) {
      throw new UnauthorizedException('Authorization code tidak valid');
    }

    if (authCode.usedAt) {
      throw new UnauthorizedException(
        'Authorization code sudah pernah digunakan',
      );
    }

    if (authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Authorization code telah kedaluwarsa');
    }

    const expectedChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (authCode.codeChallenge !== expectedChallenge) {
      throw new UnauthorizedException('PKCE verifier tidak valid');
    }

    await this.prisma.authorizationCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.accessToken.create({
      data: {
        tokenHash,
        userId: authCode.userId,
        applicationId: authCode.applicationId,
        ssoSessionId: authCode.ssoSessionId,
        expiresAt,
        status: 'active',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        eventType: 'TokenIssued',
        userId: authCode.userId,
        applicationId: authCode.applicationId,
        sessionId: authCode.ssoSessionId,
        result: 'success',
      },
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  async getUserInfoByToken(rawToken: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const accessToken = await this.prisma.accessToken.findFirst({
      where: {
        tokenHash,
        status: 'active',
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: { user: true },
    });

    if (!accessToken || accessToken.user.status !== 'active') {
      throw new UnauthorizedException(
        'Access token tidak valid atau telah kedaluwarsa',
      );
    }

    return {
      sub: accessToken.user.id,
      name: accessToken.user.name,
      email: accessToken.user.email,
    };
  }

  // --- FUNGSI BARU: Pencabutan Sesi secara Sinkron & Asinkron ---
  async revokeCentralSession(rawToken: string, reason: string = 'sso_logout') {
    if (!rawToken) return;

    const sessionTokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // 1. Cari sesi sentral yang masih aktif
    const session = await this.prisma.ssoSession.findFirst({
      where: { sessionTokenHash, status: 'active' },
    });

    if (!session) return;

    // 2. Terapkan Transactional Outbox
    const savedEvent = await this.prisma.$transaction(async (tx) => {
      // Cabut sesi sentral
      await tx.ssoSession.update({
        where: { id: session.id },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: reason,
        },
      });

      // Cabut semua akses token yang terkait dengan sesi ini agar tidak bisa digunakan lagi
      await tx.accessToken.updateMany({
        where: { ssoSessionId: session.id, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      });

      // Siapkan payload event sesuai spesifikasi
      const eventPayload = {
        eventId: crypto.randomUUID(), // Dihasilkan agar unik
        eventType: 'SessionRevoked',
        userId: session.userId,
        centralSessionId: session.id,
        applicationId: null, // null karena ini logout global untuk semua aplikasi
        reason: reason,
        occurredAt: new Date().toISOString(),
        metadata: {},
      };

      // Simpan event ke tabel events untuk outbox
      const newEvent = await tx.event.create({
        data: {
          eventType: 'SessionRevoked',
          userId: session.userId,
          centralSessionId: session.id,
          payload: eventPayload,
          status: 'pending', // Masih pending sebelum masuk Redis
        },
      });

      // Catat ke audit log
      await tx.auditLog.create({
        data: {
          eventType: 'Logout',
          userId: session.userId,
          sessionId: session.id,
          result: 'success',
          metadata: { reason },
        },
      });

      return newEvent;
    });

    // 3. Masukkan ke Message Queue (BullMQ)
    // Penggunaan properti jobId memastikan event yang sama tidak dikerjakan dua kali
    await this.eventQueue.add('SessionRevoked', savedEvent.payload, {
      jobId: savedEvent.id,
      attempts: 5, // Maksimal 5 kali percobaan ulang jika gagal
      backoff: {
        type: 'exponential',
        delay: 2000, // Jeda waktu eksponensial agar tidak membanjiri aplikasi klien
      },
    });

    // 4. Tandai bahwa event berhasil dikirim ke antrean
    await this.prisma.event.update({
      where: { id: savedEvent.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }

  async changePasswordSelf(
    rawSessionCookie: string,
    oldPassword: string,
    newPassword: string,
  ) {
    // 1. Hash cookie mentah untuk dicocokkan dengan sessionTokenHash di database
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawSessionCookie)
      .digest('hex');

    // 2. Cari sesi menggunakan sessionTokenHash (sesuai schema.prisma)
    const session = await this.prisma.ssoSession.findFirst({
      where: {
        sessionTokenHash: tokenHash,
        status: 'active', // Menggunakan enum SessionStatus
      },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException(
        'Sesi tidak ditemukan atau sudah tidak valid',
      );
    }

    const userId = session.userId;

    // 3. Validasi Kata Sandi Lama menggunakan passwordHash (sesuai schema.prisma)
    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      session.user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Kata sandi lama salah');
    }

    // 4. Hash Kata Sandi Baru
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 5. Transactional Outbox (Atomisitas Data)
    const savedEvent = await this.prisma.$transaction(async (tx) => {
      // Perbarui sandi di tabel User
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }, // updatedAt otomatis dari Prisma @updatedAt
      });

      // Cabut SEMUA central session (SsoSession) milik pengguna ini
      await tx.ssoSession.updateMany({
        where: { userId: userId, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: 'password_changed',
        },
      });

      // Cabut SEMUA access token (AccessToken) milik pengguna ini
      await tx.accessToken.updateMany({
        where: { userId: userId, status: 'active' },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      });

      // Buat payload event untuk Sync Worker
      const eventPayload = {
        eventId: crypto.randomUUID(),
        eventType: 'PasswordChanged',
        userId: userId,
        centralSessionId: null,
        applicationId: null,
        reason: 'password_changed',
        occurredAt: new Date().toISOString(),
        metadata: {},
      };

      // Simpan event ke outbox (Event)
      const newEvent = await tx.event.create({
        data: {
          eventType: 'PasswordChanged',
          userId: userId,
          payload: eventPayload,
          status: 'pending',
        },
      });

      // Catat log audit (AuditLog)
      await tx.auditLog.create({
        data: {
          eventType: 'PasswordChanged',
          userId: userId,
          sessionId: session.id, // Menyimpan UUID asli dari sesi
          result: 'success',
          metadata: { action: 'user_self_service' },
        },
      });

      return newEvent;
    });

    // 6. Publikasikan ke Message Queue (BullMQ)
    await this.eventQueue.add('PasswordChanged', savedEvent.payload, {
      jobId: savedEvent.id,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // 7. Tandai event terpublikasi
    await this.prisma.event.update({
      where: { id: savedEvent.id },
      data: { status: 'published', publishedAt: new Date() },
    });

    return true;
  }
}
