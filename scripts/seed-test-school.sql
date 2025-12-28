-- Seed script to insert a test school for development/testing
-- Run this after migrations to have test data for the /api/v1/school endpoint

-- Insert a test school with installation_completed = true
-- This allows the GET /api/v1/school endpoint to return data
INSERT INTO schools (
  id,
  name,
  address,
  email,
  phone,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  installation_completed,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Acme High School',
  '123 Education Street, Lagos, Nigeria',
  'support@acmehigh.edu.ng',
  '+234 801 234 5678',
  '/uploads/logos/logo-acme.png',
  '#FF5733',
  '#8B5CF6',
  '#36D399',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verify the school was inserted
SELECT id, name, primary_color, installation_completed 
FROM schools 
WHERE installation_completed = true;

