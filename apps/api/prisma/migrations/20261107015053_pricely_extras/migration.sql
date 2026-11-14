-- AlterTable
ALTER TABLE "products" ADD COLUMN     "blur_hash" TEXT,
ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT;
