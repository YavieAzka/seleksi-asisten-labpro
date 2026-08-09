import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common/exceptions';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
    // Hasilkan token acak (opaque token) yang aman untuk cookie
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Hash token sebelum disimpan ke database (SHA-256 sudah cukup untuk token session)
    const sessionTokenHash = crypto
      .createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    // Tentukan waktu kedaluwarsa (contoh: 1 hari)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Simpan ke database (sesuaikan 'ssoSession' dengan nama model di Prisma-mu)
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
    // Kembalikan rawToken (untuk dikirim ke client sebagai cookie) dan data session
    return { rawToken: sessionToken, session };
  }

  async validateCentralSession(rawToken: string) {
    if (!rawToken) return null;

    // Hash kembali token mentah dari cookie untuk dicocokkan dengan database
    const sessionTokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Cari sesi yang valid, belum expired, dan belum di-revoke
    const session = await this.prisma.ssoSession.findFirst({
      where: {
        sessionTokenHash,
        status: 'active',
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      // Kita include user dan group-nya karena nanti butuh untuk evaluasi Policy
      include: {
        user: {
          include: { userGroups: true },
        },
      },
    });

    // Jika sesi tidak ditemukan atau user sudah tidak aktif, kembalikan null
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
    // Cari aplikasi beserta redirect URI dan Policy-nya
    const app = await this.prisma.application.findUnique({
      where: { clientId },
      include: { redirectUris: true, groupPolicies: true },
    });

    if (!app || app.status !== 'active') {
      throw new UnauthorizedException(
        'Client ID tidak valid atau aplikasi tidak aktif',
      );
    }

    // Validasi redirect URI (harus exact match)
    const isValidUri = app.redirectUris.some(
      (uri) => uri.redirectUri === redirectUri,
    );
    if (!isValidUri) {
      throw new UnauthorizedException('Redirect URI tidak terdaftar');
    }

    // Evaluasi Policy akses (Apakah user memiliki group yang diizinkan?)
    const userGroupIds = userGroups.map((ug) => ug.groupId);
    const hasAccess = app.groupPolicies.some(
      (policy) =>
        policy.effect === 'allow' && userGroupIds.includes(policy.groupId),
    );

    if (!hasAccess) {
      // Catat ke audit log jika akses ditolak
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
    // Generate code acak
    const code = crypto.randomBytes(32).toString('hex');

    // Hash code sebelum disimpan (PKCE butuh code mentah nanti saat ditukar)
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // TTL pendek: 5 menit
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

    return code; // Code mentah yang akan dikirim via URL ke frontend
  }

  async exchangeCodeForToken(
    clientId: string,
    redirectUri: string,
    code: string,
    codeVerifier: string,
  ) {
    // 1. Hash code dari request untuk dicari di database
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

    // 2. Validasi PKCE (S256)
    // PKCE mewajibkan code_verifier di-hash dengan SHA256 lalu di-encode ke Base64URL
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

    // 3. Tandai code sudah digunakan
    await this.prisma.authorizationCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    // 4. Buat Access Token (Opaque Token)
    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Berlaku 1 jam

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

    // 5. Catat ke Audit Log
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
}
