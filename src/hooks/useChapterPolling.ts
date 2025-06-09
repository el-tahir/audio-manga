import { useState, useEffect, useRef } from 'react';
import { Chapter } from '@/types';
import { POLLING_INTERVAL } from '@/config/constants';

/**
 * Custom hook for polling chapter data from the API
 * @returns Object containing chapters, loading state, error state, and refresh function
 */
export function useChapterPolling() {
  const [storedChapters, setStoredChapters] = useState<Chapter[]>([]);
  const [loadingStoredChapters, setLoadingStoredChapters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChapters = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoadingStoredChapters(true);
    }
    try {
      const res = await fetch('/api/chapters');
      if (!res.ok) throw new Error('Failed to fetch chapters');
      const responseData = await res.json();

      const data: Chapter[] = responseData.chapters || responseData;
      data.sort((a, b) => a.chapter_number - b.chapter_number);
      setStoredChapters(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching chapters:', err);
      setError('Could not load chapter list. Auto-refresh disabled.');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    } finally {
      if (isInitialLoad) {
        setLoadingStoredChapters(false);
      }
    }
  };

  useEffect(() => {
    fetchChapters(true);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(fetchChapters, POLLING_INTERVAL);
    
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  return {
    storedChapters,
    loadingStoredChapters,
    error,
    refreshChapters: fetchChapters,
  };
}