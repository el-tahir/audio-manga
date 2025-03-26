import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mood = searchParams.get('mood');

  if (!mood) {
    return new NextResponse('Mood parameter is required', { status: 400 });
  }

  try {
    // Define the path to the mood directory
    const moodDirPath = path.join(process.cwd(), 'public', 'audio', mood);
    
    // Check if directory exists
    if (!fs.existsSync(moodDirPath)) {
      return new NextResponse(`No audio files found for mood: ${mood}`, { status: 404 });
    }

    // Get list of all audio files in the directory
    const files = fs.readdirSync(moodDirPath)
      .filter(file => /\.(mp3|wav|ogg)$/i.test(file));
    
    if (files.length === 0) {
      return new NextResponse(`No audio files found for mood: ${mood}`, { status: 404 });
    }

    // Pick a random file
    const randomFile = files[Math.floor(Math.random() * files.length)];
    
    // Get the file path
    const filePath = path.join('audio', mood, randomFile);
    
    // Create response with cache control headers
    const response = NextResponse.redirect(new URL(`/${filePath}`, request.url));
    
    // Cache the result for 5 minutes to improve performance
    response.headers.set('Cache-Control', 'public, max-age=300');
    
    return response;
  } catch (error) {
    console.error('Error accessing audio files:', error);
    return new NextResponse('Error accessing audio files', { status: 500 });
  }
}
