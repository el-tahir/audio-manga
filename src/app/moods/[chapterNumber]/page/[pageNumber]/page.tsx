"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import CategorySelector from '@/components/CategorySelector';

interface PageClassification {
  id: number;
  category: string;
  confidence: number | null;
  explanation: string | null;
}

export default function PageView() {
  const params = useParams<{ chapterNumber: string; pageNumber: string }>();
  const router = useRouter();
  const { chapterNumber, pageNumber } = params;
  const [classification, setClassification] = useState<PageClassification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Signed image URL state
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClassification() {
      try {
        // Call the new endpoint for a single classification
        const res = await fetch(`/api/chapters/${chapterNumber}/classifications/${pageNumber}`);
        if (!res.ok) {
          if (res.status === 404) {
             throw new Error(`Classification for page ${pageNumber} not found`);
          } else {
            throw new Error(`Failed to fetch classification (status: ${res.status})`);
          }
        }
        // Response is now the single classification object
        const found: { pageNumber: number; category: string; filename?: string; explanation?: string } = await res.json();
        
        setClassification({
          id: found.pageNumber, // Use found.pageNumber directly
          category: found.category,
          confidence: null, // Confidence isn't returned by this API
          explanation: found.explanation || null
        });
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching classification:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchClassification();
  }, [chapterNumber, pageNumber]);

  // Fetch signed image URL
  useEffect(() => {
    async function fetchSignedUrl() {
      setImageLoading(true);
      try {
        const resImg = await fetch(`/api/chapters/${chapterNumber}/images/${pageNumber}`);
        if (!resImg.ok) throw new Error('Failed to fetch signed image URL');
        const { url } = await resImg.json();
        setSignedImageUrl(url);
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setImageLoading(false);
      }
    }
    fetchSignedUrl();
  }, [chapterNumber, pageNumber]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--foreground)]">
      {/* Header with back button and category selector */}
      <div className="w-full bg-[var(--bg-secondary)] p-3 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="text-white flex items-center gap-2 hover:text-gray-300 transition"
          >
            <ArrowLeft size={24} />
            <span>Back to Classifications</span>
          </button>

          {!loading && !error && classification && (
            <div className="flex items-center gap-4">
              <div className="text-white">Category:</div>
              <div className="w-48">
                <CategorySelector
                  chapterNumber={Number(chapterNumber)}
                  pageNumber={Number(pageNumber)}
                  currentCategory={classification.category}
                  onCategoryChange={(newCategory) => 
                    setClassification(prev => prev ? {...prev, category: newCategory} : null)
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-full max-h-[90vh]">
          {imageLoading && <p className="text-white">Loading image...</p>}
          {imageError && <p className="text-red-500">Error loading image: {imageError}</p>}
          {signedImageUrl && (
            <Image
              src={signedImageUrl}
              alt={`Page ${pageNumber}`}
              width={1000}
              height={1500}
              className="object-contain"
              priority
            />
          )}
        </div>
      </div>

      {/* Classification details */}
      {!loading && !error && classification && (
        <div className="w-full bg-[var(--bg-secondary)] p-4 border-t border-[var(--border-color)]">
          <div className="container mx-auto text-white">
            {classification.confidence && (
              <p className="mb-2">
                Confidence: {(classification.confidence * 100).toFixed(1)}%
              </p>
            )}
            {classification.explanation && (
              <p className="italic text-gray-300">
                "{classification.explanation}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 