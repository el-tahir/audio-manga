import { supabase } from '@/lib/supabase';
import { ClassificationResult } from '@/types';

interface ChapterRow {
  id: number;
  chapter_number: number;
  total_pages: number;
  processed_at: string;
  status?: string;
}

/**
 * Retrieves a chapter's data from the database.
 * @param {number} chapterNumber - The chapter number to retrieve.
 * @returns {Promise<ChapterRow | null>} A promise that resolves to the chapter data object, or null if not found or on error.
 */
export async function getChapterFromDatabase(chapterNumber: number): Promise<ChapterRow | null> {
  const { data, error } = await supabase
    .from('manga_chapters')
    .select('*')
    .eq('chapter_number', chapterNumber)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Checks if a chapter exists in the database.
 * This is the primary function for checking chapter existence across the manga classifier system.
 * @param {number} chapterNumber - The chapter number to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the chapter exists, false otherwise.
 */
export async function chapterExistsInDatabase(chapterNumber: number): Promise<boolean> {
  const chapter = await getChapterFromDatabase(chapterNumber);
  return !!chapter;
}

/**
 * Stores manga chapter information and its page classifications in the database.
 * It checks for the existence of an 'explanation' column and adapts the insert accordingly.
 * It also handles upserting chapter details and batch inserting page classifications.
 * @param {number} chapterNumber - The chapter number.
 * @param {ClassificationResult[]} classifications - An array of classification results for the chapter's pages.
 * @returns {Promise<void>} A promise that resolves when the data has been stored.
 * @throws {Error} If storing chapter or page classification data fails.
 */
export async function storeClassificationsInDatabase(
  chapterNumber: number,
  classifications: ClassificationResult[]
): Promise<void> {
  const { error: schemaError } = await supabase
    .from('manga_page_classifications')
    .select('*')
    .limit(1);

  const hasExplanationColumn = !schemaError;

  if (schemaError) {
    console.log(
      '[MANGA-CLASSIFIER] Warning: Could not verify schema, will attempt insert without explanation field'
    );
  }

  const { error: chapterError } = await supabase.from('manga_chapters').upsert(
    {
      chapter_number: chapterNumber,
      total_pages: classifications.length,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'chapter_number' }
  );

  if (chapterError) {
    console.error('[MANGA-CLASSIFIER] Error storing chapter data:', chapterError);
    throw new Error('Failed to store chapter data');
  }

  const pageClassifications = classifications.map((classification, index) => {
    const record: {
      chapter_number: number;
      page_number: number;
      filename: string;
      category: string;
      explanation?: string | null;
    } = {
      chapter_number: chapterNumber,
      page_number: index + 1,
      filename: classification.filename,
      category: classification.category,
    };

    if (hasExplanationColumn) {
      record.explanation = classification.explanation || null;
    }

    return record;
  });

  // Insert in smaller batches to avoid potential size limits
  const batchSize = 30;
  for (let i = 0; i < pageClassifications.length; i += batchSize) {
    const batch = pageClassifications.slice(i, i + batchSize);

    const { error: pagesError } = await supabase.from('manga_page_classifications').insert(batch);

    if (pagesError) {
      console.error(
        `[MANGA-CLASSIFIER] Error storing page classifications batch ${i / batchSize + 1}:`,
        pagesError
      );

      // Try without explanation field if that might be the issue
      if (hasExplanationColumn && pagesError.message?.includes('explanation')) {
        console.log('[MANGA-CLASSIFIER] Retrying without explanation field');

        const simplifiedBatch = batch.map(record => {
          // Remove explanation field for fallback insert when schema doesn't support it
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { explanation: _explanation, ...rest } = record;
          return rest;
        });

        const { error: retryError } = await supabase
          .from('manga_page_classifications')
          .insert(simplifiedBatch);

        if (retryError) {
          throw new Error(
            `Failed to store page classifications batch ${i / batchSize + 1}: ${retryError.message}`
          );
        }
      } else {
        throw new Error(
          `Failed to store page classifications batch ${i / batchSize + 1}: ${pagesError.message}`
        );
      }
    }
  }
}
