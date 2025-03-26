import fs from 'fs';
import path from 'path';
import os from 'os';

// Function to create a temporary directory
export async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `manga-classifier-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

// Function to save uploaded file to temporary location
export async function saveFile(formData: FormData): Promise<string> {
  const file = formData.get('archive') as File;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const tempDir = await createTempDir();
  const filePath = path.join(tempDir, file.name);
  
  const fileArrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(fileArrayBuffer));
  
  return filePath;
}

// Function to clean up temporary files
export function cleanupTempFiles(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      const deleteRecursive = (dir: string) => {
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).forEach((file) => {
            const curPath = path.join(dir, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteRecursive(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dir);
        }
      };
      
      deleteRecursive(dirPath);
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
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