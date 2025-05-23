'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ImageOff, AlertTriangle } from 'lucide-react';
import NextChapterButton from './NextChapterButton';

// Types mirroring those in page.tsx (consider shared types file later)
type ChapterStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'not_found'
  | 'downloading';

interface Page {
  id: number;
  page_number: number;
  signedImageUrl: string;
  error?: string;
}

interface ChapterData {
  chapter_number: number;
  total_pages: number;
}

interface ReaderContentProps {
  initialChapterData: ChapterData | null;
  initialPages: Page[];
  initialOverallError: string | null;
  initialNextChapterStatus: ChapterStatus;
  currentChapterNumber: number;
}

export default function ReaderContent({
  initialChapterData,
  initialPages,
  initialOverallError,
  initialNextChapterStatus,
  currentChapterNumber,
}: ReaderContentProps) {
  const router = useRouter();
  const nextChapterNumber = currentChapterNumber + 1;

  // State managed by this client component
  const pages = initialPages; // Use directly since we don't need to update it
  const overallError = initialOverallError; // Use directly since we don't need to update it
  const chapterData = initialChapterData; // Use directly since we don't need to update it
  // --- Shared state for NextChapterButton ---
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ChapterStatus>(initialNextChapterStatus);
  // -----------------------------------------

  const handleNextChapterClick = async () => {
    setStatusMessage(null); // Clear previous messages
    setIsError(false);

    if (currentStatus === 'completed') {
      // Navigate to the next chapter reader page
      router.push(`/reader/${nextChapterNumber}`);
      // Optionally add loading state for navigation
      // setIsLoading(true);
      // setStatusMessage(`Loading Chapter ${nextChapterNumber}...`);
    } else {
      // Trigger the download API
      setIsLoading(true);
      const optimisticStatus: ChapterStatus =
        currentStatus === 'failed' ? 'pending' : 'downloading';
      setCurrentStatus(optimisticStatus);
      setStatusMessage(`Initiating action for Chapter ${nextChapterNumber}...`);

      try {
        const response = await fetch(`/api/download-chapter/${nextChapterNumber}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (response.ok) {
          if (response.status === 202) {
            setStatusMessage(
              `Chapter ${nextChapterNumber} download started. Processing in background.`
            );
            setCurrentStatus('pending');
          } else if (response.status === 409) {
            setStatusMessage(
              result.message || `Chapter ${nextChapterNumber} already processing/available.`
            );
            // Attempt to determine a more specific status if possible from result
            // For now, stick with pending as a safe bet
            setCurrentStatus('pending');
          } else {
            setStatusMessage(
              result.message || `Request acknowledged for chapter ${nextChapterNumber}.`
            );
            setCurrentStatus('pending');
          }
          setIsError(false);
        } else {
          setIsError(true);
          setStatusMessage(
            `Error: ${result.error || `Failed to start download (Status: ${response.status})`}`
          );
          // Revert status only if it was an actual API error,
          // keep 'failed' if it was already failed and retry failed
          if (currentStatus !== 'failed') {
            setCurrentStatus(initialNextChapterStatus);
          } // If it was already 'failed', leave it as 'failed'
        }
      } catch (error) {
        console.error('Failed to call download API:', error);
        setIsError(true);
        setStatusMessage(`Error: Network error or fetch failure. Please try again.`);
        // Revert status on network errors too
        if (currentStatus !== 'failed') {
          setCurrentStatus(initialNextChapterStatus);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Common props for both buttons
  const nextButtonProps = {
    nextChapterNumber,
    currentStatus,
    isLoading,
    statusMessage, // Pass message to potentially display near button
    isError,
    onClick: handleNextChapterClick,
  };

  return (
    <>
      {/* Header Section - Rendered by parent or passed down if needed */}
      {/* We pass the state down */}
      <div className="mb-6 md:mb-8 flex items-center justify-between">
        {/* Back button remains in parent page.tsx */}
        {/* Title remains in parent page.tsx */}
        {/* Top Next Chapter Button */}
        {chapterData && (
          <div className="w-auto">
            {' '}
            {/* Adjust width as needed */}
            <NextChapterButton {...nextButtonProps} />
          </div>
        )}
        {!chapterData && <div className="w-24"></div>} {/* Spacer if no chapter data */}
      </div>

      {/* Display shared status/error message once, below the header buttons */}
      {statusMessage && (
        <p className={`text-center text-xs mb-4 ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {statusMessage}
        </p>
      )}

      {/* Overall Error Display */}
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
        <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto pb-16">
          {' '}
          {/* Reduced pb slightly */}
          {pages.map(page => (
            <div
              key={page.id}
              className="w-full bg-bg-secondary rounded-md shadow-md overflow-hidden border border-border-default"
              id={`page-${page.page_number}`}
            >
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
                <div className="w-full aspect-[2/3] bg-bg-tertiary/50 flex flex-col items-center justify-center text-red-400 p-4 border border-border-default rounded-md">
                  <ImageOff className="w-16 h-16 mb-3 text-gray-500" />
                  <p className="font-semibold text-sm text-red-300">
                    Failed to load Page {page.page_number}
                  </p>
                  {page.error && (
                    <p className="text-xs text-red-500 mt-1 text-center max-w-xs">({page.error})</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {pages.length === 0 && chapterData.total_pages > 0 && (
            <p className="text-yellow-400 italic">
              Could not load any page images for this chapter.
            </p>
          )}
          {chapterData.total_pages === 0 && (
            <p className="text-gray-500 italic">
              This chapter has no pages according to the database.
            </p>
          )}
          {/* Bottom Next Chapter Button */}
          {pages.length > 0 && (
            <div className="mt-8 text-center">
              {' '}
              {/* Center the bottom button */}
              <NextChapterButton {...nextButtonProps} />
              {/* Optionally display status message here too/instead */}
            </div>
          )}
        </div>
      )}
    </>
  );
}
