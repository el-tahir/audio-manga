# API Documentation

## Overview

The application provides several REST API endpoints for chapter management, image serving, and classification handling.

## Endpoints

### Chapters

#### GET `/api/chapters`
Retrieves a list of all processed chapters.

**Response:**
```json
{
  "chapters": [
    {
      "id": 1,
      "chapter_number": 1120,
      "total_pages": 18,
      "status": "completed",
      "processed_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

#### GET `/api/chapters/[chapterNumber]`
Retrieves details for a specific chapter.

**Parameters:**
- `chapterNumber` (string): The chapter number to retrieve

**Response:**
```json
{
  "id": 1,
  "chapter_number": 1120,
  "total_pages": 18,
  "status": "completed",
  "processed_at": "2024-01-15T10:30:00Z"
}
```

#### POST `/api/download-chapter/[chapterNumber]`
Initiates download and processing of a new chapter.

**Parameters:**
- `chapterNumber` (string): The chapter number to download

**Response (202 Accepted):**
```json
{
  "message": "Chapter 1120 download initiated and scheduled for processing. Found 18 pages.",
  "chapterNumber": "1120",
  "status": "pending",
  "downloadedPages": 18,
  "totalPages": 18
}
```

**Response (409 Conflict):**
```json
{
  "message": "Chapter 1120 already processed."
}
```

### Chapter Images

#### GET `/api/chapters/[chapterNumber]/images/[pageNumber]`
Retrieves a signed URL for a specific page image.

**Parameters:**
- `chapterNumber` (string): The chapter number
- `pageNumber` (string): The page number (1-based)

**Response:**
```json
{
  "signedUrl": "https://storage.googleapis.com/bucket/path/to/image.jpg?X-Goog-Algorithm=..."
}
```

### Classifications

#### GET `/api/chapters/[chapterNumber]/classifications`
Retrieves mood classifications for all pages in a chapter.

**Parameters:**
- `chapterNumber` (string): The chapter number

**Response:**
```json
{
  "classifications": [
    {
      "id": 1,
      "page_number": 1,
      "category": "intro",
      "confidence": 0.95,
      "explanation": "Opening scene with character introduction",
      "filename": "001.jpg"
    }
  ]
}
```

#### PUT `/api/chapters/[chapterNumber]/classifications/[pageNumber]`
Updates the mood classification for a specific page.

**Parameters:**
- `chapterNumber` (string): The chapter number
- `pageNumber` (string): The page number

**Request Body:**
```json
{
  "category": "tension",
  "explanation": "Updated mood based on user feedback"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Classification updated successfully"
}
```

### Audio

#### GET `/api/audio/random`
Retrieves a random audio track URL for a given mood category.

**Query Parameters:**
- `category` (string): The mood category (e.g., "tension", "comedy", "action_serious")

**Response:**
```json
{
  "audioUrl": "https://storage.googleapis.com/bucket/audio/tension/track1.mp3?X-Goog-Algorithm=..."
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (chapter/page doesn't exist)
- `409` - Conflict (chapter already exists/processing)
- `500` - Internal Server Error

## Rate Limiting

The API currently doesn't implement rate limiting, but it's recommended for production use, especially for the download endpoints.

## Authentication

Currently, the API operates without authentication. In a production environment, consider implementing:
- API key authentication for external access
- User authentication for administrative functions
- Rate limiting per user/IP

## Data Models

### Chapter Status Values
- `pending` - Chapter queued for processing
- `processing` - Chapter currently being processed
- `completed` - Chapter fully processed and available
- `failed` - Processing failed, can be retried
- `downloading` - Chapter images being downloaded

### Mood Categories
See the constants file for the complete list of supported mood categories:
- `intro`, `love`, `love_ran`, `casual`, `adventure`
- `comedy`, `action_casual`, `action_serious`, `tragic`
- `tension`, `confrontation`, `investigation`, `revelation`, `conclusion`