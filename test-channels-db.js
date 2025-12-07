/**
 * Test script to check channels in database
 * 
 * Usage:
 *   node test-channels-db.js [userId]
 * 
 * Example:
 *   node test-channels-db.js user-goodprogram
 */

import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.MCP_SERVER_URL || 'https://youtube-mcp-server.goodprogram.workers.dev';

async function testChannelsInDB(userId) {
  if (!userId) {
    console.error('❌ Error: userId is required');
    console.log('\nUsage:');
    console.log('  node test-channels-db.js <userId>');
    console.log('\nExamples:');
    console.log('  node test-channels-db.js user-goodprogram');
    console.log('  node test-channels-db.js user-test');
    return;
  }

  console.log('\n🧪 Testing Channels in Database');
  console.log('═'.repeat(60));
  console.log(`👤 User ID: ${userId}`);
  console.log(`🌐 API URL: ${API_BASE_URL}/api/channels?userId=${userId}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/channels?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Error:`, errorData);
      return;
    }

    const data = await response.json();
    
    if (!data.channels || data.channels.length === 0) {
      console.log(`⚠️  No channels found for user: ${userId}`);
      console.log('\n💡 This could mean:');
      console.log('   1. No channels have been added yet');
      console.log('   2. Channels were added with a different userId');
      console.log('   3. Database table is empty');
      return;
    }

    console.log(`✅ Found ${data.channels.length} channel(s):\n`);

    data.channels.forEach((channel, index) => {
      console.log(`📺 Channel ${index + 1}:`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Title: ${channel.title || 'N/A'}`);
      console.log(`   Handle: ${channel.handle || 'N/A'}`);
      console.log(`   Custom URL: ${channel.custom_url || 'N/A'}`);
      console.log(`   User ID: ${channel.user_id}`);
      console.log(`   Subscribers: ${channel.subscriber_count?.toLocaleString() || 'N/A'}`);
      console.log(`   Videos: ${channel.video_count?.toLocaleString() || 'N/A'}`);
      console.log(`   Views: ${channel.view_count?.toLocaleString() || 'N/A'}`);
      console.log(`   Country: ${channel.country || 'N/A'}`);
      console.log(`   Created: ${channel.created_at || 'N/A'}`);
      console.log(`   Updated: ${channel.updated_at || 'N/A'}`);
      if (channel.thumbnail) {
        console.log(`   Thumbnail: ${channel.thumbnail.substring(0, 50)}...`);
      }
      console.log('');
    });

    console.log('📋 Full Response:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
  }
}

// Get userId from command line arguments
const userId = process.argv[2];

// Run test
testChannelsInDB(userId);

