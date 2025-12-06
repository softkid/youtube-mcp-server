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

  constructor(apiKey: string) {
    this.apiKey = apiKey;

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

  async getMyChannels(accessToken: string, maxResults: number = 50, pageToken?: string): Promise<ChannelListResponse> {
    try {
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
