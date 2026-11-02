// Which council district a point falls in, computed in the browser so a visitor's location
// never leaves their device. Works on the GeoJSON in public/data/districts.geojson.

// Ray casting: count how many ring edges a ray from the point crosses.
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A polygon is an outer ring followed by holes.
const inPolygon = (point, [outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h));

export function inGeometry(point, geometry) {
  if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((p) => inPolygon(point, p));
  return false;
}

// point is [longitude, latitude]. Returns the district number, or null outside every district.
export function findDistrict(districts, point) {
  const hit = districts.features.find((f) => inGeometry(point, f.geometry));
  return hit ? hit.properties.district : null;
}
