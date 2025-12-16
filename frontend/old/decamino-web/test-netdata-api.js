// Test script pentru Netdata Cloud API
const API_KEY = 'ndc.LFBOzvx7Fj2y4RcIG1Olt98tjUsreqz5RpVgWepyGCJSE9wMTFVB54j3NwxhWoHeyYAUECIdCCEYALJEMWegg6OHbuhkBMccEpLaUSxcE9ovAUVrG6Zm39nQEoUmon0t';
const CLOUD_URL = 'https://app.netdata.cloud';
const SPACE_ID = '5f8c0359-8509-4867-858d-a217b5c9f727';
const SERVER_IDS = [
  '7764789d-63d5-49fb-a0e4-dfeae97b5f74', // VPS 1 - DeCamino
  'cdc0c2d9-7d9b-4b72-aa47-4b201446d045'  // VPS 2 - Backup
];

async function testNetdataAPI() {
  console.log('🔍 Testing Netdata Cloud API...');
  console.log('🔍 API Key (first 20 chars):', API_KEY.substring(0, 20));
  console.log('🔍 Cloud URL:', CLOUD_URL);
  console.log('🔍 Space ID:', SPACE_ID);
  console.log('🔍 Server IDs:', SERVER_IDS);

  for (const serverId of SERVER_IDS) {
    console.log(`\n📊 Testing server: ${serverId}`);
    
    const endpoints = [
      `/api/v1/nodes/${serverId}/info`,
      `/api/v1/spaces/${SPACE_ID}/nodes/${serverId}/info`,
      `/api/v1/nodes/${serverId}/charts`,
      `/api/v1/spaces/${SPACE_ID}/nodes/${serverId}/charts`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔗 Testing endpoint: ${endpoint}`);
        
        const response = await fetch(`${CLOUD_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success! Data keys:`, Object.keys(data));
          console.log(`✅ Sample data:`, JSON.stringify(data, null, 2).substring(0, 500));
        } else {
          const errorText = await response.text();
          console.log(`❌ Error: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Network error: ${error.message}`);
      }
    }
  }
}

// Testează și endpoint-ul pentru spații
async function testSpacesAPI() {
  console.log('\n🔍 Testing spaces API...');
  
  try {
    const response = await fetch(`${CLOUD_URL}/api/v1/spaces`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Spaces response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Spaces data:`, data);
    } else {
      const errorText = await response.text();
      console.log(`❌ Spaces error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ Spaces network error: ${error.message}`);
  }
}

// Rulează testele
testNetdataAPI().then(() => {
  return testSpacesAPI();
}).then(() => {
  console.log('\n✅ API testing completed!');
}).catch(error => {
  console.error('💥 Test error:', error);
}); 