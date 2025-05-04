'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';

// Keep the status type definition
type ChapterStatus = 'completed' | 'pending' | 'processing' | 'failed' | 'not_found' | 'downloading';

interface NextChapterButtonProps {
  nextChapterNumber: number;
  currentStatus: ChapterStatus;
  isLoading: boolean;
  statusMessage: string | null;
  isError: boolean;
  onClick: () => void; // Receive the handler function
}

export default function NextChapterButton({
  nextChapterNumber,
  currentStatus,
  isLoading,
  statusMessage,
  isError,
  onClick, // Use the passed onClick handler
}: NextChapterButtonProps) {

  const getButtonText = () => {
    if (isLoading) return `Processing...`;
    if (currentStatus === 'completed') return `Next Chapter (${nextChapterNumber})`;
    if (currentStatus === 'pending' || currentStatus === 'processing' || currentStatus === 'downloading') return `Processing Ch. ${nextChapterNumber}...`;
    if (currentStatus === 'failed') return `Retry Download Ch. ${nextChapterNumber}`;
    return `Download Ch. ${nextChapterNumber}`;
  };

  const getButtonIcon = () => {
    if (isLoading || currentStatus === 'pending' || currentStatus === 'processing' || currentStatus === 'downloading') return <Loader2 size={16} className="animate-spin" />;
    if (currentStatus === 'failed') return <AlertCircle size={16} />; // Indicate retry needed
    return <ArrowRight size={16} />;
  };

  // Disable button based on props
  const isDisabled = isLoading || currentStatus === 'pending' || currentStatus === 'processing' || currentStatus === 'downloading';

  return (
    // Simplified wrapper div, specific layout handled by parent
    <div>
      <button
        onClick={onClick} // Use the passed handler
        disabled={isDisabled}
        className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]
                    ${
                      isDisabled
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : currentStatus === 'completed'
                        ? 'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500'
                        : currentStatus === 'failed'
                        ? 'bg-yellow-600 text-black hover:bg-yellow-500 focus:ring-yellow-500'
                        : 'bg-green-600 text-white hover:bg-green-500 focus:ring-green-500' // Default: Download
                    }`}
      >
        {getButtonIcon()}
        {getButtonText()}
      </button>
      {/* Moved status message rendering to parent to avoid duplication */}
    </div>
  );
} 