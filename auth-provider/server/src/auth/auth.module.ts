import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    // Tambahkan baris ini di dalam array imports
    BullModule.registerQueue({
      name: 'sso-events',
    }),
    // ... import lainnya (seperti PrismaModule jika ada)
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
