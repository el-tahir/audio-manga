import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createGCSClient } from '@/utils/gcsUtils';
import { MOOD_CATEGORIES } from '@/config/constants';
import type { Storage } from '@google-cloud/storage';

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'audio-manga';

// Zod schema for mood query parameter validation
const MoodQuerySchema = z.enum(MOOD_CATEGORIES, {
  errorMap: () => ({
    message: `Invalid mood. Must be one of: ${MOOD_CATEGORIES.join(', ')}`,
  }),
});

export async function GET(request: NextRequest) {
  let storage: Storage;
  try {
    storage = createGCSClient();
  } catch (err) {
    console.error('[API /api/audio/random] GCS client init error:', err);
    return new NextResponse('Server configuration error: Google Cloud credentials missing', {
      status: 500,
    });
  }
  console.log('API route triggered with params:', request.nextUrl.searchParams.toString());
  console.log('Environment variables:', {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    bucketName,
  });

  // Validate mood parameter with Zod
  const moodParam = request.nextUrl.searchParams.get('mood');
  if (!moodParam) {
    return NextResponse.json(
      {
        error: 'Mood parameter is required',
        validMoods: MOOD_CATEGORIES,
      },
      { status: 400 }
    );
  }

  const validationResult = MoodQuerySchema.safeParse(moodParam);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid mood parameter',
        details: validationResult.error.errors[0].message,
        validMoods: MOOD_CATEGORIES,
        provided: moodParam,
      },
      { status: 400 }
    );
  }

  const mood = validationResult.data;

  try {
    console.log(`Accessing bucket: ${bucketName}`);
    const bucket = storage.bucket(bucketName);
    console.log(`Looking for files with prefix: audio/${mood}/`);
    const [files] = await bucket.getFiles({
      prefix: `audio/${mood}/`,
      delimiter: '/',
    });
    console.log(`Found ${files.length} files for mood: ${mood}`);

    const audioFiles = files.filter(file => /\.(mp3|wav|ogg)$/i.test(file.name));
    console.log(`After filtering, found ${audioFiles.length} audio files`);
    if (audioFiles.length === 0) {
      return NextResponse.json(
        {
          error: `No audio files found for mood: ${mood}`,
          mood: mood,
        },
        { status: 404 }
      );
    }

    const randomFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
    console.log(`Selected file: ${randomFile.name}`);

    console.log('Generating signed URL');
    const [url] = await randomFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    console.log('Successfully generated signed URL');

    const response = NextResponse.json({
      url,
      mood: mood,
      filename: randomFile.name,
    });
    response.headers.set('Cache-Control', 'public, max-age=300');
    return response;
  } catch (error) {
    console.error('Error accessing audio files:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        error: 'Error accessing audio files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
