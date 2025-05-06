/**
 * Google Cloud Function triggered by Cloud Tasks to process manga chapters.
 */
import path from 'path';
import { supabase } from '@/lib/supabase'; // Adjust path if needed for cloud function env
import { uploadFileToGCS } from '@/utils/gcsUtils'; // Adjust path if needed
import { extractArchive } from '@/utils/manga-classifier/archiveUtils'; // Adjust path if needed
import { getImageFiles } from '@/utils/manga-classifier/imageUtils'; // Adjust path if needed
import { classifyChapter } from '@/services/manga-classifier/aiService'; // Adjust path if needed
import { storeClassificationsInDatabase } from '@/services/manga-classifier/dbService'; // Adjust path if needed
import { cleanupTempFiles } from '@/utils/manga-classifier/fileUtils'; // Adjust path if needed
import { downloadFileFromGCS, deleteFileFromGCS } from '@/utils/gcsUtils'; // ADDED GCS download/delete
import os from 'os'; // Needed for temp directory
import fs from 'fs/promises'; // Needed for local file cleanup

import type { Request, Response } from 'express'; // Assuming a Node.js runtime like Express

// Interface for the expected task payload
interface TaskPayload {
  chapterNumber: number;
  sourceFilePath: string; // GCS Path
}

/**
 * Parses a GCS path (gs://bucket/path/to/object) into bucket and path components.
 */
function parseGcsPath(gcsPath: string): { bucketName: string; filePath: string } {
  const match = gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCS path format: ${gcsPath}`);
  }
  return { bucketName: match[1], filePath: match[2] };
}

/**
 * Cloud Function entry point.
 * Handles HTTP requests from Cloud Tasks.
 *
 * @param {Request} req The Express Request object.
 * @param {Response} res The Express Response object.
 */
export async function mangaProcessorWorker(req: Request, res: Response): Promise<void> {
  // Verify request is POST
  if (req.method !== 'POST') {
    console.warn(`[GCF Worker] Received non-POST request: ${req.method}`);
    res.status(405).send('Method Not Allowed');
    return;
  }

  let payload: TaskPayload;
  try {
    // Cloud Tasks sends the payload base64 encoded in the body
    if (!req.body || typeof req.body !== 'string') {
      throw new Error('Request body is missing or not a string (expected base64 encoded payload).');
    }
    const decodedBody = Buffer.from(req.body, 'base64').toString('utf-8');
    payload = JSON.parse(decodedBody);

    if (typeof payload.chapterNumber !== 'number' || typeof payload.sourceFilePath !== 'string') {
      throw new Error('Invalid task payload structure.');
    }
    console.log(`[GCF Worker] Received task for Chapter ${payload.chapterNumber}, Source: ${payload.sourceFilePath}`);

  } catch (error: any) {
    console.error('[GCF Worker] Error parsing task payload:', error.message);
    // Malformed request - don't retry
    res.status(400).send(`Bad Request: ${error.message}`);
    return;
  }

  const { chapterNumber, sourceFilePath: sourceGcsPath } = payload;
  let extractDir: string | undefined;
  let localZipPath: string | undefined; // Path where GCS zip is downloaded locally

  try {
    // --- Start of processing logic (adapted from backgroundProcessor.ts) ---

    // ADDED: Download source zip from GCS
    const { bucketName: sourceBucket, filePath: sourceZipObjectPath } = parseGcsPath(sourceGcsPath);
    localZipPath = path.join(os.tmpdir(), `chapter-${chapterNumber}-${Date.now()}.zip`);
    console.log(`[GCF Worker] Downloading ${sourceGcsPath} to ${localZipPath}...`);
    try {
      await downloadFileFromGCS(sourceBucket, sourceZipObjectPath, localZipPath);
    } catch (downloadError: any) {
      console.error(`[GCF Worker] Failed to download source zip from GCS: ${sourceGcsPath}`, downloadError);
      // Don't update DB status here, let the main error handling do it, but throw
      throw new Error(`Failed to download source zip: ${downloadError.message}`);
    }
    console.log(`[GCF Worker] Source archive downloaded locally to ${localZipPath}`);

    // Check if source file exists (basic check)
    // In a real GCF environment, sourceFilePath might be a GCS path or require different handling
    // For now, assuming it's accessible locally or on a shared volume
    // const fs = require('fs').promises; // Lazy require 'fs' if needed
    // await fs.access(sourceFilePath); // This will throw if not accessible

    let classifications: any[];
    // File setup: update status and prepare source archive
    await supabase
      .from('manga_chapters')
      .update({ status: 'processing_file_setup' })
      .eq('chapter_number', chapterNumber);
    console.log(`[GCF Worker] Using source archive at ${sourceGcsPath}`);
    console.log(`[GCF Worker] Using LOCAL source archive at ${localZipPath}`); // Log local path

    // Archive extraction: extract files for processing
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_extraction' })
        .eq('chapter_number', chapterNumber);

      extractDir = await extractArchive(localZipPath);
      console.log(`[GCF Worker] Archive extracted to ${extractDir}`);
    } catch (error) {
      console.error('[GCF Worker] Error during archive extraction:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
        })
        .eq('chapter_number', chapterNumber);
      // Indicate failure to Cloud Tasks for potential retry
      res.status(500).send('Archive extraction failed.');
      return; // Stop processing
    }
    // Image processing: identify and save images
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_images' })
        .eq('chapter_number', chapterNumber);

      const imageFiles = getImageFiles(extractDir).sort();
      const totalPages = imageFiles.length;

      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME!;
      if (!bucketName) {
        throw new Error('Missing required environment variable: GOOGLE_CLOUD_BUCKET_NAME');
      }
      console.log("[GCF Worker] Target GCS bucket name is ", bucketName);

      for (let i = 0; i < totalPages; i++) {
        const imageFile = imageFiles[i];
        const pageNumber = i + 1;
        const destinationGcsPath = `chapters/${chapterNumber}/${pageNumber}.jpg`;
        await uploadFileToGCS(imageFile, destinationGcsPath, bucketName);
        if (pageNumber % 10 === 0 || pageNumber === totalPages) {
          console.log(`[GCF Worker] Uploaded ${pageNumber}/${totalPages} pages for chapter ${chapterNumber}`);
        }
      }

      // Update total_pages in DB after upload
      await supabase
        .from('manga_chapters')
        .update({ total_pages: totalPages })
        .eq('chapter_number', chapterNumber);
    } catch (error) {
      console.error('[GCF Worker] Error during image processing:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `Image processing/upload failed: ${error instanceof Error ? error.message : String(error)}`
        })
        .eq('chapter_number', chapterNumber);
      res.status(500).send('Image processing failed.');
      return; // Stop processing
    }
    // AI classification: classify images using AI service
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_ai' })
        .eq('chapter_number', chapterNumber);

      const aiImageFiles = getImageFiles(extractDir);
      classifications = await classifyChapter(aiImageFiles);
      console.log(`[GCF Worker] Completed AI classification for ${classifications.length} pages`);
    } catch (error) {
      console.error('[GCF Worker] Error during AI classification:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `AI classification failed: ${error instanceof Error ? error.message : String(error)}`
        })
        .eq('chapter_number', chapterNumber);
      res.status(500).send('AI classification failed.');
      return; // Stop processing
    }
    // Classification storage: save results to database
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_db_save' })
        .eq('chapter_number', chapterNumber);

      await storeClassificationsInDatabase(chapterNumber, classifications);
      console.log(`[GCF Worker] Stored classifications for chapter ${chapterNumber}`);
    } catch (error) {
      console.error('[GCF Worker] Error saving classifications to DB:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `DB save failed: ${error instanceof Error ? error.message : String(error)}`
        })
        .eq('chapter_number', chapterNumber);
      res.status(500).send('Saving classifications failed.');
      return; // Stop processing
    }
    // Final success update: mark chapter as completed
    await supabase
      .from('manga_chapters')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('chapter_number', chapterNumber);
    console.log(`[GCF Worker] Chapter ${chapterNumber} processing completed successfully.`);

    // --- End of processing logic ---

    // Send success response to Cloud Tasks to acknowledge the task
    res.status(200).send('Processing completed successfully.');

  } catch (error) {
    // Catch any unexpected errors during the main processing try block
    console.error(`[GCF Worker] Unexpected error processing Chapter ${chapterNumber}:`, error);
    try {
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: `Worker unexpected error: ${error instanceof Error ? error.message : String(error)}`
        })
        .eq('chapter_number', chapterNumber);
    } catch (dbError) {
      console.error('[GCF Worker] FATAL: Failed to update status to failed after unexpected error:', dbError);
    }
    // Indicate failure to Cloud Tasks
    res.status(500).send('An unexpected error occurred during processing.');

  } finally {
    // Cleanup temporary files and directories created by THIS worker
    if (extractDir) {
      console.log(`[GCF Worker] Cleaning up extraction directory: ${extractDir}`);
      cleanupTempFiles(extractDir); // Assuming this handles errors internally
    }
    // ADDED: Cleanup downloaded local zip file
    if (localZipPath) {
      console.log(`[GCF Worker] Cleaning up downloaded zip file: ${localZipPath}`);
      fs.unlink(localZipPath).catch((err: any) => {
        console.error(`[GCF Worker] Warning: Failed to clean up local zip ${localZipPath}:`, err.message);
      });
    }
    // MODIFIED: The original source file (zip) in GCS also needs cleanup now
    if (sourceGcsPath) {
      try {
        // Re-parse the GCS path here as variables from try block are out of scope
        const { bucketName: sourceBucketToClean, filePath: sourceZipObjectPathToClean } = parseGcsPath(sourceGcsPath);
        console.log(`[GCF Worker] Cleaning up source GCS zip file: ${sourceGcsPath}`);
        // Use await here to ensure cleanup is attempted before function potentially exits
        await deleteFileFromGCS(sourceBucketToClean, sourceZipObjectPathToClean);
      } catch (gcsDeleteError: any) {
        // Log error but don't fail the function response because of cleanup failure
        console.error(`[GCF Worker] Warning: Failed to clean up source GCS zip ${sourceGcsPath}:`, gcsDeleteError.message);
      }
    }
    // Note: We don't cleanup the source *directory* like in the original backgroundProcessor
    // because the zip file passed in sourceFilePath might not be in a temp dir we created.
    // The API route cleans up its download dir. The worker cleans up its extraction dir and the input zip.
  }
} 