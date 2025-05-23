import { DETECTIVE_CONAN_SLUG } from '@/config/constants';

export interface ChapterImageUrls {
  imageUrls: string[];
  totalPages: number;
}

/**
 * Fetches manga chapter data from the Cubari API.
 * Handles series data retrieval, chapter existence validation, and image URL extraction.
 *
 * @param chapterNumber - The chapter number to fetch (supports decimal numbers like 1128.5)
 * @returns Promise resolving to an array of image URLs for the chapter pages
 * @throws Error if chapter is not found or API request fails
 * @example
 * ```typescript
 * const imageUrls = await fetchChapterFromCubari("1128");
 * console.log(imageUrls.length); // Number of pages in the chapter
 * ```
 */
export async function fetchChapterFromCubari(chapterNumber: string): Promise<string[]> {
  const seriesUrl = 'https://cubari.moe/read/api/imgur/ennEHNL/';

  try {
    console.log(`[CubariService] Fetching series data from: ${seriesUrl}`);

    // Fetch the series metadata
    const seriesResponse = await fetch(seriesUrl);
    if (!seriesResponse.ok) {
      throw new Error(`Failed to fetch series data: ${seriesResponse.status}`);
    }

    const seriesData = await seriesResponse.json();
    console.log('[CubariService] Successfully fetched series data.');

    // Check if the chapter exists
    const chapters = seriesData.chapters || {};
    if (!chapters[chapterNumber]) {
      console.log(`[CubariService] Chapter ${chapterNumber} not found in series data.`);
      throw new Error(`Chapter ${chapterNumber} not found.`);
    }

    // Get the first group from the chapter (Cubari supports multiple scan groups)
    const chapterData = chapters[chapterNumber];
    const groups = chapterData.groups || {};
    const firstGroupKey = Object.keys(groups)[0];

    if (!firstGroupKey) {
      throw new Error(`No scan groups found for chapter ${chapterNumber}.`);
    }

    console.log(`[CubariService] Using first available group: ${firstGroupKey}`);

    // Fetch detailed chapter information
    const chapterPath = groups[firstGroupKey];
    const chapterDetailsUrl = `https://cubari.moe/read/api/imgur/ennEHNL/${chapterPath}`;

    console.log(`[CubariService] Fetching chapter details from: ${chapterDetailsUrl}`);

    const chapterResponse = await fetch(chapterDetailsUrl);
    if (!chapterResponse.ok) {
      throw new Error(
        `Failed to fetch chapter details: ${chapterResponse.status} ${chapterResponse.statusText}`
      );
    }

    const chapterDetails = await chapterResponse.json();
    console.log('[CubariService] Successfully fetched chapter details.');

    // Extract image URLs from the response
    let imageUrls: string[] = [];

    if (chapterDetails.pages && Array.isArray(chapterDetails.pages)) {
      // Standard format: pages array
      imageUrls = chapterDetails.pages;
    } else if (chapterDetails && typeof chapterDetails === 'object') {
      // Alternative format: pages as object with numeric keys
      const pageKeys = Object.keys(chapterDetails).filter(key => !isNaN(Number(key)));
      imageUrls = pageKeys.sort((a, b) => Number(a) - Number(b)).map(key => chapterDetails[key]);
    } else {
      console.warn('[CubariService] Unexpected chapter details structure:', chapterDetails);
      throw new Error('Unable to extract image URLs from chapter data.');
    }

    if (imageUrls.length === 0) {
      console.log(`[CubariService] No pages found for chapter ${chapterNumber}.`);
    } else {
      console.log(`[CubariService] Found ${imageUrls.length} pages for chapter ${chapterNumber}.`);
    }

    return imageUrls;
  } catch (error) {
    console.error(`[CubariService] Error fetching chapter ${chapterNumber}:`, error);
    throw error;
  }
}

/**
 * Checks if a specific chapter exists in the Cubari series without downloading it.
 * Useful for validation before attempting to process a chapter.
 *
 * @param chapterNumber - The chapter number to check for existence
 * @returns Promise resolving to true if chapter exists, false otherwise
 * @example
 * ```typescript
 * const exists = await doesChapterExist("1128");
 * if (exists) {
 *   console.log("Chapter is available for download");
 * }
 * ```
 */
export async function doesChapterExist(chapterNumber: string): Promise<boolean> {
  try {
    const seriesUrl = 'https://cubari.moe/read/api/imgur/ennEHNL/';
    const seriesResponse = await fetch(seriesUrl);

    if (!seriesResponse.ok) {
      return false;
    }

    const seriesData = await seriesResponse.json();
    const chapters = seriesData.chapters || {};

    return !!chapters[chapterNumber];
  } catch (error) {
    console.error(`[CubariService] Error checking chapter existence for ${chapterNumber}:`, error);
    return false;
  }
}

/**
 * Fetches chapter image URLs from the Cubari API.
 * This service handles the complex multi-step API interaction with Cubari's weebcentral API.
 *
 * @param chapterNumber - The chapter number to fetch image URLs for
 * @returns Promise resolving to array of image URLs and total page count, or null if chapter not found
 * @throws Error if API requests fail or chapter data is malformed
 */
export async function getChapterImageUrls(chapterNumber: string): Promise<ChapterImageUrls | null> {
  // Step 1: Fetch Series Data
  const seriesUrl = `https://cubari.moe/read/api/weebcentral/series/${DETECTIVE_CONAN_SLUG}/`;
  console.log(`[CubariService] Fetching series data from: ${seriesUrl}`);

  try {
    const seriesRes = await fetch(seriesUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!seriesRes.ok) {
      // Check if it's a 500 error specifically
      if (seriesRes.status === 500) {
        throw new Error(
          `Cubari API is currently experiencing issues (500 Internal Server Error). The service may be temporarily down. Please try again later.`
        );
      } else if (seriesRes.status === 404) {
        throw new Error(
          `Detective Conan series not found in Cubari API (404). The series slug may have changed.`
        );
      } else {
        throw new Error(`Failed to fetch series data: ${seriesRes.status} ${seriesRes.statusText}`);
      }
    }

    const seriesData = await seriesRes.json();
    console.log('[CubariService] Successfully fetched series data.');

    // Step 2: Find Chapter and Group URL
    const chapterData = seriesData?.chapters?.[chapterNumber];
    if (!chapterData) {
      console.log(`[CubariService] Chapter ${chapterNumber} not found in series data.`);
      return null;
    }

    let groupUrl = chapterData.groups?.['1']; // Try group '1' first
    if (!groupUrl && chapterData.groups && Object.keys(chapterData.groups).length > 0) {
      const firstGroupKey = Object.keys(chapterData.groups)[0];
      groupUrl = chapterData.groups[firstGroupKey];
      console.log(`[CubariService] Using first available group: ${firstGroupKey}`);
    }

    if (!groupUrl) {
      throw new Error(`No group URL found for chapter ${chapterNumber}.`);
    }

    // Step 3: Fetch Chapter Details
    const chapterDetailsUrl = `https://cubari.moe${groupUrl}`;
    console.log(`[CubariService] Fetching chapter details from: ${chapterDetailsUrl}`);

    const chapterDetailsRes = await fetch(chapterDetailsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!chapterDetailsRes.ok) {
      throw new Error(
        `Failed to fetch chapter details: ${chapterDetailsRes.status} ${chapterDetailsRes.statusText}`
      );
    }

    const chapterDetails = await chapterDetailsRes.json();
    console.log('[CubariService] Successfully fetched chapter details.');

    // Step 4: Extract Image URLs
    let imageUrls: string[] = [];
    if (Array.isArray(chapterDetails)) {
      imageUrls = chapterDetails;
    } else if (
      typeof chapterDetails === 'object' &&
      chapterDetails !== null &&
      Array.isArray(chapterDetails.pages)
    ) {
      imageUrls = chapterDetails.pages;
    } else {
      console.warn('[CubariService] Unexpected chapter details structure:', chapterDetails);
      throw new Error('Could not extract image URLs from chapter details.');
    }

    if (imageUrls.length === 0) {
      console.log(`[CubariService] No pages found for chapter ${chapterNumber}.`);
    } else {
      console.log(`[CubariService] Found ${imageUrls.length} pages for chapter ${chapterNumber}.`);
    }

    return {
      imageUrls,
      totalPages: imageUrls.length,
    };
  } catch (error) {
    console.error(`[CubariService] Error fetching chapter ${chapterNumber}:`, error);
    throw error;
  }
}

/**
 * Validates if a chapter exists in the Cubari API without fetching all image URLs.
 * This is a lighter-weight check compared to getChapterImageUrls.
 *
 * @param chapterNumber - The chapter number to check
 * @returns Promise resolving to true if chapter exists, false otherwise
 * @throws Error if API request fails
 */
export async function chapterExistsInCubari(chapterNumber: string): Promise<boolean> {
  try {
    const seriesUrl = `https://cubari.moe/read/api/weebcentral/series/${DETECTIVE_CONAN_SLUG}/`;
    const seriesRes = await fetch(seriesUrl);

    if (!seriesRes.ok) {
      throw new Error(`Failed to fetch series data: ${seriesRes.status} ${seriesRes.statusText}`);
    }

    const seriesData = await seriesRes.json();
    const chapterData = seriesData?.chapters?.[chapterNumber];

    return !!chapterData;
  } catch (error) {
    console.error(`[CubariService] Error checking chapter existence for ${chapterNumber}:`, error);
    throw error;
  }
}
