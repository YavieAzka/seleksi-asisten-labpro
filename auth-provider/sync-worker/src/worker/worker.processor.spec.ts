import { Test, TestingModule } from '@nestjs/testing';
import { WorkerProcessor } from './worker.processor';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bullmq';

describe('WorkerProcessor', () => {
  let processor: WorkerProcessor;
  let prisma: PrismaService;

  // Mock (tiruan) untuk fungsi database
  const mockPrismaService = {
    application: {
      findMany: jest.fn(),
    },
    eventDelivery: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    processor = module.get<WorkerProcessor>(WorkerProcessor);
    prisma = module.get<PrismaService>(PrismaService);

    // Mengganti fungsi fetch bawaan Node.js dengan mock
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('harus melempar eror jika Job ID tidak ditemukan', async () => {
    // Memaksa job.id menjadi undefined untuk melihat reaksi sistem
    const job = { id: undefined, data: {}, name: 'SessionRevoked' } as Job;
    await expect(processor.process(job)).rejects.toThrow(
      'Job ID tidak ditemukan',
    );
  });

  it('harus mengirim webhook dengan sukses dan mengubah status menjadi succeeded', async () => {
    const job = {
      id: 'job-123',
      data: { eventId: 'event-123' },
      name: 'SessionRevoked',
    } as any;

    // Skenario: Database menemukan 1 aplikasi aktif, dan event belum pernah diproses
    mockPrismaService.application.findMany.mockResolvedValue([
      {
        id: 'app-1',
        name: 'App A',
        logoutNotificationUrl: 'http://localhost:3001/logout',
      },
    ]);
    mockPrismaService.eventDelivery.findFirst.mockResolvedValue(null);
    mockPrismaService.eventDelivery.create.mockResolvedValue({
      id: 'delivery-1',
      attemptCount: 1,
    });

    // Skenario: HTTP request berhasil (status 200)
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await processor.process(job);

    expect(result).toEqual({ status: 'processed' });
    expect(global.fetch).toHaveBeenCalled();
    expect(prisma.eventDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded' }),
      }),
    );
  });

  it('harus mencatat kegagalan parsial dan memicu mekanisme retry di akhir', async () => {
    const job = {
      id: 'job-123',
      data: { eventId: 'event-123' },
      name: 'SessionRevoked',
    } as any;

    mockPrismaService.application.findMany.mockResolvedValue([
      {
        id: 'app-1',
        name: 'App A',
        logoutNotificationUrl: 'http://localhost:3001/logout',
      },
    ]);
    mockPrismaService.eventDelivery.findFirst.mockResolvedValue(null);
    mockPrismaService.eventDelivery.create.mockResolvedValue({
      id: 'delivery-1',
      attemptCount: 1,
    });

    // Skenario: HTTP request gagal (status 500)
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    // Pastikan fungsi pada akhirnya melempar eror untuk memicu fitur retry dari BullMQ
    await expect(processor.process(job)).rejects.toThrow(
      'Ada satu atau lebih aplikasi yang gagal diproses. Memicu mekanisme retry...',
    );

    // Pastikan status di database tetap diperbarui menjadi failed
    expect(prisma.eventDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});
