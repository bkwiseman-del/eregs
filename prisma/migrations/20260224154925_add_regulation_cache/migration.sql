-- CreateTable
CREATE TABLE "CachedSection" (
    "id" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "subpartLabel" TEXT,
    "subpartTitle" TEXT,
    "ecfrVersion" TEXT NOT NULL,
    "rawXml" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedPartToc" (
    "id" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tocJson" TEXT NOT NULL,
    "ecfrVersion" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedPartToc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedSection_section_key" ON "CachedSection"("section");

-- CreateIndex
CREATE INDEX "CachedSection_part_idx" ON "CachedSection"("part");

-- CreateIndex
CREATE INDEX "CachedSection_ecfrVersion_idx" ON "CachedSection"("ecfrVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CachedPartToc_part_key" ON "CachedPartToc"("part");
