'use client';

import { useEffect, useRef, useState } from 'react';
import usePageObserver from './usePageObserver';

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
  
  // Use two audio elements for cross-fading
  const audioRef1 = useRef<HTMLAudioElement | null>(null);
  const audioRef2 = useRef<HTMLAudioElement | null>(null);
  const [activeAudio, setActiveAudio] = useState<1 | 2>(1);
  
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
  const fadeOut = (audioElement: HTMLAudioElement, duration: number = 1000): Promise<void> => {
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
  
  const fadeIn = (audioElement: HTMLAudioElement, duration: number = 1000): Promise<void> => {
    return new Promise((resolve) => {
      const targetVolume = 0.5; // Target volume level
      audioElement.volume = 0;
      audioElement.play().catch(console.error);
      
      const fadeInterval = 10; // ms
      const volumeStep = targetVolume / (duration / fadeInterval);
      
      const interval = setInterval(() => {
        if (audioElement.volume < targetVolume - volumeStep) {
          audioElement.volume += volumeStep;
        } else {
          audioElement.volume = targetVolume;
          clearInterval(interval);
          resolve();
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
        // Clean up any existing audio
        cleanupAudio(currentAudio);
        cleanupAudio(nextAudio);

        // Set up metadata loaded event to start from a random position
        const handleMetadataLoaded = async () => {
          try {
            // Set a random position in the track
            setRandomStartPosition(nextAudio);

            // If previous audio is playing, do a cross-fade with a pause between
            if (isPlaying && currentAudio.currentTime > 0) {
              // First fade out the current audio
              await fadeOut(currentAudio, 1200);

              // Pause for a moment to create a natural break (1-3 seconds)
              const pauseDuration = 1000 + Math.random() * 2000;
              await delay(pauseDuration);

              // Then fade in the new audio
              await fadeIn(nextAudio, 1500);
            } else {
              // Just play the new audio directly
              nextAudio.volume = 0.5;
              await nextAudio.play()
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
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-black/70 text-white px-4 py-2 rounded-full shadow-lg">
        <div className="flex items-center gap-2">
          <button 
            onClick={togglePlayPause} 
            className="w-6 h-6 flex items-center justify-center"
            aria-label={isPlaying ? "Pause music" : "Play music"}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <p>
            <span className="capitalize">{currentMood}</span> Music
          </p>
        </div>
        <audio 
          ref={audioRef1} 
          style={{ display: 'none' }} 
        />
        <audio 
          ref={audioRef2} 
          style={{ display: 'none' }} 
        />
      </div>
    </div>
  );
}
