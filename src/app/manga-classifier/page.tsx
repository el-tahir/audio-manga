"use client";

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  chapterExistsInDatabase, 
  getStoredChapterNumbers,
  getChapterClassifications 
} from '@/services/mangaService';

type ClassificationResult = {
  filename: string;
  category: 'investigation' | 'suspense' | 'action' | 'revelation' | 'conclusion' | 'casual' | 'tragic';
  confidence?: number;
};

export default function MangaClassifier() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chapterInfo, setChapterInfo] = useState<{
    number: number | null;
    exists: boolean;
  }>({ number: null, exists: false });
  const [storedChapters, setStoredChapters] = useState<number[]>([]);
  const [loadingStoredChapters, setLoadingStoredChapters] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStoredChapters = async () => {
      try {
        const chapters = await getStoredChapterNumbers();
        setStoredChapters(chapters);
      } catch (err) {
        console.error("Error fetching stored chapters:", err);
      } finally {
        setLoadingStoredChapters(false);
      }
    };
    
    loadStoredChapters();
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

      const res = await fetch('/api/manga-classifier', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to process archive');
      }

      const data = await res.json();
      
      // Set chapter info
      if (data.chapterNumber) {
        setChapterInfo({
          number: data.chapterNumber,
          exists: data.exists || false
        });
        
        // Refresh stored chapters list after processing
        const chapters = await getStoredChapterNumbers();
        setStoredChapters(chapters);
      }
      
      // Set results if not already in database
      if (!data.exists) {
        setResults(data.classifications);
      } else if (data.chapterNumber) {
        // If the chapter exists, fetch its classifications from the database
        const classifications = await getChapterClassifications(data.chapterNumber);
        setResults(classifications);
      } else {
        setResults([]);
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

  const categoryColors = {
    investigation: '#3498db', // blue
    suspense: '#9b59b6',     // purple
    action: '#e74c3c',       // red
    revelation: '#2ecc71',   // green
    conclusion: '#f39c12',   // orange
    casual: '#1abc9c',       // turquoise
    tragic: '#34495e',       // dark gray
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                {storedChapters.map((chapter) => (
                  <span key={chapter} style={{
                    padding: '3px 8px',
                    backgroundColor: '#2D3748',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>
                    #{chapter}
                  </span>
                ))}
              </div>
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

        {results.length > 0 && (
          <div>
            <h2 style={{ marginBottom: '15px' }}>Classification Results</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '15px'
            }}>
              {results.map((result, index) => (
                <div key={index} style={{
                  backgroundColor: '#1a1a1a',
                  border: `2px solid ${categoryColors[result.category] || '#333'}`,
                  borderRadius: '4px',
                  padding: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '5px',
                    backgroundColor: categoryColors[result.category] || '#333',
                    padding: '4px',
                    borderRadius: '2px',
                    color: 'white'
                  }}>
                    {result.category.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {result.filename}
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => {
                const json = JSON.stringify(results, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const href = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = href;
                link.download = `${chapterInfo.number}-classifications.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(href);
              }}
              style={{
                marginTop: '20px',
                backgroundColor: '#2ecc71',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Download JSON
            </button>
          </div>
        )}
      </div>
    </>
  );
}
