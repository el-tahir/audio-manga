import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Creates a temporary directory for manga classification.
 * @returns {Promise<string>} The path to the created temporary directory.
 */
export async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `manga-classifier-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up (deletes) a directory and its contents.
 * Primarily used for removing temporary directories.
 * Logs warnings for files/directories that cannot be removed instead of crashing.
 * @param {string} dirPath - The path to the directory to clean up.
 */
export function cleanupTempFiles(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      const deleteRecursive = (dir: string) => {
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).forEach((file) => {
            const curPath = path.join(dir, file);
            try {
              if (fs.lstatSync(curPath).isDirectory()) {
                deleteRecursive(curPath);
              } else {
                try {
                  fs.unlinkSync(curPath);
                } catch (err) {
                  // If we can't delete the file, just log it rather than crashing
                  const fileError = err as Error;
                  console.warn(`[MANGA-CLASSIFIER] Could not delete temporary file ${curPath}: ${fileError.message}`);
                }
              }
            } catch (err) {
              const statError = err as Error;
              console.warn(`[MANGA-CLASSIFIER] Error accessing ${curPath}: ${statError.message}`);
            }
          });
          
          // Try to remove the directory but don't crash if it fails
          try {
            fs.rmdirSync(dir);
          } catch (err) {
            const dirError = err as Error;
            console.warn(`[MANGA-CLASSIFIER] Could not remove directory ${dir}: ${dirError.message}`);
          }
        }
      };
      
      deleteRecursive(dirPath);
      console.log(`[MANGA-CLASSIFIER] Temp directory cleanup attempted for ${dirPath}`);
    }
  } catch (error) {
    console.error('[MANGA-CLASSIFIER] Error during temp files cleanup:', error);
  }
}

/**
 * Extracts the chapter number from a filename.
 * Assumes the chapter number is at the beginning of the filename (e.g., "001.cbz", "10.zip").
 * @param {string} filename - The filename to parse.
 * @returns {number | null} The extracted chapter number, or null if not found.
 */
export function extractChapterNumber(filename: string): number | null {
  const match = filename.match(/^(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Saves a file (e.g., a chapter archive) to the public/chapters directory.
 * The destination filename will be <chapterNumber>.<original_extension>.
 * @param {string} sourceFilePath - The path to the source file.
 * @param {number} chapterNumber - The chapter number.
 * @returns {Promise<string>} The destination path of the saved file.
 */
export async function saveToPublicDirectory(sourceFilePath: string, chapterNumber: number): Promise<string> {
  const publicDir = path.join(process.cwd(), 'public', 'chapters');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log(`[MANGA-CLASSIFIER] Created public chapters directory: ${publicDir}`);
  }
  
  const fileExtension = path.extname(sourceFilePath);
  const destPath = path.join(publicDir, `${chapterNumber}${fileExtension}`);
  
  fs.copyFileSync(sourceFilePath, destPath);
  console.log(`[MANGA-CLASSIFIER] Saved chapter ${chapterNumber} to public directory: ${destPath}`);
  
  return destPath;
}

/**
 * Saves individual image files to a chapter-specific subdirectory within public/chapters.
 * Images are named sequentially (1.jpg, 2.jpg, etc.).
 * Existing files in the target chapter directory are cleared before saving new ones.
 * @param {string[]} imageFiles - An array of paths to the image files to save.
 * @param {number} chapterNumber - The chapter number.
 * @returns {Promise<string>} The path to the directory where images were saved.
 */
export async function saveImagesToPublicDirectory(imageFiles: string[], chapterNumber: number): Promise<string> {
  const chapterDir = path.join(process.cwd(), 'public', 'chapters', chapterNumber.toString());
  
  if (!fs.existsSync(chapterDir)) {
    fs.mkdirSync(chapterDir, { recursive: true });
    console.log(`[MANGA-CLASSIFIER] Created chapter directory: ${chapterDir}`);
  } else {
    // Clear any existing files in this directory
    fs.readdirSync(chapterDir).forEach(file => {
      const filePath = path.join(chapterDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    console.log(`[MANGA-CLASSIFIER] Cleared existing files in chapter directory: ${chapterDir}`);
  }
  
  // Sort the image files to ensure correct page order
  const sortedImageFiles = [...imageFiles].sort();
  
  for (let i = 0; i < sortedImageFiles.length; i++) {
    const sourceImage = sortedImageFiles[i];
    const pageNumber = i + 1; // 1-based page numbering
    const destImage = path.join(chapterDir, `${pageNumber}.jpg`);
    
    // TODO (YYYY-MM-DD): For a more robust solution, use an image processing library
    // to ensure consistent JPG format and potentially optimize images.
    fs.copyFileSync(sourceImage, destImage);
    
    if ((i + 1) % 10 === 0 || i === sortedImageFiles.length - 1) {
      console.log(`[MANGA-CLASSIFIER] Saved ${i + 1}/${sortedImageFiles.length} images for chapter ${chapterNumber}`);
    }
  }
  
  return chapterDir;
}