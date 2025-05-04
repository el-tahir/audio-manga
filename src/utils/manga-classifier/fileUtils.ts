import fs from 'fs';
import path from 'path';
import os from 'os';

// Function to create a temporary directory
export async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `manga-classifier-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

// Function to clean up temporary files
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

// Function to extract chapter number from filename
export function extractChapterNumber(filename: string): number | null {
  const match = filename.match(/^(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Function to save archive to public/chapters directory
export async function saveToPublicDirectory(sourceFilePath: string, chapterNumber: number): Promise<string> {
  // Determine the public directory path
  const publicDir = path.join(process.cwd(), 'public', 'chapters');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log(`[MANGA-CLASSIFIER] Created public chapters directory: ${publicDir}`);
  }
  
  // Get the file extension from the source
  const fileExtension = path.extname(sourceFilePath);
  
  // Create the destination path with the chapter number as filename
  const destPath = path.join(publicDir, `${chapterNumber}${fileExtension}`);
  
  // Copy the file
  fs.copyFileSync(sourceFilePath, destPath);
  console.log(`[MANGA-CLASSIFIER] Saved chapter ${chapterNumber} to public directory: ${destPath}`);
  
  return destPath;
}

// Function to save individual page images to public directory
export async function saveImagesToPublicDirectory(imageFiles: string[], chapterNumber: number): Promise<string> {
  // Create chapter-specific directory
  const chapterDir = path.join(process.cwd(), 'public', 'chapters', chapterNumber.toString());
  
  // Create the directory if it doesn't exist
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
  
  // Copy each image with the new naming convention
  for (let i = 0; i < sortedImageFiles.length; i++) {
    const sourceImage = sortedImageFiles[i];
    const pageNumber = i + 1; // 1-based page numbering
    const destImage = path.join(chapterDir, `${pageNumber}.jpg`);
    
    // Simple file copy - for a more robust solution, you might want to use
    // an image processing library to ensure consistent jpg format
    fs.copyFileSync(sourceImage, destImage);
    
    if ((i + 1) % 10 === 0 || i === sortedImageFiles.length - 1) {
      console.log(`[MANGA-CLASSIFIER] Saved ${i + 1}/${sortedImageFiles.length} images for chapter ${chapterNumber}`);
    }
  }
  
  return chapterDir;
}