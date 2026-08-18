// src/policies/policies.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sso-events',
    }),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
