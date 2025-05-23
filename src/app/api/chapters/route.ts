import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

// Define valid chapter statuses
const CHAPTER_STATUSES = [
  'completed',
  'pending',
  'processing',
  'failed',
  'not_found',
  'downloading',
] as const;

// Zod schemas for query parameter validation
const SortBySchema = z
  .enum(['chapter_number', 'processed_at', 'total_pages', 'status'], {
    errorMap: () => ({
      message: 'sortBy must be one of: chapter_number, processed_at, total_pages, status',
    }),
  })
  .optional()
  .default('chapter_number');

const OrderSchema = z
  .enum(['asc', 'desc'], {
    errorMap: () => ({
      message: 'order must be either "asc" or "desc"',
    }),
  })
  .optional()
  .default('asc');

const StatusSchema = z
  .enum(CHAPTER_STATUSES, {
    errorMap: () => ({
      message: `status must be one of: ${CHAPTER_STATUSES.join(', ')}`,
    }),
  })
  .optional();

// Combined query parameters schema
const ChaptersQuerySchema = z.object({
  sortBy: SortBySchema,
  order: OrderSchema,
  status: StatusSchema,
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    console.log(
      '[API /api/chapters GET] Raw URL searchParams:',
      Object.fromEntries(params.entries())
    );

    // Extract and validate query parameters with explicit null handling
    const rawSortBy = params.get('sortBy');
    const rawOrder = params.get('order');
    const rawStatus = params.get('status');

    const queryParams = {
      sortBy: rawSortBy || undefined,
      order: rawOrder?.toLowerCase() || undefined,
      status: rawStatus || undefined,
    };

    console.log('[API /api/chapters GET] Processed query params:', queryParams);

    const validationResult = ChaptersQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      console.error('[API /api/chapters GET] Validation errors:', validationResult.error.errors);

      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: errorMessages,
          receivedParams: queryParams,
          rawParams: { rawSortBy, rawOrder, rawStatus },
          validSortBy: ['chapter_number', 'processed_at', 'total_pages', 'status'],
          validOrder: ['asc', 'desc'],
          validStatus: CHAPTER_STATUSES,
        },
        { status: 400 }
      );
    }

    const { sortBy, order, status: statusFilter } = validationResult.data;
    const ascending = order === 'asc';

    let query = supabase.from('manga_chapters').select('*');
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: chapters, error } = await query.order(sortBy, { ascending });
    if (error) {
      console.error('[API /api/chapters GET] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        chapters,
        pagination: {
          total: chapters.length,
          sortBy,
          order,
          ...(statusFilter && { statusFilter }),
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[API /api/chapters GET] Internal server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
