-- Initial versioned schema for Sind.19-Mar.
-- Generated to match prisma/schema.prisma on the integration branch.
-- Review and test on an empty development database before production use.

CREATE TYPE "UserRole" AS ENUM ('PASSENGER', 'DRIVER', 'FLEET_MANAGER', 'ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "FleetStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "DriverAvailability" AS ENUM ('OFFLINE', 'AVAILABLE', 'ON_TRIP');
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DIGITAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'RETRYABLE_FAILURE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
  "passwordHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Passenger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Fleet" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "managerUserId" TEXT NOT NULL,
  "status" "FleetStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Fleet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Driver" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fleetId" TEXT,
  "availability" "DriverAvailability" NOT NULL DEFAULT 'OFFLINE',
  "licenseNumber" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Ride" (
  "id" TEXT NOT NULL,
  "passengerId" TEXT NOT NULL,
  "driverId" TEXT,
  "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
  "originAddress" TEXT NOT NULL,
  "originLatitude" DECIMAL(10,7) NOT NULL,
  "originLongitude" DECIMAL(10,7) NOT NULL,
  "destinationAddress" TEXT NOT NULL,
  "destinationLatitude" DECIMAL(10,7) NOT NULL,
  "destinationLongitude" DECIMAL(10,7) NOT NULL,
  "estimatedFare" DECIMAL(10,2),
  "finalFare" DECIMAL(10,2),
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DriverLocation" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RidePayment" (
  "id" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BOB',
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "cashConfirmedAt" TIMESTAMP(3),
  "cashConfirmedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RidePayment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "ridePaymentId" TEXT NOT NULL,
  "providerCode" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "providerReference" VARCHAR(191),
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BOB',
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "providerCode" VARCHAR(64) NOT NULL,
  "providerEventId" VARCHAR(191) NOT NULL,
  "eventType" VARCHAR(128) NOT NULL,
  "payloadSha256" CHAR(64) NOT NULL,
  "paymentAttemptId" TEXT,
  "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(64),
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "Passenger_userId_key" ON "Passenger"("userId");
CREATE UNIQUE INDEX "Fleet_managerUserId_key" ON "Fleet"("managerUserId");
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");
CREATE UNIQUE INDEX "Driver_licenseNumber_key" ON "Driver"("licenseNumber");
CREATE INDEX "Driver_fleetId_idx" ON "Driver"("fleetId");
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");
CREATE INDEX "Ride_passengerId_requestedAt_idx" ON "Ride"("passengerId", "requestedAt");
CREATE INDEX "Ride_driverId_status_idx" ON "Ride"("driverId", "status");
CREATE INDEX "Ride_status_requestedAt_idx" ON "Ride"("status", "requestedAt");
CREATE UNIQUE INDEX "DriverLocation_driverId_key" ON "DriverLocation"("driverId");
CREATE INDEX "DriverLocation_recordedAt_idx" ON "DriverLocation"("recordedAt");
CREATE UNIQUE INDEX "RidePayment_rideId_key" ON "RidePayment"("rideId");
CREATE INDEX "RidePayment_status_createdAt_idx" ON "RidePayment"("status", "createdAt");
CREATE UNIQUE INDEX "PaymentAttempt_providerCode_idempotencyKey_key" ON "PaymentAttempt"("providerCode", "idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_providerCode_providerReference_key" ON "PaymentAttempt"("providerCode", "providerReference");
CREATE INDEX "PaymentAttempt_ridePaymentId_createdAt_idx" ON "PaymentAttempt"("ridePaymentId", "createdAt");
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");
CREATE UNIQUE INDEX "PaymentWebhookEvent_providerCode_providerEventId_key" ON "PaymentWebhookEvent"("providerCode", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_status_receivedAt_idx" ON "PaymentWebhookEvent"("status", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_paymentAttemptId_idx" ON "PaymentWebhookEvent"("paymentAttemptId");

ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RidePayment" ADD CONSTRAINT "RidePayment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RidePayment" ADD CONSTRAINT "RidePayment_cashConfirmedByUserId_fkey" FOREIGN KEY ("cashConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_ridePaymentId_fkey" FOREIGN KEY ("ridePaymentId") REFERENCES "RidePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
