'use client';

import usePageObserver from './usePageObserver';
import { PageCounterProps } from '@/types';

export default function PageCounter({ totalPages }: PageCounterProps) {
  const currentPage = usePageObserver();

  if (!currentPage || totalPages === 0) return null;

  return (
    <div className="bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
      {currentPage} / {totalPages}
    </div>
  );
}
