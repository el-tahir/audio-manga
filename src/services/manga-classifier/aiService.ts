import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClassificationResult } from '@/types';

// Constants for API handling
const MAX_RETRIES = 3; // Maximum retry attempts
const REQUEST_TIMEOUT = 60000; // 60 second timeout for API calls

// Function to get an API instance with rotating keys
function getAIInstance(keyIndex?: number): GoogleGenerativeAI {
  // If specific key index is requested, use it; otherwise use the first one as default
  const apiKey = keyIndex === 1 ? 
    process.env.GOOGLE_API_KEY_2 : 
    process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error(`API key ${keyIndex === 1 ? '2' : '1'} is not defined in environment variables`);
  }
  
  return new GoogleGenerativeAI(apiKey);
}

// Enhanced function to handle API key fallback with exponential backoff
export async function executeWithFallback<T>(fn: (genAI: GoogleGenerativeAI) => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: any;
  let totalAttempts = 0;
  const startTime = Date.now();
  
  // Try both keys with increasing delays
  for (let keyIndex = 0; keyIndex < 2; keyIndex++) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      totalAttempts++;
      try {
        // Add increasing delay between attempts to avoid rate limits
        if (attempt > 0 || keyIndex > 0) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`[MANGA-CLASSIFIER] Waiting ${delay.toFixed(0)}ms before retry (key ${keyIndex + 1}, attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`API request timed out after ${REQUEST_TIMEOUT/1000} seconds`)), 
                    REQUEST_TIMEOUT);
        });
        
        // Execute the function with a timeout
        const result = await Promise.race([
          fn(getAIInstance(keyIndex)),
          timeoutPromise
        ]) as T;
        
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[MANGA-CLASSIFIER] Request succeeded after ${totalAttempts} attempts (${elapsedTime}s)`);
        
        return result;
      } catch (error: any) {
        lastError = error;
        const errorType = getErrorType(error);
        
        console.error(`[MANGA-CLASSIFIER] ${errorType} error with API key ${keyIndex + 1}, attempt ${attempt + 1}: ${error.message || 'Unknown error'}`);
        
        // If it's not a rate limit error, try the other key
        if (!isRateLimitError(error)) {
          console.log(`[MANGA-CLASSIFIER] Switching API keys due to non-rate-limit error`);
          break; // Break the retry loop for this key, try next key
        }
      }
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`[MANGA-CLASSIFIER] All API requests failed after ${totalAttempts} attempts (${totalTime}s)`);
  
  // Trigger garbage collection if available (in Node.js environments)
  if (global.gc) {
    try {
      global.gc();
      console.log(`[MANGA-CLASSIFIER] Manually triggered garbage collection after failures`);
    } catch (e) {
      // Ignore if not available
    }
  }
  
  // All attempts failed
  throw lastError || new Error('All API requests failed');
}

// Helper function to determine error type
function getErrorType(error: any): string {
  if (!error.message) return 'Unknown';
  
  if (error.message.includes('too many requests') || 
      error.message.includes('rate limit') || 
      error.message.includes('429')) {
    return 'Rate limit';
  }
  
  if (error.message.includes('timeout')) {
    return 'Timeout';
  }
  
  if (error.message.includes('network') || 
      error.message.includes('connection')) {
    return 'Network';
  }
  
  if (error.message.includes('invalid') || 
      error.message.includes('format')) {
    return 'Format';
  }
  
  return 'API';
}

// Helper function to check if error is rate limit related
function isRateLimitError(error: any): boolean {
  return error.message?.includes('too many requests') || 
         error.message?.includes('rate limit') || 
         error.message?.includes('429');
}

// Process three images at a time to provide context while keeping requests manageable
export async function processTripleImages(
  imageFiles: string[],
  previousMood: string | null,
  previousContext: string,
  model: any
): Promise<ClassificationResult[]> {
  try {
    const filenames = imageFiles.map(file => path.basename(file));
    console.log(`[MANGA-CLASSIFIER] Processing 3-image group: ${filenames.join(", ")}`);
    
    // Create image parts directly from files
    const imageParts = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = imageFiles[i];
      const imageData = fs.readFileSync(imagePath);
      const imageBase64 = imageData.toString('base64');
      const mimeType = `image/${path.extname(imagePath).substring(1)}`;
      
      imageParts.push({ 
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      });
    }
    
    // Build context information
    const positionContext = previousMood 
      ? `Previous sequence ended with mood: ${previousMood}` 
      : "This is the beginning of the chapter";
    
    // Create the prompt for analyzing three consecutive images
    const textPart = { text: `You are a specialized Detective Conan manga analyst for soundtrack optimization. Your task is to analyze 3 consecutive manga pages and classify each page's dominant mood for precise OST mapping.

**Context:**
* ${positionContext}
* ${previousContext ? `Previous context: ${previousContext}` : ''}

**Analysis Instructions:**
Identify the primary mood of EACH page by examining:
1. **Character Presence:** Which characters are present (Conan/Shinichi, Ran, Kogoro, Detective Boys, FBI, Black Organization, etc.)
2. **Facial Expressions:** Detective face, glasses glare, worried expressions, determined looks, etc.
3. **Panel Structure:** Dynamic layouts, size/focus of panels, establishing shots
4. **Scene Setting:** Location, lighting, weather (rain often indicates tension/tragedy)
5. **Story Phase:** Case introduction, investigation, confrontation, revelation
6. **Narrative Connection:** How these 3 pages connect and flow together

**Core Concept:** Sound transitions should occur at meaningful narrative shifts, not between every page. Consider how these pages work together.

**Mandatory Mood Categories:**
Select ONE mood per page from this exact list:
1. **intro:** Establishing scene/case, opening narration
2. **love:** Romantic moments, general romantic tension
3. **love_ran:** Specific focus on Ran's feelings for Shinichi
4. **casual:** Everyday interactions outside the case
5. **adventure:** Light investigation, exploration moments
6. **comedy:** Humorous elements, comic relief
7. **action_casual:** Standard chase/confrontation, lower stakes
8. **action_serious:** High-stakes, dangerous situations
9. **tragic:** Emotional, sad moments
10. **tension:** Suspense building, mystery development
11. **confrontation:** Facing suspects, accusation phase
12. **investigation:** Active clue gathering, deduction
13. **revelation:** Case solution explanation, "aha" moment
14. **conclusion:** Case wrap-up, aftermath

**Response Format:** JSON array only, one object per page:
[
  {
    "filename": "${filenames[0]}",
    "mood": "[CATEGORY]",
    "visual_elements": "[Key visual elements: faces, layout, items]",
    "reasoning": "[Specific evidence linking to mood category]",
    "continuity": "[How this page connects to surrounding narrative]"
  },
  {
    "filename": "${filenames[1]}",
    "mood": "[CATEGORY]",
    "visual_elements": "[Key visual elements]",
    "reasoning": "[Evidence for classification]",
    "continuity": "[Narrative connection]"
  },
  {
    "filename": "${filenames[2]}",
    "mood": "[CATEGORY]",
    "visual_elements": "[Key visual elements]",
    "reasoning": "[Evidence for classification]",
    "continuity": "[Narrative connection]"
  }
]

Focus on Detective Conan's visual language, storytelling patterns, and case structure. Consider both immediate page content and the overall narrative flow.` };
    
    console.log(`[MANGA-CLASSIFIER] Sending 3-image request to Gemini`);
    
    // Combine parts and send to the model
    const parts = [...imageParts, textPart];
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent results
      }
    });
    
    const response = await result.response.text();
    console.log(`[MANGA-CLASSIFIER] Received 3-image response from Gemini`);
    
    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(`[MANGA-CLASSIFIER] Error parsing JSON response:`, error);
      throw new Error("Failed to parse 3-image response");
    }
    
    if (!parsedResponse || !Array.isArray(parsedResponse)) {
      throw new Error("Invalid response format from 3-image analysis");
    }
    
    // Process each result in the array
    const results: ClassificationResult[] = [];
    
    for (let i = 0; i < parsedResponse.length && i < filenames.length; i++) {
      const pageResult = parsedResponse[i];
      const filename = filenames[i];
      
      // Extract and validate the mood
      let category: ClassificationResult['category'] = 'investigation'; // Default fallback
      let explanation: string = "";
      
      if (pageResult?.mood) {
        const extractedMood = pageResult.mood;
        const validMoods: ClassificationResult['category'][] = [
          'intro', 'love', 'love_ran', 'casual', 'adventure',
          'comedy', 'action_casual', 'action_serious', 'tragic',
          'tension', 'confrontation', 'investigation', 'revelation',
          'conclusion'
        ];
        
        // Check if the extracted mood is one of the valid categories
        if ((validMoods as string[]).includes(extractedMood)) {
          category = extractedMood as ClassificationResult['category'];
        } else {
          console.warn(`[MANGA-CLASSIFIER] Received invalid mood category for ${filename}: ${extractedMood}. Using fallback '${category}'.`);
        }
        
        // Compile explanation from various fields
        explanation = [
          pageResult.visual_elements, 
          pageResult.reasoning, 
          pageResult.continuity || ""
        ].filter(Boolean).join(" | ");
      }
      
      results.push({
        filename: filename,
        category: category,
        explanation: explanation
      });
      
      console.log(`[MANGA-CLASSIFIER] Classified ${filename}: ${category}`);
    }
    
    return results;
    
  } catch (error) {
    console.error(`[MANGA-CLASSIFIER] Error in 3-image classification:`, error);
    throw error;
  }
}

// Simplified function to classify images in a chapter using a 3-image sliding window approach
export async function classifyChapter(imageFiles: string[]): Promise<ClassificationResult[]> {
  console.log(`[MANGA-CLASSIFIER] Starting classification of ${imageFiles.length} images using 3-image sliding window`);
  
  // Process empty chapters gracefully
  if (!imageFiles.length) {
    console.log(`[MANGA-CLASSIFIER] No images to process.`);
    return [];
  }
  
  let allResults: ClassificationResult[] = [];
  let lastMood: string | null = null;
  let lastContext: string = "";
  
  // Process in groups of 3 with a sliding window
  for (let i = 0; i < imageFiles.length; i += 3) {
    try {
      // Get the next 3 images (or whatever remains)
      const groupImages = imageFiles.slice(i, Math.min(i + 3, imageFiles.length));
      
      console.log(`[MANGA-CLASSIFIER] Processing group ${i/3 + 1}/${Math.ceil(imageFiles.length/3)}: ${groupImages.map(f => path.basename(f)).join(", ")}`);
      
      const results = await executeWithFallback(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        return processTripleImages(groupImages, lastMood, lastContext, model);
      });
      
      allResults = [...allResults, ...results];
      
      // Update context from last processed image
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        lastMood = lastResult.category;
        lastContext = lastResult.explanation || "";
      }
      
      // Add small delay between groups
      if (i + 3 < imageFiles.length) {
        const delay = 1000 + Math.random() * 1000;
        console.log(`[MANGA-CLASSIFIER] Waiting ${delay.toFixed(0)}ms before next group`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error(`[MANGA-CLASSIFIER] Error processing image group:`, error);
      
      // If group processing failed, log error and provide default classifications
      const defaultResults = imageFiles.slice(i, Math.min(i + 3, imageFiles.length)).map((imagePath: string) => {
        const filename = path.basename(imagePath);
        const fallbackCategory = lastMood || 'investigation';
        
        const result: ClassificationResult = {
          filename: filename,
          category: fallbackCategory as any,
          explanation: `Classification failed, using fallback: ${fallbackCategory}`
        };
        
        console.log(`[MANGA-CLASSIFIER] Using fallback classification for ${filename}: ${fallbackCategory}`);
        return result;
      });
      
      allResults = [...allResults, ...defaultResults];
      
      // Update context from the last default result
      if (defaultResults.length > 0) {
        lastMood = defaultResults[defaultResults.length - 1].category;
      }
    }
  }
  
  // // Apply smoothing to ensure reasonable OST transitions
  // console.log(`[MANGA-CLASSIFIER] Applying smoothing to ${allResults.length} results`);
  // smoothTransitions(allResults);
  
  // console.log(`[MANGA-CLASSIFIER] Classification complete. Total results: ${allResults.length}`);
  
  return allResults;
}

// Function to smooth out abrupt transitions between pages
export function smoothTransitions(results: ClassificationResult[]): void {
  if (results.length < 3) return; // Need at least 3 pages for meaningful smoothing
  
  console.log(`[MANGA-CLASSIFIER] Running transition smoothing on ${results.length} pages`);
  
  // Look for isolated mood changes (A-B-A pattern) and smooth them
  for (let i = 1; i < results.length - 1; i++) {
    const prev = results[i-1].category;
    const current = results[i].category;
    const next = results[i+1].category;
    
    // Check if current mood is different from both neighbors and neighbors match
    if (prev === next && current !== prev) {
      console.log(`[MANGA-CLASSIFIER] Smoothing isolated mood change on page ${i+1}: ${current} -> ${prev}`);
      results[i].category = prev as any;
      results[i].explanation = `${results[i].explanation || ''} | Smoothed from ${current} to ${prev} for narrative consistency`;
    }
  }
  
  // Look for very rapid back-and-forth changes
  for (let i = 2; i < results.length; i++) {
    const prevPrev = results[i-2].category;
    const prev = results[i-1].category;
    const current = results[i].category;
    
    // If we see A-B-A pattern, set middle to match
    if (prevPrev === current && prev !== current) {
      console.log(`[MANGA-CLASSIFIER] Smoothing oscillation on page ${i}: ${prev} -> ${current}`);
      results[i-1].category = current as any;
      results[i-1].explanation = `${results[i-1].explanation || ''} | Changed from ${prev} to ${current} to avoid oscillation`;
    }
  }
}