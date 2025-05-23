import fs from 'fs';
import path from 'path';

/**
 * Recursively finds all image files in a directory and its subdirectories.
 * Searches for common image file extensions and returns sorted file paths.
 *
 * @param dirPath - The path to the directory to search
 * @returns Array of full paths to image files, sorted alphabetically by filename
 * @throws Error if directory doesn't exist or can't be read
 *
 * @example
 * ```typescript
 * const imageFiles = getImageFiles('./manga/chapter-1');
 * console.log(imageFiles);
 * // ['/full/path/to/manga/chapter-1/page_001.jpg', '/full/path/to/manga/chapter-1/page_002.png']
 * ```
 *
 * @remarks
 * Supported image formats: .jpg, .jpeg, .png, .gif, .webp
 * File paths are sorted alphabetically to ensure consistent page ordering
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
