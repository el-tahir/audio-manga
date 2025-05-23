import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { uploadFileToGCS } from '@/utils/gcsUtils';
import { CloudTasksClient } from '@google-cloud/tasks';
import { getChapterImageUrls } from '@/services/cubariService';
import { downloadAndZipChapter, cleanupTempFiles } from '@/services/fileProcessingService';

// Cloud Tasks configuration
const project = process.env.GCP_PROJECT_ID!;
const location = process.env.GCP_QUEUE_LOCATION!; // e.g., 'us-central1'
const queue = process.env.GCP_QUEUE_ID!; // The name of your queue
const taskHandlerUrl = process.env.GCP_TASK_HANDLER_URL!; // URL of your Cloud Function
// Temp bucket for zip uploads
const tempBucketName = process.env.GCP_TEMP_UPLOAD_BUCKET_NAME!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterNumber: string }> }
) {
  const resolvedParams = await params;
  const { chapterNumber: chapterNumberStr } = resolvedParams;

  // Validate request parameters
  if (!chapterNumberStr || typeof chapterNumberStr !== 'string') {
    return NextResponse.json({ error: 'Invalid chapter number format' }, { status: 400 });
  }

  const chapterNumberInt = Number(chapterNumberStr);
  if (isNaN(chapterNumberInt)) {
    return NextResponse.json({ error: 'Chapter number must be numeric' }, { status: 400 });
  }

  let tempDownloadDir: string | null = null;
  let tempZipPath: string | null = null;

  try {
    // 1. Check DB for existing chapter status
    const { data: existingChapter, error: dbCheckError } = await supabase
      .from('manga_chapters')
      .select('status')
      .eq('chapter_number', chapterNumberInt)
      .maybeSingle();

    if (dbCheckError) {
      throw new Error(`Database error checking chapter existence: ${dbCheckError.message}`);
    }

    if (existingChapter) {
      if (existingChapter.status === 'completed') {
        return NextResponse.json(
          { message: `Chapter ${chapterNumberStr} already processed.` },
          { status: 409 }
        );
      } else if (existingChapter.status !== 'failed') {
        return NextResponse.json(
          {
            message: `Chapter ${chapterNumberStr} is currently processing (status: ${existingChapter.status}).`,
          },
          { status: 409 }
        );
      }
      console.log(
        `[API download-chapter] Chapter ${chapterNumberStr} previously failed, attempting reprocessing.`
      );
    }

    // 2. Fetch chapter image URLs from Cubari API
    console.log(`[API download-chapter] Fetching image URLs for chapter ${chapterNumberStr}...`);
    const chapterData = await getChapterImageUrls(chapterNumberStr);

    if (!chapterData) {
      return NextResponse.json(
        { error: `Chapter ${chapterNumberStr} not found in Cubari API.` },
        { status: 404 }
      );
    }

    const { imageUrls, totalPages } = chapterData;
    console.log(
      `[API download-chapter] Found ${totalPages} pages for chapter ${chapterNumberStr}.`
    );

    // 3. Download images and create ZIP archive
    console.log(
      `[API download-chapter] Starting download and ZIP creation for chapter ${chapterNumberStr}...`
    );
    const processingResult = await downloadAndZipChapter(imageUrls, chapterNumberStr);

    tempDownloadDir = processingResult.downloadedFolderPath;
    tempZipPath = processingResult.zipPath;

    console.log(
      `[API download-chapter] Downloaded ${processingResult.downloadedCount}/${processingResult.totalAttempted} pages and created ZIP.`
    );

    // 4. Update DB status to pending
    const { error: upsertError } = await supabase
      .from('manga_chapters')
      .upsert(
        {
          chapter_number: chapterNumberInt,
          status: 'pending',
          total_pages: totalPages,
          error_message: null,
        },
        { onConflict: 'chapter_number' }
      )
      .select();

    if (upsertError) {
      throw new Error(`Failed to update chapter status in database: ${upsertError.message}`);
    }
    console.log(`[API download-chapter] Set chapter ${chapterNumberStr} status to pending in DB.`);

    // 5. Upload ZIP to GCS for background processing
    if (!tempBucketName) {
      throw new Error('Missing required environment variable: GCP_TEMP_UPLOAD_BUCKET_NAME');
    }

    const zipFileName = path.basename(tempZipPath);
    const gcsZipPath = `temp-chapter-zips/${zipFileName}`;
    let uploadedGcsPath: string | null = null;

    try {
      console.log(
        `[API download-chapter] Uploading ${tempZipPath} to gs://${tempBucketName}/${gcsZipPath}...`
      );
      await uploadFileToGCS(tempZipPath, gcsZipPath, tempBucketName);
      uploadedGcsPath = `gs://${tempBucketName}/${gcsZipPath}`;
      console.log(`[API download-chapter] Successfully uploaded zip to ${uploadedGcsPath}`);
    } catch (uploadError: unknown) {
      const error = uploadError instanceof Error ? uploadError : new Error(String(uploadError));
      console.error(`[API download-chapter] Failed to upload zip to GCS:`, error);

      // Update DB status to failed if upload fails
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `Failed to upload source zip to GCS: ${error.message}`,
        })
        .eq('chapter_number', chapterNumberInt);

      throw new Error(`Failed to upload source zip to GCS: ${error.message}`);
    }

    // 6. Create Cloud Task for background processing
    await createProcessingTask(chapterNumberInt, uploadedGcsPath);

    // 7. Return success response
    return NextResponse.json(
      {
        message: `Chapter ${chapterNumberStr} download initiated and scheduled for processing. Found ${totalPages} pages.`,
        chapterNumber: chapterNumberStr,
        status: 'pending',
        downloadedPages: processingResult.downloadedCount,
        totalPages: totalPages,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[API download-chapter] Error:', err.message);

    // Update DB status to failed
    try {
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: err.message || 'Unknown download error',
        })
        .eq('chapter_number', chapterNumberInt);
    } catch (dbError: unknown) {
      const dbErr = dbError instanceof Error ? dbError : new Error(String(dbError));
      console.error(
        '[API download-chapter] Failed to update chapter status to failed:',
        dbErr.message
      );
    }

    return NextResponse.json(
      { error: `Failed to process chapter ${chapterNumberStr}: ${err.message}` },
      { status: 500 }
    );
  } finally {
    // Cleanup temporary files
    await cleanupTempFiles([tempDownloadDir, tempZipPath]);

    // NOTE: We DO NOT cleanup the GCS file from this API route.
    // The background worker is responsible for deleting the GCS zip after successful processing.
    // If task creation failed AFTER successful GCS upload, the GCS file remains.
    // Consider a separate garbage collection mechanism for orphaned GCS zips if this becomes an issue.
  }
}

/**
 * Creates a Cloud Task for background chapter processing.
 * Handles Cloud Tasks client configuration and task creation.
 *
 * @param chapterNumber - The chapter number to process
 * @param gcsPath - The GCS path to the uploaded ZIP file
 * @throws Error if task creation fails
 */
async function createProcessingTask(chapterNumber: number, gcsPath: string): Promise<void> {
  // Construct credentials object similar to getStorageClient
  const taskClientOptions: {
    projectId?: string;
    credentials?: { client_email: string; private_key: string };
  } = {};

  if (project && process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY_BASE64) {
    taskClientOptions.projectId = project;
    taskClientOptions.credentials = {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: Buffer.from(process.env.GCP_PRIVATE_KEY_BASE64, 'base64').toString('utf8'),
    };
    console.log('[API CloudTask Client] Using explicit credentials from ENV variables.');
  } else {
    console.error(
      '[API CloudTask Client] Required ENV variables for explicit credentials (GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY_BASE64) not fully set. Attempting default ADC.'
    );
    // Consider throwing an error here if explicit credentials are required for your setup.
    // throw new Error("Missing required credentials for Cloud Tasks Client");
  }

  const client = new CloudTasksClient(taskClientOptions);
  const queuePath = client.queuePath(project, location, queue);

  const taskPayload = {
    chapterNumber: chapterNumber,
    sourceFilePath: gcsPath,
  };

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
  } catch (taskError: unknown) {
    const error = taskError instanceof Error ? taskError : new Error(String(taskError));
    console.error(`[API download-chapter] Error creating Cloud Task:`, error);

    // Update DB status to failed if task creation fails
    await supabase
      .from('manga_chapters')
      .update({
        status: 'failed',
        error_message: `Failed to enqueue processing task: ${error.message}`,
      })
      .eq('chapter_number', chapterNumber);

    throw new Error(`Failed to enqueue chapter processing task: ${error.message}`);
  }
}
