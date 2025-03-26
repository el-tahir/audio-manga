'use client';

import { useEffect, useState } from 'react';

interface PageCounterProps {
  totalPages: number;
}

export default function PageCounter({ totalPages }: PageCounterProps) {
  const [currentPage, setCurrentPage] = useState(1);
  
  useEffect(() => {
    // Set up intersection observer to detect which page is in view
    const observerOptions = {
      root: null, // Use viewport as root
      rootMargin: '0px',
      threshold: 0.5 // Element is considered in view when 50% visible
    };
    
    const pageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Extract page number from the element ID (format: page-X)
          const pageId = entry.target.id;
          const pageNum = parseInt(pageId.split('-')[1]);
          setCurrentPage(pageNum);
        }
      });
    }, observerOptions);
    
    // Observe all page elements
    document.querySelectorAll('[id^="page-"]').forEach(page => {
      pageObserver.observe(page);
    });
    
    return () => {
      pageObserver.disconnect();
    };
  }, [totalPages]);
  
  return (
    <div className="fixed bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full shadow-lg font-medium">
      <span>
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
