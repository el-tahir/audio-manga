import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClassificationResult } from '@/utils/manga-classifier/types';

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
export async function executeWithFallback<T>(fn: (genAI: GoogleGenerativeAI) => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  let retryCount = 0;
  
  // Try both keys with increasing delays
  for (let keyIndex = 0; keyIndex < 2; keyIndex++) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add increasing delay between attempts to avoid rate limits
        if (attempt > 0 || keyIndex > 0) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`[MANGA-CLASSIFIER] Waiting ${delay.toFixed(0)}ms before retry (key ${keyIndex + 1}, attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await fn(getAIInstance(keyIndex));
      } catch (error: any) {
        lastError = error;
        console.error(`[MANGA-CLASSIFIER] Error with API key ${keyIndex + 1}, attempt ${attempt + 1}:`, 
                     error.message || 'Unknown error');
        
        // If it's not a rate limit error, try the other key
        if (!error.message?.includes('too many requests') && 
            !error.message?.includes('rate limit') && 
            !error.message?.includes('429')) {
          break; // Break the retry loop for this key, try next key
        }
      }
    }
  }
  
  // All attempts failed
  throw lastError || new Error('All API requests failed');
}

// Process a single image with enhanced context awareness and visual cues analysis
export async function processEnhancedImage(
  imagePath: string, 
  previousMood: string | null, 
  previousFilename: string | null,
  nextFilename: string | null,
  previousContext: string,
  model: any
): Promise<ClassificationResult> {
  try {
    const filename = path.basename(imagePath);
    console.log(`[MANGA-CLASSIFIER] Enhanced processing of: ${filename}`);
    
    // Create image part for the model
    const imageData = fs.readFileSync(imagePath);
    const imageBase64 = imageData.toString('base64');
    const mimeType = `image/${path.extname(imagePath).substring(1)}`;
    const imagePart = { 
      inlineData: {
        data: imageBase64,
        mimeType: mimeType
      }
    };
    
    // Build narrative context description based on previous analysis
    let contextDescription = "This is the first page of the chapter.";
    if (previousMood && previousFilename) {
      contextDescription = `The previous page (${previousFilename}) was classified as "${previousMood}". ${previousContext}`;
    }
    
    // Page position context
    let positionContext = "";
    if (!previousFilename && nextFilename) {
      positionContext = "This is the first page of the chapter.";
    } else if (!nextFilename && previousFilename) {
      positionContext = "This is the last page of the chapter.";
    } else if (previousFilename && nextFilename) {
      positionContext = "This is a middle page of the chapter.";
    }
    
    // Create the enhanced prompt with visual cues for each mood
    const textPart = { text: `You are an expert manga analyst specializing in Detective Conan/Case Closed. Analyze this manga page carefully. ${positionContext} ${contextDescription}

I need you to classify this page (${filename}) into exactly one of these mood categories:

1. investigation: 
   - Visual cues: Characters examining crime scenes, discussing clues, thoughtful expressions
   - Examples: Detectives looking at evidence, characters interviewing witnesses
   - Text cues: Dialog about crime details, hypothesizing about cases

2. suspense: 
   - Visual cues: Tense face expressions, dramatic angles, shadows, close-ups
   - Examples: Characters looking worried/shocked, someone being followed
   - Text cues: Ominous dialog, warning statements, threatening messages

3. action: 
   - Visual cues: Motion lines, dynamic poses, impact effects, speed indicators
   - Examples: Chase scenes, fighting, running, physical confrontation
   - Text cues: Exclamations, sound effects indicating physical activity

4. revelation: 
   - Visual cues: Wide-eyed expressions, pointing gestures, dramatic close-ups
   - Examples: Character solving a case, villain being unmasked, truth being told
   - Text cues: "The culprit is..." statements, confession dialog

5. conclusion: 
   - Visual cues: Relaxed poses, explanatory gestures, case wrap-up visuals
   - Examples: Post-case discussions, culprit being taken away, case summary
   - Text cues: Explanation of how the crime occurred, concluding remarks

6. casual: 
   - Visual cues: Relaxed expressions, everyday settings, regular clothing
   - Examples: Characters eating together, school scenes, casual conversation
   - Text cues: Friendly banter, jokes, everyday conversation

7. tragic: 
   - Visual cues: Crying expressions, downcast eyes, dark tones, rain effects
   - Examples: Death scenes, character mourning, tragic revelations
   - Text cues: Somber dialog, expressions of grief or regret

Analyze the visual elements in the following order:
1. Character facial expressions and body language
2. Scene composition and environmental elements
3. Text/dialog content and tone
4. Narrative position (considering previous page's mood)

Then use this structured thought process:
1. Identify the most prominent visual and textual elements that indicate mood
2. Consider how this page relates to the previous mood "${previousMood || "none"}"
3. Determine the primary mood category for this page
4. Assess your confidence in this classification (low, medium, high)
5. Consider if this classification creates an unnatural transition from the previous mood

Respond in this exact JSON format:
{
  "mood": "[ONE CATEGORY FROM THE LIST]",
  "confidence": "[LOW/MEDIUM/HIGH]",
  "visual_elements": "[BRIEF DESCRIPTION OF KEY VISUAL ELEMENTS]",
  "reasoning": "[SHORT EXPLANATION OF WHY THIS MOOD WAS CHOSEN]",
  "narrative_flow": "[COMMENT ON HOW THIS MOOD TRANSITIONS FROM THE PREVIOUS]"
}

Make sure you ONLY use one of the exact seven mood categories listed above in lowercase.` };
    
    console.log(`[MANGA-CLASSIFIER] Sending enhanced request to Gemini for ${filename}`);
    
    // Combine parts and send to the model
    const parts = [imagePart, textPart];
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    
    const response = await result.response.text();
    console.log(`[MANGA-CLASSIFIER] Received enhanced response from Gemini:`, response);
    
    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from response (handling possible text before/after the JSON)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(`[MANGA-CLASSIFIER] Error parsing JSON response:`, error);
    }
    
    // Extract the mood and other data
    let category = 'investigation'; // Default fallback
    let confidence: number | undefined = undefined;
    let explanation: string | undefined = undefined;
    
    if (parsedResponse && parsedResponse.mood) {
      const extractedMood = parsedResponse.mood.toLowerCase();
      const validMoods = ['investigation', 'suspense', 'action', 'revelation', 'conclusion', 'casual', 'tragic'];
      
      if (validMoods.includes(extractedMood)) {
        category = extractedMood as any;
      }
      
      // Convert confidence string to numeric value
      if (parsedResponse.confidence) {
        switch(parsedResponse.confidence.toLowerCase()) {
          case 'high': confidence = 0.9; break;
          case 'medium': confidence = 0.7; break;
          case 'low': confidence = 0.5; break;
          default: confidence = 0.6; // Default medium-low
        }
      }
      
      // Compile explanation from various fields
      explanation = [
        parsedResponse.visual_elements, 
        parsedResponse.reasoning, 
        parsedResponse.narrative_flow
      ].filter(Boolean).join(" | ");
    } else {
      // Fallback to regex extraction if JSON parsing failed
      const moodMatch = response.match(/["']mood["']\s*:\s*["'](\w+)["']/i);
      if (moodMatch && moodMatch[1]) {
        const extractedMood = moodMatch[1].toLowerCase();
        const validMoods = ['investigation', 'suspense', 'action', 'revelation', 'conclusion', 'casual', 'tragic'];
        if (validMoods.includes(extractedMood)) {
          category = extractedMood as any;
        }
      }
    }
    
    console.log(`[MANGA-CLASSIFIER] Final classification for ${filename}: ${category} (confidence: ${confidence || 'unknown'})`);
    
    return {
      filename: filename,
      category: category as any,
      confidence: confidence,
      explanation: explanation
    };
    
  } catch (error) {
    console.error(`[MANGA-CLASSIFIER] Error in enhanced classification:`, error);
    
    // Return default classification
    return {
      filename: path.basename(imagePath),
      category: 'investigation' as any, // Default fallback
      confidence: 0.5, // Medium-low confidence for error cases
      explanation: "Classification error occurred, defaulting to investigation"
    };
  }
}

// Function to classify multiple images in a chapter using Gemini AI with improved load balancing
export async function classifyChapter(imageFiles: string[]): Promise<ClassificationResult[]> {
  console.log(`[MANGA-CLASSIFIER] Starting enhanced classification of ${imageFiles.length} images with improved load balancing`);
  
  const results: ClassificationResult[] = [];
  let previousMood: string | null = null;
  let previousContext: string = "";
  
  // Process images in smaller batches to reduce rate limit issues
  const batchSize = 5; // Process 5 images per batch
  const batches: string[][] = [];
  
  // Split images into smaller batches
  for (let i = 0; i < imageFiles.length; i += batchSize) {
    batches.push(imageFiles.slice(i, i + batchSize));
  }
  
  console.log(`[MANGA-CLASSIFIER] Split workload into ${batches.length} batches of up to ${batchSize} images each`);
  
  // Alternate API keys between batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const keyIndex = batchIndex % 2; // Alternate between key 0 and key 1
    
    console.log(`[MANGA-CLASSIFIER] Processing batch ${batchIndex + 1}/${batches.length} with API key ${keyIndex + 1}`);
    
    // Add delay between batches to avoid rate limits
    if (batchIndex > 0) {
      const delay = 2000 + Math.random() * 1000;
      console.log(`[MANGA-CLASSIFIER] Waiting ${delay.toFixed(0)}ms between batches`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Process each image in the batch
    for (let i = 0; i < batch.length; i++) {
      const imagePath = batch[i];
      const globalIndex = batchIndex * batchSize + i;
      console.log(`[MANGA-CLASSIFIER] Processing image ${globalIndex + 1}/${imageFiles.length} (Batch ${batchIndex + 1}, API key ${keyIndex + 1})`);
      
      try {
        // Add small delay between individual images
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        }
        
        const result = await executeWithFallback(async (genAI) => {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          return processEnhancedImage(
            imagePath, 
            previousMood, 
            globalIndex > 0 ? path.basename(imageFiles[globalIndex - 1]) : null,
            globalIndex < imageFiles.length - 1 ? path.basename(imageFiles[globalIndex + 1]) : null,
            previousContext,
            model
          );
        });
        
        results.push(result);
        previousMood = result.category;
        previousContext = result.explanation || "";
      } catch (error) {
        console.error(`[MANGA-CLASSIFIER] Failed to process image ${path.basename(imagePath)}, using fallback:`, error);
        
        // Use a fallback classification based on previous mood or default to investigation
        const fallbackCategory = previousMood || 'investigation';
        const fallbackResult: ClassificationResult = {
          filename: path.basename(imagePath),
          category: fallbackCategory as any,
          confidence: 0.5,
          explanation: `Failed to process image, fallback based on previous page mood: ${fallbackCategory}`
        };
        
        results.push(fallbackResult);
        previousMood = fallbackResult.category;
        previousContext = fallbackResult.explanation || "";
      }
    }
  }
  
  // Second pass: Smooth out any abrupt transitions
  smoothTransitions(results);
  
  console.log(`[MANGA-CLASSIFIER] Enhanced classification complete. Total results: ${results.length}`);
  
  return results;
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