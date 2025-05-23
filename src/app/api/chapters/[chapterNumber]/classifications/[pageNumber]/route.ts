import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { MOOD_CATEGORIES } from '@/config/constants';

// Zod schema for PATCH request body validation
const UpdateClassificationSchema = z.object({
  category: z.enum(MOOD_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid category. Must be one of: ${MOOD_CATEGORIES.join(', ')}`,
    }),
  }),
});

export async function GET(
  request: Request, // Keep request parameter even if unused for consistency
  { params }: { params: Promise<{ chapterNumber: string; pageNumber: string }> }
) {
  try {
    const { chapterNumber: chapterNumberParam, pageNumber: pageNumberParam } = await params;
    const chapterNumber = Number(chapterNumberParam);
    const pageNumber = Number(pageNumberParam);
    if (isNaN(chapterNumber) || isNaN(pageNumber)) {
      return NextResponse.json({ error: 'Invalid chapterNumber or pageNumber' }, { status: 400 });
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
    return NextResponse.json(
      {
        pageNumber: classification.page_number,
        category: classification.category,
        filename: classification.filename,
        explanation: classification.explanation,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[API .../[pageNumber] GET] Internal server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid chapterNumber or pageNumber' }, { status: 400 });
    }

    // Parse and validate request body using Zod
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const validationResult = UpdateClassificationSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      return NextResponse.json(
        {
          error: 'Validation failed',
          details: errorMessages,
          validCategories: MOOD_CATEGORIES,
        },
        { status: 400 }
      );
    }

    const { category } = validationResult.data;

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
      console.error(
        '[API /api/chapters/[chapterNumber]/classifications/[pageNumber] PATCH] DB error:',
        error
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return updated classification
    return NextResponse.json(
      {
        pageNumber: updated.page_number,
        category: updated.category,
        filename: updated.filename,
        explanation: updated.explanation,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(
      '[API /api/chapters/[chapterNumber]/classifications/[pageNumber] PATCH] Internal server error:',
      error
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
