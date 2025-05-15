'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { BookOpen, Edit } from 'lucide-react';

interface ChapterCardProps {
  chapterNumber: number;
  totalPages: number;
  processedAt: string;
  status: string;
}

export default function ChapterCard({ chapterNumber, totalPages, processedAt, status }: ChapterCardProps) {
  let formattedDate = 'N/A';
  if (processedAt) {
    try {
      formattedDate = format(parseISO(processedAt), 'MMM d, yyyy');
    } catch (e) {
      console.error("Error formatting date:", processedAt, e);
    }
  }

  const getStatusClasses = (status: string): string => {
    if (status === 'completed') return 'text-green-400';
    if (status === 'failed') return 'text-red-400';
    if (status.startsWith('processing') || status === 'pending') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md p-4 border border-[var(--border-color)] flex flex-col justify-between transition-transform hover:scale-[1.02] hover:shadow-lg">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-white">Chapter {chapterNumber}</h3>
        <p className="text-sm text-gray-400 mb-1">{totalPages > 0 ? `${totalPages} pages` : 'No pages'}</p>
        <p className="text-sm text-gray-400 mb-1">Processed: {formattedDate}</p>
        <p className="text-sm text-gray-400">
          Status: <span className={`font-medium ${getStatusClasses(status)}`}>{status}</span>
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-auto pt-3 border-t border-[var(--border-color)]">
        <Link 
          href={`/reader/${chapterNumber}`} 
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
          aria-disabled={status !== 'completed'}
          onClick={(e) => { if (status !== 'completed') e.preventDefault(); }}
        >
          <BookOpen size={16} />
          Read
        </Link>
        <Link 
          href={`/moods/${chapterNumber}`} 
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-500 transition-colors disabled:opacity-50"
          aria-disabled={status !== 'completed'}
          onClick={(e) => { if (status !== 'completed') e.preventDefault(); }}
        >
          <Edit size={16} />
          View Moods
        </Link>
      </div>
    </div>
  );
}
