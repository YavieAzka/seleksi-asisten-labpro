import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('internal/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}
