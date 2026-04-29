import { prisma } from "../lib/prisma.js";

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    tableName,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    tableName,
    columnName,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function foreignKeyExists(tableName, constraintName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
    tableName,
    constraintName,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function ensureSql(condition, sql) {
  if (!condition) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function addColumnIfMissing(tableName, columnName, sql) {
  if (!(await columnExists(tableName, columnName))) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function main() {
  const tableOptions = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

  await ensureSql(
    await tableExists("purchasegroup"),
    `CREATE TABLE \`purchasegroup\` (
      \`id\` char(36) NOT NULL,
      \`groupCode\` varchar(191) NOT NULL,
      \`warehouse\` varchar(191) NOT NULL,
      \`supplierName\` varchar(191) NOT NULL,
      \`referenceNo\` varchar(191) DEFAULT NULL,
      \`purchaseDate\` datetime(3) NOT NULL,
      \`subtotal\` decimal(12,2) NOT NULL,
      \`otherCharges\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`discountOnAll\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`roundOff\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`grandTotal\` decimal(12,2) NOT NULL,
      \`paidAmount\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`dueAmount\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`note\` text DEFAULT NULL,
      \`status\` enum('pending','partial','paid','cancelled') NOT NULL DEFAULT 'pending',
      \`createdById\` char(36) NOT NULL,
      \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` datetime(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`PurchaseGroup_groupCode_key\` (\`groupCode\`),
      KEY \`PurchaseGroup_createdById_fkey\` (\`createdById\`),
      CONSTRAINT \`PurchaseGroup_createdById_fkey\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ${tableOptions};`,
  );

  await ensureSql(
    await tableExists("purchasegrouppayment"),
    `CREATE TABLE \`purchasegrouppayment\` (
      \`id\` char(36) NOT NULL,
      \`purchaseGroupId\` char(36) NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`paymentType\` varchar(191) NOT NULL,
      \`account\` varchar(191) DEFAULT NULL,
      \`note\` text DEFAULT NULL,
      \`paidById\` char(36) NOT NULL,
      \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` datetime(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`PurchaseGroupPayment_purchaseGroupId_fkey\` (\`purchaseGroupId\`),
      KEY \`PurchaseGroupPayment_paidById_fkey\` (\`paidById\`),
      CONSTRAINT \`PurchaseGroupPayment_purchaseGroupId_fkey\` FOREIGN KEY (\`purchaseGroupId\`) REFERENCES \`purchasegroup\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`PurchaseGroupPayment_paidById_fkey\` FOREIGN KEY (\`paidById\`) REFERENCES \`user\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ${tableOptions};`,
  );

  if (!(await columnExists("purchase", "purchaseGroupId"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `purchase` ADD COLUMN `purchaseGroupId` char(36) NULL AFTER `purchasedById`",
    );
  }

  await addColumnIfMissing(
    "purchase",
    "purchasePrice",
    "ALTER TABLE `purchase` ADD COLUMN `purchasePrice` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `quantity`",
  );

  await addColumnIfMissing(
    "purchase",
    "discountAmount",
    "ALTER TABLE `purchase` ADD COLUMN `discountAmount` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `purchasePrice`",
  );

  await addColumnIfMissing(
    "purchase",
    "taxAmount",
    "ALTER TABLE `purchase` ADD COLUMN `taxAmount` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `discountAmount`",
  );

  if (!(await foreignKeyExists("purchase", "Purchase_purchaseGroupId_fkey"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `purchase` ADD CONSTRAINT `Purchase_purchaseGroupId_fkey` FOREIGN KEY (`purchaseGroupId`) REFERENCES `purchasegroup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Purchase schema applied successfully.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
