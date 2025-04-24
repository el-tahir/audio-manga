"use client"

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ChapterCard from '@/components/ChapterCard';

interface Chapter {
  id: number;
  chapter_number: number;
  total_pages: number;
  processed_at: string;
  status: string;
}

export default function ReaderPage() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChapters() {
      try {
        const res = await fetch('/api/chapters');
        if (!res.ok) throw new Error('Failed to fetch chapters');
        const data: Chapter[] = await res.json();
        setChapters(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching chapters:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchChapters();
  }, []);

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Manga Reader</h1>
        
        {loading && (
          <div className="bg-blue-500/20 border border-blue-500 p-4 rounded mb-6">
            <p className="text-blue-500">Loading chapters...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded mb-6">
            <p className="text-red-500">Error loading chapters: {error.message}</p>
          </div>
        )}

        {(!chapters || chapters.length === 0) && !loading && !error && (
          <div className="bg-yellow-500/20 border border-yellow-500 p-4 rounded mb-6">
            <p className="text-yellow-500">No chapters available. Process some chapters first.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters?.map((chapter: Chapter) => (
            <ChapterCard 
              key={chapter.chapter_number}
              chapterNumber={chapter.chapter_number}
              totalPages={chapter.total_pages}
              processedAt={chapter.processed_at}
              status={chapter.status}
            />
          ))}
        </div>
      </div>
    </>
  );
}
