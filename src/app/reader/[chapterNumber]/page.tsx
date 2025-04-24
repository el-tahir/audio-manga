import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import PageCounter from './PageCounter';
import ClassificationBubble from './ClassificationBubble';
import AudioPlayer from './AudioPlayer';
import { headers } from 'next/headers';

interface PageParams {
  params: {
    chapterNumber: string;
  }
}

interface Page {
  id: number;
  page_number: number;
  image_url: string;
}

export default async function ChapterReaderPage({ params }: PageParams) {
  // Await params before accessing its properties to fix Next.js 15 async params error
  const { chapterNumber: chapterNumberString } = await params;
  const chapterNumber = parseInt(chapterNumberString);
  
  // Fetch chapter info
  const { data: chapter, error: chapterError } = await supabase
    .from('manga_chapters')
    .select('*')
    .eq('chapter_number', chapterNumber)
    .single();
  
  // Fetch page classifications
  const { data: classifications, error: classificationsError } = await supabase
    .from('manga_page_classifications')
    .select('page_number, category, filename')
    .eq('chapter_number', chapterNumber)
    .order('page_number');

  // Build pages list by fetching signed URLs
  const totalPages = chapter?.total_pages ?? 0;
  type SignedPage = { id: number; page_number: number; signedImageUrl: string; error?: string };
  const pages: SignedPage[] = [];
  let pagesError = null;
  try {
    if (!chapter) throw new Error('Chapter information not found');
    // Determine base URL for signed URLs
    const hdrs = await headers();
    const host = hdrs.get('host')!;
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    for (let i = 1; i <= totalPages; i++) {
      try {
        const res = await fetch(`${baseUrl}/api/chapters/${chapterNumber}/images/${i}`);
        if (!res.ok) throw new Error(`Failed to fetch URL for page ${i}`);
        const { url } = await res.json();
        pages.push({ id: i, page_number: i, signedImageUrl: url });
      } catch (err) {
        pages.push({ id: i, page_number: i, signedImageUrl: '', error: (err as Error).message });
      }
    }
  } catch (err) {
    pagesError = { message: (err as Error).message };
  }

  const error = chapterError || pagesError || classificationsError;

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Link href="/" className="text-blue-500 hover:underline">
            ← Back to chapters
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded mb-6">
            <p className="text-red-500">Error loading chapter: {error.message}</p>
          </div>
        )}
        
        {chapter && (
          <h1 className="text-3xl font-bold mb-6">Chapter {chapter.chapter_number}</h1>
        )}
        
        <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto">
          {pages.map((page) => (
            <div key={page.id} className="w-full" id={`page-${page.page_number}`}>
              <Image
                src={page.signedImageUrl}
                alt={`Page ${page.page_number}`}
                width={800}
                height={1200}
                className="w-full h-auto"
              />
            </div>
          ))}
        </div>
        
        {pages.length > 0 && (
          <>
            <PageCounter totalPages={pages.length} />
            {classifications && classifications.length > 0 && (
              <>
                <ClassificationBubble classifications={classifications} />
                <AudioPlayer classifications={classifications} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
