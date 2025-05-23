import { Storage } from '@google-cloud/storage';

/**
 * Uploads a local file to Google Cloud Storage.
 *
 * @param sourceFilePath - Path to the local file to upload
 * @param destinationGcsPath - Destination path (object name) in the bucket
 * @param bucketName - Name of the GCS bucket
 * @returns Promise that resolves when upload is complete
 * @throws Error if upload fails
 */
export async function uploadFileToGCS(
  sourceFilePath: string,
  destinationGcsPath: string,
  bucketName: string
): Promise<void> {
  const storage = createGCSClient();
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

/**
 * Creates and configures a Google Cloud Storage client with fallback authentication methods.
 * Tries multiple credential sources in order of priority for maximum compatibility.
 *
 * @returns Configured Google Cloud Storage instance
 * @throws Error if no valid credentials are found
 */
export function createGCSClient(): Storage {
  const storageOptions: {
    projectId?: string;
    credentials?:
      | {
          client_email?: string;
          private_key?: string;
        }
      | Record<string, unknown>;
    keyFilename?: string;
  } = {};

  try {
    // Priority 1: Explicit credentials from environment variables (recommended for Cloud Run)
    if (
      process.env.GCP_PROJECT_ID &&
      process.env.GCP_CLIENT_EMAIL &&
      process.env.GCP_PRIVATE_KEY_BASE64
    ) {
      storageOptions.projectId = process.env.GCP_PROJECT_ID;
      storageOptions.credentials = {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: Buffer.from(process.env.GCP_PRIVATE_KEY_BASE64, 'base64').toString('utf8'),
      };
      console.log('[GCS] Using explicit credentials from environment variables.');
    } else if (process.env.GOOGLE_CLOUD_KEYFILE_JSON) {
      // Priority 2: Full JSON credentials as environment variable
      console.log('[GCS] Using credentials from GOOGLE_CLOUD_KEYFILE_JSON environment variable.');
      const parsedCredentials = JSON.parse(process.env.GOOGLE_CLOUD_KEYFILE_JSON) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      if (parsedCredentials.project_id) {
        storageOptions.projectId = parsedCredentials.project_id;
      }

      storageOptions.credentials = parsedCredentials;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Priority 3: Path to credentials file (local development)
      console.log(`[GCS] Using credentials file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      }
    } else {
      // No explicit credentials found, will use default (e.g., metadata service in Cloud Run)
      console.log('[GCS] No explicit credentials found, using default authentication');
    }

    // Ensure project ID is set if available
    if (!storageOptions.projectId && process.env.GOOGLE_CLOUD_PROJECT_ID) {
      storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    }

    return new Storage(storageOptions);
  } catch (error) {
    console.error('[GCS] Error initializing Google Cloud Storage client:', error);
    throw new Error('Failed to initialize Google Cloud Storage client');
  }
}

/**
 * Downloads a file from Google Cloud Storage to the local filesystem.
 *
 * @param bucketName - Name of the GCS bucket
 * @param sourceGcsPath - Path to the file in GCS (without gs:// prefix)
 * @param destinationLocalPath - Local path where the file should be saved
 * @returns Promise that resolves when download is complete
 * @throws Error if download fails
 */
export async function downloadFromGCS(
  bucketName: string,
  sourceGcsPath: string,
  destinationLocalPath: string
): Promise<void> {
  const storage = createGCSClient();

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(sourceGcsPath);

    await file.download({
      destination: destinationLocalPath,
    });

    console.log(`[GCS] Downloaded gs://${bucketName}/${sourceGcsPath} to ${destinationLocalPath}`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[GCS] Error downloading gs://${bucketName}/${sourceGcsPath}:`, error);
    throw error;
  }
}

/**
 * Deletes a file from Google Cloud Storage.
 *
 * @param bucketName - Name of the GCS bucket
 * @param gcsPath - Path to the file in GCS (without gs:// prefix)
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteFromGCS(bucketName: string, gcsPath: string): Promise<void> {
  const storage = createGCSClient();

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);

    await file.delete();
    console.log(`[GCS] Deleted gs://${bucketName}/${gcsPath}`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if ((error as { code?: number }).code === 404) {
      console.warn(`[GCS] File not found (already deleted?): gs://${bucketName}/${gcsPath}`);
    } else {
      console.error(`[GCS] Error deleting gs://${bucketName}/${gcsPath}:`, error);
      throw error;
    }
  }
}
