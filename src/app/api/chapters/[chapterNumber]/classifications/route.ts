import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chapterNumber: string }> }
) {
  try {
    // Await dynamic params for Next.js 15
    const { chapterNumber: chapterNumberString } = await params;
    const chapterNumber = Number(chapterNumberString);
    if (isNaN(chapterNumber)) {
      return NextResponse.json({ error: 'Invalid chapterNumber' }, { status: 400 });
    }

    const { data: chapterExists, error: chapErr } = await supabase
      .from('manga_chapters')
      .select('chapter_number')
      .eq('chapter_number', chapterNumber)
      .maybeSingle();
    if (chapErr) {
      console.error(
        '[API /api/chapters/[chapterNumber]/classifications GET] Chapter query error:',
        chapErr
      );
      return NextResponse.json({ error: chapErr.message }, { status: 500 });
    }
    if (!chapterExists) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const { data: classifications, error } = await supabase
      .from('manga_page_classifications')
      .select('page_number, category, filename, explanation')
      .eq('chapter_number', chapterNumber)
      .order('page_number', { ascending: true });

    if (error) {
      console.error('[API /api/chapters/[chapterNumber]/classifications GET] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map rows to include id (for React keys) alongside snake_case fields
    const formatted = classifications.map(c => ({
      id: c.page_number,
      page_number: c.page_number,
      filename: c.filename,
      category: c.category,
      explanation: c.explanation,
    }));
    return NextResponse.json(formatted, { status: 200 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(
      '[API /api/chapters/[chapterNumber]/classifications GET] Internal server error:',
      error
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
