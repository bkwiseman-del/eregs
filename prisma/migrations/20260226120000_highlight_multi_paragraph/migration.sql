-- DropIndex
DROP INDEX "Highlight_userId_paragraphId_key";

-- AlterTable: replace paragraphId with paragraphIds
ALTER TABLE "Highlight" DROP COLUMN "paragraphId",
ADD COLUMN "paragraphIds" TEXT[];

-- CreateIndex
CREATE INDEX "Highlight_userId_sectionId_idx" ON "Highlight"("userId", "sectionId");
