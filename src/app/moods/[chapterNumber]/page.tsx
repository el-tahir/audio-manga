"use client"

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import CategorySelector from '@/components/CategorySelector';

interface PageClassification {
  id: number;
  page_number: number;
  category: string;
  confidence: number | null;
  explanation: string | null;
  filename: string;
  thumbnailUrl?: string;
}

interface Chapter {
  id: number;
  chapter_number: number;
  total_pages: number;
}

export default function MoodsPage() {
  const params = useParams<{ chapterNumber: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [classifications, setClassifications] = useState<PageClassification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch chapter details
        const chapterRes = await fetch(`/api/chapters/${params.chapterNumber}`);
        if (!chapterRes.ok) throw new Error('Failed to fetch chapter details');
        const chapterData: Chapter = await chapterRes.json();
        setChapter(chapterData);

        // Fetch page classifications
        const classifRes = await fetch(`/api/chapters/${params.chapterNumber}/classifications`);
        if (!classifRes.ok) throw new Error('Failed to fetch classifications');
        const classificationsData: PageClassification[] = await classifRes.json();

        // Fetch signed thumbnail URLs
        const enriched = await Promise.all(classificationsData.map(async (c) => {
          try {
            const resThumb = await fetch(`/api/chapters/${params.chapterNumber}/images/${c.page_number}`);
            if (!resThumb.ok) throw new Error('Signed URL fetch failed');
            const { url: thumbnailUrl } = await resThumb.json();
            return { ...c, thumbnailUrl };
          } catch (err) {
            console.error('Thumbnail URL error for page', c.page_number, err);
            return { ...c, thumbnailUrl: '' };
          }
        }));
        setClassifications(enriched);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.chapterNumber]);

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      excitement: 'bg-red-100 text-red-800',
      ran: 'bg-purple-100 text-purple-800',
      exhilaration: 'bg-orange-100 text-orange-800',
      hope: 'bg-green-100 text-green-800',
      kogoro: 'bg-blue-100 text-blue-800',
      detective_boys: 'bg-cyan-100 text-cyan-800',
      affection: 'bg-pink-100 text-pink-800',
      carefree: 'bg-emerald-100 text-emerald-800',
      agasa: 'bg-violet-100 text-violet-800',
      melancholy: 'bg-gray-100 text-gray-800',
      tension: 'bg-red-200 text-red-900',
      panic: 'bg-red-300 text-red-900',
      isolation: 'bg-slate-100 text-slate-800',
      triumph: 'bg-yellow-100 text-yellow-800',
      resolution: 'bg-green-200 text-green-900',
      multipurpose: 'bg-gray-200 text-gray-900',
      case_intro: 'bg-blue-200 text-blue-900',
      investigation: 'bg-blue-300 text-blue-900',
      revelation: 'bg-green-300 text-green-900',
      ominous: 'bg-purple-200 text-purple-900',
      shock: 'bg-red-400 text-red-900',
      deduction: 'bg-teal-100 text-teal-800',
      confrontation: 'bg-red-500 text-red-900'
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getImagePath = (chapterNumber: number, pageNumber: number) => {
    return `/chapters/${chapterNumber}/${pageNumber}.jpg`;
  };

  const handleCategoryChange = (classificationId: number, newCategory: string) => {
    setClassifications(prevClassifications => 
      prevClassifications?.map(classification =>
        classification.id === classificationId
          ? { ...classification, category: newCategory }
          : classification
      ) || null
    );
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            Chapter {chapter?.chapter_number} - Page Classifications
          </h1>
          <Link 
            href={`/reader/${params.chapterNumber}`}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Read Chapter
          </Link>
        </div>

        {loading && (
          <div className="bg-blue-500/20 border border-blue-500 p-4 rounded mb-6">
            <p className="text-blue-500">Loading classifications...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded mb-6">
            <p className="text-red-500">Error loading data: {error.message}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classifications?.map((classification) => (
              <div
                key={classification.id}
                className={`border rounded-lg p-4 ${getCategoryColor(classification.category)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-semibold">Page {classification.page_number}</h3>
                  {classification.confidence && (
                    <span className="text-sm bg-white/50 px-2 py-1 rounded">
                      {(classification.confidence * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                
                {/* Category Selector */}
                <div className="mb-3">
                  <CategorySelector
                    chapterNumber={Number(params.chapterNumber)}
                    pageNumber={classification.page_number}
                    currentCategory={classification.category}
                    onCategoryChange={(newCategory) => handleCategoryChange(classification.id, newCategory)}
                  />
                </div>

                {/* Thumbnail with Link */}
                <Link 
                  href={`/moods/${params.chapterNumber}/page/${classification.page_number}`}
                  className="block relative w-full h-48 mb-3 cursor-pointer overflow-hidden rounded"
                >
                  <Image
                    src={classification.thumbnailUrl || getImagePath(chapter!.chapter_number, classification.page_number)}
                    alt={`Page ${classification.page_number}`}
                    fill
                    className="object-cover hover:scale-105 transition"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </Link>

                {classification.explanation && (
                  <p className="text-sm opacity-75 italic">
                    "{classification.explanation}"
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  File: {classification.filename}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
} 