import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { promisify } from 'util';
import childProcess from 'child_process';

const exec = promisify(childProcess.exec);

/**
 * Extracts an archive file (ZIP, CBZ, CBR) to a subdirectory named 'extracted'.
 * @param {string} filePath - The path to the archive file.
 * @returns {Promise<string>} The path to the directory where files were extracted.
 * @throws {Error} If the archive format is unsupported or extraction fails.
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
    } catch (error) {
      throw new Error('Failed to extract CBR file. Make sure unrar is installed on the server.');
    }
  } else {
    throw new Error('Unsupported archive format');
  }
  
  return extractDir;
}