import { Test, TestingModule } from '@nestjs/testing';
import { InternalController } from './internal.controller';
import { PrismaService } from './prisma.service';

describe('InternalController', () => {
  let controller: InternalController;
  let prisma: PrismaService;

  // Membuat mock (tiruan) untuk fungsi-fungsi Prisma
  const mockPrismaService = {
    processedEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    localSession: {
      deleteMany: jest.fn(),
    },
    // Mock untuk transaksi agar mengeksekusi callback menggunakan mockPrismaService itu sendiri
    $transaction: jest.fn(async (cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<InternalController>(InternalController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Membersihkan memori mock setelah tiap tes
  });

  it('harus menolak payload yang tidak lengkap', async () => {
    const result = await controller.handleLogoutWebhook({ eventId: '123' }); // centralSessionId hilang

    expect(result).toEqual({ status: 'error', message: 'Invalid payload' });
    expect(prisma.processedEvent.findUnique).not.toHaveBeenCalled();
  });

  it('harus mengabaikan event yang sudah pernah diproses (Idempotency)', async () => {
    // Skenario: Database mengembalikan data (artinya event sudah ada)
    mockPrismaService.processedEvent.findUnique.mockResolvedValueOnce({
      id: 1,
      eventId: '123',
    });

    const result = await controller.handleLogoutWebhook({
      eventId: '123',
      centralSessionId: 'abc',
    });

    expect(result).toEqual({ status: 'ignored', reason: 'already_processed' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('harus memproses event baru dan mencabut sesi lokal', async () => {
    // Skenario: Database tidak menemukan event (artinya event baru)
    mockPrismaService.processedEvent.findUnique.mockResolvedValueOnce(null);

    const result = await controller.handleLogoutWebhook({
      eventId: '123',
      centralSessionId: 'abc',
      eventType: 'SessionRevoked',
    });

    expect(result).toEqual({ status: 'success' });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.localSession.deleteMany).toHaveBeenCalledWith({
      where: { centralSessionId: 'abc' },
    });
    expect(prisma.processedEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: '123',
        eventType: 'SessionRevoked',
        result: 'success',
      }),
    });
  });

  it('harus melempar eror jika transaksi database gagal', async () => {
    mockPrismaService.processedEvent.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.$transaction.mockRejectedValueOnce(new Error('DB Error'));

    await expect(
      controller.handleLogoutWebhook({
        eventId: '123',
        centralSessionId: 'abc',
      }),
    ).rejects.toThrow('Gagal memproses webhook sinkronisasi sesi');
  });
});
