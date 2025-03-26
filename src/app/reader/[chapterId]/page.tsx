import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs/promises';
import path from 'path';
import PageCounter from './PageCounter';
import ClassificationBubble from './ClassificationBubble';
import AudioPlayer from './AudioPlayer';

interface PageParams {
  params: {
    chapterId: string;
  }
}

interface Page {
  id: number;
  page_number: number;
  image_url: string;
}

export default async function ChapterReaderPage({ params }: PageParams) {
  const chapterId = parseInt(params.chapterId);
  
  // Fetch chapter info
  const { data: chapter, error: chapterError } = await supabase
    .from('manga_chapters')
    .select('*')
    .eq('id', chapterId)
    .single();
  
  // Fetch page classifications
  const { data: classifications, error: classificationsError } = await supabase
    .from('manga_page_classifications')
    .select('page_number, category')
    .eq('chapter_id', chapterId)
    .order('page_number');
  
  // Load pages from local filesystem instead of database
  // Use chapter_number instead of ID for directory path
  const chapterDirPath = chapter 
    ? path.join(process.cwd(), 'public', 'chapters', chapter.chapter_number.toString())
    : '';
  
  let pages: Page[] = [];
  let pagesError = null;
  
  try {
    // Only try to read directory if we have chapter data
    if (!chapter) {
      throw new Error('Chapter information not found');
    }
    
    const files = await fs.readdir(chapterDirPath);
    // Filter image files and create page objects
    pages = files
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .sort((a, b) => {
        // Sort numerically if filenames are numbers
        const numA = parseInt(a.split('.')[0]);
        const numB = parseInt(b.split('.')[0]);
        return numA - numB;
      })
      .map((file, index) => ({
        id: index,
        page_number: index + 1,
        // Use chapter_number for the image URL
        image_url: `/chapters/${chapter.chapter_number}/${file}`
      }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    pagesError = { message: `Failed to read chapter directory: ${errorMessage}` };
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
          {pages?.map((page) => (
            <div key={page.id} className="w-full" id={`page-${page.page_number}`}>
              <Image
                src={page.image_url}
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
