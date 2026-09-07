-- CreateTable
CREATE TABLE "EnergyReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solarSystemId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "solarKwh" REAL,
    "consumptionKwh" REAL,
    "batterySocPercent" REAL,
    "batteryChargeKwh" REAL,
    "batteryDischargeKwh" REAL,
    "gridImportKwh" REAL,
    "gridExportKwh" REAL,
    "isEstimated" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" TEXT NOT NULL DEFAULT 'csv',
    "importSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnergyReading_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "SolarSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solarSystemId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "columnMappings" TEXT NOT NULL DEFAULT '{}',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataImportSession_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "SolarSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solarSystemId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mappedTo" TEXT NOT NULL,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyColumn_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "SolarSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solarSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "powerKw" REAL NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isFlexible" BOOLEAN NOT NULL DEFAULT true,
    "preferredStart" TEXT,
    "preferredEnd" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appliance_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "SolarSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable SolarSystem
ALTER TABLE "SolarSystem" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "SolarSystem" ADD COLUMN "batteryCapacityKwh" REAL;
ALTER TABLE "SolarSystem" ADD COLUMN "exportRate" REAL;

-- CreateIndex
CREATE INDEX "EnergyReading_solarSystemId_timestamp_idx" ON "EnergyReading"("solarSystemId", "timestamp");
CREATE UNIQUE INDEX "EnergyReading_solarSystemId_timestamp_key" ON "EnergyReading"("solarSystemId", "timestamp");
CREATE INDEX "DataImportSession_solarSystemId_idx" ON "DataImportSession"("solarSystemId");
CREATE INDEX "PropertyColumn_solarSystemId_idx" ON "PropertyColumn"("solarSystemId");
CREATE UNIQUE INDEX "PropertyColumn_solarSystemId_mappedTo_key" ON "PropertyColumn"("solarSystemId", "mappedTo");
