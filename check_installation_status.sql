-- Check current installation status
SELECT 
  id, 
  name, 
  installation_completed, 
  email,
  created_at, 
  updated_at 
FROM schools 
ORDER BY created_at DESC 
LIMIT 5;
