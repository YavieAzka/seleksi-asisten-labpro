import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sso-events',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
