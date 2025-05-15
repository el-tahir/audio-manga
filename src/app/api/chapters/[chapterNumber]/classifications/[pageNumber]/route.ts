import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request, // Keep request parameter even if unused for consistency
  { params }: { params: Promise<{ chapterNumber: string; pageNumber: string }> }
) {
  try {
    const { chapterNumber: chapterNumberParam, pageNumber: pageNumberParam } = await params;
    const chapterNumber = Number(chapterNumberParam);
    const pageNumber = Number(pageNumberParam);
    if (isNaN(chapterNumber) || isNaN(pageNumber)) {
      return NextResponse.json(
        { error: 'Invalid chapterNumber or pageNumber' },
        { status: 400 }
      );
    }

    const { data: classification, error } = await supabase
      .from('manga_page_classifications')
      .select('page_number, category, filename, explanation')
      .eq('chapter_number', chapterNumber)
      .eq('page_number', pageNumber)
      .maybeSingle(); // Use maybeSingle() to return null if not found, instead of error

    if (error) {
      console.error('[API .../[pageNumber] GET] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!classification) {
      return NextResponse.json({ error: 'Classification not found' }, { status: 404 });
    }

    // Map DB fields to consistent camelCase if needed, here they match
    return NextResponse.json({
      pageNumber: classification.page_number,
      category: classification.category,
      filename: classification.filename,
      explanation: classification.explanation
    }, { status: 200 });

  } catch (err: any) {
    console.error(
      '[API .../[pageNumber] GET] Internal server error:',
      err
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chapterNumber: string; pageNumber: string }> }
) {
  try {
    // Await dynamic params for Next.js 15
    const { chapterNumber: chapterNumberParam, pageNumber: pageNumberParam } = await params;
    const chapterNumber = Number(chapterNumberParam);
    const pageNumber = Number(pageNumberParam);
    if (isNaN(chapterNumber) || isNaN(pageNumber)) {
      return NextResponse.json(
        { error: 'Invalid chapterNumber or pageNumber' },
        { status: 400 }
      );
    }

    // Only updating category
    const { category } = await request.json();
    const allowed = ['intro','love','love_ran','casual','adventure','comedy','action_casual','action_serious','tragic','tension','confrontation','investigation','revelation','conclusion'];
    if (!category || !allowed.includes(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('manga_page_classifications')
      .update({ category })
      .eq('chapter_number', chapterNumber)
      .eq('page_number', pageNumber)
      .select('page_number, category, filename, explanation')
      .single();

    if (error) {
      // Distinguish not found vs other DB errors
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Classification not found' }, { status: 404 });
      }
      console.error('[API /api/chapters/[chapterNumber]/classifications/[pageNumber] PATCH] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return updated classification
    return NextResponse.json({
      pageNumber: updated.page_number,
      category: updated.category,
      filename: updated.filename,
      explanation: updated.explanation
    }, { status: 200 });
  } catch (err: any) {
    console.error(
      '[API /api/chapters/[chapterNumber]/classifications/[pageNumber] PATCH] Internal server error:',
      err
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
