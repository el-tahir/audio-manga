/**
 * Background processor for manga chapters
 */
import { supabase } from '@/lib/supabase';
import { uploadFileToGCS } from '@/utils/gcsUtils';
import { extractArchive } from '@/utils/manga-classifier/archiveUtils';
import { getImageFiles } from '@/utils/manga-classifier/imageUtils';
import { classifyChapter } from '@/services/manga-classifier/aiService';
import { storeClassificationsInDatabase } from '@/services/manga-classifier/dbService';

export async function processChapterInBackground(chapterNumber: number, sourceFilePath: string): Promise<void> {
  try {
    let extractDir: string;
    let classifications: any[];
    // File setup: update status and prepare source archive
    await supabase
      .from('manga_chapters')
      .update({ status: 'processing_file_setup' })
      .eq('chapter_number', chapterNumber);
    console.log(`[BACKGROUND] Using source archive at ${sourceFilePath}`);

    // Archive extraction: extract files for processing
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_extraction' })
        .eq('chapter_number', chapterNumber);

      extractDir = await extractArchive(sourceFilePath);
      console.log(`[BACKGROUND] Archive extracted to ${extractDir}`);
    } catch (error) {
      console.error('[BACKGROUND] Error during archive extraction:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('chapter_number', chapterNumber);
      return;
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
      console.log("bucket name is ", bucketName)
      for (let i = 0; i < totalPages; i++) {
        const imageFile = imageFiles[i];
        const pageNumber = i + 1;
        const destinationGcsPath = `chapters/${chapterNumber}/${pageNumber}.jpg`;
        await uploadFileToGCS(imageFile, destinationGcsPath, bucketName);
        if (pageNumber % 10 === 0 || pageNumber === totalPages) {
          console.log(`[GCS] Uploaded ${pageNumber}/${totalPages} pages for chapter ${chapterNumber}`);
        }
      }

      // Update total_pages in DB after upload
      await supabase
        .from('manga_chapters')
        .update({ total_pages: totalPages })
        .eq('chapter_number', chapterNumber);
    } catch (error) {
      console.error('[BACKGROUND] Error during image processing:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('chapter_number', chapterNumber);
      return;
    }
    // AI classification: classify images using AI service
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_ai' })
        .eq('chapter_number', chapterNumber);

      const aiImageFiles = getImageFiles(extractDir);
      classifications = await classifyChapter(aiImageFiles);
      console.log(`[BACKGROUND] Completed AI classification for ${classifications.length} pages`);
    } catch (error) {
      console.error('[BACKGROUND] Error during AI classification:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('chapter_number', chapterNumber);
      return;
    }
    // Classification storage: save results to database
    try {
      await supabase
        .from('manga_chapters')
        .update({ status: 'processing_db_save' })
        .eq('chapter_number', chapterNumber);

      await storeClassificationsInDatabase(chapterNumber, classifications);
      console.log(`[BACKGROUND] Stored classifications for chapter ${chapterNumber}`);
    } catch (error) {
      console.error('[BACKGROUND] Error saving classifications to DB:', error);
      await supabase
        .from('manga_chapters')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('chapter_number', chapterNumber);
      return;
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
    console.log(`[BACKGROUND] Chapter ${chapterNumber} processing completed`);
  } catch (error) {
    console.error('[BACKGROUND] Unexpected error in processChapterInBackground:', error);
    await supabase
      .from('manga_chapters')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error)
      })
      .eq('chapter_number', chapterNumber);
  }
}
