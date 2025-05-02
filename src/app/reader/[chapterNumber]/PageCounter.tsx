'use client';

import { useEffect, useState } from 'react';
import usePageObserver from './usePageObserver';

interface PageCounterProps {
  totalPages: number;
}

export default function PageCounter({ totalPages }: PageCounterProps) {
  const currentPage = usePageObserver();
  
  return (
    <div className="fixed bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full shadow-lg font-medium">
      <span>
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
