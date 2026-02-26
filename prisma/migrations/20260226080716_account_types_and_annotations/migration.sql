-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('PRO', 'FLEET_MANAGER', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');

-- CreateEnum
CREATE TYPE "PartnerBillingModel" AS ENUM ('PARTNER_PAYS', 'SUBSIDY', 'REFERRAL');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('FMCSA_GUIDANCE', 'VIDEO', 'ARTICLE');

-- AlterEnum
BEGIN;
CREATE TYPE "DriverStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'ACKNOWLEDGED', 'REMOVED');
ALTER TABLE "public"."Driver" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Driver" ALTER COLUMN "status" TYPE "DriverStatus_new" USING ("status"::text::"DriverStatus_new");
ALTER TYPE "DriverStatus" RENAME TO "DriverStatus_old";
ALTER TYPE "DriverStatus_new" RENAME TO "DriverStatus";
DROP TYPE "public"."DriverStatus_old";
ALTER TABLE "Driver" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Acknowledgement" DROP CONSTRAINT "Acknowledgement_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_fleetId_fkey";

-- DropForeignKey
ALTER TABLE "Fleet" DROP CONSTRAINT "Fleet_userId_fkey";

-- DropForeignKey
ALTER TABLE "Tablet" DROP CONSTRAINT "Tablet_fleetId_fkey";

-- AlterTable
ALTER TABLE "Acknowledgement" DROP COLUMN "deviceId",
DROP COLUMN "deviceType",
DROP COLUMN "driverName",
DROP COLUMN "driverPhone",
DROP COLUMN "fleetId",
DROP COLUMN "partsAcknowledged",
ADD COLUMN     "deviceToken" TEXT NOT NULL,
ALTER COLUMN "driverId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "fleetId",
DROP COLUMN "revokedAt",
ADD COLUMN     "acknowledgeChargeId" TEXT,
ADD COLUMN     "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- AlterTable
ALTER TABLE "Tablet" DROP COLUMN "fleetId",
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hazmatAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "partnerCodeId" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- DropTable
DROP TABLE "Annotation";

-- DropTable
DROP TABLE "Fleet";

-- DropEnum
DROP TYPE "AckDeviceType";

-- DropEnum
DROP TYPE "AnnotationType";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "freeInvitesLeft" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "hazmatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hazmatStripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "billingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfr49Part" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfr49Part" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "paragraphIds" TEXT[],
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfr49Part" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingModel" "PartnerBillingModel" NOT NULL DEFAULT 'REFERRAL',
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "rawXml" TEXT,
    "sectionContent" JSONB,
    "ecfrVersionDate" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegChangelog" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "versionDate" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "summary" TEXT,
    "federalRegCitation" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegChangelog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "durationMinutes" INTEGER,
    "thumbnailUrl" TEXT,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "readTimeMinutes" INTEGER,
    "sectionIds" TEXT[],
    "paragraphIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Highlight_userId_paragraphId_key" ON "Highlight"("userId", "paragraphId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_sectionId_key" ON "Bookmark"("userId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCode_code_key" ON "PartnerCode"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerCodeId_fkey" FOREIGN KEY ("partnerCodeId") REFERENCES "PartnerCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tablet" ADD CONSTRAINT "Tablet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegChangelog" ADD CONSTRAINT "RegChangelog_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "RegSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

