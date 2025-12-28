/**
 * Script to create a test user for login testing
 * Run with: npx ts-node scripts/create-test-user.ts
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { User, UserRole } from '../src/modules/user/entities/user.entity';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function createTestUser() {
  // Use the same entity loading pattern as the main app
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'schoolbase',
    // Load entities from the same path pattern as the app
    entities: [
      path.join(__dirname, '..', 'src', 'modules', '**', '*.entity.{ts,js}'),
      path.join(__dirname, '..', 'src', 'modules', '**', 'entities', '*.entity.{ts,js}'),
    ],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    const userRepository = dataSource.getRepository(User);

    // Check if test user already exists
    const existingUser = await userRepository.findOne({
      where: { email: 'admin@acmehigh.edu.ng' },
    });

    if (existingUser) {
      console.log('ℹ️  Test user already exists:', existingUser.email);
      console.log('   You can login with:');
      console.log('   Email: admin@acmehigh.edu.ng');
      console.log('   Password: password123');
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);

    // Create test admin user
    const testUser = userRepository.create({
      first_name: 'Test',
      last_name: 'Admin',
      email: 'admin@acmehigh.edu.ng',
      password: hashedPassword,
      phone: '+234 801 234 5678',
      role: [UserRole.ADMIN], // You can change this to UserRole.TEACHER, UserRole.STUDENT, or UserRole.PARENT
      gender: 'Male',
      dob: new Date('1990-01-01'), // Convert string to Date
      is_active: true,
      is_verified: true,
      // stream is nullable, so we don't need to set it
    });

    const savedUser = await userRepository.save(testUser);

    console.log('✅ Test user created successfully!');
    console.log('   ID:', savedUser.id);
    console.log('   Email:', savedUser.email);
    console.log('   Role:', savedUser.role.join(', '));
    console.log('');
    console.log('You can now login with:');
    console.log('   Email: admin@acmehigh.edu.ng');
    console.log('   Password: password123');
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Run the function
createTestUser();

