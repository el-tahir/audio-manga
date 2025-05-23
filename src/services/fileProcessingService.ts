import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';

export interface DownloadResult {
  downloadedFolderPath: string;
  downloadedCount: number;
  totalAttempted: number;
}

export interface ZipCreationResult {
  zipPath: string;
  zipFileName: string;
}

/**
 * Determines the appropriate file extension based on the HTTP Content-Type header.
 * Defaults to 'png' if the content type is null or not recognized.
 *
 * @param contentType - The value of the Content-Type header
 * @returns The determined file extension (e.g., 'jpg', 'png', 'webp', 'gif')
 */
function getExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'png'; // Default
  contentType = contentType.toLowerCase();
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'png'; // Default to png if unsure or other format
}

/**
 * Downloads images from the provided URLs to a temporary directory.
 * Images are saved with sequential naming (page_001.ext, page_002.ext, etc.).
 * Failed downloads are logged but don't stop the process.
 *
 * @param imageUrls - Array of image URLs to download
 * @param chapterNumber - Chapter number for logging purposes
 * @param timeoutMs - Download timeout in milliseconds (default: 30000)
 * @returns Promise resolving to download results including folder path and counts
 * @throws Error if temporary directory creation fails
 */
export async function downloadImagesToTempDir(
  imageUrls: string[],
  chapterNumber: string,
  timeoutMs: number = 30000
): Promise<DownloadResult> {
  // Create temporary directory
  const tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chapter-download-'));
  console.log(`[FileProcessingService] Created temp download directory: ${tempDownloadDir}`);

  let downloadedCount = 0;
  const totalAttempted = imageUrls.length;

  // Download images
  for (let i = 0; i < imageUrls.length; i++) {
    const pageNum = i + 1;
    const imageUrl = imageUrls[i];

    try {
      const imgRes = await fetch(imageUrl, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!imgRes.ok) {
        console.error(
          `[FileProcessingService] Failed to download page ${pageNum}: HTTP ${imgRes.status} ${imgRes.statusText}`
        );
        continue; // Skip this page
      }

      const contentType = imgRes.headers.get('content-type');
      const extension = getExtensionFromContentType(contentType);
      const imgBuffer = await imgRes.arrayBuffer();
      const filename = `page_${pageNum.toString().padStart(3, '0')}.${extension}`;
      const filePath = path.join(tempDownloadDir, filename);

      await fs.writeFile(filePath, Buffer.from(imgBuffer));
      console.log(`[FileProcessingService] Downloaded page ${pageNum}: ${filename}`);
      downloadedCount++;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.error(
          `[FileProcessingService] Timeout downloading page ${pageNum}:`,
          error.message
        );
      } else {
        console.error(`[FileProcessingService] Error downloading page ${pageNum}:`, error);
      }
      // Continue with next page
    }
  }

  console.log(
    `[FileProcessingService] Download complete: ${downloadedCount}/${totalAttempted} pages successful`
  );

  return {
    downloadedFolderPath: tempDownloadDir,
    downloadedCount,
    totalAttempted,
  };
}

/**
 * Creates a ZIP archive from all files in the source folder.
 * The created ZIP file includes a timestamp to ensure uniqueness.
 *
 * @param sourceFolderPath - Path to the folder containing files to zip
 * @param chapterNumber - Chapter number for naming the output file
 * @returns Promise resolving to zip creation results
 * @throws Error if archiving fails
 */
export async function createChapterZip(
  sourceFolderPath: string,
  chapterNumber: string
): Promise<ZipCreationResult> {
  const timestamp = Date.now();
  const zipFileName = `chapter_${chapterNumber}_${timestamp}.zip`;
  const zipPath = path.join(os.tmpdir(), zipFileName);

  try {
    const zip = new AdmZip();

    // Read all files from source folder
    const files = await fs.readdir(sourceFolderPath);
    const imageFiles = files.filter(file => /\.(jpe?g|png|gif|webp)$/i.test(file)).sort(); // Ensure consistent ordering

    for (const file of imageFiles) {
      const filePath = path.join(sourceFolderPath, file);
      zip.addLocalFile(filePath);
    }

    // Write the zip file
    zip.writeZip(zipPath);
    console.log(`[FileProcessingService] Created ZIP archive: ${zipPath}`);

    return { zipPath, zipFileName };
  } catch (error) {
    console.error('[FileProcessingService] Error creating ZIP archive:', error);
    throw error;
  }
}

/**
 * Downloads images and creates a ZIP archive in one operation.
 * Combines downloadImagesToTempDir and createChapterZip for convenience.
 *
 * @param imageUrls - Array of image URLs to download
 * @param chapterNumber - Chapter number for naming and logging
 * @param timeoutMs - Download timeout in milliseconds (default: 30000)
 * @returns Promise resolving to combined download and zip results
 */
export async function downloadAndZipChapter(
  imageUrls: string[],
  chapterNumber: string,
  timeoutMs: number = 30000
): Promise<DownloadResult & ZipCreationResult> {
  const downloadResult = await downloadImagesToTempDir(imageUrls, chapterNumber, timeoutMs);
  const zipResult = await createChapterZip(downloadResult.downloadedFolderPath, chapterNumber);

  return {
    ...downloadResult,
    ...zipResult,
  };
}

/**
 * Cleans up temporary files and directories.
 * This function safely removes files/directories and logs errors instead of throwing.
 *
 * @param paths - Array of file or directory paths to clean up
 */
export async function cleanupTempFiles(paths: (string | null | undefined)[]): Promise<void> {
  for (const filePath of paths) {
    if (!filePath) continue;

    try {
      console.log(`[FileProcessingService] Cleaning up: ${filePath}`);
      await fs.rm(filePath, { recursive: true, force: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[FileProcessingService] Error cleaning up ${filePath}:`, err.message);
    }
  }
}
