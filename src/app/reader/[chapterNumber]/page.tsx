import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import PageCounter from './PageCounter';
import ClassificationBubble from './ClassificationBubble';
import AudioPlayer from './AudioPlayer';
import { headers } from 'next/headers';
import {
  AlertTriangle, 
  ImageOff, 
  ArrowLeft // Added for back button consistency
} from 'lucide-react';

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

export default async function ChapterReaderPage({ params }: PageParams) {
  // Await params before accessing its properties to fix Next.js 15 async params error
  const { chapterNumber: chapterNumberString } = await params;
  const chapterNumber = parseInt(chapterNumberString);
  
  let chapterData: { chapter_number: number; total_pages: number } | null = null;
  let classifications: ClassificationData[] | null = null;
  let pages: Page[] = [];
  let overallError: string | null = null;

  try {
    // Fetch chapter info first
    const { data: chapterInfo, error: chapterError } = await supabase
      .from('manga_chapters')
      .select('chapter_number, total_pages')
      .eq('chapter_number', chapterNumber)
      .single();

    if (chapterError) throw new Error(`Database error fetching chapter info: ${chapterError.message}`);
    if (!chapterInfo) throw new Error(`Chapter ${chapterNumber} not found in database.`);
    chapterData = chapterInfo;

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
  }

  return (
    // Consistent background and text color
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--foreground)] flex flex-col">
      <Navbar />
      {/* Use consistent padding and max-width */}
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
        {/* Header Section - Apply Tailwind classes */} 
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft size={16} />
            Back to Chapters
          </Link>
          {chapterData && (
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-white">Chapter {chapterData.chapter_number}</h1>
          )}
          <div className="w-24"></div> {/* Spacer */}
        </div>
        
        {/* Overall Error Display - Styled like GlobalFeedback */} 
        {overallError && (
           <div className="flex items-center gap-3 p-4 rounded-md text-sm bg-red-900/30 border border-red-700 text-red-300 mb-6">
             <AlertTriangle size={20} />
             <div>
               <p className="font-semibold">Error loading chapter:</p>
               <p>{overallError}</p>
             </div>
           </div>
        )}
        
        {/* Pages Display */} 
        {!overallError && chapterData && (
          <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto pb-24"> {/* Reduced max-width for focus, more padding-bottom */} 
            {pages.map((page) => (
              <div key={page.id} className="w-full bg-[var(--bg-secondary)] rounded-md shadow-md overflow-hidden border border-[var(--border-color)]" id={`page-${page.page_number}`}>
                {page.signedImageUrl ? (
                  <Image
                    src={page.signedImageUrl}
                    alt={`Page ${page.page_number}`}
                    width={800} 
                    height={1200}
                    className="w-full h-auto block" 
                    priority={page.page_number <= 3} 
                    unoptimized 
                  />
                ) : (
                  // Error placeholder for individual image - styled consistently
                  <div className="w-full aspect-[2/3] bg-[var(--bg-tertiary)]/50 flex flex-col items-center justify-center text-red-400 p-4 border border-[var(--border-color)] rounded-md">
                    <ImageOff className="w-16 h-16 mb-3 text-gray-500" />
                    <p className="font-semibold text-sm text-red-300">Failed to load Page {page.page_number}</p>
                    {page.error && <p className="text-xs text-red-500 mt-1 text-center max-w-xs">({page.error})</p>}
                  </div>
                )}
              </div>
            ))}
             {pages.length === 0 && chapterData.total_pages > 0 && (
                 <p className="text-yellow-400 italic">Could not load any page images for this chapter.</p>
             )}
             {chapterData.total_pages === 0 && (
                 <p className="text-gray-500 italic">This chapter has no pages according to the database.</p>
             )}
          </div>
        )}
        
        {/* Fixed Controls Overlay - Styled container */} 
        {pages.length > 0 && classifications && classifications.length > 0 && (
          // Apply card-like styling to the container
          <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 ">
             {/* Controls themselves might need internal adjustments if their styling clashes */}
             <AudioPlayer classifications={classifications} />
             <ClassificationBubble classifications={classifications} />
             <PageCounter totalPages={pages.length} />
           </div>
        )}
      </main>
    </div>
  );
}
