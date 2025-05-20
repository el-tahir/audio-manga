import { GET } from '@/app/api/chapters/route';
import { supabase } from '@/lib/supabase'; // This will be the mock
import { NextRequest } from 'next/server';

// Mock the supabase client from the actual path
jest.mock('@/lib/supabase');

// Helper to create a mock NextRequest
const createMockRequest = (searchParams: Record<string, string> = {}): NextRequest => {
  const url = new URL('http://localhost/api/chapters');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
};

const mockChapters = [
  { id: '1', chapter_number: 1, status: 'pending', total_pages: 10, title: 'Chapter 1', manga_id: 'manga1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), s3_path: 'path/1' },
  { id: '2', chapter_number: 2, status: 'processed', total_pages: 20, title: 'Chapter 2', manga_id: 'manga1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), s3_path: 'path/2' },
  { id: '3', chapter_number: 3, status: 'pending', total_pages: 15, title: 'Chapter 3', manga_id: 'manga2', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), s3_path: 'path/3' },
];

// Define mocks that can be commonly accessed and reset
let fromMock: jest.Mock;
let selectMock: jest.Mock;
let eqMock: jest.Mock;
let orderMock: jest.Mock;

describe('GET /api/chapters', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears usage data for all mocks

    // Re-initialize mocks for each test to ensure clean state for chaining
    orderMock = jest.fn().mockResolvedValue({ data: [...mockChapters], error: null });
    eqMock = jest.fn().mockReturnValue({ order: orderMock });
    selectMock = jest.fn().mockReturnValue({ eq: eqMock, order: orderMock });
    fromMock = (supabase.from as jest.Mock).mockReturnValue({ select: selectMock });
  });

  it('should fetch chapters with default sorting (chapter_number, asc)', async () => {
    const req = createMockRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockChapters);
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('chapter_number', { ascending: true });
  });

  it('should return 200 and an empty array if no chapters are found', async () => {
    const req = createMockRequest();
    orderMock.mockResolvedValueOnce({ data: [], error: null }); // Simulate no chapters found

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('chapter_number', { ascending: true }); // Default sort
  });

  it('should fetch chapters sorted by status in desc order', async () => {
    const req = createMockRequest({ sortBy: 'status', order: 'desc' });
    const sortedData = [...mockChapters].sort((a, b) => b.status.localeCompare(a.status));
    orderMock.mockResolvedValueOnce({ data: sortedData, error: null }); // Specific mock for this test case

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(sortedData);
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('status', { ascending: false });
  });

  it('should fetch chapters filtered by status=processed', async () => {
    const req = createMockRequest({ status: 'processed' });
    const processedChapters = mockChapters.filter(c => c.status === 'processed');
    orderMock.mockResolvedValueOnce({ data: processedChapters, error: null }); // Specific mock for this test case

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(processedChapters);
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('status', 'processed');
    // orderMock is returned by eqMock, so this assertion checks what eqMock().order was called with
    expect(orderMock).toHaveBeenCalledWith('chapter_number', { ascending: true });
  });

  it('should handle database errors when fetching chapters', async () => {
    const req = createMockRequest();
    orderMock.mockResolvedValueOnce({ data: null, error: { message: 'Test DB Error' } });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Test DB Error' });
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('chapter_number', { ascending: true });
  });

  it('should handle internal server errors', async () => {
    // Make supabase.from itself throw an error
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Simulated internal error');
    });

    const req = createMockRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
    // supabase.from was called, and then it threw an error.
    expect(supabase.from).toHaveBeenCalledWith('manga_chapters');
    // Other mocks like selectMock, orderMock should not have been called
    expect(selectMock).not.toHaveBeenCalled();
    expect(orderMock).not.toHaveBeenCalled();
  });
});
