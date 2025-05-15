import fs from 'fs';
import path from 'path';

/**
 * Recursively finds all image files (jpg, jpeg, png, gif, webp) in a directory.
 * @param {string} dirPath - The path to the directory to search.
 * @returns {string[]} An array of full paths to the image files, sorted by name.
 */
export function getImageFiles(dirPath: string): string[] {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const files: string[] = [];
  
  const readDir = (dir: string) => {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        readDir(fullPath);
      } else if (stat.isFile() && imageExtensions.includes(path.extname(item).toLowerCase())) {
        files.push(fullPath);
      }
    }
  };
  
  readDir(dirPath);
  // Sort files by name for sequential ordering
  return files.sort();
}