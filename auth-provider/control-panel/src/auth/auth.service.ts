import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAdminLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userGroups: {
          include: { group: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const isAdmin = user.userGroups.some((ug) => ug.group.name === 'Admin');
    if (!isAdmin) {
      throw new UnauthorizedException(
        'Akun ini tidak memiliki akses ke Control Panel',
      );
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}
