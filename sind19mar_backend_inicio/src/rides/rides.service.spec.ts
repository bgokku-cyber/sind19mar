import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RidesService } from './rides.service';

type TransactionMock = {
  ride: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    updateMany: jest.Mock;
  };
  driver: {
    updateMany: jest.Mock;
  };
  ridePayment: {
    upsert: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
};

describe('RidesService critical transitions and cash payments', () => {
  let tx: TransactionMock;
  let prisma: PrismaService;
  let service: RidesService;

  beforeEach(() => {
    tx = {
      ride: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      driver: {
        updateMany: jest.fn(),
      },
      ridePayment: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(
        async (callback: (client: TransactionMock) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;

    service = new RidesService(prisma);
  });

  it('claims an available verified driver before assigning a requested ride', async () => {
    const ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
      paymentMethod: PaymentMethod.CASH,
    };
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(ride);

    await expect(service.accept('ride-1', 'driver-1')).resolves.toBe(ride);

    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'driver-1',
        availability: 'AVAILABLE',
        verifiedAt: { not: null },
        user: { status: 'ACTIVE' },
        vehicles: { some: { isActive: true } },
        OR: [{ fleetId: null }, { fleet: { is: { status: 'ACTIVE' } } }],
      },
      data: { availability: 'ON_TRIP' },
    });
    expect(tx.ride.updateMany).toHaveBeenCalledWith({
      where: { id: 'ride-1', status: RideStatus.REQUESTED, driverId: null },
      data: expect.objectContaining({
        driverId: 'driver-1',
        status: RideStatus.ACCEPTED,
        acceptedAt: expect.any(Date),
      }),
    });
  });

  it('completes a ride and releases the assigned driver', async () => {
    const completedRide = { id: 'ride-1', status: RideStatus.COMPLETED };
    tx.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.IN_PROGRESS,
    });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(completedRide);

    await expect(
      service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED),
    ).resolves.toBe(completedRide);

    expect(tx.ride.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ride-1',
        driverId: 'driver-1',
        status: RideStatus.IN_PROGRESS,
      },
      data: expect.objectContaining({
        status: RideStatus.COMPLETED,
        completedAt: expect.any(Date),
      }),
    });
    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', availability: 'ON_TRIP' },
      data: { availability: 'AVAILABLE' },
    });
  });

  it('rejects a ride status transition that skips the allowed sequence', async () => {
    tx.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.REQUESTED,
    });

    await expect(
      service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ride.updateMany).not.toHaveBeenCalled();
    expect(tx.driver.updateMany).not.toHaveBeenCalled();
  });

  it('releases the driver when an administrator cancels an accepted ride', async () => {
    const cancelledRide = { id: 'ride-1', status: RideStatus.CANCELLED };
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passengerId: 'passenger-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
    });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(cancelledRide);

    await expect(
      service.cancel('ride-1', { role: 'ADMIN' }),
    ).resolves.toBe(cancelledRide);

    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', availability: 'ON_TRIP' },
      data: { availability: 'AVAILABLE' },
    });
  });

  it('does not let a passenger cancel a ride after it has been accepted', async () => {
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passengerId: 'passenger-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
    });

    await expect(
      service.cancel('ride-1', {
        role: 'PASSENGER',
        passengerId: 'passenger-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ride.updateMany).not.toHaveBeenCalled();
    expect(tx.driver.updateMany).not.toHaveBeenCalled();
  });

  it('records a cash payment for the assigned driver using the server final fare', async () => {
    const finalFare = new Prisma.Decimal('24.50');
    const pendingPayment = {
      id: 'payment-1',
      rideId: 'ride-1',
      amount: finalFare,
      currency: 'BOB',
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
    };
    const paidPayment = { ...pendingPayment, status: PaymentStatus.PAID };

    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      finalFare,
    });
    tx.ridePayment.upsert.mockResolvedValue(pendingPayment);
    tx.ridePayment.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.ridePayment.findUniqueOrThrow.mockResolvedValue(paidPayment);

    await expect(
      service.confirmCashPayment('ride-1', 'driver-1', 'user-1'),
    ).resolves.toBe(paidPayment);

    expect(tx.ridePayment.upsert).toHaveBeenCalledWith({
      where: { rideId: 'ride-1' },
      create: {
        rideId: 'ride-1',
        amount: finalFare,
        currency: 'BOB',
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
      },
      update: {},
    });
    expect(tx.ridePayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: PaymentStatus.PENDING, method: PaymentMethod.CASH },
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        paidAt: expect.any(Date),
        cashConfirmedAt: expect.any(Date),
        cashConfirmedByUserId: 'user-1',
      }),
    });
    expect(tx.ride.updateMany).toHaveBeenCalledWith({
      where: { id: 'ride-1', driverId: 'driver-1', status: RideStatus.COMPLETED },
      data: { paymentStatus: PaymentStatus.PAID },
    });
  });

  it('rejects cash confirmation from a driver who is not assigned to the ride', async () => {
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'another-driver',
      status: RideStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      finalFare: new Prisma.Decimal('24.50'),
    });

    await expect(
      service.confirmCashPayment('ride-1', 'driver-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.ridePayment.upsert).not.toHaveBeenCalled();
  });

  it('does not create a cash payment until the server has calculated a positive final fare', async () => {
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      finalFare: null,
    });

    await expect(
      service.confirmCashPayment('ride-1', 'driver-1', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ridePayment.upsert).not.toHaveBeenCalled();
  });

  it('rejects cash confirmation for a digital-payment ride', async () => {
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.COMPLETED,
      paymentMethod: PaymentMethod.DIGITAL,
      paymentStatus: PaymentStatus.PENDING,
      finalFare: new Prisma.Decimal('24.50'),
    });

    await expect(
      service.confirmCashPayment('ride-1', 'driver-1', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ridePayment.upsert).not.toHaveBeenCalled();
  });

  it('returns an already paid cash record without charging or changing it again', async () => {
    const paidPayment = {
      id: 'payment-1',
      rideId: 'ride-1',
      amount: new Prisma.Decimal('24.50'),
      currency: 'BOB',
      method: PaymentMethod.CASH,
      status: PaymentStatus.PAID,
    };
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.COMPLETED,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      finalFare: new Prisma.Decimal('24.50'),
    });
    tx.ridePayment.upsert.mockResolvedValue(paidPayment);

    await expect(
      service.confirmCashPayment('ride-1', 'driver-1', 'user-1'),
    ).resolves.toBe(paidPayment);

    expect(tx.ridePayment.updateMany).not.toHaveBeenCalled();
    expect(tx.ride.updateMany).not.toHaveBeenCalled();
  });
});
