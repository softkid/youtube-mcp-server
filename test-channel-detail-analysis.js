/**
 * Test script for channel detail analysis
 * 
 * This script tests the channel detail analysis functionality by:
 * 1. Fetching channel info by handle using /api/get-channel-by-handle
 * 2. Getting channel ID
 * 3. Fetching detailed channel information using YouTube API
 * 
 * Usage:
 *   node test-channel-detail-analysis.js <handle> [apiKey]
 * 
 * Example:
 *   node test-channel-detail-analysis.js breakingbad100
 *   node test-channel-detail-analysis.js @breakingbad100 YOUR_API_KEY
 */

import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.MCP_SERVER_URL || 'https://youtube-mcp-server.goodprogram.workers.dev';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.argv[3];

async function testChannelDetailAnalysis(handle, apiKey) {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  
  console.log('\n🧪 Testing Channel Detail Analysis');
  console.log('═'.repeat(60));
  console.log(`📺 Channel Handle: ${cleanHandle}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}\n`);

  try {
    // Step 1: Get channel info by handle
    console.log('📋 Step 1: Fetching channel info by handle...');
    const handleResponse = await fetch(`${API_BASE_URL}/api/get-channel-by-handle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        handle: cleanHandle
      })
    });

    console.log(`   Status: ${handleResponse.status} ${handleResponse.statusText}`);

    if (!handleResponse.ok) {
      const errorData = await handleResponse.json();
      console.error(`   ❌ Error:`, errorData);
      return;
    }

    const handleData = await handleResponse.json();
    const channelId = handleData.channel?.id;

    if (!channelId) {
      console.error(`   ❌ Error: Channel ID not found in response`);
      console.log(`   Response:`, JSON.stringify(handleData, null, 2));
      return;
    }

    console.log(`   ✅ Channel found!`);
    console.log(`   📺 Channel ID: ${channelId}`);
    console.log(`   📝 Title: ${handleData.channel?.title || 'N/A'}`);
    console.log(`   👥 Subscribers: ${handleData.channel?.subscriberCount?.toLocaleString() || 'N/A'}\n`);

    // Step 2: Get detailed channel information
    if (!apiKey) {
      console.log('⚠️  Step 2: Skipping detailed analysis (API key not provided)');
      console.log('   💡 To test full analysis, provide API key:');
      console.log(`      node test-channel-detail-analysis.js ${handle} YOUR_API_KEY`);
      console.log('\n📋 Basic Channel Info:');
      console.log(JSON.stringify(handleData.channel, null, 2));
      return;
    }

    console.log('📋 Step 2: Fetching detailed channel information from YouTube API...');
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`;
    
    const detailResponse = await fetch(youtubeApiUrl);

    console.log(`   Status: ${detailResponse.status} ${detailResponse.statusText}`);

    if (!detailResponse.ok) {
      const errorData = await detailResponse.json();
      console.error(`   ❌ Error:`, errorData);
      return;
    }

    const detailData = await detailResponse.json();

    if (!detailData.items || detailData.items.length === 0) {
      console.error(`   ❌ Error: No channel data found`);
      return;
    }

    const channel = detailData.items[0];
    const snippet = channel.snippet || {};
    const statistics = channel.statistics || {};
    const brandingSettings = channel.brandingSettings || {};

    console.log(`   ✅ Detailed channel information retrieved!\n`);

    // Display formatted results
    console.log('📊 Channel Detail Analysis Results');
    console.log('═'.repeat(60));
    
    // Basic Information
    console.log('\n📌 Basic Information:');
    console.log(`   ID: ${channel.id}`);
    console.log(`   Title: ${snippet.title || 'N/A'}`);
    console.log(`   Custom URL: ${snippet.customUrl || 'N/A'}`);
    console.log(`   Published: ${snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString('ko-KR') : 'N/A'}`);
    console.log(`   Country: ${snippet.country || 'N/A'}`);
    console.log(`   Default Language: ${snippet.defaultLanguage || 'N/A'}`);
    
    // Statistics
    console.log('\n📈 Statistics:');
    console.log(`   Subscribers: ${parseInt(statistics.subscriberCount || 0).toLocaleString()}`);
    console.log(`   Total Views: ${parseInt(statistics.viewCount || 0).toLocaleString()}`);
    console.log(`   Video Count: ${parseInt(statistics.videoCount || 0).toLocaleString()}`);
    
    // Description
    if (snippet.description) {
      const desc = snippet.description.length > 200 
        ? snippet.description.substring(0, 200) + '...'
        : snippet.description;
      console.log('\n📝 Description:');
      console.log(`   ${desc.replace(/\n/g, '\n   ')}`);
    }

    // Keywords
    if (brandingSettings?.channel?.keywords) {
      const keywords = brandingSettings.channel.keywords.split(' ').filter(k => k.trim());
      if (keywords.length > 0) {
        console.log('\n🏷️  Keywords:');
        console.log(`   ${keywords.join(', ')}`);
      }
    }

    // Thumbnails
    if (snippet.thumbnails) {
      console.log('\n🖼️  Thumbnails:');
      if (snippet.thumbnails.high) {
        console.log(`   High: ${snippet.thumbnails.high.url}`);
      }
      if (snippet.thumbnails.medium) {
        console.log(`   Medium: ${snippet.thumbnails.medium.url}`);
      }
      if (snippet.thumbnails.default) {
        console.log(`   Default: ${snippet.thumbnails.default.url}`);
      }
    }

    // Banner
    if (brandingSettings?.image?.bannerExternalUrl) {
      console.log('\n🎨 Banner:');
      console.log(`   ${brandingSettings.image.bannerExternalUrl}`);
    }

    // Full JSON response
    console.log('\n📋 Full JSON Response:');
    console.log(JSON.stringify(channel, null, 2));

    console.log('\n✅ Channel detail analysis completed successfully!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error(`\n❌ Request failed:`, error.message);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
  }
}

// Get handle from command line arguments
const handle = process.argv[2] || 'breakingbad100';
const apiKey = process.argv[3] || YOUTUBE_API_KEY;

if (!handle) {
  console.error('❌ Error: Handle is required');
  console.log('\nUsage:');
  console.log('  node test-channel-detail-analysis.js <handle> [apiKey]');
  console.log('\nExamples:');
  console.log('  node test-channel-detail-analysis.js breakingbad100');
  console.log('  node test-channel-detail-analysis.js @breakingbad100 YOUR_API_KEY');
  console.log('\nNote: If API key is not provided, only basic info will be shown.');
  process.exit(1);
}

// Run test
testChannelDetailAnalysis(handle, apiKey);

