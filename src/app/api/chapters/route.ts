import { NextResponse } from 'next/server';
import path from 'path';
import { saveFile, extractChapterNumber } from '@/utils/manga-classifier/fileUtils';
import { supabase } from '@/lib/supabase';
import { processChapterInBackground } from '@/services/manga-processing/backgroundProcessor';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb'
  }
};

export async function GET(request: Request) {
  try {
    // Handle optional query params: sortBy, order (asc|desc), status filter
    const url = new URL(request.url);
    const params = url.searchParams;
    const sortBy = params.get('sortBy') ?? 'chapter_number';
    const orderParam = params.get('order')?.toLowerCase() ?? 'asc';
    const ascending = orderParam === 'asc';
    const statusFilter = params.get('status');

    let query = supabase.from('manga_chapters').select('*');
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    const { data: chapters, error } = await query.order(sortBy, { ascending });
    if (error) {
      console.error('[API /api/chapters GET] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(chapters, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/chapters GET] Internal server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tempDirs: string[] = [];
  try {
    const formData = await request.formData();
    const filePath = await saveFile(formData);
    const tempDir = path.dirname(filePath);
    tempDirs.push(tempDir);

    const fileName = path.basename(filePath);
    const chapterNumber = extractChapterNumber(fileName);
    if (!chapterNumber) {
      return NextResponse.json(
        { error: 'Could not determine chapter number from filename. Please use format "12.cbr" for chapter 12.' },
        { status: 400 }
      );
    }

    // Insert new chapter with pending status
    const { data: newChapterData, error: insertError } = await supabase
      .from('manga_chapters')
      .insert({ chapter_number: chapterNumber, status: 'pending', total_pages: 0 })
      .single();

    if (insertError) {
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json({ error: `Chapter ${chapterNumber} already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Kick off background processing without blocking response, passing chapterNumber
    void processChapterInBackground(chapterNumber, filePath);

    return NextResponse.json(
      {
        message: `Chapter ${chapterNumber} scheduled for processing`,
        chapterNumber,
        status: 'pending'
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[API /api/chapters] Internal server error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
