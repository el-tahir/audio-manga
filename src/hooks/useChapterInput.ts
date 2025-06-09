import { useState, useEffect } from 'react';
import { Chapter, InputChapterStateType } from '@/types';

interface InputStatus {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'none';
}

/**
 * Custom hook for managing chapter input validation and state
 * @param storedChapters - Array of existing chapters
 * @returns Object containing input state, validation states, and input handler
 */
export function useChapterInput(storedChapters: Chapter[]) {
  const [chapterNumberInput, setChapterNumberInput] = useState<string>('');
  const [inputChapterState, setInputChapterState] = useState<InputChapterStateType>('idle');
  const [inputStatus, setInputStatus] = useState<InputStatus>({ message: '', type: 'none' });
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean>(true);
  const [submitButtonText, setSubmitButtonText] = useState<string>('Enter Chapter Number');

  // Determine input state based on input and stored data
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
        setInputChapterState('processing');
      }
    } else {
      setInputChapterState('ready_new');
    }
  }, [chapterNumberInput, storedChapters]);

  // Set UI states based on inputChapterState
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
        setInputStatus({ message: '', type: 'none' });
        setIsSubmitDisabled(false);
        setSubmitButtonText('Download & Classify');
        break;
    }
  }, [inputChapterState, chapterNumberInput, storedChapters]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChapterNumberInput(e.target.value);
  };

  const clearInput = () => {
    setChapterNumberInput('');
  };

  return {
    chapterNumberInput,
    inputChapterState,
    inputStatus,
    isSubmitDisabled,
    submitButtonText,
    handleInputChange,
    clearInput,
  };
}