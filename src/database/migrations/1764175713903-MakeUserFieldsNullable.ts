import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserFieldsNullable1764175713903 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if users table exists before altering
    const usersTableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )`,
    );

    if (!usersTableExists[0]?.exists) {
      console.log('Users table does not exist, skipping MakeUserFieldsNullable migration');
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "gender" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "dob" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if users table exists before altering
    const usersTableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )`,
    );

    if (!usersTableExists[0]?.exists) {
      console.log('Users table does not exist, skipping MakeUserFieldsNullable rollback');
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "dob" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "gender" SET NOT NULL`,
    );
  }
}
