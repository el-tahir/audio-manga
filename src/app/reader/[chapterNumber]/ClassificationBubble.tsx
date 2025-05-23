'use client';

import { useEffect, useState } from 'react';
import { ClassificationResult, ClassificationBubbleProps } from '@/types';
import { getMoodCategoryStyle } from '@/config/constants';
import usePageObserver from './usePageObserver';

export default function ClassificationBubble({ classifications }: ClassificationBubbleProps) {
  const currentPage = usePageObserver();
  const [currentCategory, setCurrentCategory] = useState<ClassificationResult['category'] | null>(
    null
  );

  useEffect(() => {
    // Find classification for the current page
    const classification = classifications.find(c => {
      if (
        'page_number' in c &&
        (c as ClassificationResult & { page_number: number }).page_number === currentPage
      ) {
        return true;
      }
      const filePageMatch = c.filename.match(/page_(\d+)/i);
      return filePageMatch && parseInt(filePageMatch[1], 10) === currentPage;
    });
    setCurrentCategory(classification ? classification.category : null);
  }, [currentPage, classifications]);

  // Don't render if no category is available
  if (!currentCategory) return null;

  // Get colors from centralized style function
  const colors = getMoodCategoryStyle(currentCategory);

  return (
    <div
      className="fixed bottom-16 right-6 px-4 py-2 rounded-full shadow-lg font-medium capitalize"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {currentCategory}
    </div>
  );
}
