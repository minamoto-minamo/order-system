-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "refreshTokenExpiresMinutes" INTEGER NOT NULL DEFAULT 1440,
ADD COLUMN     "refreshTokenSliding" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "parentId" TEXT,
    "familyIssuedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_staffId_idx" ON "refresh_token"("staffId");

-- CreateIndex
CREATE INDEX "refresh_token_parentId_idx" ON "refresh_token"("parentId");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "refresh_token"("id") ON DELETE SET NULL ON UPDATE CASCADE;
