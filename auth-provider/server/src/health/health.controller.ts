import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private redisClient: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      enableOfflineQueue: false, // Agar perintah ping() gagal seketika jika Redis mati, bukan masuk antrean
    });
    
    // Tangani error agar aplikasi tidak crash karena unhandled promise rejection
    this.redisClient.on('error', () => {
      // diamkan saja, biarkan health check menangkapnya saat di-ping
    });
  }

  @Get('live')
  checkLiveness() {
    return { status: 'alive' };
  }

  @Get('ready')
  async checkReadiness() {
    const status = {
      database: 'ok',
      redis: 'ok',
    };
    let isReady = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      status.database = 'failed';
      isReady = false;
    }

    try {
      const pingResult = await this.redisClient.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Redis ping tidak membalas PONG');
      }
    } catch (e) {
      status.redis = 'failed';
      isReady = false;
    }

    if (!isReady) {
      throw new ServiceUnavailableException({
        status: 'error',
        components: status,
      });
    }

    return {
      status: 'ready',
      components: status,
    };
  }
}
