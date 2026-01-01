import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddNfcCardIdToStudents1735000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if students table exists first
    const tableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'students'
      )`,
    );

    if (!tableExists[0]?.exists) {
      console.log('Students table does not exist yet, skipping AddNfcCardIdToStudents migration');
      return;
    }

    // Check if column already exists
    const table = await queryRunner.getTable('students');
    const columnExists = table?.findColumnByName('nfc_card_id');

    // Add nfc_card_id column to students table (only if it doesn't exist)
    if (!columnExists) {
      await queryRunner.query(
        `ALTER TABLE "students" ADD COLUMN "nfc_card_id" character varying NULL`,
      );
    }

    // Check if indexes exist before creating them
    const uniqueIndexExists = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'IDX_students_nfc_card_id' AND tablename = 'students'`,
    );

    if (uniqueIndexExists.length === 0) {
      // Create unique index on nfc_card_id (allowing nulls)
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_students_nfc_card_id" ON "students" ("nfc_card_id") WHERE "nfc_card_id" IS NOT NULL`,
      );
    }

    const lookupIndexExists = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'IDX_students_nfc_card_id_lookup' AND tablename = 'students'`,
    );

    if (lookupIndexExists.length === 0) {
      // Create regular index for faster lookups (allowing nulls)
      await queryRunner.query(
        `CREATE INDEX "IDX_students_nfc_card_id_lookup" ON "students" ("nfc_card_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if students table exists first
    const tableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'students'
      )`,
    );

    if (!tableExists[0]?.exists) {
      console.log('Students table does not exist, skipping migration rollback');
      return;
    }

    // Drop indexes (IF EXISTS handles cases where they don't exist)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_students_nfc_card_id_lookup"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_students_nfc_card_id"`);

    // Check if column exists before dropping
    const table = await queryRunner.getTable('students');
    const columnExists = table?.findColumnByName('nfc_card_id');

    if (columnExists) {
      await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "nfc_card_id"`);
    }
  }
}

