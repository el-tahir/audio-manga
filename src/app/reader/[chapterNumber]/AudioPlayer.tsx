'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import usePageObserver from './usePageObserver';
import { Settings, X } from 'lucide-react'; // Add icons
import { Classification, AudioPlayerProps } from '@/types';

export default function AudioPlayer({ classifications }: AudioPlayerProps) {
  const currentPage = usePageObserver();
  const [currentMood, setCurrentMood] = useState<Classification['category'] | null>(null);
  const [previousMood, setPreviousMood] = useState<Classification['category'] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false); // Track if at least one audio element has a source and is ready

  // Configurable settings with defaults
  const [fadeOutMs, setFadeOutMs] = useState<number>(0);
  const [fadeInMs, setFadeInMs] = useState<number>(0);
  const [targetVolume, setTargetVolume] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Use two audio elements for cross-fading
  const audioRef1 = useRef<HTMLAudioElement | null>(null);
  const audioRef2 = useRef<HTMLAudioElement | null>(null);
  const [activeAudioRef, setActiveAudioRef] =
    useState<React.RefObject<HTMLAudioElement | null>>(audioRef1);
  const [inactiveAudioRef, setInactiveAudioRef] =
    useState<React.RefObject<HTMLAudioElement | null>>(audioRef2);

  // Ref to track if a transition is currently in progress to prevent overlaps
  const isTransitioningRef = useRef(false);

  // --- Persistence ---
  useEffect(() => {
    // Load settings from localStorage on mount
    const savedFadeOut = localStorage.getItem('audioFadeOutMs');
    const savedFadeIn = localStorage.getItem('audioFadeInMs');
    const savedVolume = localStorage.getItem('audioTargetVolume');

    if (savedFadeOut) setFadeOutMs(parseInt(savedFadeOut, 10));
    if (savedFadeIn) setFadeInMs(parseInt(savedFadeIn, 10));
    if (savedVolume) setTargetVolume(parseFloat(savedVolume));

    // Initialize Audio Elements
    audioRef1.current = new Audio();
    audioRef2.current = new Audio();
    audioRef1.current.preload = 'auto';
    audioRef2.current.preload = 'auto';
    audioRef1.current.loop = false;
    audioRef2.current.loop = false;

    return () => {
      // Cleanup on unmount
      if (audioRef1.current) {
        audioRef1.current.pause();
        audioRef1.current.src = '';
        audioRef1.current.load();
      }
      if (audioRef2.current) {
        audioRef2.current.pause();
        audioRef2.current.src = '';
        audioRef2.current.load();
      }
    };
  }, []); // Empty dependency array - this should only run once on mount

  // Save settings to localStorage when they change
  const handleSettingChange = <T extends number>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: string,
    value: string
  ) => {
    const numericValue = key === 'audioTargetVolume' ? parseFloat(value) : parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setter(numericValue as T);
      localStorage.setItem(key, value);
    }
  };

  // --- Audio Utility Functions ---

  /**
   * Sets a random start position for the audio to create variety.
   * @param audioElement - The audio element to set the position for
   */
  const setRandomStartPosition = (audioElement: HTMLAudioElement | null) => {
    if (!audioElement) return;

    const duration = audioElement.duration;
    if (isFinite(duration) && duration > 5) {
      const minPosition = duration * 0.1;
      const maxPosition = duration * 0.8;
      const randomPosition = minPosition + Math.random() * (maxPosition - minPosition);
      audioElement.currentTime = randomPosition;
    } else {
      audioElement.currentTime = 0;
    }
  };

  // Get random audio file from a mood directory
  const getRandomAudioForMood = async (mood: Classification['category']): Promise<string> => {
    try {
      const response = await fetch(`/api/audio/random?mood=${encodeURIComponent(mood)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('[AudioPlayer] Error fetching audio URL:', error);
      return ''; // Return empty string on error
    }
  };

  /**
   * Cleans up an HTMLAudioElement by pausing it, resetting its source and state,
   * and removing event listeners.
   * @param {HTMLAudioElement | null} audioElement - The audio element to clean up.
   */
  const cleanupAudio = useCallback(
    (audioElement: HTMLAudioElement | null) => {
      if (audioElement) {
        audioElement.pause();
        if (audioElement.src && audioElement.src !== window.location.href) {
          // Revoke object URL if necessary, or simply reset src
          // In this case, we assume URLs don't need revoking, just resetting.
          audioElement.src = '';
        }
        audioElement.removeAttribute('src'); // Ensure src attribute is removed
        audioElement.load(); // Abort current network request and reset
        audioElement.currentTime = 0;
        audioElement.volume = targetVolume; // Reset volume
        // Remove potentially attached listeners - using function references that will be stable
        audioElement.removeEventListener('loadedmetadata', () => {});
        audioElement.removeEventListener('ended', () => {});
        audioElement.removeEventListener('error', () => {});
      }
    },
    [targetVolume]
  );

  /**
   * Gradually fades out an audio element over a specified duration.
   * @param {HTMLAudioElement | null} audioElement - The audio element to fade out.
   * @param {number} [duration=fadeOutMs] - The duration of the fade-out in milliseconds.
   * @returns {Promise<void>} A promise that resolves when the fade-out is complete.
   */
  const fadeOut = useCallback(
    (audioElement: HTMLAudioElement | null, duration: number = fadeOutMs): Promise<void> => {
      return new Promise(resolve => {
        if (!audioElement || audioElement.volume === 0 || duration <= 0) {
          if (audioElement) audioElement.pause();
          resolve();
          return;
        }

        const startVolume = audioElement.volume;
        const fadeInterval = 20; // ms
        const steps = duration / fadeInterval;
        const volumeStep = startVolume / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
          currentStep++;
          const newVolume = Math.max(0, startVolume - volumeStep * currentStep);
          audioElement.volume = newVolume;

          if (newVolume <= 0 || currentStep >= steps) {
            audioElement.volume = 0;
            audioElement.pause();
            clearInterval(interval);
            resolve();
          }
        }, fadeInterval);
      });
    },
    [fadeOutMs]
  );

  /**
   * Gradually fades in an audio element to the target volume over a specified duration.
   * @param {HTMLAudioElement | null} audioElement - The audio element to fade in.
   * @param {number} [duration=fadeInMs] - The duration of the fade-in in milliseconds.
   * @returns {Promise<void>} A promise that resolves when the fade-in is complete.
   */
  const fadeIn = useCallback(
    (audioElement: HTMLAudioElement | null, duration: number = fadeInMs): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!audioElement || !audioElement.src) {
          reject(new Error('Audio element or source not available for fade in.'));
          return;
        }

        const effectiveTargetVolume = Math.max(0, Math.min(1, targetVolume));
        audioElement.volume = 0;

        // Attempt to play, handle potential interruptions
        audioElement
          .play()
          .then(() => {
            if (duration <= 0 || effectiveTargetVolume === 0) {
              audioElement.volume = effectiveTargetVolume;
              resolve();
              return;
            }

            const fadeInterval = 20; // ms
            const steps = duration / fadeInterval;
            const volumeStep = effectiveTargetVolume / steps;
            let currentStep = 0;

            const interval = setInterval(() => {
              currentStep++;
              const newVolume = Math.min(effectiveTargetVolume, volumeStep * currentStep);
              audioElement.volume = newVolume;

              if (newVolume >= effectiveTargetVolume || currentStep >= steps) {
                audioElement.volume = effectiveTargetVolume; // Ensure target is reached
                clearInterval(interval);
                resolve();
              }
            }, fadeInterval);
          })
          .catch(error => {
            console.error('[AudioPlayer] Fade-in play error:', error);
            resolve(); // Resolve anyway to let the flow continue, error is logged.
          });
      });
    },
    [fadeInMs, targetVolume]
  );

  // --- Event Handlers ---

  const handleTrackEnd = useCallback(() => {
    setIsPlaying(false); // Mark as not playing
    // Cleanup will be handled by the main effect if mood remains the same or changes.
  }, []);

  const handleAudioError = useCallback(
    (event: Event) => {
      const audioElement = event.target as HTMLAudioElement;
      console.error('[AudioPlayer] Audio playback error:', audioElement.error);
      setIsPlaying(false);
      cleanupAudio(audioElement);
      // Maybe attempt to load a different track? Or just stop.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // --- Core Logic Effect ---
  useEffect(() => {
    const classification = classifications.find(c => c.page_number === currentPage);
    const newMood = classification ? classification.category : null;
    if (newMood !== currentMood) {
      setPreviousMood(currentMood);
      setCurrentMood(newMood);
    }
  }, [currentPage, classifications, currentMood]);

  // Main effect to handle mood changes and track ending
  useEffect(() => {
    const activeAudio = activeAudioRef.current;
    const inactiveAudio = inactiveAudioRef.current;

    if (!activeAudio || !inactiveAudio || isTransitioningRef.current) {
      return; // Exit if audio elements not ready or transition in progress
    }

    const shouldChangeTrack = currentMood !== previousMood;
    const activeTrackEnded =
      activeAudio.ended || (activeAudio.paused && activeAudio.currentTime === 0 && isPlaying); // Consider ended or paused at start as 'ended'

    if (!currentMood) {
      // If there's no current mood, fade out and clean up everything
      if (isPlaying) {
        isTransitioningRef.current = true;
        fadeOut(activeAudio, fadeOutMs).finally(() => {
          cleanupAudio(activeAudio);
          cleanupAudio(inactiveAudio); // Ensure both are clean
          setIsPlaying(false);
          setPreviousMood(null);
          setIsAudioReady(false);
          isTransitioningRef.current = false;
        });
      } else {
        // Ensure cleanup even if not playing
        cleanupAudio(activeAudio);
        cleanupAudio(inactiveAudio);
        setPreviousMood(null);
        setIsAudioReady(false);
      }
      return;
    }

    // Decision logic: Change track if mood changed OR if active track ended and mood is the same
    if (shouldChangeTrack || (activeTrackEnded && !shouldChangeTrack)) {
      if (isTransitioningRef.current) {
        return;
      }
      isTransitioningRef.current = true;

      // Prepare the inactive audio element for the new track
      cleanupAudio(inactiveAudio);

      // Get the audio URL for the *current* mood
      getRandomAudioForMood(currentMood)
        .then(audioPath => {
          if (!audioPath) {
            console.error('[AudioPlayer] No audio path received for mood:', currentMood);
            isTransitioningRef.current = false;
            return; // Stop if we couldn't get a URL
          }

          inactiveAudio.src = audioPath;
          inactiveAudio.preload = 'auto'; // Ensure preload is set
          inactiveAudio.loop = false;

          // Attach listeners TO THE INACTIVE ELEMENT which will become active
          const metadataHandler = () => {
            setRandomStartPosition(inactiveAudio);
            // Now ready to perform the fade/cross-fade

            const fadeOutPromise = isPlaying ? fadeOut(activeAudio, fadeOutMs) : Promise.resolve();

            fadeOutPromise
              .then(() => {
                cleanupAudio(activeAudio); // Clean up old active one AFTER fade out
                return fadeIn(inactiveAudio, fadeInMs);
              })
              .then(() => {
                // Switch roles
                setActiveAudioRef(inactiveAudioRef);
                setInactiveAudioRef(activeAudioRef);
                setIsPlaying(true); // Mark as playing
                setPreviousMood(currentMood); // Update previous mood *after* successful transition
                setIsAudioReady(true);
              })
              .catch(error => {
                console.error('[AudioPlayer] Error during audio transition:', error);
                cleanupAudio(inactiveAudio); // Clean up the element that failed
                setIsPlaying(false);
                setIsAudioReady(false);
              })
              .finally(() => {
                isTransitioningRef.current = false; // Release the lock
                // Remove listeners after use
                inactiveAudio.removeEventListener('loadedmetadata', metadataHandler);
                inactiveAudio.removeEventListener('ended', endHandler);
                inactiveAudio.removeEventListener('error', errorHandler);
              });
          };

          const endHandler = () => {
            handleTrackEnd(); // Call the generic end handler
          };

          const errorHandler = (e: Event) => {
            console.error('[AudioPlayer] Error loading audio track:', e);
            handleAudioError(e); // Call the generic error handler
            // Clean up listeners immediately on error
            inactiveAudio.removeEventListener('loadedmetadata', metadataHandler);
            inactiveAudio.removeEventListener('ended', endHandler);
            inactiveAudio.removeEventListener('error', errorHandler);
            isTransitioningRef.current = false; // Release lock on error
          };

          inactiveAudio.addEventListener('loadedmetadata', metadataHandler, { once: true });
          inactiveAudio.addEventListener('ended', endHandler, { once: true });
          inactiveAudio.addEventListener('error', errorHandler, { once: true });

          // Explicitly load the source
          inactiveAudio.load();
        })
        .catch(error => {
          console.error('[AudioPlayer] Failed to get random audio URL:', error);
          isTransitioningRef.current = false; // Release lock if fetch fails
        });
    }
  }, [
    currentMood,
    previousMood,
    isPlaying,
    activeAudioRef,
    inactiveAudioRef,
    fadeOutMs,
    fadeInMs,
    cleanupAudio,
    fadeOut,
    fadeIn,
    handleTrackEnd,
    handleAudioError,
  ]); // Dependencies

  // --- Live Volume Control ---
  useEffect(() => {
    const activeAudio = activeAudioRef.current;
    if (activeAudio && isPlaying) {
      const effectiveVolume = Math.max(0, Math.min(1, targetVolume));
      if (activeAudio.volume !== effectiveVolume) {
        activeAudio.volume = effectiveVolume;
      }
    }
  }, [targetVolume, isPlaying, activeAudioRef]);

  // --- UI Interaction ---

  const togglePlayPause = () => {
    const activeAudio = activeAudioRef.current;

    if (isPlaying) {
      if (activeAudio) activeAudio.pause();
      setIsPlaying(false);
    } else {
      // Only play if a mood is set and audio is ready/has source
      if (currentMood && activeAudio && activeAudio.src) {
        activeAudio
          .play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.error('[AudioPlayer] UI play error:', err);
            setIsPlaying(false);
            handleTrackEnd(); // Treat play error like track end to potentially reload
          });
      } else {
        // If no mood, maybe trigger the main effect to load something?
        // Or try to reload the current track if src exists?
        if (currentMood && activeAudio && !activeAudio.src) {
          // Trigger main effect to load track for current mood
          setPreviousMood(null); // Force reload by making current != previous
        }
      }
    }
  };

  if (!classifications || classifications.length === 0) return null; // Don't render if no classifications

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Player UI (Only show if a mood could potentially play) */}
      {isAudioReady || currentMood ? ( // Show controls if audio is ready OR a mood is selected
        <div className="bg-black/70 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3">
          <button
            onClick={togglePlayPause}
            disabled={!currentMood && !isAudioReady} // Disable if no mood AND no audio ready
            className="w-6 h-6 flex items-center justify-center text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? 'Pause music' : 'Play music'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
        </div>
      ) : null}

      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="text-gray-300 hover:text-white transition-colors"
        aria-label={showSettings ? 'Hide settings' : 'Show settings'}
      >
        {showSettings ? <X size={16} /> : <Settings size={16} />}
      </button>

      {/* Settings Panel (Conditional) */}
      {showSettings && (
        <div className="bg-black/80 backdrop-blur-sm text-white p-4 rounded-lg shadow-xl w-64 text-xs">
          <h4 className="font-semibold mb-3 text-sm">Audio Settings</h4>
          {/* Fade Out Duration */}
          <div className="mb-3">
            <label htmlFor="fade-out-ms" className="block mb-1 text-gray-300">
              Fade Out (ms)
            </label>
            <input
              type="range"
              id="fade-out-ms"
              min="0"
              max="5000"
              step="100"
              value={fadeOutMs}
              onChange={e => handleSettingChange(setFadeOutMs, 'audioFadeOutMs', e.target.value)}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">{fadeOutMs} ms</span>
          </div>
          {/* Fade In Duration */}
          <div className="mb-3">
            <label htmlFor="fade-in-ms" className="block mb-1 text-gray-300">
              Fade In (ms)
            </label>
            <input
              type="range"
              id="fade-in-ms"
              min="0"
              max="5000"
              step="100"
              value={fadeInMs}
              onChange={e => handleSettingChange(setFadeInMs, 'audioFadeInMs', e.target.value)}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">{fadeInMs} ms</span>
          </div>
          {/* Target Volume */}
          <div className="mb-1">
            <label htmlFor="target-volume" className="block mb-1 text-gray-300">
              Volume
            </label>
            <input
              type="range"
              id="target-volume"
              min="0"
              max="1"
              step="0.05"
              value={targetVolume}
              onChange={e =>
                handleSettingChange(setTargetVolume, 'audioTargetVolume', e.target.value)
              }
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">
              {(targetVolume * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Hidden Audio Elements are created in useEffect */}
    </div>
  );
}
