// ===== CORE TYPES =====

// Import mood categories from central constants
import { MOOD_CATEGORIES, MOOD_CATEGORY_LABELS, type MoodCategory } from '@/config/constants';

// Re-export for backward compatibility
export { MOOD_CATEGORIES, MOOD_CATEGORY_LABELS, type MoodCategory };

export type ClassificationResult = {
  filename: string;
  category: MoodCategory;
  explanation?: string;
};

// ===== CHAPTER TYPES =====

export type ChapterStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'not_found'
  | 'downloading';

export interface Chapter {
  id?: number;
  chapter_number: number;
  total_pages: number;
  status?: string;
}

export interface ChapterData {
  chapter_number: number;
  total_pages: number;
}

// ===== PAGE TYPES =====

export interface Page {
  id: number;
  page_number: number;
  signedImageUrl: string;
  error?: string;
}

export interface PageClassification {
  id: number;
  page_number: number;
  category: string;
  confidence: number | null;
  explanation: string | null;
  filename: string;
  thumbnailUrl?: string; // Optional signed URL for thumbnail
}

export interface ClassificationData {
  page_number: number;
  category: MoodCategory;
  filename: string;
}

// Simplified classification interface for audio player
export interface Classification {
  page_number: number;
  category: MoodCategory;
}

// ===== PAGE PARAMS TYPES =====

// Updated for Next.js 15 async params
export interface PageParams {
  params: Promise<{
    chapterNumber: string;
  }>;
}

// ===== STATE TYPES =====

export type InputChapterStateType =
  | 'idle'
  | 'invalid'
  | 'ready_new'
  | 'processing'
  | 'completed'
  | 'failed_retryable';

// ===== COMPONENT PROPS TYPES =====

export interface AudioPlayerProps {
  classifications: Classification[];
}

export interface ClassificationBubbleProps {
  classifications: ClassificationResult[];
}

export interface NextChapterButtonProps {
  nextChapterNumber: number;
  currentStatus: ChapterStatus;
  isLoading: boolean;
  statusMessage: string | null;
  isError: boolean;
  onClick: () => void;
}

export interface PageCounterProps {
  totalPages: number;
}

export interface ChapterCardProps {
  chapterNumber: number;
  totalPages: number;
  processedAt: string;
  status: string;
}

export interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  alt: string;
}

export interface CategorySelectorProps {
  chapterNumber: number;
  pageNumber: number;
  currentCategory: string;
  onCategoryChange: (newCategory: string) => void;
}
