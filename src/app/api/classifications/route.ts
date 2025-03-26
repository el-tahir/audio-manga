import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterNumber = searchParams.get('chapter');

    if (!chapterNumber) {
      return NextResponse.json(
        { error: 'Chapter number is required' },
        { status: 400 }
      );
    }

    // First get the chapter ID
    const { data: chapterData, error: chapterError } = await supabase
      .from('manga_chapters')
      .select('id')
      .eq('chapter_number', parseInt(chapterNumber))
      .single();

    if (chapterError || !chapterData) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Then get classifications
    const { data: classifications, error: classificationError } = await supabase
      .from('manga_page_classifications')
      .select('filename, category, page_number')
      .eq('chapter_id', chapterData.id)
      .order('page_number', { ascending: true });

    if (classificationError) {
      return NextResponse.json(
        { error: 'Failed to fetch classifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ classifications });
  } catch (error) {
    console.error('Error fetching classifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
