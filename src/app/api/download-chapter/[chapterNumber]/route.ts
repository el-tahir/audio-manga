import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs/promises'; // Use promises for async file operations
import AdmZip from 'adm-zip';
import { supabase } from '@/lib/supabase';
import { processChapterInBackground } from '@/services/manga-processing/backgroundProcessor';

const DETECTIVE_CONAN_SLUG = "01J76XY7HA6DH9YYGREDVPH8W5";

// Helper function to determine image extension
function getExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'png'; // Default
  contentType = contentType.toLowerCase();
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'png'; // Default to png if unsure or other format
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chapterNumber: string } }
) {
  const { chapterNumber: chapterNumberStr } = params;
  if (!chapterNumberStr || typeof chapterNumberStr !== 'string') {
    return NextResponse.json({ error: 'Invalid chapter number format' }, { status: 400 });
  }
  const chapterNumberInt = Number(chapterNumberStr);
  if (isNaN(chapterNumberInt)) {
    return NextResponse.json({ error: 'Chapter number must be numeric' }, { status: 400 });
  }

  let tempDownloadDir: string | null = null;
  let tempZipPath: string | null = null;
  let downloadedFolderPath: string | null = null; // Keep track of the final folder

  try {
    // 1. Check DB (existing logic remains the same)
    const { data: existingChapter, error: dbCheckError } = await supabase
      .from('manga_chapters')
      .select('status')
      .eq('chapter_number', chapterNumberInt)
      .maybeSingle();

    if (dbCheckError) throw new Error(`Database error checking chapter existence: ${dbCheckError.message}`);

    if (existingChapter) {
      if (existingChapter.status === 'completed') {
        return NextResponse.json({ message: `Chapter ${chapterNumberStr} already processed.` }, { status: 409 });
      } else if (existingChapter.status !== 'failed') {
        return NextResponse.json({ message: `Chapter ${chapterNumberStr} is currently processing (status: ${existingChapter.status}).` }, { status: 409 });
      }
      console.log(`[API download-chapter] Chapter ${chapterNumberStr} previously failed, attempting reprocessing.`);
    }

    // --- Start of New Download Logic ---

    // 2. Fetch Series Data
    const seriesUrl = `https://cubari.moe/read/api/weebcentral/series/${DETECTIVE_CONAN_SLUG}/`;
    console.log(`[API download-chapter] Fetching series data from: ${seriesUrl}`);
    const seriesRes = await fetch(seriesUrl);
    if (!seriesRes.ok) {
      throw new Error(`Failed to fetch series data: ${seriesRes.status} ${seriesRes.statusText}`);
    }
    const seriesData = await seriesRes.json();
    console.log("[API download-chapter] Successfully fetched series data.");

    // 3. Find Chapter and Group URL
    const chapterData = seriesData?.chapters?.[chapterNumberStr];
    if (!chapterData) {
        throw new Error(`Chapter ${chapterNumberStr} not found in series data.`);
    }
    let groupUrl = chapterData.groups?.['1']; // Try group '1' first
    if (!groupUrl && chapterData.groups && Object.keys(chapterData.groups).length > 0) {
        const firstGroupKey = Object.keys(chapterData.groups)[0];
        groupUrl = chapterData.groups[firstGroupKey];
        console.log(`[API download-chapter] Using first available group: ${firstGroupKey}`);
    }
    if (!groupUrl) {
        throw new Error(`No group URL found for chapter ${chapterNumberStr}.`);
    }

    // 4. Fetch Chapter Details
    const chapterDetailsUrl = `https://cubari.moe${groupUrl}`;
    console.log(`[API download-chapter] Fetching chapter details from: ${chapterDetailsUrl}`);
    const chapterDetailsRes = await fetch(chapterDetailsUrl);
     if (!chapterDetailsRes.ok) {
      throw new Error(`Failed to fetch chapter details: ${chapterDetailsRes.status} ${chapterDetailsRes.statusText}`);
    }
    const chapterDetails = await chapterDetailsRes.json();
    console.log("[API download-chapter] Successfully fetched chapter details.");

    // 5. Extract Image URLs
    let imageUrls: string[] = [];
    if (Array.isArray(chapterDetails)) {
        imageUrls = chapterDetails;
    } else if (typeof chapterDetails === 'object' && chapterDetails !== null && Array.isArray(chapterDetails.pages)) {
        imageUrls = chapterDetails.pages;
    } else {
        console.warn("[API download-chapter] Unexpected chapter details structure:", chapterDetails);
        throw new Error("Could not extract image URLs from chapter details.");
    }
    if (imageUrls.length === 0) {
        console.log(`[API download-chapter] No pages found for chapter ${chapterNumberStr}.`);
        // Proceed to mark as pending/failed, but background processor will find no pages
        // Alternatively, could throw an error here? For now, let it proceed.
    } else {
        console.log(`[API download-chapter] Found ${imageUrls.length} pages for chapter ${chapterNumberStr}.`);
    }

    // 6. Create temporary directory
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chapter-download-'));
    console.log(`[API download-chapter] Created temp download dir: ${tempDownloadDir}`);
    downloadedFolderPath = tempDownloadDir; // This is the folder we'll zip

    // 7. Download Images
    let downloadedCount = 0;
    for (let i = 0; i < imageUrls.length; i++) {
        const pageNum = i + 1;
        const imageUrl = imageUrls[i];
        console.log(`[API download-chapter] Downloading page ${pageNum}/${imageUrls.length} from ${imageUrl}...`);
        try {
            const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) }); // 30s timeout
            if (!imgRes.ok) {
                console.error(`[API download-chapter] Failed to download page ${pageNum}: ${imgRes.status} ${imgRes.statusText}`);
                continue; // Skip this page
            }
            const contentType = imgRes.headers.get('content-type');
            const extension = getExtensionFromContentType(contentType);
            const imgBuffer = await imgRes.arrayBuffer();
            const filePath = path.join(downloadedFolderPath, `page_${String(pageNum).padStart(3, '0')}.${extension}`);

            await fs.writeFile(filePath, Buffer.from(imgBuffer));
            console.log(`[API download-chapter] Saved page ${pageNum} to ${filePath}`);
            downloadedCount++;
        } catch (pageError: any) {
             if (pageError.name === 'TimeoutError') {
                 console.error(`[API download-chapter] Timeout downloading page ${pageNum}`);
             } else {
                 console.error(`[API download-chapter] Error downloading page ${pageNum}:`, pageError.message || pageError);
             }
             // Continue to next page even if one fails
        }
    }

    if (downloadedCount === 0 && imageUrls.length > 0) {
        console.error(`[API download-chapter] Failed to download any pages for chapter ${chapterNumberStr}.`);
        // Let the process continue, background task will handle empty zip/folder
    } else {
        console.log(`[API download-chapter] Successfully downloaded ${downloadedCount}/${imageUrls.length} pages.`);
    }

    // --- End of New Download Logic ---

    // 8. Create Zip Archive (using the path populated by download logic)
    if (!downloadedFolderPath) {
        // This should ideally not happen if mkdtemp succeeded, but safety check
         throw new Error("Temporary download directory path was not set.");
    }
    const zip = new AdmZip();
    zip.addLocalFolder(downloadedFolderPath); // Add content of the folder
    tempZipPath = path.join(os.tmpdir(), `chapter-${chapterNumberStr}-${Date.now()}.zip`); // More unique zip name
    await zip.writeZipPromise(tempZipPath);
    console.log(`[API download-chapter] Created temporary zip archive: ${tempZipPath}`);

    // 9. Update DB Status (existing logic)
    const { error: upsertError } = await supabase
      .from('manga_chapters')
      .upsert({
         chapter_number: chapterNumberInt,
         status: 'pending',
         total_pages: imageUrls.length, // Store total pages found
         error_message: null
        }, { onConflict: 'chapter_number' })
       .select();

    if (upsertError) throw new Error(`Failed to update chapter status in database: ${upsertError.message}`);
    console.log(`[API download-chapter] Set chapter ${chapterNumberStr} status to pending in DB.`);

    // 10. Trigger background processing (existing logic)
    void processChapterInBackground(chapterNumberInt, tempZipPath);
    console.log(`[API download-chapter] Triggered background processing for chapter ${chapterNumberStr}`);

    // 11. Return 202 Accepted (existing logic)
    return NextResponse.json(
      {
        message: `Chapter ${chapterNumberStr} download initiated and scheduled for processing. Found ${imageUrls.length} pages.`,
        chapterNumber: chapterNumberStr,
        status: 'pending'
      },
      { status: 202 }
    );

  } catch (error: any) {
    console.error('[API download-chapter] Error:', error.message || error);
    // Update DB status (existing logic)
    try {
        await supabase
            .from('manga_chapters')
            .update({ status: 'failed', error_message: error.message || 'Unknown error during download initiation' })
            .eq('chapter_number', chapterNumberInt);
    } catch (dbError: any) {
        console.error('[API download-chapter] Failed to update chapter status to failed after error:', dbError.message || dbError);
    }
    return NextResponse.json(
      { error: `Failed to initiate download: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  } finally {
    // 12. Cleanup download dir (existing logic, ensures downloadedFolderPath is used)
    if (downloadedFolderPath) {
        console.log(`[API download-chapter] Cleaning up temporary download directory: ${downloadedFolderPath}`);
        fs.rm(downloadedFolderPath, { recursive: true, force: true }).catch(err => {
          console.error(`[API download-chapter] Error cleaning up temp directory ${downloadedFolderPath}:`, err);
        });
    }
    // NOTE: tempZipPath is NOT deleted here, background processor handles it.
  }
} 