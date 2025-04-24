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
  const storageOptions: { projectId?: string; keyFilename?: string; credentials?: any } = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  };
  if (process.env.GOOGLE_CLOUD_KEYFILE_JSON) {
    storageOptions.credentials = JSON.parse(process.env.GOOGLE_CLOUD_KEYFILE_JSON);
  } else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    storageOptions.keyFilename = path.resolve(process.cwd(), process.env.GOOGLE_CLOUD_CREDENTIALS);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  } else {
    throw new Error('Google Cloud credentials not set');
  }
  return new Storage(storageOptions);
}
