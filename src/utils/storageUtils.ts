import { ClassificationResult } from "@/types";

const CHAPTERS_KEY = "manga_stored_chapters";
const CLASSIFICATIONS_KEY_PREFIX = "manga_classifications_";

/**
 * Checks if a chapter exists in local storage
 */
export async function chapterExists(chapterNumber: number): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const storedChapters = getStoredChaptersFromLocalStorage();
  return storedChapters.includes(chapterNumber);
}

/**
 * Stores chapter archive file reference in local storage
 */
export async function storeChapterArchive(chapterNumber: number, file: File): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Add chapter number to the list of stored chapters
  const storedChapters = getStoredChaptersFromLocalStorage();
  if (!storedChapters.includes(chapterNumber)) {
    storedChapters.push(chapterNumber);
    localStorage.setItem(CHAPTERS_KEY, JSON.stringify(storedChapters));
  }
  
  // Store basic chapter metadata
  localStorage.setItem(`manga_chapter_${chapterNumber}_info`, JSON.stringify({
    chapterNumber,
    fileName: file.name,
    fileSize: file.size,
    uploadDate: new Date().toISOString(),
    pageCount: 0 // Will be updated when classifications are stored
  }));
}

/**
 * Stores page classifications for a chapter
 */
export async function storeClassifications(
  chapterNumber: number, 
  classifications: ClassificationResult[]
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Store classifications in local storage
  localStorage.setItem(
    `${CLASSIFICATIONS_KEY_PREFIX}${chapterNumber}`, 
    JSON.stringify(classifications)
  );
  
  // Update chapter metadata with page count
  const chapterInfoKey = `manga_chapter_${chapterNumber}_info`;
  const chapterInfoStr = localStorage.getItem(chapterInfoKey);
  
  if (chapterInfoStr) {
    const chapterInfo = JSON.parse(chapterInfoStr);
    chapterInfo.pageCount = classifications.length;
    localStorage.setItem(chapterInfoKey, JSON.stringify(chapterInfo));
  }
}

/**
 * Gets all stored chapter numbers
 */
export async function getStoredChapterNumbers(): Promise<number[]> {
  if (typeof window === 'undefined') return [];
  
  return getStoredChaptersFromLocalStorage();
}

/**
 * Gets classifications for a specific chapter
 */
export async function getChapterClassifications(
  chapterNumber: number
): Promise<ClassificationResult[]> {
  if (typeof window === 'undefined') return [];
  
  const classificationsStr = localStorage.getItem(`${CLASSIFICATIONS_KEY_PREFIX}${chapterNumber}`);
  return classificationsStr ? JSON.parse(classificationsStr) : [];
}

/**
 * Gets chapter information
 */
export async function getChapterInfo(chapterNumber: number): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  
  const chapterInfoStr = localStorage.getItem(`manga_chapter_${chapterNumber}_info`);
  return chapterInfoStr ? JSON.parse(chapterInfoStr) : null;
}

/**
 * Gets stored chapters from local storage
 */
function getStoredChaptersFromLocalStorage(): number[] {
  if (typeof window === 'undefined') return [];
  
  const storedChaptersStr = localStorage.getItem(CHAPTERS_KEY);
  return storedChaptersStr ? JSON.parse(storedChaptersStr) : [];
}

/**
 * Removes a chapter from local storage
 */
export async function removeChapter(chapterNumber: number): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Remove from stored chapters list
  const storedChapters = getStoredChaptersFromLocalStorage();
  const updatedChapters = storedChapters.filter(ch => ch !== chapterNumber);
  localStorage.setItem(CHAPTERS_KEY, JSON.stringify(updatedChapters));
  
  // Remove chapter metadata and classifications
  localStorage.removeItem(`manga_chapter_${chapterNumber}_info`);
  localStorage.removeItem(`${CLASSIFICATIONS_KEY_PREFIX}${chapterNumber}`);
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
