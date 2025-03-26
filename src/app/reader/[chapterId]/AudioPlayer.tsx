'use client';

import { useEffect, useRef, useState } from 'react';
import usePageObserver from './usePageObserver';

interface Classification {
  page_number: number;
  category: 'investigation' | 'suspense' | 'action' | 'revelation' | 'conclusion' | 'casual' | 'tragic';
}

interface AudioPlayerProps {
  classifications: Classification[];
}

export default function AudioPlayer({ classifications }: AudioPlayerProps) {
  const currentPage = usePageObserver();
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [previousMood, setPreviousMood] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Use two audio elements for cross-fading
  const audioRef1 = useRef<HTMLAudioElement | null>(null);
  const audioRef2 = useRef<HTMLAudioElement | null>(null);
  const [activeAudio, setActiveAudio] = useState<1 | 2>(1);
  
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
      
      const fadeInterval = 20; // ms
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

  // Change audio when mood changes with cross-fade
  useEffect(() => {
    if (currentMood && currentMood !== previousMood) {
      const currentAudio = activeAudio === 1 ? audioRef1.current : audioRef2.current;
      const nextAudio = activeAudio === 1 ? audioRef2.current : audioRef1.current;
      
      if (currentAudio && nextAudio) {
        // Get random audio file path for the mood
        const audioPath = getRandomAudioForMood(currentMood);
        
        // Set up the next audio
        nextAudio.src = audioPath;
        nextAudio.loop = true;
        
        // If previous audio is playing, do a cross-fade
        if (isPlaying && currentAudio.currentTime > 0) {
          // Fade out current audio while fading in new audio
          fadeOut(currentAudio, 1500);
          fadeIn(nextAudio, 1500);
        } else {
          // Just play the new audio directly
          nextAudio.volume = 0.5;
          nextAudio.play()
            .catch(err => {
              console.error("Failed to play audio:", err);
              setIsPlaying(false);
            });
        }
        
        // Toggle active audio reference
        setActiveAudio(activeAudio === 1 ? 2 : 1);
        setIsPlaying(true);
        setPreviousMood(currentMood);
      }
    }
  }, [currentMood, previousMood, activeAudio, isPlaying]);

  // Get random audio file from a mood directory
  const getRandomAudioForMood = (mood: string): string => {
    return `/api/random-audio?mood=${encodeURIComponent(mood)}`;
  };

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
          loop 
          style={{ display: 'none' }} 
        />
        <audio 
          ref={audioRef2} 
          loop 
          style={{ display: 'none' }} 
        />
      </div>
    </div>
  );
}
