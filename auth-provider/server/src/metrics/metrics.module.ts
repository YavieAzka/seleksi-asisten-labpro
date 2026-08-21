import { Module, MiddlewareConsumer } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sso-events',
    }),
  ],
  providers: [MetricsService],
  controllers: [MetricsController],
})
export class MetricsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
