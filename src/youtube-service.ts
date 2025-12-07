import { google, youtube_v3 } from 'googleapis';
import {
  VideoItem,
  ChannelItem,
  VideoListResponse,
  ChannelListResponse,
  CommentThreadListResponse,
  SearchListResponse
} from './types/youtube-types.js';

export class YouTubeService {
  public youtube: youtube_v3.Youtube; // Made public for access in index.ts
  private apiKey: string;
  private db?: any; // Database instance for API key retrieval

  constructor(apiKey: string, db?: any) {
    this.apiKey = apiKey;
    this.db = db;

    // Initialize the YouTube client
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });
  }

  async initialize() {
    // Database initialization is handled by Cloudflare D1
    console.log('YouTube Service initialized');
  }

  // Get active API key for a user from database
  async getActiveApiKey(userId: string): Promise<string | null> {
    if (!this.db) {
      console.warn('Database not available, falling back to default API key');
      return this.apiKey;
    }

    try {
      const result = await this.db.prepare(
        'SELECT key_value FROM ApiKeys WHERE user_id = ? AND is_active = 1'
      ).bind(userId).first();

      return result?.key_value || this.apiKey; // Fallback to default API key
    } catch (error) {
      console.error('Error fetching active API key:', error);
      return this.apiKey; // Fallback to default API key
    }
  }

  // Update YouTube client with new API key
  private updateYouTubeClient(apiKey: string) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });
  }


  // Get video details
  async getVideoDetails(videoIds: string): Promise<VideoListResponse> {
    const response = await this.youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics', 'status'],
      id: videoIds.split(',')
    });

    return response.data as VideoListResponse;
  }

  async getChannelDetails(channelId: string): Promise<ChannelListResponse> {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails', 'brandingSettings', 'status'],
      id: [channelId]
    });

    return response.data as ChannelListResponse;
  }

  async getTranscript(videoId: string, language?: string) {
    // Mock data
    return [{ offset: 0, text: 'This is a test transcript.', duration: 5 }];
  }

  async getEnhancedTranscript(videoIds: string[], options: any) {
    // Mock data
    return [{ videoId: videoIds[0], text: 'Enhanced transcript content' }];
  }

  async getKeyMomentsTranscript(videoId: string, maxMoments: number) {
    // Mock data
    return { text: 'Key moments content', metadata: [] };
  }

  async getSegmentedTranscript(videoId: string, segmentCount: number) {
    // Mock data
    return { text: 'Segmented transcript content', metadata: [] };
  }

  async searchVideos(query: string, maxResults: number, filters: any): Promise<SearchListResponse> {
    // Mock data
    return {
      kind: 'youtube#searchListResponse',
      etag: '',
      regionCode: 'US',
      items: [],
      pageInfo: { totalResults: 0, resultsPerPage: maxResults }
    };
  }

  async getComments(videoId: string, maxResults: number, options: any): Promise<CommentThreadListResponse> {
    // Mock data
    return {
      kind: 'youtube#commentThreadListResponse',
      etag: '',
      items: [],
      pageInfo: { totalResults: 0, resultsPerPage: maxResults }
    };
  }

  async getMyChannels(userId: string, accessToken: string, maxResults: number = 50, pageToken?: string): Promise<ChannelListResponse> {
    try {
      // Get user-specific API key from database
      const userApiKey = await this.getActiveApiKey(userId);
      if (!userApiKey) {
        throw new Error('No API key found for user');
      }

      // Create new auth instance with user's API key
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const youtube = google.youtube({ version: 'v3', auth });

      const response = await youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails', 'brandingSettings', 'status'],
        mine: true,
        maxResults,
        pageToken
      });

      return response.data as ChannelListResponse;
    } catch (error) {
      console.error('Error fetching my channels:', error);
      throw error;
    }
  }

  async getChannelByHandle(handle: string): Promise<ChannelListResponse> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails', 'brandingSettings'],
        forHandle: handle
      });

      return response.data as ChannelListResponse;
    } catch (error) {
      console.error('Error fetching channel by handle:', error);
      throw error;
    }
  }
}
