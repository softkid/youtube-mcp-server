#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { YouTubeService } from './youtube-service.js';
import { TranscriptOptions } from './types/youtube-types.js';

// Global type augmentation for log storage
declare global {
  var channelCreationLogs: any[];
  var brandingLogs: any[];
  var searchLogs: any[];
}

// Configuration schema for Smithery
export const configSchema = z.object({
  youtubeApiKey: z.string().describe("YouTube Data API v3 key"),
  port: z.string().optional().describe("Server port").default("3000")
});

// Helper function to format time in MM:SS format
function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Export default function for Smithery
function createMcpServer({ config }: { config: z.infer<typeof configSchema> }) {
  // Initialize the YouTube service with the provided API key
  const youtubeService = new YouTubeService(config.youtubeApiKey);

  // Create the MCP server
  const server = new McpServer({
    name: 'YouTube MCP Server',
    version: '1.0.0'
  });

  // Define resources
  server.resource(
    'video',
    new ResourceTemplate('youtube://video/{videoId}', { list: undefined }),
    {
      description: 'Get detailed information about a specific YouTube video by ID'
    },
    async (uri, { videoId }) => {
      try {
        // Ensure videoId is a string, not an array
        const videoIdStr = Array.isArray(videoId) ? videoId[0] : videoId;
        const videoData = await youtubeService.getVideoDetails(videoIdStr);
        const video = videoData.items?.[0];

        if (!video) {
          return {
            contents: [{
              uri: uri.href,
              text: `Video with ID ${videoIdStr} not found.`
            }]
          };
        }

        const details = {
          id: video.id,
          title: video.snippet?.title,
          description: video.snippet?.description,
          publishedAt: video.snippet?.publishedAt,
          channelId: video.snippet?.channelId,
          channelTitle: video.snippet?.channelTitle,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          commentCount: video.statistics?.commentCount,
          duration: video.contentDetails?.duration
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(details, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error fetching video details: ${error}`
          }]
        };
      }
    }
  );

  server.resource(
    'channel',
    new ResourceTemplate('youtube://channel/{channelId}', { list: undefined }),
    {
      description: 'Get information about a specific YouTube channel by ID'
    },
    async (uri, { channelId }) => {
      try {
        // Ensure channelId is a string, not an array
        const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId;
        const channelData = await youtubeService.getChannelDetails(channelIdStr);
        const channel = channelData.items?.[0];

        if (!channel) {
          return {
            contents: [{
              uri: uri.href,
              text: `Channel with ID ${channelIdStr} not found.`
            }]
          };
        }

        const details = {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          publishedAt: channel.snippet?.publishedAt,
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(details, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error fetching channel details: ${error}`
          }]
        };
      }
    }
  );

  server.resource(
    'transcript',
    new ResourceTemplate('youtube://transcript/{videoId}', { list: undefined }),
    {
      description: 'Get the transcript/captions for a specific YouTube video with optional language parameter'
    },
    async (uri, { videoId }) => {
      try {
        // Parse parameters from the URL
        const url = new URL(uri.href);
        const language = url.searchParams.get('language');

        // Ensure videoId is a string, not an array
        const videoIdStr = Array.isArray(videoId) ? videoId[0] : videoId;

        // Get video details for metadata
        const videoData = await youtubeService.getVideoDetails(videoIdStr);
        const video = videoData.items?.[0];

        if (!video) {
          return {
            contents: [{
              uri: uri.href,
              text: `Video with ID ${videoIdStr} not found.`
            }]
          };
        }

        try {
          // Get transcript
          const transcriptData = await youtubeService.getTranscript(videoIdStr, language || undefined);

          // Format the transcript with timestamps
          const formattedTranscript = transcriptData.map(caption =>
            `[${formatTime(caption.offset)}] ${caption.text}`
          ).join('\n');

          // Create metadata
          const metadata = {
            videoId: video.id,
            title: video.snippet?.title,
            channelTitle: video.snippet?.channelTitle,
            language: language || 'default',
            captionCount: transcriptData.length
          };

          return {
            contents: [{
              uri: uri.href,
              text: `# Transcript for: ${metadata.title}\n\n${formattedTranscript}`
            }],
            metadata
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `Transcript not available for video ID ${videoIdStr}. Error: ${error}`
            }]
          };
        }
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Error fetching transcript: ${error}`
          }]
        };
      }
    }
  );

  // Define tools
  server.tool(
    'search-videos',
    'Search for YouTube videos with advanced filtering options. Supports parameters: \
- query: Search term (required) \
- maxResults: Number of results to return (1-50) \
- channelId: Filter by specific channel \
- order: Sort by date, rating, viewCount, relevance, title \
- type: Filter by resource type (video, channel, playlist) \
- videoDuration: Filter by length (short: <4min, medium: 4-20min, long: >20min) \
- publishedAfter/publishedBefore: Filter by publish date (ISO format) \
- videoCaption: Filter by caption availability \
- videoDefinition: Filter by quality (standard/high) \
- regionCode: Filter by country (ISO country code)',
    {
      query: z.string().min(1),
      maxResults: z.number().min(1).max(50).optional(),
      channelId: z.string().optional(),
      order: z.enum(['date', 'rating', 'relevance', 'title', 'videoCount', 'viewCount']).optional(),
      type: z.enum(['video', 'channel', 'playlist']).optional(),
      videoDuration: z.enum(['any', 'short', 'medium', 'long']).optional(),
      publishedAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).optional(),
      publishedBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).optional(),
      videoCaption: z.enum(['any', 'closedCaption', 'none']).optional(),
      videoDefinition: z.enum(['any', 'high', 'standard']).optional(),
      regionCode: z.string().length(2).optional()
    },
    async ({ query, maxResults = 10, channelId, order, type, videoDuration, publishedAfter, publishedBefore, videoCaption, videoDefinition, regionCode }) => {
      try {
        const searchResults = await youtubeService.searchVideos(query, maxResults, {
          channelId,
          order,
          type,
          videoDuration,
          publishedAfter,
          publishedBefore,
          videoCaption,
          videoDefinition,
          regionCode
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(searchResults, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error searching videos: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-video-comments',
    'Retrieve comments for a specific YouTube video with sorting options',
    {
      videoId: z.string().min(1),
      maxResults: z.number().min(1).max(100).optional(),
      order: z.enum(['time', 'relevance']).optional(),
      includeReplies: z.boolean().optional(),
      pageToken: z.string().optional()
    },
    async ({ videoId, maxResults = 20, order = 'relevance', includeReplies = false, pageToken }) => {
      try {
        const commentsData = await youtubeService.getComments(videoId, maxResults, {
          order,
          includeReplies,
          pageToken
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(commentsData, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching comments: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-video-transcript',
    'Get the transcript/captions for a YouTube video with optional language selection. This tool retrieves the full transcript of a video with timestamped captions. Each caption includes the text and its timestamp in the video. Parameters: videoId (required) - The YouTube video ID; language (optional) - Language code for the transcript (e.g., "en", "ko", "ja"). If not specified, the default language for the video will be used. Returns a text with each caption line preceded by its timestamp.',
    {
      videoId: z.string().min(1),
      language: z.string().optional()
    },
    async ({ videoId, language }) => {
      try {
        const transcriptData = await youtubeService.getTranscript(videoId, language);

        // Optionally format the transcript for better readability
        const formattedTranscript = transcriptData.map(caption =>
          `[${formatTime(caption.offset)}] ${caption.text}`
        ).join('\n');

        return {
          content: [{
            type: 'text',
            text: formattedTranscript
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching transcript: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  // Additional tools
  server.tool(
    'get-video-stats',
    'Get statistical information for a specific YouTube video (views, likes, comments, upload date, etc.)',
    {
      videoId: z.string().min(1)
    },
    async ({ videoId }) => {
      try {
        const videoData = await youtubeService.getVideoDetails(videoId);
        const video = videoData.items?.[0];

        if (!video) {
          return {
            content: [{
              type: 'text',
              text: `Video with ID ${videoId} not found.`
            }],
            isError: true
          };
        }

        const stats = {
          videoId: video.id,
          title: video.snippet?.title,
          publishedAt: video.snippet?.publishedAt,
          channelTitle: video.snippet?.channelTitle,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          commentCount: video.statistics?.commentCount,
          duration: video.contentDetails?.duration
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching video statistics: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-channel-stats',
    'Get statistical information for a specific YouTube channel (subscriber count, total views, video count, etc.)',
    {
      channelId: z.string().min(1)
    },
    async ({ channelId }) => {
      try {
        const channelData = await youtubeService.getChannelDetails(channelId);
        const channel = channelData.items?.[0];

        if (!channel) {
          return {
            content: [{
              type: 'text',
              text: `Channel with ID ${channelId} not found.`
            }],
            isError: true
          };
        }

        const stats = {
          channelId: channel.id,
          title: channel.snippet?.title,
          createdAt: channel.snippet?.publishedAt,
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount,
          thumbnailUrl: channel.snippet?.thumbnails?.default?.url
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching channel statistics: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'compare-videos',
    'Compare statistics for multiple YouTube videos',
    {
      videoIds: z.array(z.string()).min(2).max(10)
    },
    async ({ videoIds }) => {
      try {
        const results = [];

        for (const videoId of videoIds) {
          const videoData = await youtubeService.getVideoDetails(videoId);
          const video = videoData.items?.[0];

          if (video) {
            results.push({
              videoId: video.id,
              title: video.snippet?.title,
              viewCount: Number(video.statistics?.viewCount || 0),
              likeCount: Number(video.statistics?.likeCount || 0),
              commentCount: Number(video.statistics?.commentCount || 0),
              publishedAt: video.snippet?.publishedAt
            });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error comparing videos: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-trending-videos',
    'Retrieve trending videos by region and category. This helps analyze current popular content trends.',
    {
      regionCode: z.string().length(2).optional(),
      categoryId: z.string().optional(),
      maxResults: z.number().min(1).max(50).optional()
    },
    async ({ regionCode = 'US', categoryId, maxResults = 10 }) => {
      try {
        const response = await youtubeService.youtube.videos.list({
          part: ['snippet', 'contentDetails', 'statistics'],
          chart: 'mostPopular',
          regionCode,
          videoCategoryId: categoryId,
          maxResults
        });

        const trendingVideos = response.data.items?.map(video => ({
          videoId: video.id,
          title: video.snippet?.title,
          channelTitle: video.snippet?.channelTitle,
          publishedAt: video.snippet?.publishedAt,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          commentCount: video.statistics?.commentCount
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(trendingVideos, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching trending videos: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-video-categories',
    'Retrieve available video categories for a specific region',
    {
      regionCode: z.string().length(2).optional()
    },
    async ({ regionCode = 'US' }) => {
      try {
        const response = await youtubeService.youtube.videoCategories.list({
          part: ['snippet'],
          regionCode
        });

        const categories = response.data.items?.map(category => ({
          id: category.id,
          title: category.snippet?.title
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(categories, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error fetching video categories: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'analyze-channel-videos',
    'Analyze recent videos from a specific channel to identify performance trends',
    {
      channelId: z.string().min(1),
      maxResults: z.number().min(1).max(50).optional(),
      sortBy: z.enum(['date', 'viewCount', 'rating']).optional()
    },
    async ({ channelId, maxResults = 10, sortBy = 'date' }) => {
      try {
        // First get all videos from the channel
        const searchResponse = await youtubeService.youtube.search.list({
          part: ['snippet'],
          channelId,
          maxResults,
          order: sortBy,
          type: ['video']
        });

        // Extract videoIds and filter out any null or undefined values
        const videoIds: string[] = searchResponse.data.items
          ?.map(item => item.id?.videoId)
          .filter((id): id is string => id !== null && id !== undefined) || [];

        if (videoIds.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No videos found for channel ${channelId}`
            }]
          };
        }

        // Then get detailed stats for each video
        const videosResponse = await youtubeService.youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: videoIds
        });

        interface VideoAnalysisItem {
          videoId: string;
          title: string | null | undefined;
          publishedAt: string | null | undefined;
          duration: string | null | undefined;
          viewCount: number;
          likeCount: number;
          commentCount: number;
        }

        const videoAnalysis: VideoAnalysisItem[] = videosResponse.data.items?.map(video => ({
          videoId: video.id || '',
          title: video.snippet?.title,
          publishedAt: video.snippet?.publishedAt,
          duration: video.contentDetails?.duration,
          viewCount: Number(video.statistics?.viewCount || 0),
          likeCount: Number(video.statistics?.likeCount || 0),
          commentCount: Number(video.statistics?.commentCount || 0)
        })) || [];

        // Calculate averages
        if (videoAnalysis.length > 0) {
          const avgViews = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.viewCount, 0) / videoAnalysis.length;
          const avgLikes = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.likeCount, 0) / videoAnalysis.length;
          const avgComments = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.commentCount, 0) / videoAnalysis.length;

          const result = {
            channelId,
            videoCount: videoAnalysis.length,
            averages: {
              viewCount: avgViews,
              likeCount: avgLikes,
              commentCount: avgComments
            },
            videos: videoAnalysis
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `No video data available for analysis`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error analyzing channel videos: ${error}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'enhanced-transcript',
    'Advanced transcript extraction tool with filtering, search, and multi-video capabilities. Provides rich transcript data for detailed analysis and processing. This tool offers multiple advanced features: 1) Extract transcripts from multiple videos in one request; 2) Filter by time ranges to focus on specific parts; 3) Search for specific content within transcripts; 4) Segment transcripts for structural analysis; 5) Format output in different ways (raw, timestamped, merged text); 6) Include video metadata. Parameters: videoIds (required) - Array of YouTube video IDs (up to 5); language (optional) - Language code; format (optional) - Output format ("raw", "timestamped", "merged"); includeMetadata (optional) - Whether to include video details; filters (optional) - Complex filtering options including timeRange, search, and segment.',
    {
      videoIds: z.array(z.string()).min(1).max(5),
      language: z.string().optional(),
      format: z.enum(['raw', 'timestamped', 'merged']).optional(),
      includeMetadata: z.boolean().optional(),
      filters: z.object({
        timeRange: z.object({
          start: z.number().min(0).optional(),
          end: z.number().min(0).optional()
        }).optional(),
        search: z.object({
          query: z.string().min(1),
          caseSensitive: z.boolean().optional(),
          contextLines: z.number().min(0).max(5).optional()
        }).optional(),
        segment: z.object({
          method: z.enum(['equal', 'smart']).optional(),
          count: z.number().min(1).max(10).optional()
        }).optional()
      }).optional()
    },
    async ({ videoIds, language, format, includeMetadata, filters }) => {
      try {
        const options: TranscriptOptions = {
          language,
          format,
          includeMetadata,
          timeRange: filters?.timeRange,
          search: filters?.search
        };

        // Only add segment option if both method and count are provided
        if (filters?.segment?.method && filters?.segment?.count) {
          options.segment = {
            method: filters.segment.method,
            count: filters.segment.count
          };
        }

        // Call the enhanced transcript method
        const transcript = await youtubeService.getEnhancedTranscript(videoIds, options);

        // Convert to MCP format
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(transcript, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to process transcript: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-key-moments',
    'Extract key moments with timestamps from a video transcript for easier navigation and summarization. This tool analyzes the video transcript to identify important segments based on content density and creates a structured output with timestamped key moments. Useful for quickly navigating to important parts of longer videos. Parameters: videoId (required) - The YouTube video ID; maxMoments (optional) - Number of key moments to extract (default: 5, max: 10). Returns a formatted text with key moments and their timestamps, plus the full transcript.',
    {
      videoId: z.string().min(1),
      maxMoments: z.string().optional()
    },
    async ({ videoId, maxMoments }) => {
      try {
        // 문자열 maxMoments를 숫자로 변환
        const maxMomentsNum = maxMoments ? parseInt(maxMoments, 10) : 5;

        const keyMomentsTranscript = await youtubeService.getKeyMomentsTranscript(videoId, maxMomentsNum);

        return {
          content: [{
            type: 'text',
            text: keyMomentsTranscript.text || 'No key moments found'
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error extracting key moments: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get-segmented-transcript',
    'Divide a video transcript into segments for easier analysis and navigation. This tool splits the video into equal time segments and extracts the transcript for each segment with proper timestamps. Ideal for analyzing the structure of longer videos or when you need to focus on specific parts of the content. Parameters: videoId (required) - The YouTube video ID; segmentCount (optional) - Number of segments to divide the video into (default: 4, max: 10). Returns a markdown-formatted text with each segment clearly labeled with time ranges and containing the relevant transcript text.',
    {
      videoId: z.string().min(1),
      segmentCount: z.string().optional()
    },
    async ({ videoId, segmentCount }) => {
      try {
        // 문자열 segmentCount를 숫자로 변환
        const segmentCountNum = segmentCount ? parseInt(segmentCount, 10) : 4;

        const segmentedTranscript = await youtubeService.getSegmentedTranscript(videoId, segmentCountNum);

        return {
          content: [{
            type: 'text',
            text: segmentedTranscript.text || 'Failed to create segmented transcript'
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error creating segmented transcript: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.prompt(
    'segment-by-segment-analysis',
    'Analyze a YouTube video segment by segment for a detailed breakdown of content. This prompt divides the video into the specified number of segments and provides a comprehensive analysis of each part. Particularly useful for longer videos where the content changes throughout or for educational videos with multiple topics. The analysis includes key points, important quotes, and how each segment connects to the overall theme. Parameters: videoId (required) - The YouTube video ID; segmentCount (optional) - Number of segments to divide the video into (default: 4, range: 2-8).',
    {
      videoId: z.string().min(1),
      segmentCount: z.string().optional(),
    },
    async ({ videoId, segmentCount }) => {
      try {
        // 문자열 세그먼트 카운트를 숫자로 변환
        const segmentCountNum = segmentCount ? parseInt(segmentCount, 10) : 4;

        // Get video details and segmented transcript
        const videoData = await youtubeService.getVideoDetails(videoId);
        const video = videoData.items?.[0];
        const segmentedTranscript = await youtubeService.getSegmentedTranscript(videoId, segmentCountNum);

        if (!segmentedTranscript.text) {
          throw new Error('Failed to generate segmented transcript');
        }

        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Please provide a segment-by-segment analysis of the following YouTube video:

Video Title: ${video?.snippet?.title || 'Unknown'}
Channel: ${video?.snippet?.channelTitle || 'Unknown'}
Published: ${video?.snippet?.publishedAt || 'Unknown'}

${segmentedTranscript.text}

For each segment, please provide:
1. A brief summary of the key points and information presented
2. Any important quotes or statements
3. How this segment connects to the overall topic of the video

Conclude with a brief overall summary that ties together the main themes across all segments.`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Error creating segment analysis prompt: ${error}`
            }
          }]
        };
      }
    }
  );

  // Define prompts
  server.prompt(
    'video-analysis',
    'Generate an analysis of a YouTube video based on its content and statistics',
    {
      videoId: z.string().min(1)
    },
    ({ videoId }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze this YouTube video (ID: ${videoId}). Include information about the video's content, key points, and audience reception.`
        }
      }]
    })
  );

  server.prompt(
    'transcript-summary',
    'Generate a summary of a YouTube video based on its transcript content with customizable options. This prompt provides different summary levels from brief overviews to detailed analyses, and can extract key topics from the content. Optimal for quickly understanding video content without watching the entire video. Parameters: videoId (required) - The YouTube video ID; language (optional) - Language code for transcript (e.g., "en", "ko"); summaryLength (optional) - Level of detail in summary ("short", "medium", or "detailed", default: "medium"); includeKeywords (optional) - Whether to extract key topics (set to "true" to enable).',
    {
      videoId: z.string().min(1),
      language: z.string().optional(),
      summaryLength: z.string().optional(),
      includeKeywords: z.string().optional(),
    },
    async ({ videoId, language, summaryLength, includeKeywords }) => {
      try {
        // Set defaults
        const finalSummaryLength = summaryLength || 'medium';
        const shouldIncludeKeywords = includeKeywords === 'true';

        // Get video details and transcript
        const videoData = await youtubeService.getVideoDetails(videoId);
        const video = videoData.items?.[0];
        const transcriptData = await youtubeService.getTranscript(videoId, language);

        // Format transcript text
        const transcriptText = transcriptData.map(caption => caption.text).join(' ');

        // Define summary instructions based on length
        let summaryInstructions = '';
        switch (finalSummaryLength) {
          case 'short':
            summaryInstructions = `Please provide a brief summary of this video in 3-5 sentences that captures the main idea.`;
            break;
          case 'detailed':
            summaryInstructions = `Please provide a comprehensive summary of this video, including:
1. A detailed overview of the main topics (at least 3-4 paragraphs)
2. All important details, facts, and arguments presented
3. The structure of the content and how ideas are developed
4. The overall tone, style, and intended audience of the content
5. Any conclusions or calls to action mentioned`;
            break;
          case 'medium':
          default:
            summaryInstructions = `Please provide:
1. A concise summary of the main topics and key points
2. Important details or facts presented
3. The overall tone and style of the content`;
            break;
        }

        // Add keywords extraction if requested
        if (shouldIncludeKeywords) {
          summaryInstructions += `\n\nAlso extract and list 5-10 key topics, themes, or keywords from the content in the format:
KEY TOPICS: [comma-separated list of key topics/keywords]`;
        }

        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Please provide a ${finalSummaryLength} summary of the following YouTube video transcript.

Video Title: ${video?.snippet?.title || 'Unknown'}
Channel: ${video?.snippet?.channelTitle || 'Unknown'}
Published: ${video?.snippet?.publishedAt || 'Unknown'}

Transcript:
${transcriptText}

${summaryInstructions}`
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Error creating transcript summary prompt: ${error}`
            }
          }]
        };
      }
    }
  );

  return server.server;
}

// Local development server setup
// Check if this file is being run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.includes('index');

// Initialize YouTube service (used by both MCP and HTTP server)
let youtubeService: YouTubeService | null = null;

// Helper functions
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Cloudflare Workers ExecutionContext type
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Cloudflare Workers export
const cloudflareWorker = {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const { Hono } = await import('hono');
    const app = new Hono();

    // Initialize YouTube service if not already initialized
    if (!youtubeService) {
      const apiKey = env.YOUTUBE_API_KEY || '';
      youtubeService = new YouTubeService(apiKey);
    }

    // CORS middleware - Cloudflare Access와 호환되도록 강화
    app.use('*', async (c, next) => {
      // CORS 헤더 설정
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, CF-Access-Client-Id, CF-Access-Client-Secret');
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Max-Age', '86400'); // 24시간

      // Cloudflare Access 헤더 확인 (선택적)
      const cfAccessClientId = c.req.header('CF-Access-Client-Id');
      const cfAccessClientSecret = c.req.header('CF-Access-Client-Secret');

      // OPTIONS 프리플라이트 요청 처리
      if (c.req.method === 'OPTIONS') {
        return c.json({}, 200);
      }

      // Cloudflare Access 인증이 필요한 경우를 위한 로깅 (디버깅용)
      if (process.env.DEBUG_ACCESS === 'true') {
        console.log('Request headers:', {
          'CF-Access-Client-Id': cfAccessClientId ? 'present' : 'missing',
          'CF-Access-Client-Secret': cfAccessClientSecret ? 'present' : 'missing',
          'Origin': c.req.header('Origin'),
          'User-Agent': c.req.header('User-Agent')
        });
      }

      await next();

      // 응답에도 CORS 헤더 보장
      c.header('Access-Control-Allow-Origin', '*');
    });

    // REST API: 비디오 검색
    app.post('/api/search-videos', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { query, maxResults = 50, channelId, order, type, videoDuration, publishedAfter, publishedBefore } = body;

        if (!query) {
          return c.json({ error: 'query is required' }, 400);
        }

        const searchResults = await youtubeService.searchVideos(query, maxResults, {
          channelId,
          order: order || 'viewCount',
          type: type || 'video',
          videoDuration,
          publishedAfter,
          publishedBefore
        });

        // 비디오 상세 정보 가져오기
        const videoIds = searchResults.items?.map((item: any) => item.id.videoId).join(',') || '';
        if (!videoIds) {
          return c.json({ items: [] });
        }

        const videoResponse = await youtubeService.getVideoDetails(videoIds);
        const videos = videoResponse.items || [];


        // 채널 정보 가져오기
        const channelIds = [...new Set(videos.map((v: any) => v.snippet?.channelId).filter(Boolean))] as string[];
        const channelMap = new Map();

        if (channelIds.length > 0) {
          const channelResponse = await youtubeService.youtube.channels.list({
            part: ['statistics', 'snippet'],
            id: channelIds
          });

          channelResponse.data.items?.forEach((item: any) => {
            channelMap.set(item.id, {
              subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
              country: item.snippet?.country || null
            });
          });
        }

        // 결과 변환
        const results = videos.map((video: any) => {
          const durationSeconds = parseISO8601Duration(video.contentDetails?.duration || 'PT0S');
          const channelInfo = channelMap.get(video.snippet?.channelId) || { subscriberCount: 0, country: null };
          const subscriberCount = channelInfo.subscriberCount;
          const viewCount = parseInt(video.statistics?.viewCount || '0');
          const viewSubscriberRatio = subscriberCount > 0 ? viewCount / subscriberCount : 0;

          return {
            id: video.id,
            title: video.snippet?.title,
            publishedAt: video.snippet?.publishedAt,
            viewCount,
            likeCount: parseInt(video.statistics?.likeCount || '0'),
            channelTitle: video.snippet?.channelTitle,
            channelId: video.snippet?.channelId,
            channelCountry: channelInfo.country,
            duration: formatDuration(durationSeconds),
            durationSeconds,
            subscriberCount,
            viewSubscriberRatio,
            description: video.snippet?.description,
            tags: video.snippet?.tags || [],
            thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url
          };
        });

        return c.json({ items: results });
      } catch (error: any) {
        console.error('Search error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 트렌딩 비디오 가져오기
    app.post('/api/get-trending-videos', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { regionCode = 'US', categoryId, maxResults = 10 } = body;

        const response = await youtubeService.youtube.videos.list({
          part: ['snippet', 'contentDetails', 'statistics'],
          chart: 'mostPopular',
          regionCode,
          videoCategoryId: categoryId,
          maxResults
        });

        // 비디오 상세 정보 가져오기
        const videos = response.data.items || [];

        // 채널 정보 가져오기
        const channelIds = [...new Set(videos.map((v: any) => v.snippet?.channelId).filter(Boolean))] as string[];
        const channelMap = new Map();

        if (channelIds.length > 0) {
          const channelResponse = await youtubeService.youtube.channels.list({
            part: ['statistics', 'snippet'],
            id: channelIds
          });

          channelResponse.data.items?.forEach((item: any) => {
            channelMap.set(item.id, {
              subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
              country: item.snippet?.country || null
            });
          });
        }

        // 결과 변환
        const results = videos.map((video: any) => {
          const durationSeconds = parseISO8601Duration(video.contentDetails?.duration || 'PT0S');
          const channelInfo = channelMap.get(video.snippet?.channelId) || { subscriberCount: 0, country: null };
          const subscriberCount = channelInfo.subscriberCount;
          const viewCount = parseInt(video.statistics?.viewCount || '0');
          const viewSubscriberRatio = subscriberCount > 0 ? viewCount / subscriberCount : 0;

          return {
            id: video.id,
            title: video.snippet?.title,
            publishedAt: video.snippet?.publishedAt,
            viewCount,
            likeCount: parseInt(video.statistics?.likeCount || '0'),
            channelTitle: video.snippet?.channelTitle,
            channelId: video.snippet?.channelId,
            channelCountry: channelInfo.country,
            duration: formatDuration(durationSeconds),
            durationSeconds,
            subscriberCount,
            viewSubscriberRatio,
            description: video.snippet?.description,
            tags: video.snippet?.tags || [],
            thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url
          };
        });

        return c.json({ items: results });
      } catch (error: any) {
        console.error('Trending videos error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 비디오 카테고리 가져오기
    app.post('/api/get-video-categories', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { regionCode = 'US' } = body;

        const response = await youtubeService.youtube.videoCategories.list({
          part: ['snippet'],
          regionCode
        });

        const categories = response.data.items?.map(category => ({
          id: category.id,
          title: category.snippet?.title
        })) || [];

        return c.json({ categories });
      } catch (error: any) {
        console.error('Video categories error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 채널 통계 가져오기
    app.post('/api/get-channel-stats', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { channelId } = body;

        if (!channelId) {
          return c.json({ error: 'channelId is required' }, 400);
        }

        const channelData = await youtubeService.getChannelDetails(channelId);
        const channel = channelData.items?.[0];

        if (!channel) {
          return c.json({ error: 'Channel not found' }, 404);
        }

        const stats = {
          channelId: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          createdAt: channel.snippet?.publishedAt,
          subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
          videoCount: parseInt(channel.statistics?.videoCount || '0'),
          viewCount: parseInt(channel.statistics?.viewCount || '0'),
          thumbnailUrl: channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.medium?.url
        };

        return c.json(stats);
      } catch (error: any) {
        console.error('Channel stats error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 채널 비디오 분석
    app.post('/api/analyze-channel-videos', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { channelId, maxResults = 10, sortBy = 'date' } = body;

        if (!channelId) {
          return c.json({ error: 'channelId is required' }, 400);
        }

        // 채널의 비디오 목록 가져오기
        const searchResponse = await youtubeService.youtube.search.list({
          part: ['snippet'],
          channelId,
          maxResults,
          order: sortBy,
          type: ['video']
        });

        const videoIds: string[] = searchResponse.data.items
          ?.map(item => item.id?.videoId)
          .filter((id): id is string => id !== null && id !== undefined) || [];

        if (videoIds.length === 0) {
          return c.json({
            channelId,
            videoCount: 0,
            averages: {
              viewCount: 0,
              likeCount: 0,
              commentCount: 0
            },
            videos: []
          });
        }

        // 비디오 상세 정보 가져오기
        const videosResponse = await youtubeService.youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: videoIds
        });

        interface VideoAnalysisItem {
          videoId: string;
          title: string | null | undefined;
          publishedAt: string | null | undefined;
          duration: string | null | undefined;
          viewCount: number;
          likeCount: number;
          commentCount: number;
        }

        const videoAnalysis: VideoAnalysisItem[] = videosResponse.data.items?.map(video => ({
          videoId: video.id || '',
          title: video.snippet?.title,
          publishedAt: video.snippet?.publishedAt,
          duration: video.contentDetails?.duration,
          viewCount: Number(video.statistics?.viewCount || 0),
          likeCount: Number(video.statistics?.likeCount || 0),
          commentCount: Number(video.statistics?.commentCount || 0)
        })) || [];

        // 평균 계산
        if (videoAnalysis.length > 0) {
          const avgViews = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.viewCount, 0) / videoAnalysis.length;
          const avgLikes = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.likeCount, 0) / videoAnalysis.length;
          const avgComments = videoAnalysis.reduce((sum: number, video: VideoAnalysisItem) => sum + video.commentCount, 0) / videoAnalysis.length;

          const result = {
            channelId,
            videoCount: videoAnalysis.length,
            averages: {
              viewCount: avgViews,
              likeCount: avgLikes,
              commentCount: avgComments
            },
            videos: videoAnalysis
          };

          return c.json(result);
        } else {
          return c.json({
            channelId,
            videoCount: 0,
            averages: {
              viewCount: 0,
              likeCount: 0,
              commentCount: 0
            },
            videos: []
          });
        }
      } catch (error: any) {
        console.error('Channel analysis error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 비디오 트랜스크립트 가져오기
    app.post('/api/get-video-transcript', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoId, language } = body;

        if (!videoId) {
          return c.json({ error: 'videoId is required' }, 400);
        }

        const transcriptData = await youtubeService.getTranscript(videoId, language);

        const formattedTranscript = transcriptData.map(caption =>
          `[${formatTime(caption.offset)}] ${caption.text}`
        ).join('\n');

        return c.json({
          videoId,
          transcript: formattedTranscript,
          segments: transcriptData.map(caption => ({
            text: caption.text,
            offset: caption.offset,
            duration: caption.duration
          }))
        });
      } catch (error: any) {
        // Transcript errors are expected for videos without captions - only log in debug mode
        if (process.env.DEBUG_TRANSCRIPT === 'true') {
          console.error('[DEBUG] Video transcript error:', error.message);
        }
        // Return 404 for transcript not available (expected case)
        if (error.message?.includes('No captions available') || error.message?.includes('Failed to fetch transcript')) {
          return c.json({ error: error.message || 'Transcript not available for this video' }, 404);
        }
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 향상된 트랜스크립트 가져오기
    app.post('/api/enhanced-transcript', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoIds, language, format, includeMetadata, filters } = body;

        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
          return c.json({ error: 'videoIds array is required' }, 400);
        }

        const options: any = {
          language,
          format,
          includeMetadata,
          timeRange: filters?.timeRange,
          search: filters?.search
        };

        if (filters?.segment?.method && filters?.segment?.count) {
          options.segment = {
            method: filters.segment.method,
            count: filters.segment.count
          };
        }

        const transcript = await youtubeService.getEnhancedTranscript(videoIds, options);

        return c.json(transcript);
      } catch (error: any) {
        // Only log in debug mode to reduce noise
        if (process.env.DEBUG_TRANSCRIPT === 'true') {
          console.error('[DEBUG] Enhanced transcript error:', error.message);
        }
        if (error.message?.includes('No captions available') || error.message?.includes('Failed to fetch transcript')) {
          return c.json({ error: error.message || 'Transcript not available' }, 404);
        }
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 주요 순간 추출
    app.post('/api/get-key-moments', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoId, maxMoments = 5 } = body;

        if (!videoId) {
          return c.json({ error: 'videoId is required' }, 400);
        }

        const maxMomentsNum = typeof maxMoments === 'string' ? parseInt(maxMoments, 10) : maxMoments;
        const keyMomentsTranscript = await youtubeService.getKeyMomentsTranscript(videoId, maxMomentsNum);

        return c.json({
          videoId,
          text: keyMomentsTranscript.text || 'No key moments found',
          metadata: keyMomentsTranscript.metadata
        });
      } catch (error: any) {
        // Only log in debug mode to reduce noise
        if (process.env.DEBUG_TRANSCRIPT === 'true') {
          console.error('[DEBUG] Key moments error:', error.message);
        }
        if (error.message?.includes('No captions available') || error.message?.includes('Failed to fetch transcript') || error.message?.includes('No transcript available')) {
          return c.json({ error: error.message || 'Transcript not available' }, 404);
        }
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 사용자의 채널 목록 가져오기 (with pagination support)
    app.post('/api/get-my-channels', async (c) => {
      try {
        const body = await c.req.json();
        const { accessToken, maxResults, pageToken } = body;

        if (!accessToken) {
          return c.json({ error: 'accessToken is required' }, 400);
        }

        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        // Get channels with pagination support
        const response = await youtubeService.getMyChannels(
          accessToken,
          maxResults || 50,  // Default to 50 if not specified
          pageToken         // Can be undefined
        );

        // Map the response to include pagination info
        const channels = response.items?.map(channel => ({
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          publishedAt: channel.snippet?.publishedAt,
          thumbnail: channel.snippet?.thumbnails?.default?.url ||
            channel.snippet?.thumbnails?.medium?.url ||
            channel.snippet?.thumbnails?.high?.url,
          subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
          videoCount: parseInt(channel.statistics?.videoCount || '0'),
          viewCount: parseInt(channel.statistics?.viewCount || '0'),
          // Include additional fields that might be useful
          customUrl: channel.snippet?.customUrl,
          country: channel.snippet?.country,
          defaultLanguage: channel.brandingSettings?.channel?.defaultLanguage,
          keywords: channel.brandingSettings?.channel?.keywords,
          privacyStatus: channel.status?.privacyStatus,
          isLinked: channel.status?.isLinked,
          uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
        })) || [];

        // Return the response with pagination info
        return c.json({
          channels,
          pageInfo: {
            totalResults: response.pageInfo?.totalResults,
            resultsPerPage: response.pageInfo?.resultsPerPage,
            nextPageToken: response.nextPageToken,
            prevPageToken: response.prevPageToken
          }
        });
      } catch (error: any) {
        console.error('Get my channels error:', error);

        // Return more detailed error information
        return c.json({
          error: error.message || 'Internal server error',
          code: error.code,
          details: error.errors
        }, error.status || 500);
      }
    });

    // REST API: 핸들명으로 채널 정보 가져오기
    app.post('/api/get-channel-by-handle', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { handle } = body;

        if (!handle) {
          return c.json({ error: 'handle is required' }, 400);
        }

        const response = await youtubeService.getChannelByHandle(handle);

        if (!response.items || response.items.length === 0) {
          return c.json({ error: `Channel not found for handle: ${handle}` }, 404);
        }

        const channel = response.items[0];

        return c.json({
          channel: {
            id: channel.id,
            title: channel.snippet?.title,
            description: channel.snippet?.description,
            customUrl: channel.snippet?.customUrl,
            publishedAt: channel.snippet?.publishedAt,
            thumbnail: channel.snippet?.thumbnails?.default?.url ||
              channel.snippet?.thumbnails?.medium?.url ||
              channel.snippet?.thumbnails?.high?.url,
            subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
            videoCount: parseInt(channel.statistics?.videoCount || '0'),
            viewCount: parseInt(channel.statistics?.viewCount || '0'),
            country: channel.snippet?.country,
            defaultLanguage: channel.brandingSettings?.channel?.defaultLanguage,
            keywords: channel.brandingSettings?.channel?.keywords,
            uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
          }
        });
      } catch (error: any) {
        console.error('Get channel by handle error:', error);
        return c.json({
          error: error.message || 'Internal server error',
          code: error.code
        }, error.status || 500);
      }
    });

    // REST API: 세그먼트별 트랜스크립트 가져오기
    app.post('/api/get-segmented-transcript', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoId, segmentCount = 4 } = body;

        if (!videoId) {
          return c.json({ error: 'videoId is required' }, 400);
        }

        const segmentCountNum = typeof segmentCount === 'string' ? parseInt(segmentCount, 10) : segmentCount;
        const segmentedTranscript = await youtubeService.getSegmentedTranscript(videoId, segmentCountNum);

        return c.json({
          videoId,
          text: segmentedTranscript.text || 'Failed to create segmented transcript',
          metadata: segmentedTranscript.metadata
        });
      } catch (error: any) {
        // Only log in debug mode to reduce noise
        if (process.env.DEBUG_TRANSCRIPT === 'true') {
          console.error('[DEBUG] Segmented transcript error:', error.message);
        }
        if (error.message?.includes('No captions available') || error.message?.includes('Failed to fetch transcript')) {
          return c.json({ error: error.message || 'Transcript not available' }, 404);
        }
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 비디오 댓글 가져오기
    app.post('/api/get-video-comments', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoId, maxResults = 20, order = 'relevance', includeReplies = false, pageToken } = body;

        if (!videoId) {
          return c.json({ error: 'videoId is required' }, 400);
        }

        const commentsData = await youtubeService.getComments(videoId, maxResults, {
          order,
          includeReplies,
          pageToken
        });

        // 댓글 데이터 변환
        const comments = commentsData.items?.map(item => {
          const comment = item.snippet?.topLevelComment?.snippet;
          return {
            id: item.id,
            author: comment?.authorDisplayName,
            authorChannelId: comment?.authorChannelId?.value,
            text: comment?.textDisplay,
            likeCount: parseInt(String(comment?.likeCount ?? '0'), 10),
            publishedAt: comment?.publishedAt,
            updatedAt: comment?.updatedAt,
            replies: item.replies?.comments?.map(reply => ({
              id: reply.id,
              author: reply.snippet?.authorDisplayName,
              text: reply.snippet?.textDisplay,
              likeCount: parseInt(String(reply.snippet?.likeCount ?? '0'), 10),
              publishedAt: reply.snippet?.publishedAt
            })) || []
          };
        }) || [];

        return c.json({
          videoId,
          totalResults: commentsData.pageInfo?.totalResults || 0,
          comments,
          nextPageToken: commentsData.nextPageToken,
          pageInfo: commentsData.pageInfo
        });
      } catch (error: any) {
        console.error('Video comments error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // REST API: 비디오 분석
    app.post('/api/video-analysis', async (c) => {
      try {
        if (!youtubeService) {
          return c.json({ error: 'YouTube service not initialized' }, 500);
        }

        const body = await c.req.json();
        const { videoId } = body;

        if (!videoId) {
          return c.json({ error: 'videoId is required' }, 400);
        }

        // 비디오 상세 정보 가져오기
        const videoData = await youtubeService.getVideoDetails(videoId);
        const video = videoData.items?.[0];

        if (!video) {
          return c.json({ error: 'Video not found' }, 404);
        }

        // 트랜스크립트 가져오기 (가능한 경우)
        let transcriptText = '';
        try {
          const transcriptData = await youtubeService.getTranscript(videoId);
          transcriptText = transcriptData.map(caption => caption.text).join(' ');
        } catch (transcriptError) {
          // 트랜스크립트가 없는 경우도 분석 가능하도록 계속 진행
          // Only log in debug mode to reduce noise
          if (process.env.DEBUG_TRANSCRIPT === 'true') {
            console.log('[DEBUG] Transcript not available for video:', videoId);
          }
        }

        // 비디오 통계 정보
        const statistics = {
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          likeCount: parseInt(video.statistics?.likeCount || '0'),
          commentCount: parseInt(video.statistics?.commentCount || '0'),
          duration: video.contentDetails?.duration
        };

        // 분석 데이터 구성
        const analysisData = {
          videoId: video.id,
          title: video.snippet?.title,
          channelTitle: video.snippet?.channelTitle,
          publishedAt: video.snippet?.publishedAt,
          description: video.snippet?.description,
          statistics,
          transcript: transcriptText,
          tags: video.snippet?.tags || [],
          thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url
        };

        // 분석 메시지 생성 (video-analysis prompt와 동일한 형식)
        const analysisPrompt = `Please analyze this YouTube video (ID: ${videoId}). Include information about the video's content, key points, and audience reception.

Video Information:
- Title: ${video.snippet?.title || 'Unknown'}
- Channel: ${video.snippet?.channelTitle || 'Unknown'}
- Published: ${video.snippet?.publishedAt || 'Unknown'}
- Views: ${statistics.viewCount.toLocaleString()}
- Likes: ${statistics.likeCount.toLocaleString()}
- Comments: ${statistics.commentCount.toLocaleString()}
${transcriptText ? `\nTranscript:\n${transcriptText}` : '\n(Transcript not available)'}`;

        return c.json({
          videoId: video.id,
          title: video.snippet?.title,
          channelTitle: video.snippet?.channelTitle,
          analysisPrompt,
          data: analysisData
        });
      } catch (error: any) {
        console.error('Video analysis error:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
      }
    });

    // ===== 로그 관리 API 엔드포인트 =====

    // 채널 생성 로그 저장
    app.post('/api/logs/channel-creation', async (c) => {
      try {
        const body = await c.req.json();
        const { id, timestamp, status, channelName, userEmail, details } = body;

        if (!id || !timestamp || !status) {
          return c.json({ error: '필수 필드가 누락되었습니다' }, 400);
        }

        // 메모리에 로그 저장 (실제 환경에서는 데이터베이스 사용)
        if (!globalThis.channelCreationLogs) {
          globalThis.channelCreationLogs = [];
        }

        const logEntry = { id, timestamp, status, channelName, userEmail, details };
        globalThis.channelCreationLogs.push(logEntry);

        console.log(`[LogAPI] 채널 생성 로그 저장: ${channelName} (${status})`);
        return c.json({ success: true, id });
      } catch (error: any) {
        console.error('[LogAPI] 채널 생성 로그 저장 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 브랜딩 로그 저장
    app.post('/api/logs/branding', async (c) => {
      try {
        const body = await c.req.json();
        const { id, timestamp, topic, channelNames, tags, details } = body;

        if (!id || !timestamp || !topic) {
          return c.json({ error: '필수 필드가 누락되었습니다' }, 400);
        }

        if (!globalThis.brandingLogs) {
          globalThis.brandingLogs = [];
        }

        const logEntry = { id, timestamp, topic, channelNames, tags, details };
        globalThis.brandingLogs.push(logEntry);

        console.log(`[LogAPI] 브랜딩 로그 저장: ${topic}`);
        return c.json({ success: true, id });
      } catch (error: any) {
        console.error('[LogAPI] 브랜딩 로그 저장 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 검색 로그 저장
    app.post('/api/logs/search', async (c) => {
      try {
        const body = await c.req.json();
        const { id, timestamp, searchQuery, resultCount, details } = body;

        if (!id || !timestamp || !searchQuery) {
          return c.json({ error: '필수 필드가 누락되었습니다' }, 400);
        }

        if (!globalThis.searchLogs) {
          globalThis.searchLogs = [];
        }

        const logEntry = { id, timestamp, searchQuery, resultCount, details };
        globalThis.searchLogs.push(logEntry);

        console.log(`[LogAPI] 검색 로그 저장: ${searchQuery}`);
        return c.json({ success: true, id });
      } catch (error: any) {
        console.error('[LogAPI] 검색 로그 저장 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 채널 생성 로그 조회
    app.get('/api/logs/channel-creation', async (c) => {
      try {
        const status = c.req.query('status');
        const userEmail = c.req.query('userEmail');
        const limit = parseInt(c.req.query('limit') || '100');
        const offset = parseInt(c.req.query('offset') || '0');

        let logs = globalThis.channelCreationLogs || [];

        if (status) {
          logs = logs.filter((log: any) => log.status === status);
        }

        if (userEmail) {
          logs = logs.filter((log: any) => log.userEmail === userEmail);
        }

        // 최신순으로 정렬
        logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const paginated = logs.slice(offset, offset + limit);
        return c.json({ logs: paginated, count: paginated.length });
      } catch (error: any) {
        console.error('[LogAPI] 채널 생성 로그 조회 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 브랜딩 로그 조회
    app.get('/api/logs/branding', async (c) => {
      try {
        const topic = c.req.query('topic');
        const limit = parseInt(c.req.query('limit') || '100');
        const offset = parseInt(c.req.query('offset') || '0');

        let logs = globalThis.brandingLogs || [];

        if (topic) {
          logs = logs.filter((log: any) => log.topic.includes(topic));
        }

        logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const paginated = logs.slice(offset, offset + limit);
        return c.json({ logs: paginated, count: paginated.length });
      } catch (error: any) {
        console.error('[LogAPI] 브랜딩 로그 조회 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 검색 로그 조회

    // D1 Channels API
    app.get('/api/channels', async (c) => {
      try {
        const userId = c.req.query('userId');
        if (!userId) {
          return c.json({ error: 'UserId is required' }, 400);
        }

        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM Channels WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(userId).all();

        return c.json({ channels: results });
      } catch (error: any) {
        console.error('Get Channels API Error:', error);
        return c.json({ error: 'Failed to fetch channels' }, 500);
      }
    });

    app.post('/api/add-channel', async (c) => {
      try {
        const body = await c.req.json();
        const { handle, userId } = body;

        if (!handle || !userId) {
          return c.json({ error: 'Handle and userId are required' }, 400);
        }

        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

        const existingChannel = await env.DB.prepare(
          'SELECT id FROM Channels WHERE user_id = ? AND handle = ?'
        ).bind(userId, cleanHandle).first();

        if (existingChannel) {
          return c.json({ error: 'Channel already added' }, 400);
        }

        const channelId = `UC${Date.now()}${Math.random().toString(36).substr(2, 16)}`;

        const result = await env.DB.prepare(`
                INSERT INTO Channels (id, user_id, handle)
                VALUES (?, ?, ?)
            `).bind(channelId, userId, cleanHandle).run();

        if (!result.success) {
          return c.json({ error: 'Failed to save channel' }, 500);
        }

        return c.json({ success: true, channelId, message: 'Channel added successfully' });
      } catch (error: any) {
        console.error('Add Channel API Error:', error);
        return c.json({ error: 'Failed to add channel' }, 500);
      }
    });


    // API Key Management
    app.get('/api/apikeys', async (c) => {
      try {
        const userId = c.req.query('userId');
        if (!userId) {
          return c.json({ error: 'UserId is required' }, 400);
        }
        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM ApiKeys WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(userId).all();

        return c.json({ apiKeys: results });
      } catch (error: any) {
        console.error('Get API Keys Error:', error);
        return c.json({ error: 'Failed to fetch API keys' }, 500);
      }
    });

    app.post('/api/apikeys', async (c) => {
      try {
        const body = await c.req.json();
        const { userId, key, alias } = body;

        if (!userId || !key) {
          return c.json({ error: 'UserId and Key are required' }, 400);
        }
        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        // Check if it's the first key, if so make it active
        const existingKeys = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM ApiKeys WHERE user_id = ?'
        ).bind(userId).first();

        const isActive = (existingKeys?.count === 0) ? 1 : 0;

        const result = await env.DB.prepare(
          'INSERT INTO ApiKeys (user_id, key_value, alias, is_active) VALUES (?, ?, ?, ?)'
        ).bind(userId, key, alias || 'My API Key', isActive).run();

        if (!result.success) {
          return c.json({ error: 'Failed to save API key' }, 500);
        }

        return c.json({ success: true, message: 'API Key added successfully' });
      } catch (error: any) {
        console.error('Add API Key Error:', error);
        return c.json({ error: 'Failed to add API key' }, 500);
      }
    });

    app.put('/api/apikeys/:id/active', async (c) => {
      try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { userId } = body;

        if (!userId) {
          return c.json({ error: 'UserId is required' }, 400);
        }
        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        // Transaction: Deactivate all for user, then activate specific one
        const batch = await env.DB.batch([
          env.DB.prepare('UPDATE ApiKeys SET is_active = 0 WHERE user_id = ?').bind(userId),
          env.DB.prepare('UPDATE ApiKeys SET is_active = 1 WHERE id = ? AND user_id = ?').bind(id, userId)
        ]);

        return c.json({ success: true, message: 'API Key activated' });
      } catch (error: any) {
        console.error('Activate API Key Error:', error);
        return c.json({ error: 'Failed to activate API key' }, 500);
      }
    });

    app.delete('/api/apikeys/:id', async (c) => {
      try {
        const id = c.req.param('id');
        const userId = c.req.query('userId');

        if (!userId) {
          return c.json({ error: 'UserId is required' }, 400);
        }
        if (!env.DB) {
          return c.json({ error: 'Database not configured' }, 500);
        }

        const result = await env.DB.prepare(
          'DELETE FROM ApiKeys WHERE id = ? AND user_id = ?'
        ).bind(id, userId).run();

        if (!result.success) {
          return c.json({ error: 'Failed to delete API key' }, 500);
        }

        return c.json({ success: true, message: 'API Key deleted' });
      } catch (error: any) {
        console.error('Delete API Key Error:', error);
        return c.json({ error: 'Failed to delete API key' }, 500);
      }
    });

    app.get('/api/logs/search', async (c) => {
      try {
        const query = c.req.query('query');
        const limit = parseInt(c.req.query('limit') || '100');
        const offset = parseInt(c.req.query('offset') || '0');

        let logs = globalThis.searchLogs || [];

        if (query) {
          logs = logs.filter((log: any) => log.searchQuery.includes(query));
        }

        logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const paginated = logs.slice(offset, offset + limit);
        return c.json({ logs: paginated, count: paginated.length });
      } catch (error: any) {
        console.error('[LogAPI] 검색 로그 조회 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 모든 로그 조회
    app.get('/api/logs/all', async (c) => {
      try {
        const limit = parseInt(c.req.query('limit') || '100');
        const offset = parseInt(c.req.query('offset') || '0');

        const channelLogs = (globalThis.channelCreationLogs || []).map((log: any) => ({ ...log, type: 'channel_creation' }));
        const brandingLogs = (globalThis.brandingLogs || []).map((log: any) => ({ ...log, type: 'branding' }));
        const searchLogs = (globalThis.searchLogs || []).map((log: any) => ({ ...log, type: 'search' }));

        const allLogs = [...channelLogs, ...brandingLogs, ...searchLogs];

        // 최신순으로 정렬
        allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const paginated = allLogs.slice(offset, offset + limit);
        return c.json({ logs: paginated, total: allLogs.length, count: paginated.length });
      } catch (error: any) {
        console.error('[LogAPI] 모든 로그 조회 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 로그 통계
    app.get('/api/logs/statistics', async (c) => {
      try {
        const channelLogs = globalThis.channelCreationLogs || [];
        const brandingLogs = globalThis.brandingLogs || [];
        const searchLogs = globalThis.searchLogs || [];

        const stats = {
          channelCreation: {
            total: channelLogs.length,
            success: channelLogs.filter((log: any) => log.status === 'success').length,
            error: channelLogs.filter((log: any) => log.status === 'error').length
          },
          branding: {
            total: brandingLogs.length
          },
          search: {
            total: searchLogs.length
          }
        };

        return c.json(stats);
      } catch (error: any) {
        console.error('[LogAPI] 로그 통계 조회 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // 로그 삭제
    app.delete('/api/logs/:id/:type', async (c) => {
      try {
        const { id, type } = c.req.param();

        let logArray = null;
        if (type === 'channel_creation') {
          logArray = globalThis.channelCreationLogs || [];
        } else if (type === 'branding') {
          logArray = globalThis.brandingLogs || [];
        } else if (type === 'search') {
          logArray = globalThis.searchLogs || [];
        } else {
          return c.json({ error: '잘못된 로그 타입' }, 400);
        }

        const index = logArray.findIndex((log: any) => log.id === id);
        if (index !== -1) {
          logArray.splice(index, 1);
          console.log(`[LogAPI] 로그 삭제: ${id} (${type})`);
          return c.json({ success: true, message: '로그가 삭제되었습니다' });
        } else {
          return c.json({ error: '로그를 찾을 수 없습니다' }, 404);
        }
      } catch (error: any) {
        console.error('[LogAPI] 로그 삭제 오류:', error);
        return c.json({ error: error.message || '서버 오류' }, 500);
      }
    });

    // Basic MCP endpoint
    app.post('/mcp', async (c) => {
      try {
        return c.json({ message: 'MCP server is running', endpoint: '/mcp' });
      } catch (error) {
        return c.json({ error: String(error) }, 500);
      }
    });

    app.get('/health', (c) => {
      return c.json({ status: 'ok' });
    });

    // 에러 핸들러 - 모든 에러 응답에 CORS 헤더 추가
    app.onError((err, c) => {
      console.error('Error:', err);
      // 에러 응답에도 CORS 헤더 추가
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return c.json({
        error: err.message || 'Internal Server Error',
        status: 500
      }, 500);
    });

    // 404 핸들러
    app.notFound((c) => {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return c.json({ error: 'Not Found', status: 404 }, 404);
    });

    return app.fetch(request);
  }
};

// Export MCP server as default for Smithery
export default createMcpServer;

// Export Cloudflare Worker as named export
export { cloudflareWorker };

// Local development server (for non-Cloudflare environments)
if (isMainModule) {
  (async () => {
    try {
      const dotenv = await import('dotenv');
      dotenv.default.config();

      const { serve } = await import('@hono/node-server');
      const port = process.env.PORT || 3000;

      // Initialize YouTube service for local development
      const config = {
        youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
        port: String(port)
      };

      youtubeService = new YouTubeService(config.youtubeApiKey);

      // Use the cloudflare worker's fetch handler for local development
      const handler = {
        fetch: async (request: Request) => {
          // Create a mock env object for local development
          const mockEnv = { YOUTUBE_API_KEY: config.youtubeApiKey };
          return cloudflareWorker.fetch(request, mockEnv, {} as ExecutionContext);
        }
      };

      serve({
        fetch: handler.fetch,
        port: Number(port)
      }, (info) => {
        console.log(`YouTube MCP Server is running on http://localhost:${info.port}`);
        console.log(`MCP endpoint: http://localhost:${info.port}/mcp`);
        console.log(`Health check: http://localhost:${info.port}/health`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}