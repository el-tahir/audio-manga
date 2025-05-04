import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
