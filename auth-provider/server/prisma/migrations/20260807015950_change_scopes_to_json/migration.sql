/*
  Warnings:

  - The `scopes` column on the `access_tokens` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "access_tokens" DROP COLUMN "scopes",
ADD COLUMN     "scopes" JSONB;
