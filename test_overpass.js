const axios = require('axios');

async function test() {
  try {
    const bb = ["37.4189865", "37.4433992", "-122.1860658", "-122.1520382"];
    const [s, n, w, e] = bb.map(Number);
    if (s && n && w && e) {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|bank|cafe|police|security|clinic"](${s},${w},${n},${e});
          node["building"~"dormitory|university|college|hall|department|office|residential|academic"](${s},${w},${n},${e});
          way["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|police|security|clinic"](${s},${w},${n},${e});
          way["building"~"dormitory|university|college|hall|department|office|academic"](${s},${w},${n},${e});
          relation["amenity"~"university|college|library|hospital"](${s},${w},${n},${e});
        );
        out center 60;
      `;
      const { data: ovData } = await axios.post(
        "https://overpass-api.de/api/interpreter",
        overpassQuery,
        { headers: { "Content-Type": "text/plain" } }
      );
      
      const landmarks = (ovData.elements || [])
        .filter((el) => el.tags?.name)
        .slice(0, 40)
        .map((el) => ({
          label: el.tags.name,
        }));
      console.log('Landmarks found:', landmarks.length);
      console.log(landmarks.slice(0, 5));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
