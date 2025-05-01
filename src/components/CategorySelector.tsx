import { useState } from 'react';

const CATEGORIES = [
  'intro',
  'love',
  'love_ran',
  'casual',
  'adventure',
  'comedy',
  'action_casual',
  'action_serious',
  'tragic',
  'tension',
  'confrontation',
  'investigation',
  'revelation',
  'conclusion'
] as const;

interface CategorySelectorProps {
  chapterNumber: number;
  pageNumber: number;
  currentCategory: string;
  onCategoryChange: (newCategory: string) => void;
}

export default function CategorySelector({ 
  chapterNumber, 
  pageNumber, 
  currentCategory,
  onCategoryChange 
}: CategorySelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCategoryChange = async (newCategory: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/chapters/${chapterNumber}/classifications/${pageNumber}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: newCategory })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update category');
      }
      onCategoryChange(newCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
      console.error('Error updating category:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <select
        value={currentCategory}
        onChange={(e) => handleCategoryChange(e.target.value)}
        disabled={isLoading}
        className="w-full px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--foreground)] rounded border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {CATEGORIES.map((category) => (
          <option key={category} value={category} className="text-black bg-white">
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </option>
        ))}
      </select>
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  );
} 