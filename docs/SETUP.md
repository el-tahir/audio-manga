# Setup Guide

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Google Cloud Platform account** with enabled APIs (Storage, Tasks, Run, Build)
- **Supabase account** for database management
- **Google AI API key** for Gemini integration

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd audio-manga
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env.local` file in the project root:
   ```bash
   # Supabase configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Database URLs (from Supabase dashboard)
   POSTGRES_URL=your_postgres_connection_string
   POSTGRES_PRISMA_URL=your_postgres_prisma_connection_string
   POSTGRES_URL_NON_POOLING=your_postgres_non_pooling_connection_string

   # Google Cloud configuration
   GCP_PROJECT_ID=your_gcp_project_id
   GCP_CLIENT_EMAIL=your_service_account_email
   GCP_PRIVATE_KEY_BASE64=your_base64_encoded_private_key
   GOOGLE_CLOUD_BUCKET_NAME=your_gcs_bucket_name
   GCP_TEMP_UPLOAD_BUCKET_NAME=your_temp_bucket_name

   # Google AI API keys
   GOOGLE_API_KEY=your_google_ai_api_key
   GOOGLE_API_KEY_2=your_backup_google_ai_api_key

   # Cloud Tasks configuration
   GCP_QUEUE_LOCATION=us-central1
   GCP_QUEUE_ID=your_cloud_tasks_queue_id
   GCP_TASK_HANDLER_URL=your_cloud_function_handler_url
   ```

4. **Database Setup:**
   - Set up a Supabase project and configure the database schema using the provided `schema.sql`
   - Update the connection strings in your environment variables

5. **Google Cloud Setup:**
   - Enable required APIs: Cloud Storage, Cloud Tasks, Cloud Run, Cloud Build
   - Create service accounts with appropriate permissions
   - Set up Cloud Storage buckets for manga images and temporary processing

## Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `POSTGRES_URL` | PostgreSQL connection string | ✅ |
| `GCP_PROJECT_ID` | Google Cloud project ID | ✅ |
| `GCP_CLIENT_EMAIL` | Service account email | ✅ |
| `GCP_PRIVATE_KEY_BASE64` | Base64 encoded private key | ✅ |
| `GOOGLE_CLOUD_BUCKET_NAME` | Main GCS bucket name | ✅ |
| `GOOGLE_API_KEY` | Google AI API key | ✅ |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY_2` | Backup API key | - |
| `GCP_QUEUE_LOCATION` | Cloud Tasks queue location | us-central1 |
| `NODE_ENV` | Application environment | development |