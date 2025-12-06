import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { google, youtube_v3 } from 'googleapis';
import {
  VideoItem,
  ChannelItem,
  VideoListResponse,
  ChannelListResponse,
  CommentThreadListResponse,
  SearchListResponse
} from './types/youtube-types.js';

export class DatabaseInitializer {
  private db: InstanceType<typeof Database>;

  constructor() {
    this.db = new Database('youtube.db', { verbose: console.log });
  }

  async initializeDatabase() {
    try {
      // Read schema.sql file
      const schema = readFileSync('src/schema.sql', 'utf8');

      // Execute SQL commands
      const commands = schema.split(';').filter(cmd => cmd.trim() !== '');
      for (const command of commands) {
        if (command.trim().startsWith('DROP')) {
          // DROP TABLE commands are idempotent, so we can safely execute them
          this.db.exec(command);
        } else {
          // For CREATE TABLE, we need to ensure the command is valid SQLite
          this.db.exec(command);
        }
      }
      console.log('Database schema initialized successfully!');
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

export class YouTubeService {
  private dbInitializer: DatabaseInitializer;
  public youtube: youtube_v3.Youtube; // Made public for access in index.ts
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.dbInitializer = new DatabaseInitializer();

    // Initialize the YouTube client
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });
  }

  async initialize() {
    await this.dbInitializer.initializeDatabase();
    console.log('Database initialized');
  }

  // Get video details
  async getVideoDetails(videoId: string): Promise<VideoItem> {
    const response = await this.youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics', 'status'],
      id: [videoId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video with ID ${videoId} not found`);
    }

    return response.data.items[0] as VideoItem;
  }

  async getChannelDetails(channelId: string): Promise<ChannelItem> {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails', 'brandingSettings'],
      id: [channelId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    return response.data.items[0] as ChannelItem;
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
