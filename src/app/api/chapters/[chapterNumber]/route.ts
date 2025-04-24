import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { chapterNumber: string } }
) {
  try {
    const { chapterNumber: chapterNumberParam } = await params;
    const chapterNumber = Number(chapterNumberParam);
    if (isNaN(chapterNumber)) {
      return NextResponse.json(
        { error: 'Invalid chapterNumber' },
        { status: 400 }
      );
    }

    const { data: chapter, error } = await supabase
      .from('manga_chapters')
      .select('*')
      .eq('chapter_number', chapterNumber)
      .single();

    if (error || !chapter) {
      console.error('[API /api/chapters/[chapterNumber] GET] Not found or DB error:', error);
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chapter, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/chapters/[chapterNumber] GET] Internal server error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
