import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises'; // Use promises for async file operations
import AdmZip from 'adm-zip';
import { promisify } from 'util';
import { supabase } from '@/lib/supabase';
import { processChapterInBackground } from '@/services/manga-processing/backgroundProcessor';

const execPromise = promisify(exec);
const DETECTIVE_CONAN_SLUG = "01J76XY7HA6DH9YYGREDVPH8W5";

export async function POST(
  request: NextRequest,
  { params }: { params: { chapterNumber: string } }
) {
  const { chapterNumber: chapterNumberStr } = params;
  // Basic validation
  if (!chapterNumberStr || typeof chapterNumberStr !== 'string') {
    return NextResponse.json({ error: 'Invalid chapter number format' }, { status: 400 });
  }

  // Convert to number for DB check, but keep string for script
  const chapterNumberInt = Number(chapterNumberStr); 
  if (isNaN(chapterNumberInt)) {
      return NextResponse.json({ error: 'Chapter number must be numeric (or like 123.5)' }, { status: 400 });
  }

  let tempDownloadDir: string | null = null;
  let tempZipPath: string | null = null;

  try {
    // 1. Check if chapter already exists or is processing
    const { data: existingChapter, error: dbCheckError } = await supabase
      .from('manga_chapters')
      .select('status')
      .eq('chapter_number', chapterNumberInt)
      .maybeSingle();

    if (dbCheckError) {
      console.error('[API download-chapter] DB check error:', dbCheckError);
      return NextResponse.json({ error: 'Database error checking chapter existence' }, { status: 500 });
    }

    if (existingChapter) {
      if (existingChapter.status === 'completed') {
        return NextResponse.json({ message: `Chapter ${chapterNumberStr} already processed.` }, { status: 409 });
      } else if (existingChapter.status !== 'failed') { // Allow re-triggering failed ones
        return NextResponse.json({ message: `Chapter ${chapterNumberStr} is currently processing (status: ${existingChapter.status}).` }, { status: 409 });
      }
      // If failed, allow to proceed and overwrite/retry
      console.log(`[API download-chapter] Chapter ${chapterNumberStr} previously failed, attempting reprocessing.`);
    }

    // 2. Create temporary directory for download script output
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chapter-download-'));
    console.log(`[API download-chapter] Created temp download dir: ${tempDownloadDir}`);

    // 3. Execute Python script
    // Use 'python' as Vercel's Linux env might not have 'python3' link
    const pythonCmd = 'python'; // Changed from platform check
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'download_chapter.py');
    const command = `${pythonCmd} "${scriptPath}" ${DETECTIVE_CONAN_SLUG} "${chapterNumberStr}" --output-dir "${tempDownloadDir}"`;

    console.log(`[API download-chapter] Executing: ${command}`);
    const { stdout, stderr } = await execPromise(command, { timeout: 300000 }); // 5 min timeout

    console.log(`[API download-chapter] Script stdout:
${stdout}`);
    if (stderr) {
      console.error(`[API download-chapter] Script stderr:
${stderr}`);
    }

    // 4. Parse script output for downloaded folder path
    const downloadPathMatch = stdout.match(/^DOWNLOAD_PATH:(.*)$/m);
    if (!downloadPathMatch || !downloadPathMatch[1]) {
      console.error('[API download-chapter] Could not find DOWNLOAD_PATH in script output.');
      throw new Error('Python script failed to report download path.');
    }
    const downloadedFolderPath = downloadPathMatch[1].trim();
    console.log(`[API download-chapter] Script reported download path: ${downloadedFolderPath}`);

    // Verify the directory exists
    try {
      await fs.access(downloadedFolderPath);
    } catch (accessError) {
      console.error(`[API download-chapter] Downloaded folder path not accessible: ${downloadedFolderPath}`);
      throw new Error('Downloaded folder not found after script execution.');
    }

    // 5. Create a temporary zip archive from the downloaded folder
    const zip = new AdmZip();
    zip.addLocalFolder(downloadedFolderPath);
    tempZipPath = path.join(tempDownloadDir, `${chapterNumberStr}.zip`); // Use .zip extension
    await zip.writeZipPromise(tempZipPath);
    console.log(`[API download-chapter] Created temporary zip archive: ${tempZipPath}`);

    // 6. Insert/Update chapter entry in DB as 'pending'
    // Use upsert to handle retrying failed chapters
    const { error: upsertError } = await supabase
      .from('manga_chapters')
      .upsert({
         chapter_number: chapterNumberInt,
         status: 'pending',
         total_pages: 0, // Will be updated by background process
         error_message: null // Clear previous errors on retry
        }, { onConflict: 'chapter_number' })
       .select(); // Added select to potentially get data back if needed

    if (upsertError) {
      console.error('[API download-chapter] DB upsert error:', upsertError);
      throw new Error(`Failed to update chapter status in database: ${upsertError.message}`);
    }
    console.log(`[API download-chapter] Set chapter ${chapterNumberStr} status to pending in DB.`);

    // 7. Trigger background processing (DO NOT await this)
    void processChapterInBackground(chapterNumberInt, tempZipPath);
    console.log(`[API download-chapter] Triggered background processing for chapter ${chapterNumberStr}`);

    // 8. Return 202 Accepted
    return NextResponse.json(
      {
        message: `Chapter ${chapterNumberStr} download initiated and scheduled for processing.`,
        chapterNumber: chapterNumberStr,
        status: 'pending'
      },
      { status: 202 }
    );

  } catch (error: any) {
    console.error('[API download-chapter] Error:', error);
    // Attempt to update DB status to failed if an error occurs mid-process
    try {
        await supabase
            .from('manga_chapters')
            .update({ status: 'failed', error_message: error.message || 'Unknown error during download initiation' })
            .eq('chapter_number', chapterNumberInt);
    } catch (dbError) {
        console.error('[API download-chapter] Failed to update chapter status to failed after error:', dbError);
    }
    return NextResponse.json(
      { error: `Failed to initiate download: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  } finally {
    // 9. Cleanup temporary files/folders (don't delete the zip passed to background)
    // The background processor should handle deleting its source file (tempZipPath)
    // We only need to delete the original download dir if it wasn't the zip path's dir
    if (tempDownloadDir && tempDownloadDir !== path.dirname(tempZipPath || '')) {
        console.log(`[API download-chapter] Cleaning up temporary download directory: ${tempDownloadDir}`);
        fs.rm(tempDownloadDir, { recursive: true, force: true }).catch(err => {
          console.error(`[API download-chapter] Error cleaning up temp directory ${tempDownloadDir}:`, err);
        });
    }
  }
} 