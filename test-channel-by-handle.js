/**
 * Test script for channel-by-handle API endpoint
 * 
 * Usage:
 *   node test-channel-by-handle.js <handle>
 * 
 * Example:
 *   node test-channel-by-handle.js @mrbeast
 *   node test-channel-by-handle.js mrbeast
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://youtube-mcp-server.goodprogram.workers.dev';

async function testChannelByHandle(handle) {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  
  console.log(`\n🧪 Testing channel-by-handle API`);
  console.log(`📺 Handle: ${cleanHandle}`);
  console.log(`🌐 API URL: ${API_BASE_URL}/api/get-channel-by-handle\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/get-channel-by-handle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        handle: cleanHandle
      })
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Error:`, errorData);
      return;
    }

    const data = await response.json();
    
    console.log(`✅ Success! Channel found:\n`);
    console.log(`   ID: ${data.channel.id}`);
    console.log(`   Title: ${data.channel.title}`);
    console.log(`   Handle: ${data.channel.customUrl || cleanHandle}`);
    console.log(`   Subscribers: ${data.channel.subscriberCount?.toLocaleString() || 'N/A'}`);
    console.log(`   Videos: ${data.channel.videoCount?.toLocaleString() || 'N/A'}`);
    console.log(`   Views: ${data.channel.viewCount?.toLocaleString() || 'N/A'}`);
    console.log(`   Country: ${data.channel.country || 'N/A'}`);
    console.log(`   Published: ${data.channel.publishedAt || 'N/A'}`);
    console.log(`   Thumbnail: ${data.channel.thumbnail || 'N/A'}`);
    
    if (data.channel.description) {
      const desc = data.channel.description.length > 100 
        ? data.channel.description.substring(0, 100) + '...'
        : data.channel.description;
      console.log(`   Description: ${desc}`);
    }

    console.log(`\n📋 Full Response:`);
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
  }
}

// Get handle from command line arguments
const handle = process.argv[2];

if (!handle) {
  console.error('❌ Error: Handle is required');
  console.log('\nUsage:');
  console.log('  node test-channel-by-handle.js <handle>');
  console.log('\nExamples:');
  console.log('  node test-channel-by-handle.js @mrbeast');
  console.log('  node test-channel-by-handle.js mrbeast');
  console.log('  node test-channel-by-handle.js @mkbhd');
  process.exit(1);
}

// Run test
testChannelByHandle(handle);

