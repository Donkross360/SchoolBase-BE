/**
 * Seed script to insert test school data for development
 * Run with: npx ts-node scripts/seed-test-school.ts
 * 
 * This creates a test school so the GET /api/v1/school endpoint returns data
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { School } from '../src/modules/school/entities/school.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedTestSchool() {
  // Create data source connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'schoolbase',
    entities: [School],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    const schoolRepository = dataSource.getRepository(School);

    // Check if test school already exists
    const existingSchool = await schoolRepository.findOne({
      where: { installation_completed: true },
    });

    if (existingSchool) {
      console.log('ℹ️  Test school already exists:', existingSchool.name);
      console.log('   ID:', existingSchool.id);
      console.log('   Primary Color:', existingSchool.primary_color);
      return;
    }

    // Create test school
    const testSchool = schoolRepository.create({
      name: 'Acme High School',
      address: '123 Education Street, Lagos, Nigeria',
      email: 'support@acmehigh.edu.ng',
      phone: '+234 801 234 5678',
      // Use a publicly accessible logo URL for testing
      // You can replace this with your actual logo URL later
      logo_url: 'https://via.placeholder.com/200x200/FF5733/FFFFFF?text=Acme+High',
      primary_color: '#FF5733',
      secondary_color: '#8B5CF6',
      accent_color: '#36D399',
      installation_completed: true,
    });

    const savedSchool = await schoolRepository.save(testSchool);

    console.log('✅ Test school created successfully!');
    console.log('   ID:', savedSchool.id);
    console.log('   Name:', savedSchool.name);
    console.log('   Primary Color:', savedSchool.primary_color);
    console.log('   Email:', savedSchool.email);
    console.log('');
    console.log('You can now test the endpoint: GET /api/v1/school');
  } catch (error) {
    console.error('❌ Error seeding test school:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Run the seed function
seedTestSchool();

