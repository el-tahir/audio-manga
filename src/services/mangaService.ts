import { supabase } from '@/lib/supabase';
import { ClassificationResult } from '@/types';

/**
 * Retrieves all stored chapter numbers from the database in ascending order.
 *
 * @returns Promise resolving to an array of chapter numbers, or empty array if error occurs
 * @example
 * ```typescript
 * const chapters = await getStoredChapterNumbers();
 * console.log(chapters); // [1, 2, 3, 10, 15]
 * ```
 */
export async function getStoredChapterNumbers(): Promise<number[]> {
  const { data, error } = await supabase
    .from('manga_chapters')
    .select('chapter_number')
    .order('chapter_number', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(chapter => chapter.chapter_number);
}

/**
 * Retrieves all page classifications for a specific manga chapter.
 * Classifications include mood categorization and AI explanations for each page.
 *
 * @param chapterNumber - The chapter number to get classifications for
 * @returns Promise resolving to an array of classification results for all pages in the chapter
 * @example
 * ```typescript
 * const classifications = await getChapterClassifications(1128);
 * console.log(classifications[0]);
 * // { filename: "page_001.jpg", category: "investigation", explanation: "Conan examining clues" }
 * ```
 */
export async function getChapterClassifications(
  chapterNumber: number
): Promise<ClassificationResult[]> {
  const { data, error } = await supabase
    .from('manga_page_classifications')
    .select('*')
    .eq('chapter_number', chapterNumber)
    .order('page_number', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(item => ({
    filename: item.filename,
    category: item.category,
    explanation: item.explanation,
  }));
}

/**
 * Retrieves basic information about a specific manga chapter.
 * Includes metadata such as total page count and processing timestamp.
 *
 * @param chapterNumber - The chapter number to get information for
 * @returns Promise resolving to chapter info object, or null if chapter not found
 * @example
 * ```typescript
 * const info = await getChapterInfo(1128);
 * if (info) {
 *   console.log(`Chapter ${info.chapterNumber} has ${info.totalPages} pages`);
 * }
 * ```
 */
export async function getChapterInfo(chapterNumber: number): Promise<{
  chapterNumber: number;
  totalPages: number;
  processedAt: string;
} | null> {
  const { data, error } = await supabase
    .from('manga_chapters')
    .select('*')
    .eq('chapter_number', chapterNumber)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    chapterNumber: data.chapter_number,
    totalPages: data.total_pages,
    processedAt: data.processed_at,
  };
}

/**
 * Generates the URL path for accessing a chapter's image directory.
 * Used for constructing URLs to chapter image resources.
 *
 * @param chapterNumber - The chapter number
 * @returns URL path string for the chapter's image directory
 * @example
 * ```typescript
 * const path = getChapterImagePath(1128);
 * console.log(path); // "/chapters/1128"
 * ```
 */
export function getChapterImagePath(chapterNumber: number): string {
  return `/chapters/${chapterNumber}`;
}

/**
 * Generates the URL for a specific page image within a chapter.
 * Constructs the full path to access individual manga page images.
 *
 * @param chapterNumber - The chapter number
 * @param pageNumber - The page number (1-indexed)
 * @returns Complete URL string for the specific page image
 * @example
 * ```typescript
 * const imageUrl = getPageImageUrl(1128, 5);
 * console.log(imageUrl); // "/chapters/1128/5.jpg"
 * ```
 */
export function getPageImageUrl(chapterNumber: number, pageNumber: number): string {
  return `/chapters/${chapterNumber}/${pageNumber}.jpg`;
}
