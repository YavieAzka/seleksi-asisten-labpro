import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: { userGroups: { include: { group: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userGroups: { include: { group: true } } },
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
    await this.findOne(id); // memastikan user ada, lempar 404 kalau tidak
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
    return this.prisma.userGroup.deleteMany({
      where: { userId, groupId },
    });
  }
}
