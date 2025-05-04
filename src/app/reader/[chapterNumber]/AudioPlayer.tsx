'use client';

import { useEffect, useRef, useState } from 'react';
import usePageObserver from './usePageObserver';
import { Settings, X } from 'lucide-react'; // Add icons

interface Classification {
  page_number: number;
  category: 'intro' | 'love' | 'love_ran' | 'casual' | 'adventure' | 'comedy' | 
            'action_casual' | 'action_serious' | 'tragic' | 'tension' | 
            'confrontation' | 'investigation' | 'revelation' | 'conclusion';
}

interface AudioPlayerProps {
  classifications: Classification[];
}

export default function AudioPlayer({ classifications }: AudioPlayerProps) {
  const currentPage = usePageObserver();
  const [currentMood, setCurrentMood] = useState<Classification['category'] | null>(null);
  const [previousMood, setPreviousMood] = useState<Classification['category'] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Configurable settings with defaults
  const [fadeOutMs, setFadeOutMs] = useState<number>(800);
  const [fadeInMs, setFadeInMs] = useState<number>(1000);
  const [targetVolume, setTargetVolume] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Use two audio elements for cross-fading
  const audioRef1 = useRef<HTMLAudioElement | null>(null);
  const audioRef2 = useRef<HTMLAudioElement | null>(null);
  const [activeAudio, setActiveAudio] = useState<1 | 2>(1);
  
  // --- Persistence --- 
  useEffect(() => {
    // Load settings from localStorage on mount
    const savedFadeOut = localStorage.getItem('audioFadeOutMs');
    const savedFadeIn = localStorage.getItem('audioFadeInMs');
    const savedVolume = localStorage.getItem('audioTargetVolume');

    if (savedFadeOut) setFadeOutMs(parseInt(savedFadeOut, 10));
    if (savedFadeIn) setFadeInMs(parseInt(savedFadeIn, 10));
    if (savedVolume) setTargetVolume(parseFloat(savedVolume));
  }, []);

  // Save settings to localStorage when they change
  const handleSettingChange = <T extends number>(setter: React.Dispatch<React.SetStateAction<T>>, key: string, value: string) => {
    const numericValue = key === 'audioTargetVolume' ? parseFloat(value) : parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setter(numericValue as T);
      localStorage.setItem(key, value);
    }
  };

  // Cleanup function for audio elements
  const cleanupAudio = (audioElement: HTMLAudioElement) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
    }
  };

  // Find mood for the current page
  useEffect(() => {
    const classification = classifications.find(c => c.page_number === currentPage);
    setCurrentMood(classification ? classification.category : null);
  }, [currentPage, classifications]);

  // Fade audio in/out functions
  const fadeOut = (audioElement: HTMLAudioElement, duration: number = fadeOutMs): Promise<void> => {
    return new Promise((resolve) => {
      const startVolume = audioElement.volume;
      const fadeInterval = 20; // ms
      const volumeStep = startVolume / (duration / fadeInterval);
      
      const interval = setInterval(() => {
        if (audioElement.volume > volumeStep) {
          audioElement.volume -= volumeStep;
        } else {
          audioElement.volume = 0;
          audioElement.pause();
          clearInterval(interval);
          resolve();
        }
      }, fadeInterval);
    });
  };
  
  const fadeIn = (audioElement: HTMLAudioElement, duration: number = fadeInMs): Promise<void> => {
    return new Promise((resolve) => {
      const effectiveTargetVolume = Math.max(0, Math.min(1, targetVolume)); // Ensure volume is 0-1
      audioElement.volume = 0;
      audioElement.play().catch(console.error);
      
      const fadeInterval = 10; // ms
      const volumeStep = duration > 0 ? effectiveTargetVolume / (duration / fadeInterval) : effectiveTargetVolume;
      
      const interval = setInterval(() => {
        if (duration <= 0 || audioElement.volume >= effectiveTargetVolume - volumeStep) {
          // If duration is 0 or less, or volume is close enough, jump to target
          audioElement.volume = effectiveTargetVolume;
          clearInterval(interval);
          resolve();
        } else {
          audioElement.volume += volumeStep;
        }
      }, fadeInterval);
    });
  };

  // Function to create a delay
  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  // Function to set a random start position in the audio track
  const setRandomStartPosition = (audioElement: HTMLAudioElement) => {
    const duration = audioElement.duration;
    if (isFinite(duration) && duration > 5) {
      // Avoid the first 10% and last 20% of the track for a more natural feeling
      const minPosition = duration * 0.1; // Skip the first 10%
      const maxPosition = duration * 0.8; // Skip the last 20%
      const randomPosition = minPosition + Math.random() * (maxPosition - minPosition);
      audioElement.currentTime = randomPosition;
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
      console.error("Error fetching audio URL:", error);
      return ''; // Return empty string on error
    }
  };

  // Function to load a new track for the current mood
  const loadNewTrackForCurrentMood = async (audioElement: HTMLAudioElement, mood: Classification['category'] | null) => {
    if (!mood) return;
    
    try {
      const audioPath = await getRandomAudioForMood(mood);
      console.log(`[AudioPlayer] Loading new track for mood "${mood}": ${audioPath}`);
      audioElement.src = audioPath;
      
      audioElement.addEventListener('loadedmetadata', function handleMetadata() {
        setRandomStartPosition(audioElement);
        audioElement.volume = 0.5;
        audioElement.volume = targetVolume; // Use state variable
        audioElement.play().catch(console.error);
        audioElement.removeEventListener('loadedmetadata', handleMetadata);
      }, { once: true });
    } catch (error) {
      console.error("Error loading new track:", error);
    }
  };

  // Change audio when mood changes with cross-fade
  useEffect(() => {
    if (currentMood && currentMood !== previousMood) {
      console.log(`[AudioPlayer] Page ${currentPage} - Mood changed from "${previousMood}" to "${currentMood}"`);
      const currentAudio = activeAudio === 1 ? audioRef1.current : audioRef2.current;
      const nextAudio = activeAudio === 1 ? audioRef2.current : audioRef1.current;
      
      if (currentAudio && nextAudio) {
        // Clean up only the next audio element before loading new source
        cleanupAudio(nextAudio);

        // Set up metadata loaded event to start from a random position
        const handleMetadataLoaded = async () => {
          try {
            // Set a random position in the track
            setRandomStartPosition(nextAudio);

            // If previous audio is playing, perform a cross-fade
            if (isPlaying && currentAudio.currentTime > 0 && currentAudio.volume > 0) {
              // Start fading out the current audio and fading in the new one concurrently
              // Start fade out
              const fadeOutPromise = fadeOut(currentAudio, fadeOutMs); // Use state
              // Start fade in (starts playing at volume 0)
              const fadeInPromise = fadeIn(nextAudio, fadeInMs); // Use state

              // Wait for both fades to complete
              await Promise.all([fadeOutPromise, fadeInPromise]);

              // Ensure the old audio element is fully cleaned up after fade-out
              cleanupAudio(currentAudio); 

            } else {
              // If not previously playing, just fade in the new track
              nextAudio.volume = 0; // Start at 0 before fadeIn
              await fadeIn(nextAudio, fadeInMs) // Use state
                .catch(err => {
                  console.error("Failed to play audio:", err);
                  setIsPlaying(false);
                });
            }
            
            // Update states after successful transition/play
            setActiveAudio(prevActive => prevActive === 1 ? 2 : 1); 
            setIsPlaying(true);
            setPreviousMood(currentMood);

          } catch (error) {
             console.error("Error during audio transition:", error);
             setIsPlaying(false); // Ensure isPlaying is false on error
          } finally {
             // Clean up the event listener regardless of success/failure
            nextAudio.removeEventListener('loadedmetadata', handleMetadataLoaded);
          }
        };

        // Get audio URL and set it on the next audio element
        (async () => {
          try {
            const audioPath = await getRandomAudioForMood(currentMood);
            console.log(`[AudioPlayer] Loading new track for mood "${currentMood}": ${audioPath}`);
            
            // Set up the next audio
            nextAudio.src = audioPath;
            nextAudio.loop = false;
            
            // Add the event listener for metadata loading
            nextAudio.addEventListener('loadedmetadata', handleMetadataLoaded);
          } catch (error) {
            console.error("Error fetching audio:", error);
          }
        })();
      }
    }
  }, [currentMood, previousMood]); // Removed activeAudio and isPlaying from dependencies

  // --- Live Volume Control ---
  useEffect(() => {
    const currentAudio = activeAudio === 1 ? audioRef1.current : audioRef2.current;
    if (currentAudio && isPlaying) { // Only adjust if playing
      // Apply volume clamping just in case
      const effectiveVolume = Math.max(0, Math.min(1, targetVolume));
      currentAudio.volume = effectiveVolume;
    }
    // No need to add isPlaying or activeAudio as dependencies, 
    // we only want this effect to run when targetVolume itself changes.
  }, [targetVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      cleanupAudio(audioRef1.current!);
      cleanupAudio(audioRef2.current!);
    };
  }, []);

  // Handle track ending - play a new track from the same mood
  useEffect(() => {
    const audio1 = audioRef1.current;
    const audio2 = audioRef2.current;
    
    const handleTrackEnd = (audioElement: HTMLAudioElement) => {
      if (currentMood && isPlaying) {
        loadNewTrackForCurrentMood(audioElement, currentMood);
      }
    };
    
    if (audio1) {
      audio1.addEventListener('ended', () => handleTrackEnd(audio1));
    }
    
    if (audio2) {
      audio2.addEventListener('ended', () => handleTrackEnd(audio2));
    }
    
    return () => {
      audio1?.removeEventListener('ended', () => handleTrackEnd(audio1));
      audio2?.removeEventListener('ended', () => handleTrackEnd(audio2));
    };
  }, [currentMood, isPlaying]);

  const togglePlayPause = () => {
    const audio1 = audioRef1.current;
    const audio2 = audioRef2.current;
    
    if (isPlaying) {
      // Pause both audio elements
      if (audio1) audio1.pause();
      if (audio2) audio2.pause();
    } else {
      // Play the active audio
      const currentAudio = activeAudio === 1 ? audio1 : audio2;
      if (currentAudio) {
        currentAudio.play().catch(console.error);
      }
    }
    
    setIsPlaying(!isPlaying);
  };
  
  if (!currentMood) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Player UI */} 
      <div className="bg-black/70 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3">
          <button
            onClick={togglePlayPause}
            className="w-6 h-6 flex items-center justify-center text-lg"
            aria-label={isPlaying ? "Pause music" : "Play music"}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
      </div>

      {/* Settings Toggle Button */} 
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="text-gray-300 hover:text-white transition-colors"
        aria-label={showSettings ? "Hide settings" : "Show settings"}
      >
        {showSettings ? <X size={16} /> : <Settings size={16} />}
      </button>

      {/* Settings Panel (Conditional) */} 
      {showSettings && (
        <div className="bg-black/80 backdrop-blur-sm text-white p-4 rounded-lg shadow-xl w-64 text-xs">
          <h4 className="font-semibold mb-3 text-sm">Audio Settings</h4>
          {/* Fade Out Duration */} 
          <div className="mb-3">
            <label htmlFor="fade-out-ms" className="block mb-1 text-gray-300">Fade Out (ms)</label>
            <input
              type="range"
              id="fade-out-ms"
              min="0"
              max="5000"
              step="100"
              value={fadeOutMs}
              onChange={(e) => handleSettingChange(setFadeOutMs, 'audioFadeOutMs', e.target.value)}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">{fadeOutMs} ms</span>
          </div>
          {/* Fade In Duration */} 
          <div className="mb-3">
            <label htmlFor="fade-in-ms" className="block mb-1 text-gray-300">Fade In (ms)</label>
            <input
              type="range"
              id="fade-in-ms"
              min="0"
              max="5000"
              step="100"
              value={fadeInMs}
              onChange={(e) => handleSettingChange(setFadeInMs, 'audioFadeInMs', e.target.value)}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">{fadeInMs} ms</span>
          </div>
          {/* Target Volume */} 
          <div className="mb-1">
            <label htmlFor="target-volume" className="block mb-1 text-gray-300">Volume</label>
            <input
              type="range"
              id="target-volume"
              min="0"
              max="1"
              step="0.05"
              value={targetVolume}
              onChange={(e) => handleSettingChange(setTargetVolume, 'audioTargetVolume', e.target.value)}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
            />
            <span className="text-gray-400 text-right block mt-0.5">{(targetVolume * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Hidden Audio Elements */}
      <audio
        ref={audioRef1}
        style={{ display: 'none' }}
      />
      <audio
        ref={audioRef2}
        style={{ display: 'none' }}
      />
    </div>
  );
}
