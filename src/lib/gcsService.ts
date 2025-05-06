import { getStorageClient } from '@/utils/gcsUtils'; // Adjust path if needed

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

export async function getSignedUrlForPage(chapterNumber: number, pageNumber: number): Promise<string> {
  if (!bucketName) {
    throw new Error("Missing GOOGLE_CLOUD_BUCKET_NAME environment variable");
  }

  try {
    const storage = getStorageClient(); // Initialize GCS client
    const bucket = storage.bucket(bucketName);

    // Define potential paths
    const pngPath = `chapters/${chapterNumber}/${pageNumber}.png`;
    const jpgPath = `chapters/${chapterNumber}/${pageNumber}.jpg`;

    let finalPath: string;

    // Check if the PNG file exists
    const [pngExists] = await bucket.file(pngPath).exists();

    if (pngExists) {
      console.log(`[GCS Signed URL] Found PNG for C:${chapterNumber} P:${pageNumber}. Using path: ${pngPath}`);
      finalPath = pngPath;
    } else {
      console.log(`[GCS Signed URL] PNG not found for C:${chapterNumber} P:${pageNumber}. Falling back to JPG path: ${jpgPath}`);
      finalPath = jpgPath;
      // Optional: You could add another check here for jpgExists if needed, 
      // but falling back might be acceptable.
    }

    const file = bucket.file(finalPath);

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