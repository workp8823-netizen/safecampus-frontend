// Test all three methods to see which one the browser-equivalent works
const https = require('https');

const query = `
  [out:json][timeout:25];
  (
    node["amenity"~"library|university|college"](5.626,-0.205,5.667,-0.169);
  );
  out center 10;
`;

function testMethod(label, options, body) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ ${label}: HTTP ${res.statusCode} → ${json.elements?.length ?? 0} elements`);
        } catch {
          console.log(`❌ ${label}: HTTP ${res.statusCode} → ${data.slice(0, 100)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`❌ ${label}: Error - ${e.message}`); resolve(); });
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Method 1: text/plain (what PowerShell uses)
  await testMethod('text/plain', {
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(query), 'User-Agent': 'SafeCampus/1.0' }
  }, query);

  // Method 2: application/x-www-form-urlencoded (what Overpass docs recommend)
  const encoded = 'data=' + encodeURIComponent(query);
  await testMethod('x-www-form-urlencoded', {
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(encoded), 'User-Agent': 'SafeCampus/1.0' }
  }, encoded);

  // Method 3: GET with query param (simplest, no preflight)
  const getPath = '/api/interpreter?data=' + encodeURIComponent(query);
  await testMethod('GET request', {
    hostname: 'overpass-api.de',
    path: getPath,
    method: 'GET',
    headers: { 'User-Agent': 'SafeCampus/1.0' }
  });
}

run();
