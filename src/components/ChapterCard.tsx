'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

interface ChapterCardProps {
  chapterNumber: number;
  totalPages: number;
  processedAt: string;
  status: string;
}

export default function ChapterCard({ chapterNumber, totalPages, processedAt, status }: ChapterCardProps) {
  const formattedDate = format(new Date(processedAt), 'MMM d, yyyy');
  
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-semibold">Chapter {chapterNumber}</h3>
        <div className="flex gap-2">
          <Link 
            href={`/reader/${chapterNumber}`} 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Read
          </Link>
          <Link 
            href={`/moods/${chapterNumber}`} 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            View Moods
          </Link>
        </div>
      </div>
      <p className="text-gray-600">{totalPages} pages</p>
      <p className="text-gray-500 text-sm">Processed: {formattedDate}</p>
      <p className="text-gray-500 text-sm">Status: {status}</p>
    </div>
  );
}
