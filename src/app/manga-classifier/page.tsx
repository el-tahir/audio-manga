"use client";

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  CheckCircle2, // Success icon
  AlertCircle,  // Info icon
  AlertTriangle, // Warning icon
  XCircle,       // Error icon
  RotateCw,     // Retry icon
  DownloadCloud // Download icon
} from 'lucide-react';
// Removed unused imports
// import { 
//   chapterExistsInDatabase,
//   getChapterClassifications
// } from '@/services/mangaService';
// import { ClassificationResult } from '@/types';

// Define Chapter type for clarity
interface Chapter {
  chapter_number: number;
  status: string;
  // Add other potential fields if needed from your API response
}

const POLLING_INTERVAL = 5000; // Poll every 5 seconds

export default function MangaClassifier() {
  const [chapterNumberInput, setChapterNumberInput] = useState<string>("");
  const [loading, setLoading] = useState(false); // For API call button state
  const [error, setError] = useState<string | null>(null);
  const [storedChapters, setStoredChapters] = useState<Chapter[]>([]);
  const [loadingStoredChapters, setLoadingStoredChapters] = useState(true);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  
  const [inputStatus, setInputStatus] = useState<{ message: string; type: 'info' | 'warning' | 'error' | 'success' | 'none' }>({ message: '', type: 'none' });
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean>(false);
  const [submitButtonText, setSubmitButtonText] = useState<string>('Download & Classify');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Data Fetching & Polling ---
  const fetchChapters = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoadingStoredChapters(true);
    }
    try {
      const res = await fetch('/api/chapters');
      if (!res.ok) throw new Error('Failed to fetch chapters');
      const data: Chapter[] = await res.json();
      data.sort((a, b) => a.chapter_number - b.chapter_number);
      setStoredChapters(data);
      // Clear global error if fetch succeeds after failing previously
      // setError(null); 
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
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  // --- Input Handling & Validation ---
  useEffect(() => {
    if (!chapterNumberInput) {
      setInputStatus({ message: '', type: 'none' });
      setIsSubmitDisabled(false);
      setSubmitButtonText('Download & Classify');
      return;
    }
    const num = parseInt(chapterNumberInput, 10);
    if (isNaN(num)) {
      setInputStatus({ message: 'Please enter a valid number.', type: 'error' });
      setIsSubmitDisabled(true);
      setSubmitButtonText('Download & Classify');
      return;
    }
    const existingChapter = storedChapters.find(c => c.chapter_number === num);
    if (existingChapter) {
      if (existingChapter.status === 'completed') {
        setInputStatus({ message: `Chapter ${num} is already processed.`, type: 'success' });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Already Processed');
      } else if (existingChapter.status === 'failed') {
        setInputStatus({ message: `Chapter ${num} failed previously. Ready to retry.`, type: 'warning' });
        setIsSubmitDisabled(false);
        setSubmitButtonText('Retry Chapter');
      } else {
        setInputStatus({ message: `Chapter ${num} is currently processing (Status: ${existingChapter.status}).`, type: 'info' });
        setIsSubmitDisabled(true);
        setSubmitButtonText('Processing...');
      }
    } else {
      setInputStatus({ message: '', type: 'none' }); // Ready to download
      setIsSubmitDisabled(false);
      setSubmitButtonText('Download & Classify');
    }
  }, [chapterNumberInput, storedChapters]);

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
        setChapterNumberInput(""); // Clear input on success
      } else if (res.status === 409) {
        setError(data.message || `Chapter ${chapterNumStr} already exists or is processing.`);
      } else {
        throw new Error(data.error || `Failed to initiate download for chapter ${chapterNumStr}`);
      }
    } catch (err) {
      console.error('Error initiating download:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate download');
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
    const isProcessing = chapter.status.startsWith('processing') || chapter.status === 'pending';
    return (
      <div className="flex items-center gap-2">
        {isProcessing && <Spinner size={4} />} {/* Use Tailwind size */} 
        <span className={getStatusClasses(chapter.status)}>{chapter.status}</span>
        {chapter.status === 'failed' && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); // Prevent row click 
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
      case 'success': return <CheckCircle2 size={18} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'error': return <XCircle size={18} className="text-red-500" />;
      case 'info': return <AlertCircle size={18} className="text-blue-500" />;
      default: return null;
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--foreground)]">
      <Navbar />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">Manga Classifier</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">

          {/* Chapters List Card */} 
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-lg p-5 md:p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-[var(--border-color)] pb-2 text-white">Chapters in Database</h2>
            {loadingStoredChapters ? (
              <ChapterListSkeleton /> // Use Skeleton Loader
            ) : error && storedChapters.length === 0 ? (
               // Show error prominently if list fails AND is empty
              <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-700 rounded text-red-300">
                <AlertTriangle size={20} /> {error}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-2"> {/* Scrollable List */} 
                {storedChapters.length === 0 ? (
                   <p className="text-gray-500 italic text-center py-4">No chapters found.</p>
                ) : (
                   <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                         <tr className="border-b border-[var(--border-color)]">
                           <th className="text-left py-2 px-3 border-b border-[var(--border-color)] text-sm font-medium text-gray-400">Chapter</th>
                           <th className="text-left py-2 px-3 border-b border-[var(--border-color)] text-sm font-medium text-gray-400">Status</th>
                         </tr>
                      </thead>
                      <tbody>
                         {storedChapters.map((chap) => (
                           <tr 
                              key={chap.chapter_number}
                              className={`border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 cursor-pointer transition-colors ${chap.status === 'completed' ? 'opacity-70' : ''}`}
                              onClick={() => setChapterNumberInput(String(chap.chapter_number))}
                              title={`Click to load chapter ${chap.chapter_number}`}
                           >
                             <td className="py-2.5 px-3 text-sm">{chap.chapter_number}</td>
                             <td className="py-2.5 px-3 text-sm">{renderStatus(chap)}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                 )}
              </div>
            )}
            {/* Show polling error discreetly if list is already populated */}
            {error && storedChapters.length > 0 && (
                 <p className="text-xs text-red-400 mt-3 text-center">{error}</p>
            )}
          </div>

          {/* Download Form Card */} 
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-lg p-5 md:p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Download New Chapter</h2>
            <p className="text-sm text-gray-400 mb-5">
              Enter a Detective Conan chapter number to download and classify its pages.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="chapter-input" className="block text-sm font-medium text-gray-400 mb-1">Chapter Number</label>
                <input
                  id="chapter-input"
                  type="number" 
                  value={chapterNumberInput}
                  onChange={handleInputChange}
                  placeholder="e.g., 1120"
                  className={`w-full px-3 py-2 bg-[var(--bg-tertiary)] border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${ 
                    inputStatus.type === 'error' ? 'border-red-500' : 
                    inputStatus.type === 'warning' ? 'border-yellow-500' : 
                    inputStatus.type === 'success' ? 'border-green-500' : 'border-[var(--border-color)]' 
                  }`}
                />
                {/* Input Status Message Area */} 
                <div className="flex items-center gap-2 mt-1.5 min-h-[20px] text-xs">
                  {getInputStatusIcon(inputStatus.type)}
                  <span className={
                    inputStatus.type === 'error' ? 'text-red-400' : 
                    inputStatus.type === 'warning' ? 'text-yellow-400' : 
                    inputStatus.type === 'success' ? 'text-green-400' : 
                    inputStatus.type === 'info' ? 'text-blue-400' : 'text-gray-500'
                  }>
                    {inputStatus.message || '\u00A0'} {/* Use non-breaking space to maintain height */} 
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isSubmitDisabled || !chapterNumberInput}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <Spinner size={5} />
                ) : submitButtonText === 'Retry Chapter' ? (
                  <RotateCw size={18} />
                ) : (
                  <DownloadCloud size={18} />
                )}
                {loading ? 'Processing...' : submitButtonText}
              </button>
            </form>
          </div>
        </div>

        {/* Global Feedback Area */} 
        <div className="mt-8 space-y-4">
          {error && storedChapters.length > 0 && ( // Only show global fetch error if list is loaded
            <GlobalFeedback type="error" message={error} />
          )}
          {processingMessage && (
            <GlobalFeedback type="success" message={processingMessage} />
          )}
        </div>
      </main>
    </div>
  );
}

// --- Helper Components ---

// Spinner Component (Tailwind based)
const Spinner = ({ size = 4 }: { size?: number }) => (
  <div className={`animate-spin rounded-full border-2 border-current border-t-transparent h-${size} w-${size}`}></div>
);

// Skeleton Loader for Chapter List
const ChapterListSkeleton = () => (
  <div className="space-y-2.5 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex justify-between items-center p-2.5 bg-[var(--bg-tertiary)]/50 rounded">
        <div className="h-4 bg-[var(--bg-quaternary)] rounded w-1/4"></div>
        <div className="h-4 bg-[var(--bg-quaternary)] rounded w-1/3"></div>
      </div>
    ))}
  </div>
);

// Global Feedback Alert Component
const GlobalFeedback = ({ type, message }: { type: 'error' | 'success', message: string }) => {
  const baseClasses = "flex items-center gap-3 p-3 rounded-md text-sm";
  const typeClasses = type === 'error' 
    ? "bg-red-900/30 border border-red-700 text-red-300"
    : "bg-green-900/30 border border-green-700 text-green-300";
  const Icon = type === 'error' ? AlertTriangle : CheckCircle2;
  
  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <Icon size={18} />
      <span>{message}</span>
    </div>
  );
}; 
