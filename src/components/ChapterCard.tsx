'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

interface ChapterCardProps {
  id: number;
  chapterNumber: number;
  totalPages: number;
  processedAt: string;
}

export default function ChapterCard({ id, chapterNumber, totalPages, processedAt }: ChapterCardProps) {
  const formattedDate = format(new Date(processedAt), 'MMM d, yyyy');
  
  return (
    <Link href={`/reader/${id}`} className="block">
      <div className="border rounded-lg p-4 hover:bg-gray-100 transition cursor-pointer">
        <h3 className="text-xl font-semibold">Chapter {chapterNumber}</h3>
        <p className="text-gray-600">{totalPages} pages</p>
        <p className="text-gray-500 text-sm">Processed: {formattedDate}</p>
      </div>
    </Link>
  );
}
