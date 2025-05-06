/**
 * Background processor for manga chapters
 * DEPRECATED: Logic moved to Cloud Function worker src/cloud-functions/manga-processor/index.ts
 */
import path from 'path';
import { supabase } from '@/lib/supabase';
import { uploadFileToGCS } from '@/utils/gcsUtils';
import { extractArchive } from '@/utils/manga-classifier/archiveUtils';
import { getImageFiles } from '@/utils/manga-classifier/imageUtils';
import { classifyChapter } from '@/services/manga-classifier/aiService';
import { storeClassificationsInDatabase } from '@/services/manga-classifier/dbService';
import { cleanupTempFiles } from '@/utils/manga-classifier/fileUtils';

// The processChapterInBackground function has been removed as its logic
// now resides in the Cloud Function worker triggered by Cloud Tasks.
