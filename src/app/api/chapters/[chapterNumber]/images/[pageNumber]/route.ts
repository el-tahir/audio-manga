import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSignedUrlForPage } from '@/lib/gcsService';

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
    // Optional: Still check if chapter exists in DB if needed
    const { data: chapter, error: chapError } = await supabase
      .from('manga_chapters')
      .select('chapter_number')
      .eq('chapter_number', chapterNum)
      .maybeSingle(); // Use maybeSingle or check existence as needed

    if (chapError) {
      console.error('[API Image GET] DB Error:', chapError);
      // It's currently decided that a DB error during chapter check should not prevent signed URL generation attempt.
    }
    if (!chapter && !chapError) { // Only fail if definitively not found (and no DB error)
         return NextResponse.json({ error: 'Chapter not found in DB' }, { status: 404 });
    }

    // *** Call the utility function ***
    const signedUrl = await getSignedUrlForPage(chapterNum, pageNum);

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error('[API /api/chapters/.../images/... GET] Error:', err);
    // Return the actual error message for debugging
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
