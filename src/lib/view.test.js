import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView } from './view.js';
import { RC, TOP3, classify } from './scales.js';
import { CONDITIONS, DIRECTIONS, DISTRICTS, pct } from './format.js';

// Same value for every district, with optional overrides: fill(1.0, { 5: 1.4 }).
const fill = (v, overrides = {}) => ({ ...Object.fromEntries(DISTRICTS.map((d) => [d, v])), ...overrides });

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
};

// Small hand-made data set. Values are picked so every expected answer is easy to check by eye:
// S: all districts above average, D5 highest, D6 lowest.
// N: all below average, D4 lowest, the rest tied (ties rank by district number).
// E: exactly 2 districts above average. NE: rounding edge cases around 1.0.
const FIXTURE = deepFreeze({
  meta: {
    storm_counts: { N: 20, NE: 20, E: 20, SE: 20, S: 50, SW: 30, W: 20, NW: 20 },
    total_storms: 200,
    city_average: { N: 0.9, NE: 1, E: 1, SE: 1, S: 1.16, SW: 1, W: 1, NW: 1 },
  },
  direction: {
    N: fill(0.9, { 4: 0.8 }),
    NE: fill(1.0, { 2: 1.004, 3: 0.996 }),
    E: fill(0.95, { 1: 1.2, 3: 1.1 }),
    SE: fill(1.0),
    S: { 1: 1.1, 2: 1.3, 3: 1.2, 4: 1.06, 5: 1.4, 6: 1.02, 7: 1.16, 8: 1.26, 9: 1.08, 10: 1.12 },
    SW: fill(1.0),
    W: fill(1.0),
    NW: fill(1.0),
  },
  uhi: {
    conditions: {
      'Day|Strong': { n: 100, values: { 1: 30, 2: 28, 3: 26, 4: 24, 5: 35, 6: 37.2, 7: 32, 8: 31, 9: 19, 10: 38 } },
      'Day|Moderate': { n: 101, values: fill(30) },
      'Day|Weak': { n: 102, values: fill(30) },
      'Night|Strong': { n: 103, values: fill(30) },
      'Night|Moderate': { n: 104, values: fill(30) },
      'Night|Weak': { n: 105, values: fill(30) },
    },
  },
});

const choices = (patch = {}) => ({ mode: 'direction', dir: 'S', time: 'Day', uhi: 'Strong', sel: 5, unit: 'districts', ...patch });
const uhiChoices = (patch = {}) => choices({ mode: 'uhi', ...patch });

describe('pct', () => {
  it('formats relative concentration as a signed percent', () => {
    expect(pct(1.32)).toBe('+32%');
    expect(pct(0.84)).toBe('−16%');
    expect(pct(1)).toBe('±0%');
  });

  it('shows values that round to zero as ±0%, including just below 1', () => {
    expect(pct(1.004)).toBe('±0%');
    expect(pct(0.996)).toBe('±0%');
  });
});

describe('classify', () => {
  it('puts boundary values in the higher class', () => {
    expect(classify(RC, 0.85).name).toBe('Lighter');
    expect(classify(RC, 0.95).name).toBe('About average');
    expect(classify(RC, 1.05).name).toBe('Heavier');
    expect(classify(RC, 1.25).name).toBe('Highest');
  });

  it('treats exactly 35% top-3 share as High, not Very high', () => {
    expect(classify(TOP3, 25).name).toBe('Moderate');
    expect(classify(TOP3, 30).name).toBe('High');
    expect(classify(TOP3, 35).name).toBe('High');
    expect(classify(TOP3, 35.1).name).toBe('Very high');
  });
});

describe('buildView: storm direction', () => {
  it('labels and classifies every district for the chosen direction', () => {
    const v = buildView(FIXTURE, choices());
    expect(v.isDir).toBe(true);
    expect(v.scale).toBe(RC);
    expect(v.districts[5]).toMatchObject({ value: 1.4, label: '+40%' });
    expect(v.districts[5].cls.name).toBe('Highest');
    expect(v.districts[6].cls.name).toBe('About average');
    expect(v.districts[7].cls.name).toBe('Much heavier');
    expect(v.districts[4].cls.name).toBe('Heavier');
  });

  it('ranks districts from highest to lowest, breaking ties by district number', () => {
    expect(buildView(FIXTURE, choices()).ranked).toEqual([5, 2, 8, 3, 7, 10, 1, 9, 4, 6]);
    expect(buildView(FIXTURE, choices({ dir: 'N' })).ranked).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 4]);
  });

  it('writes the headline and insight', () => {
    const v = buildView(FIXTURE, choices());
    expect(v.title).toBe('How intense rain gets: storms from the south');
    expect(v.insight).toBe(
      'South storms make up 25% of all storms (50 of 200). '
      + 'They hit District 5 hardest (+40%) and District 6 least (+2%). '
      + 'Every district is above the regional average.',
    );
  });

  it('says when every district is below average', () => {
    expect(buildView(FIXTURE, choices({ dir: 'N' })).insight).toBe(
      'North storms make up 10% of all storms (20 of 200). '
      + 'They hit District 1 hardest (−10%) and District 4 least (−20%). '
      + 'Every district is below the regional average.',
    );
  });

  it('counts districts above average when the picture is mixed', () => {
    expect(buildView(FIXTURE, choices({ dir: 'E' })).insight)
      .toMatch(/ 2 of 10 districts are above the regional average\.$/);
  });

  it('uses "is" when exactly one district is above average', () => {
    expect(buildView(FIXTURE, choices({ dir: 'NE' })).insight)
      .toMatch(/ 1 of 10 districts is above the regional average\.$/);
  });

  it('describes the selected district, including its worst and mildest direction', () => {
    expect(buildView(FIXTURE, choices()).selected).toMatchObject({
      district: 5,
      name: 'District 5',
      label: '+40%',
      sentence: 'For storms from the south, the heaviest rain in District 5 was 40% more intense than the regional '
        + 'average for the same storm (1.40×). Its worst direction is south (+40%); its mildest is north (−10%).',
      compareTitle: 'District 5 by storm direction',
    });
  });

  it('says "less intense" for districts below average', () => {
    expect(buildView(FIXTURE, choices({ dir: 'N', sel: 4 })).selected.sentence).toBe(
      'For storms from the north, the heaviest rain in District 4 was 20% less intense than the regional '
      + 'average for the same storm (0.80×). Its worst direction is south (+6%); its mildest is north (−20%).',
    );
  });

  it('says "about as intense as" when the difference rounds to 0%', () => {
    const v = buildView(FIXTURE, choices({ dir: 'NE', sel: 2 }));
    expect(v.selected.sentence).toMatch(/^For storms from the northeast, the heaviest rain in District 2 was about as intense as the regional average for the same storm \(1\.00×\)\./);
    expect(v.districts[3].label).toBe('±0%');
  });

  it('compares the selected district across all 8 directions', () => {
    const { compare } = buildView(FIXTURE, choices()).selected;
    expect(compare.map((c) => c.key)).toEqual(DIRECTIONS);
    expect(compare.filter((c) => c.active).map((c) => c.key)).toEqual(['S']);
    expect(compare.find((c) => c.key === 'N')).toMatchObject({ label: 'From N', value: '−10%' });
  });

  it('builds the comparison table with storm counts and the city average footer', () => {
    const { table } = buildView(FIXTURE, choices());
    expect(table.title).toBe('Every district, every direction');
    expect(table.columns).toHaveLength(8);
    expect(table.columns.find((c) => c.key === 'S')).toMatchObject({ head: 'S', sub: '50 storms', active: true, set: { dir: 'S' } });
    expect(table.columns.filter((c) => c.active)).toHaveLength(1);
    expect(table.rows.map((r) => r.district)).toEqual(DISTRICTS);
    expect(table.rows[4].cells.find((c) => c.key === 'S')).toMatchObject({ value: 1.4, label: '+40%', set: { dir: 'S' } });
    expect(table.footer.find((f) => f.key === 'S').label).toBe('+16%');
  });

  it('reports the storm count for the chosen direction', () => {
    const v = buildView(FIXTURE, choices());
    expect(v.storms).toBe(50);
    expect(v.stormsNote).toBe('hit the city from this direction, out of 200 storms (2000–2024)');
  });

  it('explains district vs grid values in the legend', () => {
    expect(buildView(FIXTURE, choices({ unit: 'districts' })).legend.note).toMatch(/^District value = average/);
    expect(buildView(FIXTURE, choices({ unit: 'grid' })).legend.note).toMatch(/^Each square is one ~1 km grid cell/);
  });
});

describe('buildView: time of day and urban heat', () => {
  it('uses the top-3 share scale and formats values as percents', () => {
    const v = buildView(FIXTURE, uhiChoices());
    expect(v.isDir).toBe(false);
    expect(v.scale).toBe(TOP3);
    expect(v.districts[6]).toMatchObject({ value: 37.2, label: '37.2%' });
    expect(v.districts[6].cls.name).toBe('Very high');
    expect(v.districts[5].cls.name).toBe('High');
  });

  it('writes the headline and lists very high districts (over 35%)', () => {
    const v = buildView(FIXTURE, uhiChoices());
    expect(v.title).toBe('Where rain concentrates: daytime storms, strong urban heat');
    expect(v.insight).toBe(
      'District 10 was most often among the 3 hardest-hit districts (38.0%); District 9 least often (19.0%). '
      + 'Very high: D6, D10.',
    );
  });

  it('says when no district is very high', () => {
    const v = buildView(FIXTURE, uhiChoices({ time: 'Night', uhi: 'Weak' }));
    expect(v.title).toBe('Where rain concentrates: nighttime storms, weak urban heat');
    expect(v.insight).toMatch(/No district is very high under these conditions\.$/);
  });

  it('compares the selected district with the 30% even share', () => {
    expect(buildView(FIXTURE, uhiChoices({ sel: 9 })).selected.sentence).toBe(
      'In 19.0% of daytime storms with strong urban heat, District 9 was one of the 3 hardest-hit districts. '
      + 'That is 11.0 points below the 30% you would expect if rain fell evenly.',
    );
    expect(buildView(FIXTURE, uhiChoices({ sel: 1 })).selected.sentence)
      .toMatch(/That is 0\.0 points above the 30%/);
  });

  it('compares the selected district across all six conditions', () => {
    const { compare, compareTitle } = buildView(FIXTURE, uhiChoices({ sel: 6 })).selected;
    expect(compareTitle).toBe('District 6 under all six conditions');
    expect(compare.map((c) => c.key)).toEqual(CONDITIONS.map(([t, u]) => `${t}|${u}`));
    expect(compare[0]).toMatchObject({ label: 'Day, strong heat', value: '37.2%', active: true });
    expect(compare.filter((c) => c.active)).toHaveLength(1);
  });

  it('builds a six-column table with no footer', () => {
    const { table } = buildView(FIXTURE, uhiChoices());
    expect(table.title).toBe('Every district, every condition');
    expect(table.columns).toHaveLength(6);
    expect(table.columns[0]).toMatchObject({ head: 'Day', sub: 'Strong heat', active: true, set: { time: 'Day', uhi: 'Strong' } });
    expect(table.footer).toBeNull();
  });

  it('reports the storm count for the chosen condition', () => {
    const v = buildView(FIXTURE, uhiChoices({ time: 'Night', uhi: 'Moderate' }));
    expect(v.storms).toBe(104);
    expect(v.stormsNote).toMatch(/excluding 2014–2015/);
  });
});

describe('buildView: purity', () => {
  it('does not modify its input and returns the same view for the same choices', () => {
    // FIXTURE is deep-frozen, so any write to it would throw in this ES module.
    const a = buildView(FIXTURE, choices());
    const b = buildView(FIXTURE, choices());
    expect(a).toEqual(b);
  });
});

// Every combination of choices on the data the app actually ships.
describe('buildView: shipped data in public/data', () => {
  const load = (file) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const data = { meta: load('meta.json'), direction: load('direction_districts.json'), uhi: load('uhi_top3.json') };

  const allChoices = [
    ...DIRECTIONS.flatMap((dir) => DISTRICTS.flatMap((sel) => ['districts', 'grid'].map((unit) => choices({ dir, sel, unit })))),
    ...CONDITIONS.flatMap(([time, uhi]) => DISTRICTS.map((sel) => uhiChoices({ time, uhi, sel }))),
  ];

  const strings = (o) => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

  it('has storm counts that add up to the total', () => {
    const sum = Object.values(data.meta.storm_counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(data.meta.total_storms);
  });

  it('has top-3 shares that add up to about 300% per condition (3 of 10 districts per storm)', () => {
    for (const c of Object.values(data.uhi.conditions)) {
      const sum = Object.values(c.values).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(299);
      expect(sum).toBeLessThan(301);
    }
  });

  it.each(allChoices.map((c) => [`${c.mode} ${c.mode === 'direction' ? `${c.dir} ${c.unit}` : `${c.time}|${c.uhi}`} D${c.sel}`, c]))(
    'builds clean copy for %s',
    (_, c) => {
      const text = strings(buildView(data, c));
      expect(text.length).toBeGreaterThan(0);
      for (const t of text) {
        expect(t).not.toMatch(/NaN|undefined|Infinity/);
        expect(t).not.toContain('—'); // Project copy rule: no em dashes.
      }
    },
  );
});
