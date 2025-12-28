# Setting Up Test Data for Backend Development

This guide helps you set up the backend with test data so you can test the `/api/v1/school` endpoint.

## Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** (v18 or higher)
3. Database created (e.g., `schoolbase`)

## Quick Setup Steps

### 1. Install Dependencies

```bash
cd SchoolBase-BE
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update at minimum:
- `DB_HOST` (default: localhost)
- `DB_PORT` (default: 5432)
- `DB_USER` (default: postgres)
- `DB_PASS` (default: postgres)
- `DB_NAME` (default: schoolbase)
- `JWT_SECRET` (generate a random string)

### 3. Run Database Migrations

```bash
npm run migration:run
```

This will create all necessary tables including the `schools` table.

### 4. Seed Test School Data

You have two options:

#### Option A: Using TypeScript Seed Script (Recommended)

```bash
npm run seed:school
```

This will:
- Connect to your database
- Check if a school already exists
- Create a test school with:
  - Name: "Acme High School"
  - Primary Color: `#FF5733` (orange)
  - Secondary Color: `#8B5CF6` (purple)
  - Accent Color: `#36D399` (green)
  - Email: support@acmehigh.edu.ng
  - Phone: +234 801 234 5678

#### Option B: Using SQL Script

```bash
psql -h localhost -U postgres -d schoolbase -f scripts/seed-test-school.sql
```

### 5. Start the Backend Server

```bash
npm run start:dev
```

The server will start on `http://localhost:3008` (or the PORT you configured).

### 6. Test the Endpoint

Once the server is running, test the school config endpoint:

```bash
curl http://localhost:3008/api/v1/school
```

Expected response:
```json
{
  "id": "uuid-here",
  "name": "Acme High School",
  "address": "123 Education Street, Lagos, Nigeria",
  "email": "support@acmehigh.edu.ng",
  "phone": "+234 801 234 5678",
  "logo_url": "/uploads/logos/logo-acme.png",
  "primary_color": "#FF5733",
  "secondary_color": "#8B5CF6",
  "accent_color": "#36D399",
  "installation_completed": true
}
```

## Troubleshooting

### Database Connection Error

- Ensure PostgreSQL is running: `pg_isready` or `sudo systemctl status postgresql`
- Verify database exists: `psql -l | grep schoolbase`
- Check credentials in `.env` match your PostgreSQL setup

### Migration Errors

- Ensure database exists before running migrations
- Check that TypeORM can connect (test connection with seed script)

### Endpoint Returns 404 or Error

- Ensure `installation_completed = true` in the database
- Check that migrations ran successfully
- Verify the school record exists: `SELECT * FROM schools WHERE installation_completed = true;`

## Customizing Test Data

You can modify the seed script (`scripts/seed-test-school.ts`) to customize:
- School name
- Colors (primary, secondary, accent)
- Contact information
- Logo URL

After modifications, run the seed script again (it will skip if school already exists, or you can delete and re-run).

