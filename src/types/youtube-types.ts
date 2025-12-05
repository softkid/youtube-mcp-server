export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
  videoId?: string; // Added for multi-video transcripts
}

export interface TimeRange {
  start?: number; // Start time in seconds
  end?: number; // End time in seconds
}

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  contextLines?: number;
}

export interface TranscriptOptions {
  language?: string;
  timeRange?: TimeRange;
  search?: SearchOptions;
  segment?: {
    method: 'equal' | 'smart';
    count: number;
  };
  format?: 'raw' | 'timestamped' | 'merged';
  includeMetadata?: boolean;
}

export interface TranscriptSummaryOptions {
  summaryLength?: 'short' | 'medium' | 'detailed';
  includeKeywords?: boolean;
  includeTimestamps?: boolean;
  segmentSummaries?: boolean;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface Thumbnails {
  default?: Thumbnail;
  medium?: Thumbnail;
  high?: Thumbnail;
  standard?: Thumbnail;
  maxres?: Thumbnail;
}

export interface VideoSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  channelTitle: string;
  tags?: string[];
  categoryId?: string;
  liveBroadcastContent?: string;
  defaultLanguage?: string;
  localized?: {
    title: string;
    description: string;
  };
  defaultAudioLanguage?: string;
}

export interface VideoStatistics {
  viewCount: string;
  likeCount: string;
  dislikeCount?: string;
  favoriteCount: string;
  commentCount: string;
}

export interface VideoContentDetails {
  duration: string;
  dimension: string;
  definition: string;
  caption: string;
  licensedContent: boolean;
  contentRating: Record<string, unknown>;
  projection: string;
}

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
}

export interface ChannelSnippet {
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  thumbnails: Thumbnails;
  defaultLanguage?: string;
  localized: {
    title: string;
    description: string;
  };
  country?: string;
}

export interface ChannelStatistics {
  viewCount: string;
  subscriberCount: string;
  hiddenSubscriberCount: boolean;
  videoCount: string;
}

export interface ChannelItem {
  kind: string;
  etag: string;
  id: string;
  snippet: ChannelSnippet;
  statistics: ChannelStatistics;
  contentDetails?: {
    relatedPlaylists: {
      likes: string;
      uploads: string;
    };
  };
  brandingSettings?: {
    channel: {
      title: string;
      description: string;
      keywords: string;
      defaultLanguage: string;
      country: string;
    };
  };
}

export interface VideoListResponse {
  kind: string;
  etag: string;
  items: VideoItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  nextPageToken?: string;
  prevPageToken?: string;
}

export interface ChannelListResponse {
  kind: string;
  etag: string;
  items: ChannelItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  nextPageToken?: string;
  prevPageToken?: string;
}

export interface CommentSnippet {
  authorDisplayName: string;
  authorProfileImageUrl: string;
  authorChannelUrl: string;
  authorChannelId: {
    value: string;
  };
  channelId: string;
  videoId: string;
  textDisplay: string;
  textOriginal: string;
  parentId: string;
  canRate: boolean;
  viewerRating: string;
  likeCount: number;
  moderationStatus: string;
  publishedAt: string;
  updatedAt: string;
}

export interface CommentThreadSnippet {
  channelId: string;
  videoId: string;
  topLevelComment: {
    kind: string;
    etag: string;
    id: string;
    snippet: CommentSnippet;
  };
  canReply: boolean;
  totalReplyCount: number;
  isPublic: boolean;
}

export interface CommentThreadItem {
  kind: string;
  etag: string;
  id: string;
  snippet: CommentThreadSnippet;
  replies?: {
    comments: Array<{
      kind: string;
      etag: string;
      id: string;
      snippet: CommentSnippet & { parentId: string };
    }>;
  };
}

export interface CommentThreadListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: CommentThreadItem[];
}

export interface SearchResultSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  channelTitle: string;
  liveBroadcastContent: string;
  publishTime: string;
}

export interface SearchResultId {
  kind: string;
  videoId?: string;
  channelId?: string;
  playlistId?: string;
}

export interface SearchItem {
  kind: string;
  etag: string;
  id: SearchResultId;
  snippet: SearchResultSnippet;
}

export interface SearchListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  regionCode: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: SearchItem[];
}

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  tags?: string[];
  thumbnails: Thumbnails;
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
  };
}

export interface FormattedTranscript {
  segments: TranscriptSegment[];
  totalSegments: number;
  duration: number; // Total duration in seconds
  format: string;
  text?: string; // Formatted text (for timestamped and merged formats)
  metadata?: Array<VideoMetadata | null>;
}

export class TranscriptError extends Error {
  public videoId: string;
  public options: TranscriptOptions;
  public originalError: Error;

  constructor(params: {
    message: string;
    videoId: string;
    options: TranscriptOptions;
    originalError: Error;
  }) {
    super(params.message);
    this.name = 'TranscriptError';
    this.videoId = params.videoId;
    this.options = params.options;
    this.originalError = params.originalError;
  }
} 