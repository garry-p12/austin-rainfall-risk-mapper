import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView } from './view.js';
import { RC, TOP3, classify } from './scales.js';
import { CONDITIONS, DIRECTIONS, DISTRICTS, aboutHours, mph, pct } from './format.js';

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
// Storm calendar entry: 12 month counts and 24 hourly counts (Austin time) that each sum to n.
const cal = (n, months, hours, speed, overCity) =>
  ({ n, months, hours, speed_kmh_median: speed, hours_over_city_median: overCity });
const ones = (k, len = 24) => Array.from({ length: len }, (_, i) => (i < k ? 1 : 0));
// N and the other quiet directions: 20 storms, 2 a month Jan-Aug then 1, one per hour 0-19.
const QUIET = cal(20, [2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1], ones(20), 40.2, 1);

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
  // S: 50 storms peaking in July (40%) and 3-6 PM (29 storms). SW: 30 storms, busiest at midnight-3 AM.
  calendar: {
    timezone: 'America/Chicago',
    all: QUIET,
    N: QUIET, NE: QUIET, E: QUIET, SE: QUIET, W: QUIET, NW: QUIET,
    S: cal(50, [2, 2, 2, 2, 4, 6, 20, 4, 4, 2, 1, 1], ones(24).map((v, h) => v + ({ 15: 10, 16: 10, 17: 6 }[h] || 0)), 24.3, 2.5),
    SW: cal(30, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0], ones(24).map((v, h) => v + (h === 0 ? 6 : 0)), 40.2, 3),
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

describe('mph and aboutHours', () => {
  it('converts km/h to whole mph', () => {
    expect(mph(24.3)).toBe('15 mph');
    expect(mph(40.2)).toBe('25 mph');
  });

  it('says "hour" for exactly one hour', () => {
    expect(aboutHours(1)).toBe('about 1 hour');
    expect(aboutHours(2.5)).toBe('about 2.5 hours');
  });
});

describe('buildView: storm calendar', () => {
  const calendar = (patch) => buildView(FIXTURE, choices(patch)).calendar;

  it('only appears in the storm direction view', () => {
    expect(buildView(FIXTURE, uhiChoices()).calendar).toBeNull();
    expect(calendar({ dir: 'S' })).not.toBeNull();
  });

  it('summarizes peak month, peak 3-hour window, speed and time over the city', () => {
    const c = calendar({ dir: 'S' });
    expect(c.title).toBe('When storms from the south arrive');
    expect(c.summary).toBe(
      'Storms from the south reach Austin most often in July and between 3 and 6 PM. '
      + 'A typical one moves at about 15 mph and stays over the city for about 2.5 hours.',
    );
    expect(c.caption).toBe('Share of the 50 storms from the south');
  });

  it('has one bar per month with counts, shares and tooltips', () => {
    const { months } = calendar({ dir: 'S' });
    expect(months).toHaveLength(12);
    expect(months.map((b) => b.tick)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    expect(months[6]).toMatchObject({ key: 'July', count: 20, share: 0.4, label: '40%', tip: 'July: 20 storms (40%)', height: 1, peak: true });
    expect(months.filter((b) => b.peak)).toHaveLength(1);
  });

  it('groups arrival hours into eight 3-hour windows', () => {
    const { hours } = calendar({ dir: 'S' });
    expect(hours.map((b) => b.tick)).toEqual(['12 AM', '3 AM', '6 AM', '9 AM', 'Noon', '3 PM', '6 PM', '9 PM']);
    expect(hours.map((b) => b.count)).toEqual([3, 3, 3, 3, 3, 29, 3, 3]);
    expect(hours[5]).toMatchObject({ key: '3–6 PM', tip: '3–6 PM: 29 storms (58%)', height: 1, peak: true });
  });

  it('uses one bar scale for every direction so switching direction compares fairly', () => {
    // July is 40% of S storms (the tallest month anywhere) and 10% of N storms.
    expect(calendar({ dir: 'N' }).months[6].height).toBeCloseTo(0.25);
    // 3-6 PM: 58% of S storms (tallest window anywhere) vs 3 of 20 N storms (15%).
    expect(calendar({ dir: 'N' }).hours[5].height).toBeCloseTo(0.15 / 0.58);
  });

  it('breaks ties by the earliest month and window, and handles singular wording', () => {
    const c = calendar({ dir: 'N' });
    expect(c.summary).toBe(
      'Storms from the north reach Austin most often in January and between midnight and 3 AM. '
      + 'A typical one moves at about 25 mph and stays over the city for about 1 hour.',
    );
    expect(c.months[8].tip).toBe('September: 1 storm (5%)');
  });

  it('follows the chosen direction', () => {
    const c = calendar({ dir: 'SW' });
    expect(c.summary).toMatch(/^Storms from the southwest reach Austin most often in January and between midnight and 3 AM\./);
    expect(c.hours[0].count).toBe(9);
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
  const data = {
    meta: load('meta.json'), direction: load('direction_districts.json'), uhi: load('uhi_top3.json'),
    calendar: load('direction_calendar.json'),
  };

  const allChoices = [
    ...DIRECTIONS.flatMap((dir) => DISTRICTS.flatMap((sel) => ['districts', 'grid'].map((unit) => choices({ dir, sel, unit })))),
    ...CONDITIONS.flatMap(([time, uhi]) => DISTRICTS.map((sel) => uhiChoices({ time, uhi, sel }))),
  ];

  const strings = (o) => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

  it('has storm counts that add up to the total', () => {
    const sum = Object.values(data.meta.storm_counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(data.meta.total_storms);
  });

  it('has a storm calendar whose counts match the storm counts', () => {
    expect(data.calendar.all.n).toBe(data.meta.total_storms);
    for (const d of DIRECTIONS) {
      const c = data.calendar[d];
      expect(c.n).toBe(data.meta.storm_counts[d]);
      expect(c.months.reduce((a, b) => a + b, 0)).toBe(c.n);
      expect(c.hours.reduce((a, b) => a + b, 0)).toBe(c.n);
    }
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
