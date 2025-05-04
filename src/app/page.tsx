"use client"

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ChapterCard from '@/components/ChapterCard';
import { AlertTriangle, ArrowDownUp } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'chapter_number' | 'processed_at'>('chapter_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = "Detective Conan - Chapter Overview";
  }, []);

  useEffect(() => {
    async function fetchChapters() {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = `/api/chapters?sortBy=${sortBy}&order=${sortOrder}`;
        const res = await fetch(apiUrl);
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
  }, [sortBy, sortOrder]);

  const filteredChapters = chapters
    ? chapters.filter(chapter => 
        chapter.chapter_number.toString().includes(searchQuery.trim())
      )
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--foreground)]">
      <Navbar />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center text-white">Detective Conan OST Manga Reader</h1>
        <p className="text-center text-gray-400 mb-8 text-base">
          Browse processed chapters of Detective Conan. Use the classifier to add more.
        </p>

        <div className="max-w-3xl mx-auto mb-10 p-4 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-lg shadow">
          <p className="text-center text-gray-300 text-sm md:text-base leading-relaxed">
            One of the coolest things about the Detective Conan anime is the OST. Let's bring that to the manga! This project is a manga reader for <strong className="text-white">Detective Conan</strong> that automatically plays an appropriate OST track based on the page currently being read. You can add new chapters in the <Link href="/manga-classifier"><span className="text-blue-400 hover:text-blue-300 underline cursor-pointer">Add New Chapter</span></Link> page. The initial classifiation will not always be correct, but you can edit the mood of each page in the View Moods page of the chapter. 
          </p>
        </div>
        
        {!loading && chapters && (
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <input
              type="text"
              placeholder="Search Chapter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md px-4 py-2 text-base text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-64"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 flex items-center gap-1 shrink-0">
                <ArrowDownUp size={16} /> Sort by:
              </span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="chapter_number">Chapter Number</option>
                <option value="processed_at">Date Processed</option>
              </select>
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        )}
        
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
          <div className="text-center py-12 px-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-md">
            <h2 className="text-xl font-semibold text-gray-300 mb-3">No Chapters Found</h2>
            <p className="text-gray-400 mb-6">
              It looks like no chapters have been processed yet. Head over to the classifier to get started!
            </p>
            <Link href="/manga-classifier">
              <span className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md shadow-sm transition-colors duration-150 cursor-pointer">
                Go to Classifier
              </span>
            </Link>
          </div>
        )}

        {!loading && !error && filteredChapters.length === 0 && chapters && chapters.length > 0 && (
          <div className="text-center py-12 px-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-md">
            <h2 className="text-xl font-semibold text-gray-300 mb-3">No Matches Found</h2>
            <p className="text-gray-400 mb-6">
              No chapters match your search query "{searchQuery}".
            </p>
          </div>
        )}

        {!loading && !error && filteredChapters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredChapters.map((chapter: Chapter) => (
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
