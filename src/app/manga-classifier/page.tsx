"use client";

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  chapterExistsInDatabase, 
  getChapterClassifications 
} from '@/services/mangaService';
import { ClassificationResult } from '@/types';

export default function MangaClassifier() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chapterInfo, setChapterInfo] = useState<{
    number: number | null;
    exists: boolean;
  }>({ number: null, exists: false });
  const [storedChapters, setStoredChapters] = useState<any[]>([]);
  const [loadingStoredChapters, setLoadingStoredChapters] = useState(true);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchChapters = async () => {
    setLoadingStoredChapters(true);
    try {
      const res = await fetch('/api/chapters');
      if (!res.ok) throw new Error('Failed to fetch chapters');
      const data = await res.json();
      setStoredChapters(data);
    } catch (err) {
      console.error('Error fetching chapters:', err);
      setStoredChapters([]);
    } finally {
      setLoadingStoredChapters(false);
    }
  };

  useEffect(() => {
    fetchChapters();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    
    if (selectedFile) {
      // Try to extract chapter number from filename
      const match = selectedFile.name.match(/^(\d+)/);
      if (match && match[1]) {
        const chapterNum = parseInt(match[1], 10);
        
        // Check if this chapter exists in database
        try {
          const exists = await chapterExistsInDatabase(chapterNum);
          setChapterInfo({ number: chapterNum, exists });
        } catch (err) {
          console.error("Error checking chapter existence:", err);
          setChapterInfo({ number: chapterNum, exists: false });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('archive', file);

      const res = await fetch('/api/chapters', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.status === 202) {
        setProcessingMessage(`Processing started for chapter ${data.chapterNumber}`);
        await fetchChapters();
        clearFile();
      } else {
        throw new Error(data.error || 'Failed to start processing');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process archive');
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setChapterInfo({ number: null, exists: false });
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const categoryColors: { [key: string]: string } = {
    'intro': '#3498db',           // Blue
    'love': '#e84393',           // Pink
    'love_ran': '#ff69b4',       // Hot Pink
    'casual': '#00b894',         // Mint
    'adventure': '#1abc9c',      // Turquoise
    'comedy': '#f1c40f',         // Yellow
    'action_casual': '#e74c3c',  // Red
    'action_serious': '#c0392b', // Dark Red
    'tragic': '#34495e',         // Dark Gray-Blue
    'tension': '#8e44ad',        // Dark Purple
    'confrontation': '#d35400',  // Pumpkin Orange
    'investigation': '#2980b9',  // Darker Blue
    'revelation': '#16a085',     // Teal
    'conclusion': '#27ae60',     // Dark Green
  };

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ marginBottom: '20px' }}>Manga Page Classifier</h1>
        
        {/* Database information section */}
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
          <h2>Chapters in Database</h2>
          {loadingStoredChapters ? (
            <p>Loading stored chapters...</p>
          ) : storedChapters.length === 0 ? (
            <p>No chapters found in the database.</p>
          ) : (
            <>
              <p>Chapters in database: {storedChapters.length}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Chapter</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {storedChapters.map((chap) => (
                    <tr key={chap.chapter_number}>
                      <td style={{ padding: '8px' }}>#{chap.chapter_number}</td>
                      <td style={{ padding: '8px' }}>{chap.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        
        <p style={{ marginBottom: '20px' }}>
          Upload a manga archive (.zip, .cbr, or .cbz) with the chapter number as the filename (e.g., "12.cbr" for chapter 12).
          Each page will be classified and stored in the database.
        </p>
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="file"
              accept=".zip,.cbr,.cbz"
              onChange={handleFileChange}
              ref={fileInputRef}
              style={{
                backgroundColor: '#1a1a1a',
                color: 'white',
                padding: '8px',
                borderRadius: '4px',
                width: '100%'
              }}
            />
            {file && (
              <div style={{ marginTop: '10px' }}>
                <span>Selected file: {file.name}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  style={{
                    marginLeft: '10px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            style={{
              backgroundColor: 'blue',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Processing...' : 'Classify Pages'}
          </button>

          {chapterInfo.number !== null && chapterInfo.exists && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#2ecc71',
              borderRadius: '4px',
              color: 'white'
            }}>
              Chapter {chapterInfo.number} is already in the database.
            </div>
          )}
        </form>

        {error && (
          <div style={{
            padding: '15px',
            backgroundColor: '#ff00001a',
            border: '1px solid #ff0000',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#ff0000'
          }}>
            {error}
          </div>
        )}

        {chapterInfo.number !== null && (
          <div style={{
            padding: '15px',
            backgroundColor: chapterInfo.exists ? '#f39c12' : '#2ecc71',
            borderRadius: '4px',
            marginBottom: '20px',
            color: 'white'
          }}>
            {chapterInfo.exists ? 
              `Chapter ${chapterInfo.number} already exists in the database. Showing existing classifications.` : 
              `Chapter ${chapterInfo.number} has been processed and stored in the database.`}
          </div>
        )}

        {processingMessage && (
          <p style={{ marginBottom: '20px' }}>{processingMessage}</p>
        )}
      </div>
    </>
  );
}
