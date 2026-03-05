-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "customer_documents" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by" TEXT,
ADD COLUMN     "content_type" TEXT;
