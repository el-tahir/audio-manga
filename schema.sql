-- Create enum type for page categories
CREATE TYPE manga_page_category AS ENUM (
  'investigation',
  'suspense',
  'action',
  'revelation',
  'conclusion',
  'casual',
  'tragic'
);

-- Create table for manga chapters
CREATE TABLE manga_chapters (
  id SERIAL PRIMARY KEY,
  chapter_number INTEGER NOT NULL UNIQUE,
  total_pages INTEGER NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Add useful indexes
  CONSTRAINT chapter_number_positive CHECK (chapter_number > 0)
);

-- Create table for page classifications
CREATE TABLE manga_page_classifications (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES manga_chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  category manga_page_category NOT NULL,
  confidence NUMERIC(3,2), -- Nullable confidence score between 0 and 1
  explanation TEXT, -- Optional field for AI explanation
  
  -- Add useful constraints
  CONSTRAINT page_number_positive CHECK (page_number > 0),
  CONSTRAINT confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  
  -- Ensure unique page numbers within a chapter
  UNIQUE(chapter_id, page_number)
);

-- Create indexes for performance
CREATE INDEX idx_page_classifications_chapter_id ON manga_page_classifications(chapter_id);
CREATE INDEX idx_page_classifications_category ON manga_page_classifications(category);

-- Add RLS policies (for Supabase)
ALTER TABLE manga_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE manga_page_classifications ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read all data
CREATE POLICY "Allow read access for authenticated users" 
  ON manga_chapters FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access for authenticated users" 
  ON manga_page_classifications FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Create policy for service role to modify data
CREATE POLICY "Allow full access for service role" 
  ON manga_chapters FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow full access for service role" 
  ON manga_page_classifications FOR ALL 
  USING (auth.role() = 'service_role');

-- Create API views
CREATE OR REPLACE VIEW manga_chapter_summary AS
SELECT 
  c.id,
  c.chapter_number,
  c.total_pages,
  c.processed_at,
  COUNT(p.id) FILTER (WHERE p.category = 'investigation') AS investigation_count,
  COUNT(p.id) FILTER (WHERE p.category = 'suspense') AS suspense_count,
  COUNT(p.id) FILTER (WHERE p.category = 'action') AS action_count,
  COUNT(p.id) FILTER (WHERE p.category = 'revelation') AS revelation_count,
  COUNT(p.id) FILTER (WHERE p.category = 'conclusion') AS conclusion_count,
  COUNT(p.id) FILTER (WHERE p.category = 'casual') AS casual_count,
  COUNT(p.id) FILTER (WHERE p.category = 'tragic') AS tragic_count,
  ARRAY_AGG(DISTINCT p.category ORDER BY p.category) AS categories
FROM 
  manga_chapters c
LEFT JOIN 
  manga_page_classifications p ON c.id = p.chapter_id
GROUP BY 
  c.id, c.chapter_number, c.total_pages, c.processed_at
ORDER BY 
  c.chapter_number;
