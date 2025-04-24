# Google Cloud Storage Setup for Audio Manga

This document provides steps to set up Google Cloud Storage for storing audio files in the Audio Manga application.

## Prerequisites

1. Google Cloud Platform account
2. Billing enabled on your GCP account

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project"
3. Enter a project name and select an organization if applicable
4. Click "Create"

### 2. Create a Storage Bucket

1. In your GCP project, navigate to "Storage" > "Browser"
2. Click "Create Bucket"
3. Name your bucket (e.g., "audio-manga")
4. Choose your storage location settings based on your user base
5. Configure other settings as needed (retention, access control, etc.)
6. Click "Create"

### 3. Set Up Authentication

1. Navigate to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a service account name and description
4. Assign roles: "Storage Admin" for full access to the bucket
5. Create a key for the service account (JSON format)
6. Download the key file and save it securely in your project (e.g., as `google-credentials.json`)

### 4. Update Environment Variables

Update your `.env.local` file with:

```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_BUCKET_NAME=audio-manga
GOOGLE_CLOUD_CREDENTIALS=./google-credentials.json
```

- Replace `your-project-id` with your actual GCP project ID
- Make sure the credentials path matches where you stored your JSON key file

### 5. Organize Your Storage

Upload your audio files to the bucket with this structure:
```
audio/
  happy/
    happy-sound1.mp3
    happy-sound2.mp3
  sad/
    sad-sound1.mp3
    sad-sound2.mp3
  ...etc
```

## Security Considerations

- Never commit your credentials JSON file to version control
- Add it to your `.gitignore` file
- Consider using environment variable secrets if deploying to a platform like Vercel 

## Troubleshooting

### 500 Error when fetching audio

If you're seeing a 500 error when trying to play audio, check these common issues:

1. **Missing Credentials File**: 
   - Ensure your `google-credentials.json` file exists in the project root
   - Download it from Google Cloud Console > IAM & Admin > Service Accounts > Your Service Account > Keys

2. **Incorrect Project ID**: 
   - Make sure your `.env.local` file has the correct `GOOGLE_CLOUD_PROJECT_ID` value
   - Check it against the project ID in Google Cloud Console

3. **Wrong Bucket Name**: 
   - Verify that `GOOGLE_CLOUD_BUCKET_NAME` in `.env.local` matches your actual bucket name

4. **File Structure in Bucket**:
   - Your audio files should be organized in the bucket as: `audio/{mood}/filename.mp3`
   - Example: `audio/happy/song1.mp3`

5. **Check Server Logs**:
   - Look at your server terminal output for detailed error messages

### Testing Your Setup

Run this command to verify your credentials and bucket access:

```bash
node -e "
const {Storage} = require('@google-cloud/storage');
const storage = new Storage({
  keyFilename: './google-credentials.json',
  projectId: 'your-project-id' // replace with your project ID
}); 
storage.bucket('dc_audio').getFiles().then(([files]) => { 
  console.log('Success! Found', files.length, 'files');
  files.slice(0, 5).forEach(f => console.log(' -', f.name));
}).catch(err => console.error('Error:', err))
"
``` 