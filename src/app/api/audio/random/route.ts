import { NextRequest, NextResponse } from 'next/server';
import { getStorageClient } from '@/utils/gcsUtils';
import type { Storage } from '@google-cloud/storage';

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'audio-manga';

export async function GET(request: NextRequest) {
  let storage: Storage;
  try {
    storage = getStorageClient();
  } catch (err) {
    console.error('[API /api/audio/random] GCS client init error:', err);
    return new NextResponse('Server configuration error: Google Cloud credentials missing', { status: 500 });
  }
  console.log('API route triggered with params:', request.nextUrl.searchParams.toString());
  console.log('Environment variables:', { projectId: process.env.GOOGLE_CLOUD_PROJECT_ID, bucketName });

  const mood = request.nextUrl.searchParams.get('mood');
  if (!mood) {
    return new NextResponse('Mood parameter is required', { status: 400 });
  }

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
      return new NextResponse(`No audio files found for mood: ${mood}`, { status: 404 });
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

    const response = NextResponse.json({ url });
    response.headers.set('Cache-Control', 'public, max-age=300');
    return response;
  } catch (error) {
    console.error('Error accessing audio files:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return new NextResponse(`Error accessing audio files: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
