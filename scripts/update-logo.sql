-- Update logo URL for the test school
UPDATE schools 
SET logo_url = 'https://via.placeholder.com/200x200/FF5733/FFFFFF?text=Acme+High'
WHERE installation_completed = true;

-- Verify the update
SELECT id, name, logo_url, primary_color 
FROM schools 
WHERE installation_completed = true;

