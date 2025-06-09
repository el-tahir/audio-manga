import { useState } from 'react';

/**
 * Custom hook for managing chapter download operations
 * @param onSuccess - Callback function called when download succeeds
 * @returns Object containing download state and trigger function
 */
export function useChapterDownload(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);

  const triggerDownload = async (chapterNumStr: string) => {
    setLoading(true);
    setError(null);
    setProcessingMessage(null);
    
    try {
      const res = await fetch(`/api/download-chapter/${chapterNumStr}`, { method: 'POST' });
      const data = await res.json();
      
      if (res.status === 202) {
        setProcessingMessage(data.message || `Processing started for chapter ${chapterNumStr}`);
        onSuccess?.();
      } else if (res.status === 409) {
        setError(data.message || `Chapter ${chapterNumStr} already exists or is processing.`);
      } else {
        throw new Error(data.error || `Failed to initiate download for chapter ${chapterNumStr}`);
      }
    } catch (err) {
      console.error('Error initiating download:', err);

      let errorMessage = err instanceof Error ? err.message : 'Failed to initiate download';

      // Provide helpful error messages for common issues
      if (
        errorMessage.includes('500 Internal Server Error') ||
        errorMessage.includes('Cubari API is currently experiencing issues')
      ) {
        errorMessage = `⚠️ Manga source (Cubari) is temporarily unavailable. This is a known issue with their servers. Please try again in a few minutes.`;
      } else if (errorMessage.includes('Failed to fetch series data')) {
        errorMessage = `📡 Unable to connect to manga source. Please check your internet connection and try again.`;
      } else if (errorMessage.includes('Chapter') && errorMessage.includes('not found')) {
        errorMessage = `📚 Chapter ${chapterNumStr} was not found in the source. Please verify the chapter number is correct.`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setProcessingMessage(null);
  };

  return {
    loading,
    error,
    processingMessage,
    triggerDownload,
    clearMessages,
  };
}