'use client';

import { useEffect, useState } from 'react';

interface Classification {
  page_number: number;
  category: 'investigation' | 'suspense' | 'action' | 'revelation' | 'conclusion' | 'casual' | 'tragic';
}

interface ClassificationBubbleProps {
  classifications: Classification[];
}

export default function ClassificationBubble({ classifications }: ClassificationBubbleProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentCategory, setCurrentCategory] = useState<Classification['category'] | null>(null);
  
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
          
          // Find classification for the current page
          const classification = classifications.find(c => c.page_number === pageNum);
          setCurrentCategory(classification ? classification.category : null);
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
  }, [classifications]);
  
  // Don't render if no category is available
  if (!currentCategory) return null;
  
  // Get color and text color based on category
  const getCategoryColor = (category: string): { bg: string, text: string } => {
    switch (category) {
      case 'investigation': return { bg: '#3498db', text: 'white' }; // blue
      case 'suspense': return { bg: '#9b59b6', text: 'white' };      // purple
      case 'action': return { bg: '#e74c3c', text: 'white' };        // red
      case 'revelation': return { bg: '#2ecc71', text: 'white' };    // green
      case 'conclusion': return { bg: '#f39c12', text: 'white' };    // orange
      case 'casual': return { bg: '#1abc9c', text: 'white' };        // turquoise
      case 'tragic': return { bg: '#34495e', text: 'white' };        // dark gray
      default: return { bg: '#95a5a6', text: 'white' };              // light gray
    }
  };
  
  const colors = getCategoryColor(currentCategory);
  
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
