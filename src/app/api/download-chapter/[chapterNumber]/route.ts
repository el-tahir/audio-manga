import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs/promises'; // Use promises for async file operations
import AdmZip from 'adm-zip';
import { supabase } from '@/lib/supabase';
import { uploadFileToGCS } from '@/utils/gcsUtils'; // ADDED import
import { CloudTasksClient } from '@google-cloud/tasks'; // ADDED import back to top

const DETECTIVE_CONAN_SLUG = "01J76XY7HA6DH9YYGREDVPH8W5";

// ADDED: Cloud Tasks configuration
const project = process.env.GCP_PROJECT_ID!;
const location = process.env.GCP_QUEUE_LOCATION!; // e.g., 'us-central1'
const queue = process.env.GCP_QUEUE_ID!; // The name of your queue
const taskHandlerUrl = process.env.GCP_TASK_HANDLER_URL!; // URL of your Cloud Function
// ADDED: Temp bucket for zip uploads
const tempBucketName = process.env.GCP_TEMP_UPLOAD_BUCKET_NAME!;

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
  { params }: { params: Promise<{ chapterNumber: string }> }
) {
  const resolvedParams = await params;
  const { chapterNumber: chapterNumberStr } = resolvedParams;
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

    // --- MODIFIED: Replace background processing call with Cloud Task ---
    // 10. Trigger background processing (existing logic)
    // void processChapterInBackground(chapterNumberInt, tempZipPath); // REMOVED direct call
    // console.log(`[API download-chapter] Triggered background processing for chapter ${chapterNumberStr}`);

    // ADDED: Upload zip to GCS before creating task
    if (!tempZipPath) {
      // This should not happen if zip creation succeeded
      throw new Error("Temporary zip path is not set before GCS upload.");
    }
    if (!tempBucketName) {
       throw new Error("Missing required environment variable: GCP_TEMP_UPLOAD_BUCKET_NAME");
    }

    const zipFileName = path.basename(tempZipPath);
    const gcsZipPath = `temp-chapter-zips/${zipFileName}`; // Define a path in the temp bucket
    let uploadedGcsPath: string | null = null;

    try {
      console.log(`[API download-chapter] Uploading ${tempZipPath} to gs://${tempBucketName}/${gcsZipPath}...`);
      await uploadFileToGCS(tempZipPath, gcsZipPath, tempBucketName);
      uploadedGcsPath = `gs://${tempBucketName}/${gcsZipPath}`; // Store the full GCS path
      console.log(`[API download-chapter] Successfully uploaded zip to ${uploadedGcsPath}`);
    } catch (uploadError: any) {
        console.error(`[API download-chapter] Failed to upload zip to GCS:`, uploadError);
        // Update DB status to failed if upload fails, as processing cannot proceed
        await supabase
           .from('manga_chapters')
           .update({ status: 'failed', error_message: `Failed to upload source zip to GCS: ${uploadError.message || uploadError}` })
           .eq('chapter_number', chapterNumberInt);
        throw new Error(`Failed to upload source zip to GCS: ${uploadError.message}`); // Throw to trigger outer catch & cleanup
    }

    // ADDED: Enqueue task for background processing using GCS path

    // Construct credentials object similar to getStorageClient
    const taskClientOptions: { projectId?: string; credentials?: { client_email: string; private_key: string; } } = {};
    if (project && process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY_BASE64) {
        taskClientOptions.projectId = project;
        taskClientOptions.credentials = {
            client_email: process.env.GCP_CLIENT_EMAIL,
            private_key: Buffer.from(process.env.GCP_PRIVATE_KEY_BASE64, 'base64').toString('utf8'),
        };
         console.log("[API CloudTask Client] Using explicit credentials from ENV variables.");
    } else {
        // Fallback or error if expected ENV vars are missing for explicit auth
        // Alternatively, rely on ADC by passing no options, but that failed.
        console.error("[API CloudTask Client] Required ENV variables for explicit credentials (GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY_BASE64) not fully set. Attempting default ADC.");
        // Keep taskClientOptions empty to attempt ADC, though it previously failed.
        // Consider throwing an error here if explicit credentials are required for your setup.
        // throw new Error("Missing required credentials for Cloud Tasks Client");
    }

    const client = new CloudTasksClient(taskClientOptions);

    const queuePath = client.queuePath(project, location, queue);
    // Use the GCS path as sourceFilePath
    const taskPayload = { chapterNumber: chapterNumberInt, sourceFilePath: uploadedGcsPath };

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: taskHandlerUrl,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
      },
      // Optional: Schedule time, deadline, etc.
      // scheduleTime: {
      //   seconds: Date.now() / 1000 + 10 // Schedule 10 seconds from now
      // }
    };

    try {
      const [response] = await client.createTask({ parent: queuePath, task });
      console.log(`[API download-chapter] Created Cloud Task ${response.name}`);
      // tempZipPath = null; // We no longer need this null check, local zip is cleaned up regardless after successful upload/task
    } catch (taskError: any) {
        console.error(`[API download-chapter] Error creating Cloud Task:`, taskError);
        // If task creation fails, we might want to revert the DB status or retry
        // For now, log the error and continue to return 202, but the task won't run.
        // Consider more robust error handling here.
        // Revert status?
         await supabase
           .from('manga_chapters')
           .update({
                status: 'failed',
                error_message: `Failed to enqueue processing task: ${taskError.message || taskError}`
            })
           .eq('chapter_number', chapterNumberInt);
         throw new Error(`Failed to enqueue chapter processing task: ${taskError.message}`); // Throw to trigger outer catch
    }
    // --- END MODIFICATION ---

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
            .update({ status: 'failed', error_message: error.message || 'Unknown download error' })
            .eq('chapter_number', chapterNumberInt);
    } catch (dbError: any) {
        console.error('[API download-chapter] Failed to update chapter status to failed:', dbError.message);
    }

    return NextResponse.json({ error: `Failed to process chapter ${chapterNumberStr}: ${error.message}` }, { status: 500 });

  } finally {
    // Cleanup only the download directory, not the zip if task was created successfully
    if (downloadedFolderPath) {
      console.log(`[API download-chapter] Cleaning up download directory: ${downloadedFolderPath}`);
      fs.rm(downloadedFolderPath, { recursive: true, force: true }).catch(err => {
          console.error(`[API download-chapter] Error cleaning up download directory ${downloadedFolderPath}:`, err);
      });
    }
    // MODIFIED: Always clean up local zip path if it exists (after upload attempt)
    if (tempZipPath) {
        console.log(`[API download-chapter] Cleaning up local temporary zip: ${tempZipPath}`);
        fs.unlink(tempZipPath).catch(err => {
            console.error(`[API download-chapter] Error cleaning up local temporary zip ${tempZipPath}:`, err);
        });
    }
    // NOTE: We DO NOT cleanup the GCS file here. The worker is responsible for that.
    // If task creation failed AFTER successful upload, the GCS file remains.
    // Consider adding cleanup logic here or a separate garbage collection mechanism for orphaned GCS zips.
  }
} 