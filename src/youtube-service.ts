import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { google, youtube_v3 } from 'googleapis';
import { 
  VideoItem, 
  ChannelItem, 
  VideoListResponse, 
  ChannelListResponse,
  CommentThreadListResponse,
  SearchListResponse
} from './types/youtube-types';

export interface VideoItem {
  kind: string;
  etag: string;
  id: string;
  snippet: VideoSnippet;
  statistics?: VideoStatistics;
  contentDetails?: VideoContentDetails;
  status?: {
    uploadStatus: string;
    privacyStatus: string;
    license: string;
    embeddable: boolean;
    publicStatsViewable: boolean;
  };
  items?: VideoItem[]; // Add this line
}

export interface ChannelItem {
  kind: string;
  etag: string;
  id: string;
  snippet: ChannelSnippet;
  statistics?: ChannelStatistics;
  contentDetails?: ChannelContentDetails;
  brandingSettings?: ChannelBrandingSettings;
  items?: ChannelItem[]; // Add this line
}

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
  private youtube: youtube_v3.Youtube;
  private apiKey: string;
  private youtubeApi: {
    videos: {
      list: (params: youtube_v3.Params$Resource$Videos$List) => Promise<{ data: VideoListResponse }>;
    };
    channels: {
      list: (params: youtube_v3.Params$Resource$Channels$List) => Promise<{ data: ChannelListResponse }>;
    };
    commentThreads: {
      list: (params: youtube_v3.Params$Resource$Commentthreads$List) => Promise<{ data: CommentThreadListResponse }>;
    };
    search: {
      list: (params: youtube_v3.Params$Resource$Search$List) => Promise<{ data: SearchListResponse }>;
    };
    videoCategories: {
      list: (params: youtube_v3.Params$Resource$Videocategories$List) => Promise<any>;
    };
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.dbInitializer = new DatabaseInitializer();
    
    // Initialize the YouTube client
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });
    
    // Mock implementation for testing
    this.youtubeApi = {
      videos: {
        list: async (params: youtube_v3.Params$Resource$Videos$List) => {
          // Mock implementation for testing
          return { 
            data: { 
              kind: 'youtube#videoListResponse',
              etag: '',
              items: [],
              pageInfo: { totalResults: 0, resultsPerPage: 0 }
            } as VideoListResponse 
          };
        }
      },
      channels: {
        list: async (params: youtube_v3.Params$Resource$Channels$List) => {
          // Mock implementation for testing
          return { 
            data: { 
              kind: 'youtube#channelListResponse',
              etag: '',
              items: [],
              pageInfo: { totalResults: 0, resultsPerPage: 0 }
            } as ChannelListResponse 
          };
        }
      },
      commentThreads: {
        list: async (params: youtube_v3.Params$Resource$Commentthreads$List) => {
          // Mock implementation for testing
          return { 
            data: { 
              kind: 'youtube#commentThreadListResponse',
              etag: '',
              items: [],
              pageInfo: { totalResults: 0, resultsPerPage: 0 }
            } as CommentThreadListResponse 
          };
        }
      },
      search: {
        list: async (params: youtube_v3.Params$Resource$Search$List) => {
          // Mock implementation for testing
          return { 
            data: { 
              kind: 'youtube#searchListResponse',
              etag: '',
              regionCode: '',
              items: [],
              pageInfo: { totalResults: 0, resultsPerPage: 0 }
            } as SearchListResponse 
          };
        }
      },
      videoCategories: {
        list: async (params: youtube_v3.Params$Resource$Videocategories$List) => {
          // Mock implementation for testing
          return { 
            data: { 
              kind: 'youtube#videoCategoryListResponse',
              etag: '',
              items: []
            } 
          };
        }
      }
    };
    this.apiKey = apiKey;
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
    
    return  response.data.items[0] as VideoItem & { kind: string };
  }

  async getChannelDetails(channelId: string): Promise<ChannelItem> {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails', 'brandingSettings'],
      id: [channelId]
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }
    
    return  response.data.items[0] as ChannelItem & { kind: string };
  }

  async getTranscript(videoId: string, language?: string) {
    // Mock data
    return [{ offset: 0, text: 'This is a test transcript.' }];
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

  async searchVideos(query: string, maxResults: number, filters: any) {
    // Mock data
    return { items: [] };
  }

  async getComments(videoId: string, maxResults: number, options: any) {
    // Mock data
    return { items: [], pageInfo: { totalResults: 0 } };
  }
}
