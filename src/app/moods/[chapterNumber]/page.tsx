'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import CategorySelector from '@/components/CategorySelector';
import { AlertTriangle, ImageOff, BookOpen } from 'lucide-react'; // Icons
import { PageClassification, Chapter } from '@/types';
import { getMoodCategoryBorderColor } from '@/config/constants';

export default function MoodsPage() {
  const params = useParams<{ chapterNumber: string }>();
  const chapterNumber = params.chapterNumber; // Extracted for cleaner use

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [classifications, setClassifications] = useState<PageClassification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Store error as string

  useEffect(() => {
    if (!chapterNumber) return; // Don't fetch if chapterNumber isn't available yet

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch chapter details
        const chapterRes = await fetch(`/api/chapters/${chapterNumber}`);
        if (!chapterRes.ok) {
          const errData = await chapterRes.json().catch(() => ({}));
          throw new Error(
            errData.error || `Failed to fetch chapter details (Status: ${chapterRes.status})`
          );
        }
        const chapterData: Chapter = await chapterRes.json();
        setChapter(chapterData);

        // Fetch page classifications
        const classifRes = await fetch(`/api/chapters/${chapterNumber}/classifications`);
        if (!classifRes.ok) {
          const errData = await classifRes.json().catch(() => ({}));
          throw new Error(
            errData.error || `Failed to fetch classifications (Status: ${classifRes.status})`
          );
        }
        const classificationsData: PageClassification[] = await classifRes.json();

        // Fetch signed thumbnail URLs (if classifications fetched successfully)
        const enrichedClassifications = await Promise.all(
          classificationsData.map(async c => {
            try {
              // Use internal API endpoint for images
              const resThumb = await fetch(
                `/api/chapters/${chapterNumber}/images/${c.page_number}`
              );
              if (!resThumb.ok)
                throw new Error(`Thumb URL fetch failed (Status: ${resThumb.status})`);
              const { url: thumbnailUrl } = await resThumb.json();
              return { ...c, thumbnailUrl };
            } catch (err) {
              console.error('Thumbnail URL error for page', c.page_number, err);
              return { ...c, thumbnailUrl: '' }; // Return empty string on error
            }
          })
        );
        setClassifications(enrichedClassifications);
      } catch (err) {
        console.error('Error fetching data for moods page:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setClassifications([]); // Set empty on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [chapterNumber]); // Depend on chapterNumber

  // Update classification locally on category change
  const handleCategoryChange = (pageNumber: number, newCategory: string) => {
    setClassifications(
      prevClassifications =>
        prevClassifications?.map(classification =>
          classification.page_number === pageNumber // Match by page_number
            ? { ...classification, category: newCategory }
            : classification
        ) || null
    );
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-gray-200">
      <Navbar />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        {' '}
        {/* Wider container */}
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Chapter {chapter?.chapter_number ?? chapterNumber} - Page Moods
          </h1>
          <Link
            href={`/reader/${chapterNumber}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors shadow-md whitespace-nowrap"
          >
            <BookOpen size={18} />
            Read Chapter
          </Link>
        </div>
        {/* Loading State */}
        {loading && <ClassificationGridSkeleton />}
        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-md text-sm bg-red-900/30 border border-red-700 text-red-300 mb-6">
            <AlertTriangle size={20} />
            <span>Error loading classifications: {error}</span>
          </div>
        )}
        {/* Empty State */}
        {!loading && !error && (!classifications || classifications.length === 0) && (
          <div className="text-center py-10 px-4 rounded-md bg-neutral-800 border border-gray-700">
            <p className="text-lg text-gray-400">No classifications found for this chapter.</p>
            <p className="text-sm text-gray-500 mt-1">
              Ensure the chapter has been processed successfully.
            </p>
          </div>
        )}
        {/* Classifications Grid */}
        {!loading && !error && classifications && classifications.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {classifications.map(classification => (
              // Classification Card - Dark theme with colored top border
              <div
                key={classification.id}
                className={`bg-neutral-800 rounded-lg shadow-md border border-gray-700 border-t-4 ${getMoodCategoryBorderColor(classification.category)} overflow-hidden flex flex-col`}
              >
                <div className="p-3">
                  <h3 className="text-base font-semibold mb-2 text-white">
                    Page {classification.page_number}
                  </h3>

                  {/* Category Selector - Assuming internal styling is adaptable */}
                  <CategorySelector
                    chapterNumber={Number(chapterNumber)}
                    pageNumber={classification.page_number}
                    currentCategory={classification.category}
                    onCategoryChange={newCategory =>
                      handleCategoryChange(classification.page_number, newCategory)
                    }
                  />
                </div>

                {/* Thumbnail Link */}
                <Link
                  href={`/moods/${chapterNumber}/page/${classification.page_number}`}
                  className="block relative w-full aspect-[2/3] mt-2 group cursor-pointer bg-neutral-700"
                  title={`View/Edit Page ${classification.page_number}`}
                >
                  {classification.thumbnailUrl ? (
                    <Image
                      src={classification.thumbnailUrl}
                      alt={`Thumbnail for Page ${classification.page_number}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200 ease-in-out"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // Adjust sizes as needed
                      unoptimized // Good for signed URLs
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <ImageOff size={32} />
                    </div>
                  )}
                </Link>

                {/* Explanation (optional display) */}
                {classification.explanation && (
                  <div className="p-3 mt-auto text-xs text-gray-400 italic border-t border-gray-700 bg-neutral-800/50">
                    AI: &quot;{classification.explanation.substring(0, 80)}
                    {classification.explanation.length > 80 ? '...' : ''}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Skeleton loader component for the classifications grid.
 * Displays a pulsing placeholder for several classification cards.
 * @returns {JSX.Element}
 */
const ClassificationGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 animate-pulse">
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="bg-neutral-800 rounded-lg shadow-md border border-gray-700 overflow-hidden"
      >
        <div className="p-3">
          <div className="h-5 bg-neutral-700 rounded w-1/2 mb-3"></div>
          <div className="h-9 bg-neutral-700 rounded w-full"></div>
        </div>
        <div className="w-full aspect-[2/3] bg-neutral-700 mt-2"></div>
      </div>
    ))}
  </div>
);
