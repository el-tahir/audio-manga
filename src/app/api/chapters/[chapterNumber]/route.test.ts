import { GET } from '@/app/api/chapters/[chapterNumber]/route';
import { supabase } from '@/lib/supabase'; // This will be the mock
import { NextRequest } from 'next/server';

// Mock the supabase client from the actual path
jest.mock('@/lib/supabase');

// Helper to create a mock NextRequest
const createMockRequest = (): NextRequest => {
  return new NextRequest('http://localhost/api/chapters/1'); // URL doesn't really matter for params
};

// Helper to create mock params for the route
const createMockRouteParams = (chapterNumber: string | number) => {
  // The actual handler expects { params: { chapterNumber: string } }
  // but the way Next.js passes it to the handler, it's { chapterNumber: string } directly inside the params object
  return { params: { chapterNumber: String(chapterNumber) } };
};

const sampleChapter = {
  id: 'chapter123',
  chapter_number: 123,
  title: 'The Great Adventure',
  status: 'processed',
  total_pages: 50,
  manga_id: 'manga1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  s3_path: 'path/to/s3/123',
};

// Define mocks that can be commonly accessed and reset
let fromMock: jest.Mock;
let selectMock: jest.Mock;
let eqMock: jest.Mock;
let singleMock: jest.Mock;

describe('GET /api/chapters/[chapterNumber]', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears usage data for all mocks

    // Re-initialize mocks for each test to ensure clean state for chaining
    singleMock = jest.fn().mockResolvedValue({ data: { ...sampleChapter }, error: null });
    eqMock = jest.fn().mockReturnValue({ single: singleMock });
    selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    fromMock = (supabase.from as jest.Mock).mockReturnValue({ select: selectMock });
  });

  it('should fetch a chapter for a valid chapterNumber', async () => {
    const req = createMockRequest();
    const params = createMockRouteParams(sampleChapter.chapter_number);

    const response = await GET(req, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(sampleChapter);
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('chapter_number', sampleChapter.chapter_number); // Use number here
    expect(singleMock).toHaveBeenCalled();
  });

  it('should return 400 if chapterNumber is not a valid number', async () => {
    const req = createMockRequest();
    const params = createMockRouteParams('abc'); // Invalid chapter number

    const response = await GET(req, params);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid chapterNumber' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('should return 404 if chapter is not found', async () => {
    const req = createMockRequest();
    const params = createMockRouteParams(999); // Non-existent chapter
    singleMock.mockResolvedValueOnce({ data: null, error: null }); // Simulate not found

    const response = await GET(req, params);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Chapter not found' });
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('chapter_number', 999); // Use number here
    expect(singleMock).toHaveBeenCalled();
  });

  it('should return 404 on database error when fetching chapter', async () => {
    const req = createMockRequest();
    const params = createMockRouteParams(123);
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'Test DB Error', code: 'DB_ERROR_CODE' } });

    const response = await GET(req, params);
    const data = await response.json();

    expect(response.status).toBe(404); // As per current implementation, DB errors also lead to 404 if no chapter is found
    expect(data).toEqual({ error: 'Chapter not found' });
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('chapter_number', 123); // Use number here
    expect(singleMock).toHaveBeenCalled();
  });

  it('should handle internal server errors', async () => {
    const req = createMockRequest();
    const params = createMockRouteParams(123);
    // Make supabase.from itself throw an error
    fromMock.mockImplementation(() => {
      throw new Error('Simulated internal error');
    });

    const response = await GET(req, params);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
    // supabase.from was called, and then it threw an error.
    expect(fromMock).toHaveBeenCalledWith('manga_chapters');
    // Other mocks like selectMock, singleMock should not have been called
    expect(selectMock).not.toHaveBeenCalled();
    expect(singleMock).not.toHaveBeenCalled();
  });
});
