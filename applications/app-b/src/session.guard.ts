import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service'; // Path ini sudah sesuai dengan struktur Anda
import { Request } from 'express';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // PERHATIAN: Pastikan ini sesuai dengan nama cookie di App B
    const sessionToken = request.cookies['app_b_session'];

    if (!sessionToken) {
      throw new UnauthorizedException(
        'Anda belum login atau sesi tidak ditemukan di browser.',
      );
    }

    // VALIDASI DATABASE: Pastikan sesi benar-benar ada dan berstatus 'active'
    const session = await this.prisma.localSession.findFirst({
      where: {
        sessionTokenHash: sessionToken,
        status: 'active',
      },
    });

    // Tolak akses jika sesi tidak ada di DB, sudah di-revoke, atau kedaluwarsa
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Sesi telah dicabut (revoked) atau kedaluwarsa. Silakan login kembali SSO.',
      );
    }

    return true;
  }
}
