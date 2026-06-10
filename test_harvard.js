import https from 'https';

// Harvard bounding box from Nominatim
const bb = ['42.3592867', '42.3838794', '-71.1361609', '-71.1104568'];
const [s, n, w, e] = bb.map(Number);
console.log('BBox:', s, n, w, e);

const overpassQuery = `[out:json][timeout:25];
(
  node["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|bank|cafe|police|security|clinic"](${s},${w},${n},${e});
  node["building"~"dormitory|university|college|hall|department|office|residential|academic"](${s},${w},${n},${e});
  way["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|police|security|clinic"](${s},${w},${n},${e});
  way["building"~"dormitory|university|college|hall|department|office|academic"](${s},${w},${n},${e});
  relation["amenity"~"university|college|library|hospital"](${s},${w},${n},${e});
);
out center 60;`;

const getUrl = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);
console.log('Testing Overpass GET method...');

https.get(getUrl, { headers: { 'User-Agent': 'SafeCampus/1.0 test' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const ovData = JSON.parse(data);
      const allElements = ovData.elements || [];
      const namedLandmarks = allElements.filter(el => el.tags && el.tags.name);
      console.log('Total elements returned:', allElements.length);
      console.log('Named landmarks:', namedLandmarks.length);
      if (namedLandmarks.length > 0) {
        console.log('\nFirst 10 named landmarks:');
        namedLandmarks.slice(0, 10).forEach(l => {
          console.log(' -', l.tags.name, '| amenity:', l.tags.amenity || '-', '| building:', l.tags.building || '-', '| lat:', l.lat || l.center?.lat);
        });
      } else {
        console.log('No named landmarks found!');
        if (allElements.length > 0) {
          console.log('Sample elements (no name filter):', allElements.slice(0, 3).map(e => e.tags));
        }
      }
    } catch (err) {
      console.error('Parse error:', err.message);
      console.log('Raw response (first 500):', data.substring(0, 500));
    }
  });
}).on('error', e => console.error('GET Error:', e.message));
