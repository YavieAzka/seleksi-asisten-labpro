import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const isError = res.statusCode >= 400;

      // Do not log the internal metrics endpoint itself to avoid recursive inflation
      if (req.originalUrl !== '/internal/metrics') {
        this.metricsService.recordRequest(duration, isError);
      }
    });

    next();
  }
}
