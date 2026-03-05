/*
  Warnings:

  - A unique constraint covering the columns `[approval_code]` on the table `approval_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'pending_discount_approval';

-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "approval_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_approval_code_key" ON "approval_requests"("approval_code");
