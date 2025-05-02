'use client';

import { useEffect, useState } from 'react';
import { ClassificationResult } from '@/types';
import usePageObserver from './usePageObserver';

interface ClassificationBubbleProps {
  classifications: ClassificationResult[];
}

export default function ClassificationBubble({ classifications }: ClassificationBubbleProps) {
  const currentPage = usePageObserver();
  const [currentCategory, setCurrentCategory] = useState<ClassificationResult['category'] | null>(null);
  
  useEffect(() => {
    // Find classification for the current page
    const classification = classifications.find(c => {
      if ('page_number' in c && (c as any).page_number === currentPage) {
        return true;
      }
      const filePageMatch = c.filename.match(/page_(\d+)/i);
      return filePageMatch && parseInt(filePageMatch[1], 10) === currentPage;
    });
    setCurrentCategory(classification ? classification.category : null);
  }, [currentPage, classifications]);
  
  // Don't render if no category is available
  if (!currentCategory) return null;
  
  // Get color and text color based on category
  const getCategoryStyle = (category: ClassificationResult['category']) => {
    switch (category) {
      case 'intro':              return { bg: '#3498db', text: 'white' }; // Blue
      case 'love':               return { bg: '#e84393', text: 'white' }; // Pink
      case 'love_ran':           return { bg: '#ff69b4', text: 'white' }; // Hot Pink
      case 'casual':             return { bg: '#00b894', text: 'white' }; // Mint
      case 'adventure':          return { bg: '#1abc9c', text: 'white' }; // Turquoise
      case 'comedy':             return { bg: '#f1c40f', text: 'black' }; // Yellow
      case 'action_casual':      return { bg: '#e74c3c', text: 'white' }; // Red
      case 'action_serious':     return { bg: '#c0392b', text: 'white' }; // Dark Red
      case 'tragic':             return { bg: '#34495e', text: 'white' }; // Dark Gray-Blue
      case 'tension':            return { bg: '#8e44ad', text: 'white' }; // Dark Purple
      case 'confrontation':      return { bg: '#d35400', text: 'white' }; // Pumpkin Orange
      case 'investigation':      return { bg: '#2980b9', text: 'white' }; // Darker Blue
      case 'revelation':         return { bg: '#16a085', text: 'white' }; // Teal
      case 'conclusion':         return { bg: '#27ae60', text: 'white' }; // Dark Green

      // Default fallback style
      default:                   return { bg: '#7f8c8d', text: 'white' }; // Medium Gray as default
    }
  };
  
  const colors = getCategoryStyle(currentCategory);
  
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
