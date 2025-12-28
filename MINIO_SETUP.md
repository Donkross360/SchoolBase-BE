# MinIO Setup Guide

MinIO is required for file uploads (images, audio files, etc.) in the SchoolBase application.

## Quick Setup with Docker

### 1. Start MinIO using Docker Compose

From the project root directory:

```bash
docker-compose -f docker-compose.minio.yml up -d
```

This will start MinIO with:
- **API Endpoint**: `http://localhost:9000`
- **Console UI**: `http://localhost:9001`
- **Default Username**: `minioadmin`
- **Default Password**: `minioadmin123`

### 2. Access MinIO Console

Open your browser and navigate to:
```
http://localhost:9001
```

Login with:
- Username: `minioadmin`
- Password: `minioadmin123`

### 3. Create a Bucket

1. In the MinIO Console, click **"Buckets"** in the left sidebar
2. Click **"Create Bucket"**
3. Enter bucket name: `schoolbase` (or your preferred name)
4. Click **"Create Bucket"**

### 4. Configure Backend Environment Variables

Add the following to your `.env` file in `SchoolBase-BE/`:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=schoolbase
```

### 5. Restart Your Backend

Restart your NestJS backend server to apply the changes.

## Verification

Once MinIO is running, check the backend logs. You should see:
```
Minio service initialized
```

If you see connection errors, verify:
1. MinIO container is running: `docker ps | grep minio`
2. Environment variables are set correctly
3. The bucket exists in MinIO console

## Stopping MinIO

To stop MinIO:

```bash
docker-compose -f docker-compose.minio.yml down
```

To stop and remove volumes (deletes all uploaded files):

```bash
docker-compose -f docker-compose.minio.yml down -v
```

## Production Setup

For production, you should:
1. Change the default MinIO credentials
2. Use SSL/TLS (`MINIO_USE_SSL=true`)
3. Configure proper access policies
4. Set up backups for the MinIO data volume
5. Use a proper domain name instead of `localhost`

## Troubleshooting

### Connection Refused Error

If you see `ECONNREFUSED` errors:
- Check if MinIO is running: `docker ps | grep minio`
- Verify the port 9000 is not already in use
- Check firewall settings

### Bucket Not Found

- Ensure the bucket exists in MinIO console
- Verify `MINIO_BUCKET_NAME` matches the bucket name exactly

### Permission Errors

- Check that `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` match the MinIO credentials
- In production, ensure proper IAM policies are configured

