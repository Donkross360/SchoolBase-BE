import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateClassroomMessagesTable1736000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid-ossp extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create classroom_messages table
    await queryRunner.createTable(
      new Table({
        name: 'classroom_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'class_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'sender_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sender_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'audio_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'audio_duration',
            type: 'float',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['class_id'],
            referencedTableName: 'class',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create index on class_id and createdAt for efficient querying
    await queryRunner.createIndex(
      'classroom_messages',
      new TableIndex({
        name: 'IDX_classroom_messages_class_id_created_at',
        columnNames: ['class_id', 'created_at'],
      }),
    );

    // Create index on sender_id for faster lookups (optional but helpful)
    await queryRunner.createIndex(
      'classroom_messages',
      new TableIndex({
        name: 'IDX_classroom_messages_sender_id',
        columnNames: ['sender_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'classroom_messages',
      'IDX_classroom_messages_sender_id',
    );
    await queryRunner.dropIndex(
      'classroom_messages',
      'IDX_classroom_messages_class_id_created_at',
    );

    // Drop table
    await queryRunner.dropTable('classroom_messages');
  }
}

