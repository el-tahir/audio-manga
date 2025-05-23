import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ClassificationResult } from '@/types';
import { MOOD_CATEGORIES } from '@/config/constants';

// Constants for API handling
const MAX_RETRIES = 3; // Maximum retry attempts
const REQUEST_TIMEOUT = 60000; // 60 second timeout for API calls

/**
 * Retrieves a GoogleGenerativeAI instance, selecting an API key based on the provided index.
 * Defaults to the primary API key if no index or index 0 is provided.
 * @param {number} [keyIndex] - Optional index (0 or 1) to select a specific API key.
 * @returns {GoogleGenerativeAI} An initialized GoogleGenerativeAI client.
 * @throws {Error} If the selected API key is not defined in environment variables.
 */
function getAIInstance(keyIndex?: number): GoogleGenerativeAI {
  // If specific key index is requested, use it; otherwise use the first one as default
  const apiKey = keyIndex === 1 ? process.env.GOOGLE_API_KEY_2 : process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      `API key ${keyIndex === 1 ? '2' : '1'} is not defined in environment variables`
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Executes a function with AI API fallback capabilities.
 * Tries multiple API keys with exponential backoff retry logic.
 *
 * @param fn - Function to execute with AI instance
 * @param maxRetries - Maximum number of retries per API key
 * @returns Promise resolving to the function result
 * @throws Error if all attempts fail
 */
export async function executeWithFallback<T>(
  fn: (genAI: GoogleGenerativeAI) => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  let totalAttempts = 0;

  for (let keyIndex = 0; keyIndex < 2; keyIndex++) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      totalAttempts++;
      try {
        // Add increasing delay between attempts to avoid rate limits
        if (attempt > 0 || keyIndex > 0) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(new Error(`API request timed out after ${REQUEST_TIMEOUT / 1000} seconds`)),
            REQUEST_TIMEOUT
          );
        });

        // Execute the function with a timeout
        const result = (await Promise.race([fn(getAIInstance(keyIndex)), timeoutPromise])) as T;

        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorType = getErrorType(error);

        console.error(
          `[MANGA-CLASSIFIER] ${errorType} error with API key ${keyIndex + 1}, attempt ${attempt + 1}:`,
          error
        );

        // If it's not a rate limit error, try the other key
        if (!isRateLimitError(error)) {
          break; // Break the retry loop for this key, try next key
        }
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(
    `[MANGA-CLASSIFIER] All API requests failed after ${totalAttempts} attempts (${totalTime}s):`,
    lastError
  );

  // Trigger garbage collection if available (in Node.js environments)
  if (global.gc) {
    try {
      global.gc();
    } catch {
      // Ignore if not available
    }
  }

  // All attempts failed
  throw lastError || new Error('All API requests failed');
}

/**
 * Determines a generic error type string from an error object based on its message.
 * @param {Error | unknown} error - The error object.
 * @returns {string} A string categorizing the error (e.g., 'Rate limit', 'Timeout', 'Network', 'API', 'Unknown').
 */
function getErrorType(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (!errorMessage) return 'Unknown';

  if (
    errorMessage.includes('too many requests') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('429')
  ) {
    return 'Rate limit';
  }

  if (errorMessage.includes('timeout')) {
    return 'Timeout';
  }

  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return 'Network';
  }

  if (errorMessage.includes('invalid') || errorMessage.includes('format')) {
    return 'Format';
  }

  return 'API';
}

/**
 * Checks if an error object indicates a rate limit error based on its message.
 * @param {Error | unknown} error - The error object.
 * @returns {boolean} True if the error is related to rate limiting, false otherwise.
 */
function isRateLimitError(error: Error | unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage?.includes('too many requests') ||
    errorMessage?.includes('rate limit') ||
    errorMessage?.includes('429')
  );
}

/**
 * Generates the mood categories list for the AI prompt using centralized constants.
 * @returns {string} Formatted list of mood categories with descriptions
 */
function generateMoodCategoriesPrompt(): string {
  return MOOD_CATEGORIES.map((category, index) => {
    const description = getCategoryDescription(category);
    return `${index + 1}. **${category}:** ${description}`;
  }).join('\n');
}

/**
 * Gets a detailed description for each mood category for the AI prompt.
 * @param {string} category - The mood category
 * @returns {string} Description of the category
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    intro: 'Establishing scene/case, opening narration',
    love: 'Romantic moments, general romantic tension',
    love_ran: "Specific focus on Ran's feelings for Shinichi",
    casual: 'Everyday interactions outside the case',
    adventure: 'Light investigation, exploration moments',
    comedy: 'Humorous elements, comic relief',
    action_casual: 'Standard chase/confrontation, lower stakes',
    action_serious: 'High-stakes, dangerous situations',
    tragic: 'Emotional, sad moments',
    tension: 'Suspense building, mystery development',
    confrontation: 'Facing suspects, accusation phase',
    investigation: 'Active clue gathering, deduction',
    revelation: 'Case solution explanation, "aha" moment',
    conclusion: 'Case wrap-up, aftermath',
  };
  return descriptions[category] || 'Unknown category';
}

/**
 * Processes three consecutive manga images to determine mood classifications.
 * Provides context while keeping API requests manageable.
 *
 * @param imageFiles - Array of 3 image file paths
 * @param previousMood - Previous sequence's mood for context
 * @param previousContext - Additional context from previous pages
 * @param model - AI model instance
 * @returns Promise resolving to classification results for all 3 images
 */
export async function processTripleImages(
  imageFiles: string[],
  previousMood: string | null,
  previousContext: string,
  model: GenerativeModel
): Promise<ClassificationResult[]> {
  try {
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
          mimeType: mimeType,
        },
      });
    }

    // Build context information
    const positionContext = previousMood
      ? `Previous sequence ended with mood: ${previousMood}`
      : 'This is the beginning of the chapter';

    // Create the prompt for analyzing three consecutive images with dynamic categories
    const textPart = {
      text: `You are a specialized Detective Conan manga analyst for soundtrack optimization. Your task is to analyze 3 consecutive manga pages and classify each page's dominant mood for precise OST mapping.

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
${generateMoodCategoriesPrompt()}

**Response Format:**
Return a valid JSON array with exactly 3 objects, one for each page in order:
[
  {"filename": "exact_filename", "category": "chosen_mood", "explanation": "why_this_mood"},
  {"filename": "exact_filename", "category": "chosen_mood", "explanation": "why_this_mood"},
  {"filename": "exact_filename", "category": "chosen_mood", "explanation": "why_this_mood"}
]

Only return the JSON array, no additional text.`,
    };

    console.log(`[MANGA-CLASSIFIER] Sending 3-image request to Gemini`);
    const result = await model.generateContent([textPart, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    if (!text?.trim()) {
      throw new Error('Empty response from Gemini API');
    }

    console.log(`[MANGA-CLASSIFIER] Received 3-image response from Gemini`);

    // Parse JSON response
    let parsedResults: ClassificationResult[];
    try {
      // Clean the response text to extract JSON
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      parsedResults = JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error(`[MANGA-CLASSIFIER] Error parsing JSON response:`, error);
      console.error('Raw response:', text);
      throw new Error(`Failed to parse API response as JSON: ${error}`);
    }

    // Validate and correct the response
    if (!Array.isArray(parsedResults) || parsedResults.length !== imageFiles.length) {
      throw new Error(
        `Expected ${imageFiles.length} classifications, got ${parsedResults?.length || 0}`
      );
    }

    // Map classifications to filenames
    const results: ClassificationResult[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const expectedFilename = path.basename(imageFiles[i]);
      const classification = parsedResults[i];

      if (!classification?.category) {
        console.warn(
          `[MANGA-CLASSIFIER] Missing category for ${expectedFilename}, defaulting to 'casual'`
        );
      }

      const mood = classification?.category || 'casual';
      if (!MOOD_CATEGORIES.includes(mood)) {
        console.warn(
          `[MANGA-CLASSIFIER] Invalid mood '${mood}' for ${expectedFilename}, defaulting to 'casual'`
        );
      }

      const filename = expectedFilename;
      const category = MOOD_CATEGORIES.includes(mood) ? mood : 'casual';
      const explanation = classification?.explanation || 'Default classification';

      results.push({ filename, category, explanation });
      console.log(`[MANGA-CLASSIFIER] Classified ${filename}: ${category}`);
    }

    return results;
  } catch (error) {
    console.error(`[MANGA-CLASSIFIER] Error in 3-image classification:`, error);
    throw error;
  }
}

/**
 * Classifies an entire chapter by processing images in groups of 3.
 * Provides better context than individual image classification.
 *
 * @param imageFiles - Array of image file paths to classify
 * @returns Promise resolving to classification results for all images
 */
export async function classifyChapter(imageFiles: string[]): Promise<ClassificationResult[]> {
  if (imageFiles.length === 0) {
    console.log(`[MANGA-CLASSIFIER] No images to process.`);
    return [];
  }

  const allResults: ClassificationResult[] = [];
  let previousMood: string | null = null;
  let previousContext = '';

  console.log(`[MANGA-CLASSIFIER] Starting chapter classification for ${imageFiles.length} images`);

  // Process images in groups of 3
  for (let i = 0; i < imageFiles.length; i += 3) {
    const group = imageFiles.slice(i, i + 3);
    if (group.length === 0) break;

    // Pad incomplete groups with the last available image to maintain context
    while (group.length < 3 && group.length < imageFiles.length) {
      group.push(group[group.length - 1]);
    }

    try {
      const groupResults = await executeWithFallback(async genAI => {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        return await processTripleImages(group, previousMood, previousContext, model);
      });

      // Only keep results for actual images (not padded duplicates)
      const actualResults = groupResults.slice(0, Math.min(3, imageFiles.length - i));
      allResults.push(...actualResults);

      // Update context for next group
      if (actualResults.length > 0) {
        const lastResult = actualResults[actualResults.length - 1];
        previousMood = lastResult.category;
        previousContext = lastResult.explanation || '';
      }

      // Add delay between groups to respect rate limits
      if (i + 3 < imageFiles.length) {
        const delay = 1000 + Math.random() * 1000; // 1-2 seconds
        console.log(`[MANGA-CLASSIFIER] Waiting ${delay.toFixed(0)}ms before next group`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`[MANGA-CLASSIFIER] Error processing image group:`, error);
      // Continue with next group
      const failedGroup = group.slice(0, Math.min(3, imageFiles.length - i));
      for (const imagePath of failedGroup) {
        allResults.push({
          filename: path.basename(imagePath),
          category: 'casual',
          explanation: 'Failed to classify, using default',
        });
      }
    }
  }

  console.log(`[MANGA-CLASSIFIER] Chapter classification complete: ${allResults.length} results`);

  return allResults;
}

/**
 * Smooths mood transitions by reducing frequent changes between similar moods.
 * Modifies the results array in place.
 *
 * @param results - Array of classification results to smooth
 */
export function smoothTransitions(results: ClassificationResult[]): void {
  if (results.length < 3) return;

  console.log(`[MANGA-CLASSIFIER] Smoothing transitions for ${results.length} classifications`);

  // Simple smoothing: if a mood appears for only 1 page between longer sequences,
  // consider changing it to match the surrounding mood
  for (let i = 1; i < results.length - 1; i++) {
    const prev = results[i - 1].category;
    const current = results[i].category;
    const next = results[i + 1].category;

    // If current is different from both neighbors, but neighbors are the same
    if (prev === next && current !== prev) {
      results[i].category = prev;
      results[i].explanation = `Smoothed from ${current} to ${prev} for transition continuity`;
    }
  }
}
