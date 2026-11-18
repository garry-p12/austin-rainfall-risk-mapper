import { RC, SEV, TOP3, classify } from './scales.js';
import { CONDITIONS, DIRECTIONS, DIR_NAMES, DISTRICTS, HOUR_BINS, MONTHS, aboutHours, austinDate, austinTime, capitalize, mph, pct, share, times } from './format.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const hourBins = (hours) => HOUR_BINS.map((_, i) => sum(hours.slice(i * 3, i * 3 + 3)));
const stormCount = (n) => `${n} storm${n === 1 ? '' : 's'}`;

// When storms from one direction reach the city (month and 3-hour window, Austin time).
// Bar heights share one scale across all directions so switching direction is a fair comparison.
export function buildCalendar(cal, dir) {
  const c = cal[dir];
  const dirName = DIR_NAMES[dir];
  const maxShare = (counts) => Math.max(...DIRECTIONS.map((d) => Math.max(...counts(cal[d])) / cal[d].n));
  const bars = (counts, names, max) => {
    const peak = counts.indexOf(Math.max(...counts));
    return counts.map((count, i) => {
      const p = c.n ? count / c.n : 0;
      return {
        key: names[i].key, tick: names[i].tick, count, share: p, height: p / max, peak: i === peak,
        label: `${Math.round(p * 100)}%`,
        tip: `${names[i].name}: ${stormCount(count)} (${Math.round(p * 100)}%)`,
      };
    });
  };
  const monthNames = MONTHS.map((m) => ({ key: m, tick: m.slice(0, 3), name: m }));
  const hourNames = HOUR_BINS.map((b) => ({ key: b.range, tick: b.tick, name: b.range }));
  const months = bars(c.months, monthNames, maxShare((x) => x.months));
  const hours = bars(hourBins(c.hours), hourNames, maxShare((x) => hourBins(x.hours)));
  const peakMonth = MONTHS[months.findIndex((b) => b.peak)];
  const peakHours = HOUR_BINS[hours.findIndex((b) => b.peak)].between;

  return {
    title: `When storms from the ${dirName} arrive`,
    summary: `Storms from the ${dirName} reach Austin most often in ${peakMonth} and between ${peakHours}. `
      + `A typical one moves at about ${mph(c.speed_kmh_median)} and stays over the city for ${aboutHours(c.hours_over_city_median)}.`,
    caption: `Share of the ${stormCount(c.n)} from the ${dirName}`,
    months,
    hours,
    note: 'Times are Austin local time. A storm arrives in the first hour it reaches the city. '
      + 'Typical means half of these storms were faster (or stayed longer) and half slower.',
  };
}

// Map units each view offers. The storm risk data comes per district only, so it has no watersheds or grid.
export const UNITS = {
  direction: [
    { value: 'city', label: 'City' }, { value: 'districts', label: 'Districts' },
    { value: 'watersheds', label: 'Watersheds' }, { value: 'grid', label: '1 km grid' },
  ],
  storm: [{ value: 'city', label: 'City' }, { value: 'districts', label: 'Districts' }],
  uhi: [],
};
// The unit actually shown: the chosen one if this view offers it (and its data exists), else districts.
const unitFor = (mode, unit, hasWatersheds) =>
  (UNITS[mode].some((u) => u.value === unit) && (unit !== 'watersheds' || hasWatersheds) ? unit : 'districts');

// Tooltip for one watershed on the map (props are the watershed's GeoJSON properties).
export const watershedTip = (props, dir) => `${props.name}: ${pct(props[`rc_${dir}`])} vs. regional average`;

// Tooltip for one ~1 km grid cell on the map (props are the cell's GeoJSON properties).
export const gridCellTip = (props, dir) =>
  `${pct(props[`rc_${dir}`])} vs. regional average (cell in District ${props.district})`;

// Storm risk view: risk for each district on each day of one upcoming storm, measured against history.
// Risk = heaviest 24-hour rain the weather model expects in the district (wettest grid cell)
// divided by the NOAA Atlas 14 1-year 24-hour depth, the rain Austin sees about once a year.
// Day N is assessed N days out; later assessments of the same day replace earlier ones.
const daysOut = (n) => `${n} day${n === 1 ? '' : 's'} out`;

export function buildStormRisk(st, s) {
  const days = st.days;
  const day = days.find((d) => d.day === s.day) ?? days[0];
  const i = days.indexOf(day);
  const valueAt = (district, k) => st.districts[district][k];
  const window = `${austinTime(day.start)} to ${austinTime(day.end)}`;
  const dayName = (d) => austinDate(d.end);

  const districts = {};
  for (const d of DISTRICTS) {
    const v = valueAt(d, i);
    districts[d] = { value: v, label: times(v), cls: classify(SEV, v) };
  }
  const ranked = [...DISTRICTS].sort((a, b) => districts[b].value - districts[a].value || a - b);
  const top = ranked[0];
  const low = ranked[ranked.length - 1];
  const sel = districts[s.sel];
  const name = (d) => `District ${d}`;
  const atLeast = DISTRICTS.filter((d) => districts[d].value >= 1).length;
  const selDays = days.map((d, k) => ({ d, v: valueAt(s.sel, k) }));
  const worst = selDays.reduce((a, b) => (b.v > a.v ? b : a));
  const assessed = austinTime(st.issue_time, true);
  const unit = unitFor('storm', s.unit, false);
  // Whole city = its highest-risk district, since risk is about the wettest spot.
  const cityValue = districts[top].value;
  const cityCls = classify(SEV, cityValue);

  return {
    isDir: false, isStorm: true, scale: SEV, districts, ranked, barMax: 2, unit, units: UNITS.storm,
    city: {
      value: cityValue, label: times(cityValue), cls: cityCls,
      sentence: `For ${window}, the whole city's risk is ${cityCls.name.toLowerCase()}: the wettest spot reaches `
        + `${times(cityValue)} a 1-year storm, in ${name(top)}. `
        + (atLeast === 0 ? 'No district reaches a 1-year storm.'
          : `${atLeast} of 10 districts ${atLeast === 1 ? 'reaches' : 'reach'} a 1-year storm or more.`),
    },
    title: `Storm risk: ${window}`,
    subtitle: 'How the heaviest 24-hour rain expected in each district compares with the 1-year storm from NOAA Atlas 14, the rain Austin sees about once a year.',
    insight: `Citywide, ${name(top)} has the highest risk (${districts[top].label}) and ${name(low)} the lowest (${districts[low].label}). `
      + (atLeast === 10 ? 'Every district reaches a 1-year storm.'
        : atLeast === 0 ? 'No district reaches a 1-year storm.'
          : `${atLeast} of 10 districts ${atLeast === 1 ? 'reaches' : 'reach'} a 1-year storm or more.`),
    howTo: [
      'Risk compares the heaviest 24-hour rain expected in a district with the 1-year storm from NOAA Atlas 14. 1.00× is as much rain as Austin sees about once a year.',
      'Risk is assessed up to 3 days out and gets better as the storm gets closer: 1 day out is more reliable than 3 days out.',
      'Each district shows its wettest grid cell (about 3 km), so parts of the district may get less.',
    ],
    storms: null,
    stormsNote: null,
    storm: {
      assessed: `Assessed ${assessed} (Austin time) with the ${st.model} weather model`,
      banner: `Example storm, assessed ${assessed} (Austin time). This example is not updated and is not an official warning.`,
      days: days.map((d) => ({ value: d.day, label: dayName(d), sub: daysOut(d.day) })),
    },
    calendar: null,
    selected: {
      district: s.sel, name: name(s.sel), ...sel,
      sentence: `For ${window}, the heaviest 24-hour rain expected in ${name(s.sel)} is ${sel.label} a 1-year storm `
        + `(${Math.round(sel.value * 100)}% of the rain Austin sees about once a year). `
        + `Its highest-risk day in this storm is ${dayName(worst.d)} (${times(worst.v)}).`,
      compareTitle: `${name(s.sel)}, day by day`,
      compare: selDays.map(({ d, v }) => ({ key: String(d.day), label: `${dayName(d)}, ${daysOut(d.day)}`, value: times(v), cls: classify(SEV, v), active: d === day })),
    },
    legend: {
      title: 'Rain expected compared with a 1-year storm',
      note: unit === 'city' ? 'Whole city = its highest-risk district.' : 'District value = wettest grid cell (about 3 km) inside it.',
    },
  };
}

// Everything the screen shows for the current choices, computed in one place.
// Pure function: (data, choices) -> view. Components only render what it returns.
export function buildView(data, s) {
  // No district selected (the default): build as usual, then drop the selected-district details.
  if (s.sel == null) return { ...buildView(data, { ...s, sel: DISTRICTS[0] }), selected: null };
  if (s.mode === 'storm' && data.storm) return buildStormRisk(data.storm, s);
  const isDir = s.mode === 'direction';
  const condKey = `${s.time}|${s.uhi}`;
  const scale = isDir ? RC : TOP3;
  const fmt = isDir ? pct : share;

  // Value of one district under one column (a direction or a condition).
  const valueAt = (district, col) =>
    isDir ? data.direction[col][district] : data.uhi.conditions[col].values[district];
  const current = isDir ? s.dir : condKey;

  const districts = {};
  for (const d of DISTRICTS) {
    const v = valueAt(d, current);
    districts[d] = { value: v, label: fmt(v), cls: classify(scale, v) };
  }
  const ranked = [...DISTRICTS].sort((a, b) => districts[b].value - districts[a].value || a - b);
  const top = ranked[0];
  const low = ranked[ranked.length - 1];
  const sel = districts[s.sel];
  const name = (d) => `District ${d}`;

  let title, subtitle, insight, sentence, compareTitle, compare, howTo, storms, stormsNote;
  if (isDir) {
    const dirName = DIR_NAMES[s.dir];
    const n = data.meta.storm_counts[s.dir];
    const above = DISTRICTS.filter((d) => districts[d].value > 1).length;
    const byDir = [...DIRECTIONS].sort((a, b) => valueAt(s.sel, b) - valueAt(s.sel, a));
    const p = Math.round((sel.value - 1) * 100);
    title = `How intense rain gets: storms from the ${dirName}`;
    subtitle = 'How much more (or less) intense the heaviest rain was than the regional average for the same storm.';
    insight = `${capitalize(dirName)} storms make up ${Math.round((n / data.meta.total_storms) * 100)}% of all storms (${n} of ${data.meta.total_storms.toLocaleString()}). `
      + `They hit ${name(top)} hardest (${districts[top].label}) and ${name(low)} least (${districts[low].label}). `
      + (above === 10 ? 'Every district is above the regional average.'
        : above === 0 ? 'Every district is below the regional average.'
          : `${above} of 10 districts ${above === 1 ? 'is' : 'are'} above the regional average.`);
    sentence = `For storms from the ${dirName}, the heaviest rain in ${name(s.sel)} was `
      + (p === 0 ? 'about as intense as' : `${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} intense than`)
      + ` the regional average for the same storm (${sel.value.toFixed(2)}×). Its worst direction is ${DIR_NAMES[byDir[0]]} (${pct(valueAt(s.sel, byDir[0]))}); its mildest is ${DIR_NAMES[byDir[7]]} (${pct(valueAt(s.sel, byDir[7]))}).`;
    compareTitle = `${name(s.sel)} by storm direction`;
    compare = DIRECTIONS.map((d) => ({ key: d, label: `From ${d}`, value: pct(valueAt(s.sel, d)), cls: classify(RC, valueAt(s.sel, d)), active: d === s.dir }));
    howTo = [
      'Each storm is compared with itself: a district at +20% got rain 20% more intense than the average across the Austin region during the same storm.',
      'Intensity is the heaviest 1 to 6 hour rainfall, measured against the 1-year storm from NOAA Atlas 14 (rain Austin sees about once a year).',
      'The panel on the right shows how the selected district does in every direction.',
    ];
    storms = n;
    stormsNote = `hit the city from this direction, out of ${data.meta.total_storms.toLocaleString()} storms (2000–2024)`;
  } else {
    const c = data.uhi.conditions[condKey];
    const veryHigh = DISTRICTS.filter((d) => districts[d].value > 35);
    const diff = sel.value - 30;
    title = `Where rain concentrates: ${s.time.toLowerCase()}time storms, ${s.uhi.toLowerCase()} urban heat`;
    subtitle = 'In each storm, the 3 districts with the most rain count as its "top 3".';
    insight = `${name(top)} was most often among the 3 hardest-hit districts (${districts[top].label}); ${name(low)} least often (${districts[low].label}). `
      + (veryHigh.length ? `Very high: ${veryHigh.map((d) => `D${d}`).join(', ')}.` : 'No district is very high under these conditions.');
    sentence = `In ${sel.label} of ${s.time.toLowerCase()}time storms with ${s.uhi.toLowerCase()} urban heat, ${name(s.sel)} was one of the 3 hardest-hit districts. `
      + `That is ${Math.abs(diff).toFixed(1)} points ${diff >= 0 ? 'above' : 'below'} the 30% you would expect if rain fell evenly.`;
    compareTitle = `${name(s.sel)} under all six conditions`;
    compare = CONDITIONS.map(([t, u]) => {
      const v = data.uhi.conditions[`${t}|${u}`].values[s.sel];
      return { key: `${t}|${u}`, label: `${t}, ${u.toLowerCase()} heat`, value: share(v), cls: classify(TOP3, v), active: t === s.time && u === s.uhi };
    });
    howTo = [
      'In every storm, the 3 districts that got the most rain count as its top 3.',
      'If rain fell evenly, each district would be top 3 in 30% of storms. Higher means the district gets hit hard more often.',
      'Urban heat island strength is how much warmer the city was than the countryside when the storm arrived.',
    ];
    storms = c.n;
    stormsNote = 'hit the city under these conditions (2000–2024, excluding 2014–2015)';
  }

  const unit = isDir ? unitFor('direction', s.unit, Boolean(data.watersheds)) : 'districts';
  let city = null;
  if (isDir) {
    const v = data.meta.city_average[s.dir];
    const p = Math.round((v - 1) * 100);
    city = {
      value: v, label: pct(v), cls: classify(RC, v),
      sentence: `Across the whole city, storms from the ${DIR_NAMES[s.dir]} brought rain `
        + (p === 0 ? 'about as intense as' : `${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} intense than`)
        + ` the regional average for the same storm. Districts range from ${districts[low].label} (${name(low)}) to ${districts[top].label} (${name(top)}).`,
    };
  }
  const unitNote = {
    city: 'Whole city = average of the ~1 km grid cells inside the city.',
    districts: 'District value = average of the ~1 km grid cells inside it.',
    watersheds: 'Watershed value = average of the ~1 km grid cells it covers inside the city. Watershed boundaries: City of Austin Watershed Protection Department.',
    grid: 'Each square is one ~1 km grid cell inside the city.',
  };

  return {
    isDir, isStorm: false, scale, districts, ranked, barMax: isDir ? 1.4 : 45, unit, units: isDir ? UNITS.direction.filter((u) => u.value !== 'watersheds' || data.watersheds) : UNITS.uhi, city, title, subtitle, insight, howTo, storms, stormsNote,
    calendar: isDir ? buildCalendar(data.calendar, s.dir) : null,
    selected: { district: s.sel, name: name(s.sel), ...sel, sentence, compareTitle, compare },
    legend: {
      title: isDir ? 'Compared with the regional average' : 'Share of storms where the district was top 3',
      note: isDir ? unitNote[unit] : 'If rain fell evenly, every district would be top 3 in 30% of storms.',
    },
  };
}
