import { NextResponse } from 'next/server';
import { getStorageClient } from '@/utils/gcsUtils';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chapterNumber: string; pageNumber: string }> }
) {
  const { chapterNumber, pageNumber } = await params;
  const chapterNum = Number(chapterNumber);
  const pageNum = Number(pageNumber);
  if (isNaN(chapterNum) || isNaN(pageNum)) {
    return NextResponse.json({ error: 'Invalid chapterNumber or pageNumber' }, { status: 400 });
  }

  try {
    // Fetch chapter_number from DB
    const { data: chapter, error: chapError } = await supabase
      .from('manga_chapters')
      .select('chapter_number')
      .eq('chapter_number', chapterNum)
      .single();
    if (chapError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const chapterNumVal = chapter.chapter_number;
    const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME!;
    // Initialize GCS client
    const storage = getStorageClient();
    const gcsObjectPath = `chapters/${chapterNumVal}/${pageNum}.jpg`;
    const file = storage.bucket(bucketName).file(gcsObjectPath);

    // Generate signed URL
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error('[API /api/chapters/[chapterNumber]/images/[pageNumber] GET] Error:', err);
    // Return the actual error message for debugging
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
