import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma.service';
import { InternalController } from './internal.controller';

@Module({
  imports: [AuthModule],
  controllers: [AppController, InternalController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
