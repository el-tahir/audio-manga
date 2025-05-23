'use client';

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  RotateCw,
  DownloadCloud,
} from 'lucide-react';
import { Chapter, InputChapterStateType } from '@/types';
import { POLLING_INTERVAL } from '@/config/constants';
// Removed unused imports
// import {
//   chapterExistsInDatabase,
//   getChapterClassifications
// } from '@/services/mangaService';
// import { ClassificationResult } from '@/types';

export default function MangaClassifier() {
  const [chapterNumberInput, setChapterNumberInput] = useState<string>('');
  const [loading, setLoading] = useState(false); // For API call button state
  const [error, setError] = useState<string | null>(null);
  const [storedChapters, setStoredChapters] = useState<Chapter[]>([]);
  const [loadingStoredChapters, setLoadingStoredChapters] = useState(true);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);

  // State derived from inputChapterState
  const [inputStatus, setInputStatus] = useState<{
    message: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'none';
  }>({ message: '', type: 'none' });
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean>(true); // Default to true when input is idle
  const [submitButtonText, setSubmitButtonText] = useState<string>('Enter Chapter Number');

  // New state to manage overall input/chapter condition
  const [inputChapterState, setInputChapterState] = useState<InputChapterStateType>('idle');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Set Page Title ---
  useEffect(() => {
    document.title = 'Manga Classifier - Detective Conan';
  }, []);

  // --- Data Fetching & Polling ---
  const fetchChapters = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoadingStoredChapters(true);
    }
    try {
      const res = await fetch('/api/chapters');
      if (!res.ok) throw new Error('Failed to fetch chapters');
      const responseData = await res.json();

      // The API returns { chapters: Chapter[], pagination: {...} }
      // Extract the chapters array from the response
      const data: Chapter[] = responseData.chapters || responseData;

      data.sort((a, b) => a.chapter_number - b.chapter_number);
      setStoredChapters(data);
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

  // --- Input Handling & Validation ---
  // Effect 1: Determine the inputChapterState based on input and stored data
  useEffect(() => {
    if (!chapterNumberInput) {
      setInputChapterState('idle');
      return;
    }
    const num = parseInt(chapterNumberInput, 10);
    if (isNaN(num)) {
      setInputChapterState('invalid');
      return;
    }
    const existingChapter = storedChapters.find(c => c.chapter_number === num);
    if (existingChapter) {
      if (existingChapter.status === 'completed') {
        setInputChapterState('completed');
      } else if (existingChapter.status === 'failed') {
        setInputChapterState('failed_retryable');
      } else {
        // Includes processing, pending, etc.
        setInputChapterState('processing');
      }
    } else {
      setInputChapterState('ready_new'); // Ready to download a new chapter
    }
  }, [chapterNumberInput, storedChapters]);

  // Effect 2: Set UI states based on inputChapterState
  useEffect(() => {
    const num = chapterNumberInput;
    switch (inputChapterState) {
      case 'idle':
        setInputStatus({ message: '', type: 'none' });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Enter Chapter Number');
        break;
      case 'invalid':
        setInputStatus({ message: 'Please enter a valid number.', type: 'error' });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Invalid Input');
        break;
      case 'completed':
        setInputStatus({ message: `Chapter ${num} is already processed.`, type: 'success' });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Already Processed');
        break;
      case 'failed_retryable':
        setInputStatus({
          message: `Chapter ${num} failed previously. Ready to retry.`,
          type: 'warning',
        });
        setIsSubmitDisabled(false);
        setSubmitButtonText('Retry Chapter');
        break;
      case 'processing':
        const existing = storedChapters.find(c => c.chapter_number === parseInt(num, 10));
        setInputStatus({
          message: `Chapter ${num} is currently processing (Status: ${existing?.status || '...'}).`,
          type: 'info',
        });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Processing...');
        break;
      case 'ready_new':
      default:
        setInputStatus({ message: '', type: 'none' }); // Ready to download
        setIsSubmitDisabled(false);
        setSubmitButtonText('Download & Classify');
        break;
    }
  }, [inputChapterState, chapterNumberInput, storedChapters]); // Include dependencies used inside switch

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChapterNumberInput(e.target.value);
    setError(null);
    setProcessingMessage(null);
  };

  // --- API Call Logic ---
  const triggerDownload = async (chapterNumStr: string) => {
    setLoading(true);
    setError(null);
    setProcessingMessage(null);
    try {
      const res = await fetch(`/api/download-chapter/${chapterNumStr}`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 202) {
        setProcessingMessage(data.message || `Processing started for chapter ${chapterNumStr}`);
        await fetchChapters(); // Refresh list immediately
        setChapterNumberInput(''); // Clear input on success
      } else if (res.status === 409) {
        setError(data.message || `Chapter ${chapterNumStr} already exists or is processing.`);
      } else {
        throw new Error(data.error || `Failed to initiate download for chapter ${chapterNumStr}`);
      }
    } catch (err) {
      console.error('Error initiating download:', err);

      // Provide more helpful error messages for common issues
      let errorMessage = err instanceof Error ? err.message : 'Failed to initiate download';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterNumberInput || isSubmitDisabled || loading) return;
    triggerDownload(chapterNumberInput);
  };

  // --- UI Rendering Functions ---
  const getStatusClasses = (status: string): string => {
    if (status === 'completed') return 'text-green-400 font-medium';
    if (status === 'failed') return 'text-red-400 font-medium';
    if (status.startsWith('processing') || status === 'pending') return 'text-yellow-400';
    return 'text-gray-400'; // Default/unknown status
  };

  const renderStatus = (chapter: Chapter) => {
    const isProcessing =
      chapter.status && (chapter.status.startsWith('processing') || chapter.status === 'pending');
    return (
      <div className="flex items-center gap-2">
        {isProcessing && <Spinner size={4} />} {/* Spinner for processing states */}
        <span className={getStatusClasses(chapter.status || '')}>{chapter.status}</span>
        {chapter.status === 'failed' && (
          <button
            onClick={e => {
              e.stopPropagation(); // Prevent row click affecting other elements
              triggerDownload(String(chapter.chapter_number));
            }}
            disabled={loading}
            className="ml-2 p-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={`Retry chapter ${chapter.chapter_number}`}
          >
            <RotateCw size={16} />
          </button>
        )}
      </div>
    );
  };

  const getInputStatusIcon = (type: typeof inputStatus.type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={18} className="text-red-500" />;
      case 'info':
        return <AlertCircle size={18} className="text-blue-500" />;
      default:
        return null;
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-bg-primary text-foreground">
      <Navbar />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center text-white">
          Add New Chapter
        </h1>
        <p className="text-center text-gray-400 mb-8 text-base">
          View the status of processed Detective Conan chapters or submit a new chapter for
          processing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Chapters List Card */}
          <div className="bg-bg-secondary rounded-lg shadow-lg p-5 md:p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-border-default pb-2 text-white">
              Chapter Status Overview
            </h2>
            {loadingStoredChapters ? (
              <ChapterListSkeleton />
            ) : error && storedChapters.length === 0 ? (
              // Show error prominently if list fetching fails and no chapters are loaded
              <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-700 rounded text-red-300">
                <AlertTriangle size={20} /> {error}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-2">
                {' '}
                {/* Scrollable List */}
                {storedChapters.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    No chapters processed yet. Add one below!
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-bg-secondary z-10">
                      <tr className="border-b border-border-default">
                        <th className="text-left py-2 px-3 border-b border-border-default text-sm font-medium text-gray-400">
                          Chapter
                        </th>
                        <th className="text-left py-2 px-3 border-b border-border-default text-sm font-medium text-gray-400">
                          Pages
                        </th>
                        <th className="text-left py-2 px-3 border-b border-border-default text-sm font-medium text-gray-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {storedChapters.map(chapter => (
                        <tr
                          key={chapter.chapter_number}
                          className="border-b border-border-default hover:bg-bg-tertiary transition-colors"
                        >
                          <td className="py-2 px-3 text-white">{chapter.chapter_number}</td>
                          <td className="py-2 px-3 text-gray-300">{chapter.total_pages}</td>
                          <td className="py-2 px-3">{renderStatus(chapter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Add Chapter Card */}
          <div className="bg-bg-secondary rounded-lg shadow-lg p-5 md:p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-border-default pb-2 text-white">
              Add New Chapter
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="chapterNumber"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Chapter Number
                </label>
                <input
                  type="number"
                  id="chapterNumber"
                  value={chapterNumberInput}
                  onChange={handleInputChange}
                  placeholder="e.g., 1120"
                  className="w-full px-3 py-2 bg-bg-tertiary text-foreground rounded border border-border-default focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                {/* Input Status Message */}
                {inputStatus.type !== 'none' && (
                  <div
                    className={`flex items-center gap-2 mt-2 text-sm ${
                      inputStatus.type === 'success'
                        ? 'text-green-500'
                        : inputStatus.type === 'warning'
                          ? 'text-yellow-500'
                          : inputStatus.type === 'error'
                            ? 'text-red-500'
                            : inputStatus.type === 'info'
                              ? 'text-blue-500'
                              : ''
                    }`}
                  >
                    {getInputStatusIcon(inputStatus.type)}
                    <span>{inputStatus.message}</span>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitDisabled || loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner size={4} />
                    Processing...
                  </>
                ) : (
                  <>
                    <DownloadCloud size={18} />
                    {submitButtonText}
                  </>
                )}
              </button>
            </form>

            {/* Feedback Messages */}
            {processingMessage && <GlobalFeedback type="success" message={processingMessage} />}
            {error && <GlobalFeedback type="error" message={error} />}
          </div>
        </div>
      </main>
    </div>
  );
}

const Spinner = ({ size = 4 }: { size?: number }) => (
  <div
    className={`animate-spin rounded-full h-${size} w-${size} border-2 border-current border-t-transparent`}
  ></div>
);

const ChapterListSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex justify-between items-center py-2 px-3">
        <div className="h-4 bg-gray-700 rounded w-12"></div>
        <div className="h-4 bg-gray-700 rounded w-8"></div>
        <div className="h-4 bg-gray-700 rounded w-20"></div>
      </div>
    ))}
  </div>
);

const GlobalFeedback = ({ type, message }: { type: 'error' | 'success'; message: string }) => {
  const bgColor =
    type === 'success'
      ? 'bg-green-900/30 border-green-700 text-green-300'
      : 'bg-red-900/30 border-red-700 text-red-300';
  const icon = type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />;

  return (
    <div className={`flex items-center gap-2 p-3 mt-4 rounded border text-sm ${bgColor}`}>
      {icon}
      <span>{message}</span>
    </div>
  );
};
