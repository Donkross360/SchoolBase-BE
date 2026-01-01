import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddTwoFactorAuthToUsers1732000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if users table exists before creating user_2fa table with FK
    const usersTableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )`,
    );

    if (!usersTableExists[0]?.exists) {
      throw new Error('Cannot create user_2fa table: users table does not exist. Please run new_user_migration first.');
    }

    await queryRunner.createTable(
      new Table({
        name: 'user_2fa',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'two_fa_secret',
            type: 'varchar',
          },
          {
            name: 'two_fa_enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'backup_codes',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_2fa',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists before trying to drop
    const tableExists = await queryRunner.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_2fa'
      )`,
    );

    if (tableExists[0]?.exists) {
      const table = await queryRunner.getTable('user_2fa');
      const foreignKey = table?.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('user_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('user_2fa', foreignKey);
      }
      await queryRunner.dropTable('user_2fa');
    }
  }
}
