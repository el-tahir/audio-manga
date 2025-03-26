import { NextResponse } from "next/server";
import path from 'path';

// Import utility functions and types
import { saveFile, cleanupTempFiles, extractChapterNumber, saveToPublicDirectory, saveImagesToPublicDirectory } from '@/utils/manga-classifier/fileUtils';
import { extractArchive } from '@/utils/manga-classifier/archiveUtils';
import { getImageFiles } from '@/utils/manga-classifier/imageUtils';
import { classifyChapter } from '@/services/manga-classifier/aiService';
import { chapterExistsInDatabase, storeClassificationsInDatabase } from '@/services/manga-classifier/dbService';
import { ClassificationResult } from '@/utils/manga-classifier/types';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

export async function POST(request: Request) {
  const tempDirs: string[] = [];
  
  try {
    const formData = await request.formData();
    
    // Save the uploaded file
    const filePath = await saveFile(formData);
    const tempDir = path.dirname(filePath);
    tempDirs.push(tempDir);
    
    // Extract chapter number from filename
    const fileName = path.basename(filePath);
    const chapterNumber = extractChapterNumber(fileName);
    
    if (!chapterNumber) {
      throw new Error('Could not determine chapter number from filename. Please use format "12.cbr" for chapter 12.');
    }
    
    // Check if chapter already exists in database
    const exists = await chapterExistsInDatabase(chapterNumber);
    
    // Save the file to public/chapters regardless of whether it exists in database
    // This ensures we always have the latest version locally
    const publicFilePath = await saveToPublicDirectory(filePath, chapterNumber);
    
    // Extract the archive
    const extractDir = await extractArchive(filePath);
    
    // Get all image files
    const imageFiles = getImageFiles(extractDir);
    
    if (imageFiles.length === 0) {
      throw new Error('No image files found in the archive');
    }
    
    // Save individual images to public directory
    const imagesDir = await saveImagesToPublicDirectory(imageFiles, chapterNumber);
    const imageCount = imageFiles.length;
    
    if (exists) {
      return NextResponse.json({ 
        success: true,
        exists: true,
        message: `Chapter ${chapterNumber} already exists in database`,
        chapterNumber,
        localPath: `/chapters/${chapterNumber}${path.extname(filePath)}`,
        imagesPath: `/chapters/${chapterNumber}`,
        imageCount
      });
    }
    
    // Process the entire chapter with load balancing between API keys
    const classifications = await classifyChapter(imageFiles);
    
    try {
      // Store classifications in database with improved error handling
      await storeClassificationsInDatabase(chapterNumber, classifications);
    } catch (dbError) {
      console.error('Database storage error:', dbError);
      // Return partial success - we have classifications but storage failed
      return NextResponse.json({ 
        success: true,
        storageError: true,
        errorMessage: dbError instanceof Error ? dbError.message : 'Unknown database error',
        chapterNumber,
        classifications,
        totalImages: imageFiles.length,
        localPath: `/chapters/${chapterNumber}${path.extname(filePath)}`,
        imagesPath: `/chapters/${chapterNumber}`,
        imageCount
      }, { status: 207 }); // 207 Multi-Status
    }
    
    return NextResponse.json({ 
      success: true,
      exists: false,
      chapterNumber,
      classifications,
      totalImages: imageFiles.length,
      localPath: `/chapters/${chapterNumber}${path.extname(filePath)}`,
      imagesPath: `/chapters/${chapterNumber}`,
      imageCount
    });
  } catch (error) {
    console.error('Manga Classifier API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process manga archive' },
      { status: 500 }
    );
  } finally {
    // Clean up temp directories
    for (const dir of tempDirs) {
      cleanupTempFiles(dir);
    }
  }
}
