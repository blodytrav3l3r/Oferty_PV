-- CreateTable
CREATE TABLE "ai_telemetry_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "original_auto_config" TEXT,
    "final_user_config" TEXT,
    "override_reason" TEXT,
    "createdAt" TEXT
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "oldData" TEXT,
    "newData" TEXT,
    "createdAt" TEXT
);

-- CreateTable
CREATE TABLE "clients_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT,
    "nip" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contact" TEXT DEFAULT '',
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- CreateTable
CREATE TABLE "offer_items_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT,
    "productId" TEXT,
    "quantity" REAL,
    "discount" REAL,
    "price" REAL
);

-- CreateTable
CREATE TABLE "offer_studnie_items_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT,
    "productId" TEXT,
    "quantity" REAL,
    "discount" REAL,
    "price" REAL,
    "dodatkowe_info" TEXT
);

-- CreateTable
CREATE TABLE "offers_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "clientId" TEXT,
    "state" TEXT,
    "createdAt" TEXT,
    "transportCost" REAL,
    "offer_number" TEXT,
    "data" TEXT,
    "updatedAt" TEXT,
    "history" TEXT DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "offers_studnie_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "clientId" TEXT,
    "state" TEXT,
    "createdAt" TEXT,
    "transportCost" REAL,
    "offer_number" TEXT,
    "data" TEXT,
    "updatedAt" TEXT,
    "history" TEXT DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "order_counters" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER DEFAULT 0,

    PRIMARY KEY ("userId", "year")
);

-- CreateTable
CREATE TABLE "order_counters_rury" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER DEFAULT 0,

    PRIMARY KEY ("userId", "year")
);

-- CreateTable
CREATE TABLE "orders_studnie_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "offerStudnieId" TEXT,
    "createdAt" TEXT,
    "status" TEXT,
    "data" TEXT
);

-- CreateTable
CREATE TABLE "orders_rury_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "offerId" TEXT,
    "createdAt" TEXT,
    "status" TEXT,
    "data" TEXT
);

-- CreateTable
CREATE TABLE "production_order_counters" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER DEFAULT 0,

    PRIMARY KEY ("userId", "year")
);

-- CreateTable
CREATE TABLE "production_orders_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orderId" TEXT,
    "wellId" TEXT,
    "elementIndex" INTEGER,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    "data" TEXT,
    "creatorId" TEXT DEFAULT ''
);

-- CreateTable
CREATE TABLE "recycled_production_numbers" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seqNumber" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "year", "seqNumber")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "symbol" TEXT,
    "subUsers" TEXT,
    "createdAt" TEXT,
    "orderStartNumber" INTEGER DEFAULT 1,
    "productionOrderStartNumber" INTEGER DEFAULT 1
);

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "idx_clients_user" ON "clients_rel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
