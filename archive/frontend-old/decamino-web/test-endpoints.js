#!/usr/bin/env node

// Script pentru testarea endpoint-urilor n8n
import fetch from 'node-fetch';

const endpoints = [
  'https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142',
  'https://n8n.decaminoservicios.com/webhook/ed97e937-bb85-4b58-967b-d41bbd84ac47',
  'https://n8n.decaminoservicios.com/webhook/b3fd1c12-bfc0-438f-8246-2e4d63adb291'
];

async function testEndpoint(url) {
  try {
    console.log(`\n🔍 Testing: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeCamino-Test/1.0'
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    console.log(`📄 Content-Type: ${contentType}`);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`✅ JSON Response (${Array.isArray(data) ? data.length : 1} items)`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`📝 Sample data:`, JSON.stringify(data[0], null, 2));
      } else if (typeof data === 'object') {
        console.log(`📝 Data:`, JSON.stringify(data, null, 2));
      }
    } else {
      const text = await response.text();
      console.log(`⚠️  Non-JSON Response (${text.length} chars)`);
      if (text.length < 500) {
        console.log(`📝 Content:`, text.substring(0, 200) + (text.length > 200 ? '...' : ''));
      } else {
        console.log(`📝 Content preview:`, text.substring(0, 200) + '...');
      }
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error.message);
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testing n8n endpoints...');
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n✅ Testing completed!');
}

testAllEndpoints();
