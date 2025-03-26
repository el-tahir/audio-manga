import fs from 'fs';
import path from 'path';

// Function to get all image files from directory
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