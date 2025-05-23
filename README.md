# Detective Conan OST Manga Reader

As a long-time Detective Conan enthusiast, I've always appreciated its iconic Original Soundtrack (OST). This project was conceived from the idea of enhancing the manga reading experience by integrating these memorable tracks at appropriate moments.

This is a web application designed for Detective Conan manga, featuring dynamic soundtrack playback. As you navigate through chapters, the application plays OST selections intended to match the mood of each page.

## Core Features

- **Dynamic OST Playback:** Read Detective Conan chapters accompanied by music selected to reflect the current page's atmosphere.
- **AI-Powered Mood Classification:** Google's Gemini AI analyzes manga pages to determine their dominant mood (e.g., tension, revelation, comedy), which informs the soundtrack mapping.
- **Chapter Management:** Add new manga chapters for processing. The system handles image downloading, classification, and makes them available in the reader.
- **Mood Editor:** While the AI provides initial classifications, users can review and adjust the mood assigned to each page, allowing for fine-tuning of the OST experience.
- **Reading Interface:** A clean, user-friendly interface for manga reading, including page counters and chapter navigation.

## Technology Stack

- **Frontend:** [Next.js](https://nextjs.org/) with [React](https://reactjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for the user interface.
- **Backend & Database:** [Supabase](https://supabase.io/) (using PostgreSQL) manages chapter data and classifications.
- **Content Delivery:** [Google Cloud Storage (GCS)](https://cloud.google.com/storage) hosts manga images and audio tracks.
- **AI Classification:** [Google Gemini](https://deepmind.google/technologies/gemini/) provides the image mood classification.
- **Background Processing:** [Google Cloud Functions](https://cloud.google.com/functions) and [Cloud Tasks](https://cloud.google.com/tasks) handle chapter processing and other intensive operations in the background.
- **Hosting & Deployment:** The application is containerized using [Docker](https://www.docker.com/) and deployed on [Google Cloud Run](https://cloud.google.com/run).
- **CI/CD:** A [Google Cloud Build](https://cloud.google.com/build) pipeline automates builds and deployments.

## Project Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Google Cloud Platform account** with enabled APIs (Storage, Tasks, Run, Build)
- **Supabase account** for database management
- **Google AI API key** for Gemini integration

### Getting Started

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
   cp .env.example .env.local
   ```
   
   Update the variables in `.env.local` with your specific settings (see Environment Variables section below).

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application running.

### Development with Turbopack

This project uses Next.js with Turbopack for faster development builds. The `npm run dev` command automatically uses the `--turbopack` flag for improved performance during development.

## Environment Variables

This project requires numerous environment variables for different services. Create a `.env.local` file in the project root with the following configuration:

### Node Environment
```env
NODE_ENV=development
```

### Supabase Configuration
```env
# Public Supabase configuration (exposed to frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# JWT secret for Supabase (if using custom JWTs)
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

### PostgreSQL Database (Alternative to Supabase)
```env
POSTGRES_DATABASE=your-database-name
POSTGRES_HOST=your-postgres-host
POSTGRES_PASSWORD=your-postgres-password
POSTGRES_USER=your-postgres-user
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database?schema=public&pgbouncer=true
POSTGRES_URL=postgresql://username:password@host:port/database
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database
```

### Google AI (Gemini) Configuration
```env
# Primary Google AI API key for Gemini
GOOGLE_API_KEY=your-google-ai-api-key

# Secondary Google AI API key (optional, for load balancing)
GOOGLE_API_KEY_2=your-secondary-google-ai-api-key
```

### Google Cloud Platform Configuration
```env
# Project and Storage Configuration
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_BUCKET_NAME=your-storage-bucket-name
GCP_TEMP_UPLOAD_BUCKET_NAME=your-temp-upload-bucket-name
```

### GCP Authentication (Choose ONE method)

**Method 1: Individual Components (Recommended for Cloud Run)**
```env
GCP_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_PRIVATE_KEY_BASE64=your-base64-encoded-private-key
```

**Method 2: Full JSON Credentials**
```env
GOOGLE_CLOUD_KEYFILE_JSON={"type":"service_account","project_id":"..."}
```

**Method 3: Credentials File Path (Local Development)**
```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_CLOUD_CREDENTIALS=./google-credentials.json
```

### Google Cloud Tasks Configuration
```env
GCP_QUEUE_LOCATION=us-central1
GCP_QUEUE_ID=your-cloud-tasks-queue-id
GCP_TASK_HANDLER_URL=https://your-cloud-function-or-cloud-run-url.com
```

> **Note on GCP Credentials:** The application prioritizes credentials in the following order:
> 1. `GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY_BASE64` (explicit components)
> 2. `GOOGLE_CLOUD_KEYFILE_JSON` (full JSON key content)
> 3. `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CLOUD_CREDENTIALS` (path to key file)
>
> For deployed environments like Cloud Run, use Method 1 with Google Secret Manager.

## Available Scripts

The project includes several npm scripts for development, building, and maintenance:

### Core Development Scripts

```bash
# Start development server with Turbopack
npm run dev

# Build the application for production
npm run build

# Start the production server (requires build first)
npm run start

# Run ESLint for code quality checks
npm run lint

# Format code using Prettier
npm run format

# Check code formatting without making changes
npm run format:check

# Set up Husky git hooks (runs automatically after install)
npm run prepare
```

### Custom Utility Scripts

The `scripts/` folder contains additional utility tools:

#### Chapter Download Script (`scripts/download_chapter.py`)

**Purpose:** Standalone Python script for downloading manga chapters directly from Cubari API to the local filesystem.

**Dependencies:**
- Python 3.x
- `requests` library (`pip install requests`)

**Usage:**
```bash
python scripts/download_chapter.py <series_slug> <chapter_number> [--output-dir <directory>]
```

**Examples:**
```bash
# Download chapter 1128 to current directory
python scripts/download_chapter.py detective-conan 1128

# Download chapter 1128.5 to a specific directory
python scripts/download_chapter.py detective-conan 1128.5 --output-dir ./downloads

# Download chapter 1000 to a custom location
python scripts/download_chapter.py detective-conan 1000 --output-dir /path/to/manga
```

**Features:**
- Automatic file extension detection based on content type
- Error handling for network issues and missing chapters
- Progress tracking with detailed console output
- Cleanup of empty directories on failure
- Support for decimal chapter numbers (e.g., 1128.5)

#### GCP Access Test Script (`scripts/test-gcp-access.js`)

**Purpose:** Diagnostic tool for verifying Google Cloud Storage connectivity and permissions.

**Usage:**
```bash
node scripts/test-gcp-access.js
```

**Requirements:**
- `.env.local` file with GCP credentials
- `GOOGLE_CLOUD_PROJECT_ID`: Your GCP project ID
- `GOOGLE_CLOUD_BUCKET_NAME`: Target storage bucket name
- Valid GCP service account credentials

**What It Tests:**
1. Configuration validation
2. Credentials verification
3. Bucket access testing
4. File listing permissions
5. Audio directory access

## Deployment

The application uses Google Cloud Platform for deployment with an automated CI/CD pipeline.

### Deployment Architecture

- **Container Registry:** Google Artifact Registry
- **Runtime:** Google Cloud Run
- **CI/CD:** Google Cloud Build
- **Secret Management:** Google Secret Manager
- **Service Account:** Dedicated IAM service account with necessary permissions

### Cloud Build Pipeline

The deployment process is fully automated through `cloudbuild.yaml`:

1. **Build Stage:**
   - Builds Docker container with Next.js application
   - Injects build-time environment variables from Secret Manager
   - Tags images with both commit SHA and `latest`

2. **Push Stage:**
   - Pushes container images to Google Artifact Registry
   - Maintains versioning with commit SHA tags

3. **Deploy Stage:**
   - Deploys to Google Cloud Run service
   - Maps all environment variables from Secret Manager
   - Uses dedicated service account for security
   - Configures auto-scaling and traffic management

### Manual Deployment Steps

If you need to deploy manually:

1. **Set up Google Cloud resources:**
   ```bash
   # Enable required APIs
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable storage.googleapis.com
   gcloud services enable cloudtasks.googleapis.com
   
   # Create service account
   gcloud iam service-accounts create main-app-account
   
   # Grant necessary permissions
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:main-app-account@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   ```

2. **Store secrets in Secret Manager:**
   ```bash
   # Store each environment variable as a secret
   echo "your-value" | gcloud secrets create SECRET_NAME --data-file=-
   ```

3. **Build and deploy:**
   ```bash
   # Build container
   docker build -t gcr.io/PROJECT_ID/audio-manga .
   
   # Push to registry
   docker push gcr.io/PROJECT_ID/audio-manga
   
   # Deploy to Cloud Run
   gcloud run deploy audio-manga-app \
     --image gcr.io/PROJECT_ID/audio-manga \
     --region us-east4 \
     --service-account main-app-account@PROJECT_ID.iam.gserviceaccount.com
   ```

### Automated Deployments

The CI/CD pipeline automatically triggers on:
- Pushes to the main branch
- Pull request merges
- Manual triggers from Google Cloud Console

**Pipeline Features:**
- **Security:** All secrets managed through Google Secret Manager
- **Reliability:** 20-minute timeout with proper error handling
- **Monitoring:** Comprehensive logging through Google Cloud Logging
- **Rollback:** Maintains previous versions for quick rollback if needed

### Environment-Specific Configuration

- **Development:** Uses `.env.local` for local development
- **Production:** All secrets injected via Google Secret Manager during deployment
- **Testing:** Supports separate testing configurations

## Development Tools & Scripts

### Code Quality

The project includes comprehensive code quality tools:

- **ESLint:** Configured with Next.js and Prettier integration
- **Prettier:** Automatic code formatting with custom rules
- **Husky:** Git hooks for pre-commit checks
- **lint-staged:** Runs quality checks only on staged files

### Git Hooks

Pre-commit hooks automatically:
- Format code with Prettier
- Run ESLint and fix auto-fixable issues
- Validate code quality before commits

### Docker Support

The project includes:
- **Dockerfile:** Multi-stage build for production optimization
- **dockerignore:** Excludes unnecessary files from container
- **Standalone output:** Next.js standalone mode for minimal container size

## Troubleshooting

### Common Issues

1. **GCP Authentication Errors:**
   - Verify service account permissions
   - Check credential file path and format
   - Run `node scripts/test-gcp-access.js` for diagnostics

2. **Build Failures:**
   - Check all environment variables are set
   - Verify Node.js version compatibility
   - Clear `.next` cache and rebuild

3. **Deployment Issues:**
   - Verify Secret Manager configuration
   - Check Cloud Run service account permissions
   - Review Cloud Build logs for specific errors

### Getting Help

- Check the existing issues in the repository
- Review Google Cloud documentation for service-specific issues
- Verify all prerequisites are properly configured

---

**Disclaimer:** I do not own the rights to the Detective Conan manga or soundtrack. This project is for educational and personal use only.
