# API Documentation

Base URL: `https://youtube-mcp-server.goodprogram.workers.dev`

## Channel Management

### Get User Channels
Fetches the list of channels added by the user from the database.

- **Endpoint**: `GET /api/channels`
- **Query Parameters**:
  - `userId` (required): The Google ID of the user.
- **Response**:
  ```json
  {
    "channels": [
      {
        "id": "UC...",
        "handle": "@handle",
        "title": "Channel Title",
        "thumbnail": "...",
        "subscriber_count": 1000,
        ...
      }
    ]
  }
  ```

### Add Channel
Fetches channel details from YouTube using the handle and saves it to the database for the user.

- **Endpoint**: `POST /api/add-channel`
- **Body**:
  ```json
  {
    "handle": "channelHandle", // without @ is okay
    "userId": "user_google_id"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Channel added successfully",
    "channel": { ... } // Detailed channel object
  }
  ```

### Get My Channels (YouTube)
Fetches the authenticated user's channels directly from YouTube using their OAuth access token.

- **Endpoint**: `POST /api/get-my-channels`
- **Body**:
  ```json
  {
    "accessToken": "oauth2_access_token",
    "maxResults": 50, // optional, default 50
    "pageToken": "..." // optional
  }
  ```
- **Response**:
  ```json
  {
    "channels": [ ... ],
    "pageInfo": { ... }
  }
  ```

### Get Channel by Handle
Fetches channel details directly from YouTube API.

- **Endpoint**: `POST /api/get-channel-by-handle`
- **Body**:
  ```json
  {
    "handle": "channelHandle"
  }
  ```
- **Response**:
  ```json
  {
    "channel": { ... }
  }
  ```

### Get Channel Stats
Fetches statistical information for a specific channel.

- **Endpoint**: `POST /api/get-channel-stats`
- **Body**:
  ```json
  {
    "channelId": "UC..."
  }
  ```
- **Response**:
  ```json
  {
    "channelId": "...",
    "title": "...",
    "subscriberCount": 1000,
    ...
  }
  ```

### Analyze Channel Videos
Analyzes recent videos from a specific channel.

- **Endpoint**: `POST /api/analyze-channel-videos`
- **Body**:
  ```json
  {
    "channelId": "UC...",
    "maxResults": 10, // optional, default 10
    "sortBy": "date" // optional: 'date', 'viewCount', 'rating'
  }
  ```
- **Response**:
  ```json
  {
    "channelId": "...",
    "videoCount": 10,
    "averages": { "viewCount": ..., ... },
    "videos": [ ... ]
  }
  ```

---

## API Key Management

### Get API Keys
Fetches all registered API keys for a user.

- **Endpoint**: `GET /api/apikeys`
- **Query Parameters**:
  - `userId` (required)
- **Response**:
  ```json
  {
    "apiKeys": [
      { "id": 1, "key_value": "...", "alias": "...", "is_active": 1, ... }
    ]
  }
  ```

### Add API Key
Adds a new YouTube Data API key for the user. First key added is automatically set to active.

- **Endpoint**: `POST /api/apikeys`
- **Body**:
  ```json
  {
    "userId": "user_id",
    "key": "AIza...",
    "alias": "My Key" // optional
  }
  ```
- **Response**: `{ "success": true, "message": "API Key added successfully" }`

### Set Active API Key
Sets a specific API key as the active one for the user.

- **Endpoint**: `PUT /api/apikeys/:id/active`
- **Body**:
  ```json
  { "userId": "user_id" }
  ```
- **Response**: `{ "success": true, "message": "API Key activated" }`

### Delete API Key
Deletes a specific API key.

- **Endpoint**: `DELETE /api/apikeys/:id`
- **Query Parameters**:
  - `userId` (required)
- **Response**: `{ "success": true, "message": "API Key deleted" }`

---

## Video & Search

### Search Videos
Searches for YouTube videos with filtering options.

- **Endpoint**: `POST /api/search-videos`
- **Body**:
  ```json
  {
    "query": "search term",
    "maxResults": 10,
    "channelId": "UC...", // optional
    "order": "viewCount", // optional: date, rating, relevance, title, videoCount, viewCount
    "type": "video", // optional: video, channel, playlist
    "videoDuration": "medium", // optional: any, short, medium, long
    "regionCode": "US" // optional
  }
  ```
- **Response**: `{ "items": [ ... ] }`

### Get Trending Videos
Fetches trending videos by region and category.

- **Endpoint**: `POST /api/get-trending-videos`
- **Body**:
  ```json
  {
    "regionCode": "US", // optional
    "categoryId": "10", // optional
    "maxResults": 10 // optional
  }
  ```

### Get Video Categories
Fetches available video categories for a region.

- **Endpoint**: `POST /api/get-video-categories`
- **Body**:
  ```json
  { "regionCode": "US" }
  ```

### Get Video Transcript
Fetches transcript (captions) for a video.

- **Endpoint**: `POST /api/get-video-transcript`
- **Body**:
  ```json
  { 
    "videoId": "video_id",
    "language": "ko" // optional
  }
  ```

### Get Enhanced Transcript
Fetches detailed transcript with filtering and search capabilities.

- **Endpoint**: `POST /api/enhanced-transcript`
- **Body**:
  ```json
  {
    "videoIds": ["vid1", "vid2"],
    "filters": { ... }
  }
  ```

### Get Key Moments
Extracts key moments from video transcript.

- **Endpoint**: `POST /api/get-key-moments`
- **Body**:
  ```json
  {
    "videoId": "video_id",
    "maxMoments": 5
  }
  ```

### Get Segmented Transcript
Divides video transcript into segments.

- **Endpoint**: `POST /api/get-segmented-transcript`
- **Body**:
  ```json
  {
    "videoId": "video_id",
    "segmentCount": 4
  }
  ```

---

## Brand Analysis

### Analyze Branding
Analyzes channel branding using AI (requires implementation).

- **Endpoint**: `POST /api/analyze-branding`
- **Body**: `{ "channelId": "..." }`

---

## Logging

### Search Logs
- **Endpoint**: `GET /api/logs/search?query=...`

### All Logs
- **Endpoint**: `GET /api/logs/all`

### Log Statistics
- **Endpoint**: `GET /api/logs/statistics`

### Delete Log
- **Endpoint**: `DELETE /api/logs/:id/:type`
