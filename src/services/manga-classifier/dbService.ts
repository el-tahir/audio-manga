import { supabase } from '@/lib/supabase';
import { ClassificationResult } from '@/utils/manga-classifier/types';

// Function to check if chapter exists in database and return its data
export async function getChapterFromDatabase(chapterNumber: number) {
  const { data, error } = await supabase
    .from('manga_chapters')
    .select('*')
    .eq('chapter_number', chapterNumber)
    .single();
  
  if (error) {
    return null;
  }
  
  return data;
}

// Backward compatibility function
export async function chapterExistsInDatabase(chapterNumber: number): Promise<boolean> {
  const chapter = await getChapterFromDatabase(chapterNumber);
  return !!chapter;
}

// Improved function to check database schema and store classification results
export async function storeClassificationsInDatabase(
  chapterNumber: number, 
  classifications: ClassificationResult[]
): Promise<void> {
  // First, check if the explanation column exists in the table
  const { data: columns, error: schemaError } = await supabase
    .from('manga_page_classifications')
    .select('*')
    .limit(1);
  
  const hasExplanationColumn = !schemaError;
  
  if (schemaError) {
    console.log('[MANGA-CLASSIFIER] Warning: Could not verify schema, will attempt insert without explanation field');
  }
  
  // Create or update chapter record with explicit ID matching chapter_number
  const { data: chapterData, error: chapterError } = await supabase
    .from('manga_chapters')
    .upsert({
      id: chapterNumber, // Set ID to match chapter_number
      chapter_number: chapterNumber,
      total_pages: classifications.length,
      processed_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (chapterError) {
    console.error('Error storing chapter data:', chapterError);
    throw new Error('Failed to store chapter data');
  }
  
  // Then, store page classifications - adapt based on schema check
  const pageClassifications = classifications.map((classification, index) => {
    // Base record with fields we know exist
    const record: any = {
      chapter_id: chapterData.id,
      page_number: index + 1,
      filename: classification.filename,
      category: classification.category,
      confidence: classification.confidence || null
    };
    
    // Only add explanation if we think the column exists
    if (hasExplanationColumn) {
      record.explanation = classification.explanation || null;
    }
    
    return record;
  });
  
  // Insert in smaller batches to avoid potential size limits
  const batchSize = 30;
  for (let i = 0; i < pageClassifications.length; i += batchSize) {
    const batch = pageClassifications.slice(i, i + batchSize);
    
    const { error: pagesError } = await supabase
      .from('manga_page_classifications')
      .insert(batch);
    
    if (pagesError) {
      console.error(`Error storing page classifications batch ${i/batchSize + 1}:`, pagesError);
      
      // Try without explanation field if that might be the issue
      if (hasExplanationColumn && pagesError.message?.includes('explanation')) {
        console.log('[MANGA-CLASSIFIER] Retrying without explanation field');
        
        // Remove explanation field from all records
        const simplifiedBatch = batch.map(record => {
          const { explanation, ...rest } = record;
          return rest;
        });
        
        const { error: retryError } = await supabase
          .from('manga_page_classifications')
          .insert(simplifiedBatch);
        
        if (retryError) {
          throw new Error(`Failed to store page classifications batch ${i/batchSize + 1}: ${retryError.message}`);
        }
      } else {
        throw new Error(`Failed to store page classifications batch ${i/batchSize + 1}: ${pagesError.message}`);
      }
    }
  }
}