-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "impactedByChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regVersion" TEXT;

-- AlterTable
ALTER TABLE "Highlight" ADD COLUMN     "impactedByChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regVersion" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "impactedByChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regVersion" TEXT;
