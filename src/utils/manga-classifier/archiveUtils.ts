import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { promisify } from 'util';
import childProcess from 'child_process';

const exec = promisify(childProcess.exec);

/**
 * Extracts manga archive files to a designated extraction directory.
 * Supports common manga archive formats including ZIP, CBZ, and CBR.
 *
 * @param filePath - The path to the archive file to extract
 * @returns Promise resolving to the path of the extraction directory
 * @throws Error if the archive format is unsupported, file doesn't exist, or extraction fails
 *
 * @example
 * ```typescript
 * try {
 *   const extractedDir = await extractArchive('./manga/chapter-1128.cbz');
 *   console.log(`Files extracted to: ${extractedDir}`);
 * } catch (error) {
 *   console.error('Extraction failed:', error);
 * }
 * ```
 *
 * @remarks
 * - **ZIP/CBZ files**: Extracted using the AdmZip library (built-in support)
 * - **CBR files**: Requires the `unrar` command-line tool to be installed on the system
 * - **Extraction directory**: Creates an 'extracted' subdirectory in the same folder as the archive
 * - **Overwrite behavior**: Existing files in the extraction directory will be overwritten
 *
 * @see {@link https://github.com/cthackers/adm-zip | AdmZip documentation}
 */
export async function extractArchive(filePath: string): Promise<string> {
  const extractDir = path.join(path.dirname(filePath), 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });

  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.zip' || extension === '.cbz') {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(extractDir, true);
  } else if (extension === '.cbr') {
    // Using unrar command if available
    try {
      await exec(`unrar x "${filePath}" "${extractDir}"`);
    } catch {
      throw new Error('Failed to extract CBR file. Make sure unrar is installed on the server.');
    }
  } else {
    throw new Error('Unsupported archive format');
  }

  return extractDir;
}
