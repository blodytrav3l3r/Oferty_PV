-- CreateTable
CREATE TABLE "document_shares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_share_doc_user" ON "document_shares"("documentType", "documentId", "sharedWithUserId");
CREATE INDEX "idx_shares_sharedwith" ON "document_shares"("sharedWithUserId");
CREATE INDEX "idx_shares_docid" ON "document_shares"("documentId");
CREATE INDEX "idx_shares_doctype_docid" ON "document_shares"("documentType", "documentId");
CREATE INDEX "idx_shares_owner" ON "document_shares"("ownerId");
