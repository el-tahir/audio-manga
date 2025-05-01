import { Storage } from '@google-cloud/storage';
import path from 'path';

/**
 * Uploads a local file to Google Cloud Storage.
 * @param sourceFilePath - Path to the local file to upload.
 * @param destinationGcsPath - Destination path (object name) in the bucket.
 * @param bucketName - Name of the GCS bucket.
 */
export async function uploadFileToGCS(
  sourceFilePath: string,
  destinationGcsPath: string,
  bucketName: string
): Promise<void> {
  // Initialize GCS client
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);

  try {
    await bucket.upload(sourceFilePath, { destination: destinationGcsPath });
    console.log(
      `[GCS] Uploaded file ${sourceFilePath} to gs://${bucketName}/${destinationGcsPath}`
    );
  } catch (err) {
    console.error(
      `[GCS] Error uploading ${sourceFilePath} to gs://${bucketName}/${destinationGcsPath}:`,
      err
    );
    throw err;
  }
}

// Add helper to get authenticated GCS client
export function getStorageClient(): Storage {
  const storageOptions: { projectId?: string; keyFilename?: string; credentials?: { client_email: string; private_key: string; } } = {};

  // Prioritize explicit credentials from env vars
  if (process.env.GCP_PROJECT_ID && process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY_BASE64) {
    storageOptions.projectId = process.env.GCP_PROJECT_ID;
    storageOptions.credentials = {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: Buffer.from(process.env.GCP_PRIVATE_KEY_BASE64, 'base64').toString('utf8'),
    };
    console.log("[GCS] Using explicit credentials from ENV variables.");
  } 
  // Fallback to other methods
  else if (process.env.GOOGLE_CLOUD_KEYFILE_JSON) {
    console.log("[GCS] Using credentials from GOOGLE_CLOUD_KEYFILE_JSON ENV variable.");
    // Type assertion needed as JSON.parse returns any
    const parsedCredentials = JSON.parse(process.env.GOOGLE_CLOUD_KEYFILE_JSON) as { project_id?: string, client_email: string, private_key: string };
    storageOptions.credentials = { 
        client_email: parsedCredentials.client_email, 
        private_key: parsedCredentials.private_key 
    };
    if (parsedCredentials.project_id) { 
      storageOptions.projectId = parsedCredentials.project_id;
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("[GCS] Using credentials file path from GOOGLE_APPLICATION_CREDENTIALS ENV variable.");
    storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    // Use separate GOOGLE_CLOUD_PROJECT_ID if provided, otherwise GCS client often infers from key file
    if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    }
  } else {
    console.error("[GCS] Google Cloud credentials not set in environment variables.");
    throw new Error('Google Cloud credentials not set');
  }
  
  // Final check for projectId if other methods didn't set it
  if (!storageOptions.projectId && process.env.GOOGLE_CLOUD_PROJECT_ID) {
      storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  }

  if (!storageOptions.projectId && !storageOptions.keyFilename && !storageOptions.credentials?.client_email) {
    // Throw error only if no valid credential method was found
    // Check credentials presence rather than project_id specifically
     throw new Error('[GCS] Failed to determine Google Cloud Project ID and credentials.');
  } else if (!storageOptions.projectId && !storageOptions.keyFilename) {
     // Warn if projectId is missing but credentials seem okay
      console.warn("[GCS] Project ID not found in credentials or separate ENV variable (GOOGLE_CLOUD_PROJECT_ID). GCS client might infer it.");
  }

  return new Storage(storageOptions);
}
