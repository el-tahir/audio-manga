import { supabase } from '@/lib/supabase';
import { ClassificationResult } from '@/types';

/**
 * Checks if a chapter exists in the database
 */
export async function chapterExistsInDatabase(chapterNumber: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('manga_chapters')
    .select('id')
    .eq('chapter_number', chapterNumber)
    .single();
  
  return !!data;
}

/**
 * Gets all stored chapter numbers from the database
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
 * Gets classifications for a specific chapter
 */
export async function getChapterClassifications(
  chapterNumber: number
): Promise<ClassificationResult[]> {
  // First get the chapter ID
  const { data: chapterData, error: chapterError } = await supabase
    .from('manga_chapters')
    .select('id')
    .eq('chapter_number', chapterNumber)
    .single();
  
  if (chapterError || !chapterData) {
    return [];
  }
  
  // Now get the page classifications
  const { data, error } = await supabase
    .from('manga_page_classifications')
    .select('*')
    .eq('chapter_id', chapterData.id)
    .order('page_number', { ascending: true });
  
  if (error || !data) {
    return [];
  }
  
  return data.map(item => ({
    filename: item.filename,
    category: item.category,
    confidence: item.confidence
  }));
}

/**
 * Gets chapter information
 */
export async function getChapterInfo(chapterNumber: number): Promise<any | null> {
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
    processedAt: data.processed_at
  };
}

/**
 * Gets the URL path to a chapter's pages
 */
export function getChapterImagePath(chapterNumber: number): string {
  return `/chapters/${chapterNumber}`;
}

/**
 * Gets the URL to a specific page image
 */
export function getPageImageUrl(chapterNumber: number, pageNumber: number): string {
  return `/chapters/${chapterNumber}/${pageNumber}.jpg`;
}
