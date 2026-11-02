import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findDistrict, inGeometry } from './geo.js';

const square = (x0, y0, size) => [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size], [x0, y0]];

describe('inGeometry', () => {
  const donut = { type: 'Polygon', coordinates: [square(0, 0, 10), square(4, 4, 2)] };

  it('finds points inside a polygon and outside it', () => {
    expect(inGeometry([1, 1], donut)).toBe(true);
    expect(inGeometry([11, 1], donut)).toBe(false);
    expect(inGeometry([-1, 5], donut)).toBe(false);
  });

  it('treats a hole as outside', () => {
    expect(inGeometry([5, 5], donut)).toBe(false);
  });

  it('checks every part of a multipolygon', () => {
    const two = { type: 'MultiPolygon', coordinates: [[square(0, 0, 1)], [square(5, 5, 1)]] };
    expect(inGeometry([0.5, 0.5], two)).toBe(true);
    expect(inGeometry([5.5, 5.5], two)).toBe(true);
    expect(inGeometry([3, 3], two)).toBe(false);
  });

  it('ignores other geometry types', () => {
    expect(inGeometry([0, 0], { type: 'Point', coordinates: [0, 0] })).toBe(false);
  });
});

describe('findDistrict on the shipped boundaries', () => {
  const load = (file) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const districts = load('districts.geojson');
  const labels = load('district_labels.geojson');

  it('puts every district label point inside its own district', () => {
    for (const f of labels.features) {
      expect(findDistrict(districts, f.geometry.coordinates)).toBe(f.properties.district);
    }
  });

  it('returns null outside the city', () => {
    expect(findDistrict(districts, [-96.8, 32.78])).toBeNull(); // Dallas
    expect(findDistrict(districts, [0, 0])).toBeNull();
  });
});
