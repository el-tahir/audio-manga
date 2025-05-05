import { getStorageClient } from '@/utils/gcsUtils'; // Adjust path if needed

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

export async function getSignedUrlForPage(chapterNumber: number, pageNumber: number): Promise<string> {
  if (!bucketName) {
    throw new Error("Missing GOOGLE_CLOUD_BUCKET_NAME environment variable");
  }

  try {
    const storage = getStorageClient(); // Initialize GCS client
    const gcsObjectPath = `chapters/${chapterNumber}/${pageNumber}.jpg`;
    const file = storage.bucket(bucketName).file(gcsObjectPath);

    // Generate signed URL (same logic as your API route)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    });
    return signedUrl;
  } catch (error: any) {
    console.error(`Error getting signed URL for chapter ${chapterNumber}, page ${pageNumber}:`, error);
    // Re-throw a more specific error or return an indicator
    throw new Error(`Failed to get signed URL for C:${chapterNumber} P:${pageNumber} - ${error.message}`);
  }
} 