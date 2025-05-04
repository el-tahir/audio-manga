import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PageCounter from './PageCounter';
import ClassificationBubble from './ClassificationBubble';
import AudioPlayer from './AudioPlayer';
import { headers } from 'next/headers';
import {
  AlertTriangle, 
  ArrowLeft,
} from 'lucide-react';
import ReaderContent from './ReaderContent';

interface PageParams {
  params: {
    chapterNumber: string;
  }
}

// Keep Page interface simple for image data
interface Page {
  id: number;
  page_number: number;
  signedImageUrl: string;
  error?: string;
}

// Interface for Classification data needed by client components
interface ClassificationData {
  page_number: number;
  category: 'intro' | 'love' | 'love_ran' | 'casual' | 'adventure' | 'comedy' | 
            'action_casual' | 'action_serious' | 'tragic' | 'tension' | 
            'confrontation' | 'investigation' | 'revelation' | 'conclusion';
  filename: string;
}

// Define possible statuses for the next chapter
type ChapterStatus = 'completed' | 'pending' | 'processing' | 'failed' | 'not_found' | 'downloading';

// Keep ChapterData interface for data fetching type safety
interface ChapterData {
  chapter_number: number;
  total_pages: number;
}

export default async function ChapterReaderPage({ params }: PageParams) {
  // Await params before accessing its properties to fix Next.js 15 async params error
  const { chapterNumber: chapterNumberString } = await params;
  const chapterNumber = parseInt(chapterNumberString);
  const nextChapterNumber = chapterNumber + 1; // Calculate next chapter number
  
  let chapterData: { chapter_number: number; total_pages: number } | null = null;
  let classifications: ClassificationData[] | null = null;
  let pages: Page[] = [];
  let overallError: string | null = null;
  let nextChapterStatus: ChapterStatus = 'not_found'; // Default status

  try {
    // Fetch current chapter info and next chapter status in parallel
    const [chapterResult, nextChapterResult] = await Promise.all([
      supabase
        .from('manga_chapters')
        .select('chapter_number, total_pages')
        .eq('chapter_number', chapterNumber)
        .single(),
      supabase
        .from('manga_chapters')
        .select('status')
        .eq('chapter_number', nextChapterNumber)
        .maybeSingle() // Use maybeSingle as the next chapter might not exist
    ]);

    // Process current chapter info
    const { data: chapterInfo, error: chapterError } = chapterResult;
    if (chapterError && chapterError.code !== 'PGRST116') { // Ignore 'No rows found' for single()
      throw new Error(`Database error fetching chapter info: ${chapterError.message}`);
    }
    if (!chapterInfo) {
      throw new Error(`Chapter ${chapterNumber} not found in database.`);
    }
    chapterData = chapterInfo;

    // Process next chapter status
    const { data: nextChapterInfo, error: nextChapterError } = nextChapterResult;
    if (nextChapterError && nextChapterError.code !== 'PGRST116') { // Ignore 'No rows found' for maybeSingle()
      console.error(`Database error fetching next chapter status: ${nextChapterError.message}`);
      // Potentially treat this as 'not_found' or handle differently
      nextChapterStatus = 'not_found'; // Or maybe 'failed' to indicate DB error?
    } else if (nextChapterInfo) {
      // Map DB status to our defined ChapterStatus type
      // Assuming DB status matches our type, otherwise add mapping logic here
      nextChapterStatus = nextChapterInfo.status as ChapterStatus;
    } else {
      nextChapterStatus = 'not_found'; // Explicitly set if null/undefined data
    }

    // Fetch page classifications
    const { data: classificationData, error: classificationsError } = await supabase
      .from('manga_page_classifications')
      .select('page_number, category, filename')
      .eq('chapter_number', chapterNumber)
      .order('page_number');

    if (classificationsError) {
      // Log error but maybe allow reading without audio/moods?
      console.error("Error fetching classifications:", classificationsError);
      // Decide if this is a fatal error for the page
      // throw new Error(`Database error fetching classifications: ${classificationsError.message}`);
    } else {
      classifications = classificationData as ClassificationData[]; // Cast to defined type
    }

    // Build pages list by fetching signed URLs
    const totalPages = chapterData.total_pages ?? 0;
    if (totalPages > 0) {
      // Determine base URL for signed URLs API calls
      const hdrs = await headers();
      const host = hdrs.get('host')!;
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;

      // Fetch all signed URLs in parallel for potentially faster loading
      const urlPromises = Array.from({ length: totalPages }, (_, i) => i + 1)
        .map(async (pageNumber) => {
          try {
            const res = await fetch(`${baseUrl}/api/chapters/${chapterNumber}/images/${pageNumber}`);
            // Check for specific GCS errors if possible, otherwise just res.ok
            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({})); // Try to get error details
                throw new Error(`API Error (${res.status}): ${errorBody?.error || 'Failed to fetch URL'} for page ${pageNumber}`);
            }
            const { url } = await res.json();
            if (!url) {
                throw new Error(`Empty URL returned for page ${pageNumber}`);
            }
            return { id: pageNumber, page_number: pageNumber, signedImageUrl: url };
          } catch (err) {
            console.error(`Failed to get signed URL for page ${pageNumber}:`, err);
            return { id: pageNumber, page_number: pageNumber, signedImageUrl: '', error: (err as Error).message };
          }
        });
      
      pages = await Promise.all(urlPromises);
    } else {
       console.warn(`Chapter ${chapterNumber} has 0 total_pages.`);
    }

  } catch (err) {
    console.error(`[ReaderPage] Error loading chapter ${chapterNumber}:`, err);
    overallError = (err as Error).message;
    // Ensure pages and classifications are empty/null if chapter load failed critically
    pages = [];
    classifications = null;
    chapterData = null;
    nextChapterStatus = 'not_found'; // Reset on overall error
  }

  return (
    // Consistent background and text color
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--foreground)] flex flex-col">
      <Navbar />
      {/* Use consistent padding and max-width */}
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
        {/* Header Section (Partially moved to ReaderContent) */}
        {/* Keep Back Button and Title here */} 
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft size={16} />
            Back to Chapters
          </Link>
          {chapterData && (
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-white flex-1 px-4"> {/* Allow title to take space */}
              Chapter {chapterData.chapter_number}
            </h1>
          )}
          {/* Placeholder for the space the button will occupy in ReaderContent */}
          <div className="w-auto min-w-[150px]"> {/* Adjust min-width as needed based on button size */} 
             {/* The top button itself is rendered inside ReaderContent */}
          </div>
        </div>

        {/* Render the Client Component for content and buttons */}
        <ReaderContent
          initialChapterData={chapterData}
          initialPages={pages}
          initialOverallError={overallError}
          initialNextChapterStatus={nextChapterStatus}
          currentChapterNumber={chapterNumber}
        />

        {/* Fixed Controls Overlay (Remains outside ReaderContent) */} 
        {pages.length > 0 && classifications && classifications.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 ">
             <AudioPlayer classifications={classifications} />
             <ClassificationBubble classifications={classifications} />
             <PageCounter totalPages={pages.length} />
           </div>
        )}
      </main>
    </div>
  );
}
