"use client"

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ChapterCard from '@/components/ChapterCard';
import { AlertTriangle } from 'lucide-react';

interface Chapter {
  id: number;
  chapter_number: number;
  total_pages: number;
  processed_at: string;
  status: string;
}

export default function HomePage() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChapters() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/chapters?sortBy=chapter_number&order=asc');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch chapters (Status: ${res.status})`);
        }
        const data: Chapter[] = await res.json();
        setChapters(data);
      } catch (err) {
        console.error('Error fetching chapters:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setChapters([]);
      } finally {
        setLoading(false);
      }
    }

    fetchChapters();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--foreground)]">
      <Navbar />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">Manga Chapters</h1>
        
        {loading && (
          <ChapterGridSkeleton />
        )}
        
        {error && !loading && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-md text-sm bg-red-900/30 border border-red-700 text-red-300 mb-6">
            <AlertTriangle size={20} />
            <span>Error loading chapters: {error}</span>
          </div>
        )}

        {!loading && !error && chapters && chapters.length === 0 && (
          <div className="text-center py-10 px-4 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <p className="text-lg text-gray-400">No chapters available.</p>
            <p className="text-sm text-gray-500 mt-1">Use the Manga Classifier page to download and process chapters.</p>
          </div>
        )}

        {!loading && !error && chapters && chapters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {chapters.map((chapter: Chapter) => (
              <ChapterCard 
                key={chapter.chapter_number}
                chapterNumber={chapter.chapter_number}
                totalPages={chapter.total_pages}
                processedAt={chapter.processed_at}
                status={chapter.status}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const ChapterGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-pulse">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-[var(--bg-secondary)] rounded-lg h-48 p-4 border border-[var(--border-color)]">
        <div className="h-5 bg-[var(--bg-tertiary)] rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3 mb-4"></div>
        <div className="flex justify-between mt-auto pt-3 border-t border-[var(--border-color)]">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/2"></div>
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);
