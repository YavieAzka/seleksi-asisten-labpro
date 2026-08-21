import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface RequestRecord {
  timestamp: number;
  durationMs: number;
  isError: boolean;
}

@Injectable()
export class MetricsService {
  private records: RequestRecord[] = [];
  private readonly WINDOW_MS = 60 * 1000; // 60 seconds sliding window

  constructor(@InjectQueue('sso-events') private readonly eventQueue: Queue) {
    // Periodically clean up old records every 10 seconds
    setInterval(() => this.cleanup(), 10 * 1000);
  }

  recordRequest(durationMs: number, isError: boolean) {
    this.records.push({
      timestamp: Date.now(),
      durationMs,
      isError,
    });
  }

  private cleanup() {
    const now = Date.now();
    this.records = this.records.filter((r) => now - r.timestamp < this.WINDOW_MS);
  }

  async getMetrics() {
    this.cleanup();

    const totalRequests = this.records.length;
    const totalErrors = this.records.filter((r) => r.isError).length;
    
    // Calculate average latency
    const totalDuration = this.records.reduce((sum, r) => sum + r.durationMs, 0);
    const avgLatency = totalRequests > 0 ? totalDuration / totalRequests : 0;

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Get queue depth directly from Redis via BullMQ
    const queueCounts = await this.eventQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      timeWindowSeconds: 60,
      totalRequests,
      avgLatencyMs: Math.round(avgLatency),
      errorRatePercent: errorRate.toFixed(2),
      queue: {
        waiting: queueCounts.waiting,
        active: queueCounts.active,
        failed: queueCounts.failed,
      }
    };
  }
}
