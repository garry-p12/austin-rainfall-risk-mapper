import { RC, TOP3, classify } from './scales.js';
import { CONDITIONS, DIRECTIONS, DIR_NAMES, DISTRICTS, capitalize, pct, share } from './format.js';

// Everything the screen shows for the current choices, computed in one place.
// Pure function: (data, choices) -> view. Components only render what it returns.
export function buildView(data, s) {
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
      'Use the table to see which direction is worst for each district. Select any cell to show it on the map.',
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

  // Comparison table: rows = districts, columns = directions or conditions.
  const columns = isDir
    ? DIRECTIONS.map((d) => ({ key: d, head: d, sub: `${data.meta.storm_counts[d]} storms`, active: d === s.dir, set: { dir: d } }))
    : CONDITIONS.map(([t, u]) => ({ key: `${t}|${u}`, head: t, sub: `${u} heat`, active: t === s.time && u === s.uhi, set: { time: t, uhi: u } }));
  const rows = DISTRICTS.map((d) => ({
    district: d,
    cells: columns.map((col) => {
      const v = valueAt(d, col.key);
      return { key: col.key, value: v, label: fmt(v), cls: classify(scale, v), set: col.set };
    }),
  }));
  const footer = isDir ? DIRECTIONS.map((d) => ({ key: d, label: pct(data.meta.city_average[d]) })) : null;

  return {
    isDir, scale, districts, ranked, title, subtitle, insight, howTo, storms, stormsNote,
    selected: { district: s.sel, name: name(s.sel), ...sel, sentence, compareTitle, compare },
    table: {
      title: isDir ? 'Every district, every direction' : 'Every district, every condition',
      note: isDir ? 'Rain intensity compared with the regional average. Select a cell to show it on the map.'
        : 'Share of storms where the district was top 3. Select a cell to show it on the map.',
      columns, rows, footer,
    },
    legend: {
      title: isDir ? 'Compared with the regional average' : 'Share of storms where the district was top 3',
      note: isDir
        ? (s.unit === 'grid' ? 'Each square is one ~1 km grid cell inside the city.' : 'District value = average of the ~1 km grid cells inside it.')
        : 'If rain fell evenly, every district would be top 3 in 30% of storms.',
    },
  };
}
