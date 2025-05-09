
# Detective Conan OST Manga Reader

## Overview

The "Detective Conan OST Manga Reader" is a web application designed to enhance the experience of reading the Detective Conan manga by dynamically playing appropriate Original Soundtrack (OST) music based on the mood of the currently viewed page. It leverages AI for initial mood classification and allows users to refine these classifications.

The project features:
*   A manga reader that synchronizes OST playback with page content.
*   An AI-powered system to classify the mood of each manga page.
*   A user interface to manage and correct mood classifications.
*   A system for ingesting new manga chapters.
*   A homepage to browse available chapters.

## Features

*   **Dynamic OST Playback:** As you read, the application automatically selects and plays music tracks matching the mood of the current page.
*   **AI Mood Classification:** New chapters are processed using Google's Gemini AI to determine the dominant mood of each page (e.g., "tension," "comedy," "revelation").
*   **Manual Mood Editing:** Users can review and override AI-generated mood classifications for each page to fine-tune the audio experience.
*   **Chapter Ingestion:** A dedicated interface allows users to submit new chapter numbers for downloading, processing, and classification.
*   **Chapter Browser:** A homepage lists all processed chapters, their status, and provides links to read or edit moods.
*   **Configurable Audio:** Control audio settings like volume, fade-in, and fade-out durations for music transitions.
*   **Dark/Light Mode:** The UI supports both dark and light themes based on system preference.

## Tech Stack

*   **Frontend:**
    *   Next.js (App Router)
    *   React
    *   TypeScript
    *   Tailwind CSS
    *   Lucide Icons
*   **Backend (API Routes & Background Processing):**
    *   Next.js API Routes
    *   Node.js
    *   Google Cloud Functions (for background chapter processing - triggered by Cloud Tasks)
    *   Google Cloud Tasks (for queuing background jobs)
*   **AI:**
    *   Google Generative AI (Gemini Pro/Flash model)
*   **Database:**
    *   Supabase (PostgreSQL)
*   **Storage:**
    *   Google Cloud Storage (for manga page images, OST audio files, and temporary chapter archives)
*   **Other Libraries:**
    *   `AdmZip` (for ZIP archive handling)
    *   `date-fns` (for date formatting)

## Core Workflows

1.  **Chapter Ingestion:**
    *   User submits a chapter number via the `/manga-classifier` page.
    *   `/api/download-chapter` API fetches images from an external source (Cubari.moe), zips them, uploads to a temporary GCS bucket.
    *   A Google Cloud Task is enqueued, pointing to a Cloud Function worker.
    *   The Cloud Function worker:
        *   Downloads the ZIP from GCS.
        *   Extracts images.
        *   Classifies each page's mood using Gemini AI.
        *   Uploads processed page images to the main GCS bucket.
        *   Stores chapter metadata and page classifications in Supabase.
        *   Updates chapter status to `completed` or `failed`.
        *   Cleans up the temporary ZIP from GCS.

2.  **Manga Reading (`/reader/[chapterNumber]`):**
    *   Page data (including signed GCS URLs for images) and classifications are fetched server-side.
    *   The `ReaderContent` client component displays pages.
    *   `usePageObserver` tracks the current page.
    *   `AudioPlayer` fetches a random audio track (via `/api/audio/random`) matching the current page's mood and handles playback with cross-fading.
    *   `ClassificationBubble` displays the current mood.
    *   Users can trigger the download/processing of the next chapter.

3.  **Mood Management (`/moods/[chapterNumber]`):**
    *   Displays all pages of a chapter with their AI-generated moods.
    *   Users can use the `CategorySelector` to change the mood for any page.
    *   Changes are saved to Supabase via a `PATCH` request to `/api/chapters/[chapterNumber]/classifications/[pageNumber]`.

## Setup & Configuration

### Prerequisites

*   Node.js (version specified in `.nvmrc` or latest LTS)
*   npm or yarn
*   Access to Google Cloud Platform (GCP)
*   A Supabase project

### Environment Variables

Create a `.env.local` file in the root of the project and populate it with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
GOOGLE_CLOUD_BUCKET_NAME=your_main_gcs_bucket_name_for_pages_and_audio
GCP_TEMP_UPLOAD_BUCKET_NAME=your_temporary_gcs_bucket_for_chapter_zips
GCP_QUEUE_ID=your_cloud_tasks_queue_name
GCP_QUEUE_LOCATION=your_cloud_tasks_queue_location # e.g., us-central1
GCP_TASK_HANDLER_URL=your_cloud_function_trigger_url_for_manga_processing

# For GCS/Cloud Tasks client authentication (choose one method or combine)
# Option 1: Service Account Key JSON (as string)
# GOOGLE_CLOUD_KEYFILE_JSON='{"type": "service_account", ...}'

# Option 2: Service Account Credentials (explicitly) - Private key should be base64 encoded
# GCP_CLIENT_EMAIL=your_service_account_email
# GCP_PRIVATE_KEY_BASE64=your_base64_encoded_private_key

# Option 3: Path to key file (if running locally with ADC setup or on GCE/Cloud Run with service account)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json

# Google Generative AI API Keys (for mood classification)
GOOGLE_API_KEY=your_gemini_api_key_1
GOOGLE_API_KEY_2=your_gemini_api_key_2 # Optional second key for fallback
```


**Note on GCP Authentication:** The gcsUtils.ts and download-chapter API route prioritize explicit credentials (GCP_CLIENT_EMAIL/GCP_PRIVATE_KEY_BASE64), then GOOGLE_CLOUD_KEYFILE_JSON, then GOOGLE_APPLICATION_CREDENTIALS. Ensure your environment provides one of these for server-side operations.

### Database Schema

You will need to set up the following tables in your Supabase database:

1.  **manga_chapters**
    
    -   id (int8, primary key, auto-increment)
        
    -   chapter_number (int4, unique, not null)
        
    -   status (text, not null, e.g., 'pending', 'processing', 'completed', 'failed')
        
    -   total_pages (int4)
        
    -   processed_at (timestamptz)
        
    -   error_message (text)
        
    -   created_at (timestamptz, default now())
        
2.  **manga_page_classifications**
    
    -   id (int8, primary key, auto-increment)
        
    -   chapter_number (int4, not null, foreign key to manga_chapters.chapter_number)
        
    -   page_number (int4, not null)
        
    -   filename (text, not null)
        
    -   category (text, not null -- one of the defined mood categories)
        
    -   explanation (text) -- AI's reasoning for the classification
        
    -   created_at (timestamptz, default now())
        
    -   Unique constraint on (chapter_number, page_number)
        

### GCS Bucket Setup

1.  Create two GCS buckets:
    
    -   One for main storage (GOOGLE_CLOUD_BUCKET_NAME):
        
        -   Store processed manga pages under chapters/[chapter_number]/[page_number].[ext]
            
        -   Store audio files under audio/[mood_category]/[filename.mp3]
            
    -   One for temporary ZIP uploads (GCP_TEMP_UPLOAD_BUCKET_NAME).
        
2.  Configure appropriate permissions for your service account to read/write to these buckets.
    

### Google Cloud Tasks & Functions

1.  **Cloud Tasks Queue:** Create a Cloud Tasks queue in the specified GCP_QUEUE_LOCATION.
    
2.  **Cloud Function:**
    
    -   Deploy a Google Cloud Function (HTTP trigger) that will act as the GCP_TASK_HANDLER_URL.
        
    -   This function should contain the logic from src/services/manga-processing/backgroundProcessor.ts (or similar logic) to:
        
        -   Download the ZIP from the temporary GCS bucket.
            
        -   Extract images.
            
        -   Call aiService.classifyChapter.
            
        -   Upload processed images to the main GCS bucket.
            
        -   Store results in Supabase.
            
        -   Update chapter status in Supabase.
            
        -   Delete the temporary ZIP from GCS.
            
    -   Ensure this Cloud Function has permissions to access GCS, Supabase (via network or public API), and Gemini AI.
        

### Installation

```
npm install
# or
yarn install
```


### Running Locally

```
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:3000.

**Note:** For local development, the chapter ingestion workflow involving Cloud Tasks and Cloud Functions will require those services to be deployed and accessible, or you'll need to mock/simulate their behavior. The /api/download-chapter route will enqueue tasks, but the actual processing won't occur unless the Cloud Function worker is operational.

## Development

-   **API Routes:** Located in src/app/api.
    
-   **Client Components:** Primarily in src/components and page-specific components within src/app/*/[page].tsx or dedicated files like ReaderContent.tsx.
    
-   **Styling:** Uses Tailwind CSS. Global styles and theme variables are in src/app/globals.css.
    
-   **Types:** Shared TypeScript types are in src/types.ts.
    

