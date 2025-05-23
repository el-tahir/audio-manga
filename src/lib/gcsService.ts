import { createGCSClient } from '@/utils/gcsUtils';

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

export async function getSignedUrlForPage(
  chapterNumber: number,
  pageNumber: number
): Promise<string> {
  if (!bucketName) {
    throw new Error('Missing GOOGLE_CLOUD_BUCKET_NAME environment variable');
  }

  try {
    const storage = createGCSClient();
    const bucket = storage.bucket(bucketName);

    const pngPath = `chapters/${chapterNumber}/${pageNumber}.png`;
    const jpgPath = `chapters/${chapterNumber}/${pageNumber}.jpg`;

    let finalPath: string;

    const [pngExists] = await bucket.file(pngPath).exists();

    if (pngExists) {
      console.log(
        `[GCS Signed URL] Found PNG for C:${chapterNumber} P:${pageNumber}. Using path: ${pngPath}`
      );
      finalPath = pngPath;
    } else {
      console.log(
        `[GCS Signed URL] PNG not found for C:${chapterNumber} P:${pageNumber}. Falling back to JPG path: ${jpgPath}`
      );
      finalPath = jpgPath;
    }

    const file = bucket.file(finalPath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    return signedUrl;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `Error getting signed URL for chapter ${chapterNumber}, page ${pageNumber}:`,
      err
    );
    throw new Error(
      `Failed to get signed URL for C:${chapterNumber} P:${pageNumber} - ${err.message}`
    );
  }
}
