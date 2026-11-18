import { CONDITIONS, DIRECTIONS, DISTRICTS } from './format.js';

// The current choices live in the page address so a view can be shared as a link, e.g.
//   ?view=direction&dir=E&unit=grid&district=5
//   ?view=uhi&time=night&heat=strong&district=10
//   ?view=storm&day=2&unit=city&district=8
// Only the parameters that matter for the chosen view are written. Anything missing or
// not recognized falls back to the defaults, so an old or mistyped link still opens.

const TIMES = [...new Set(CONDITIONS.map(([t]) => t))]; // Day, Night
const HEATS = [...new Set(CONDITIONS.map(([, u]) => u))]; // Strong, Moderate, Weak
const UNITS = ['city', 'districts', 'watersheds', 'grid'];
const MODES = { direction: 'direction', uhi: 'uhi', storm: 'storm' };

// Case-insensitive match against a list of allowed values; returns the canonical spelling.
const pick = (value, allowed) => allowed.find((a) => String(a).toLowerCase() === String(value ?? '').toLowerCase());

export function choicesFromSearch(search, defaults) {
  const p = new URLSearchParams(search);
  const district = Number(p.get('district'));
  const day = Number(p.get('day'));
  return {
    mode: MODES[p.get('view')] ?? defaults.mode,
    dir: pick(p.get('dir'), DIRECTIONS) ?? defaults.dir,
    unit: pick(p.get('unit'), UNITS) ?? defaults.unit,
    time: pick(p.get('time'), TIMES) ?? defaults.time,
    uhi: pick(p.get('heat'), HEATS) ?? defaults.uhi,
    sel: DISTRICTS.includes(district) ? district : defaults.sel,
    // Which days exist depends on the storm risk file; buildStormRisk falls back to day 1.
    day: Number.isInteger(day) && day >= 1 ? day : defaults.day,
  };
}

export function searchFromChoices(c) {
  const p = c.mode === 'direction' ? { view: 'direction', dir: c.dir, unit: c.unit }
    : c.mode === 'storm' ? { view: 'storm', day: c.day, unit: c.unit }
      : { view: 'uhi', time: c.time.toLowerCase(), heat: c.uhi.toLowerCase() };
  // A district is in the link only when one is selected, so the link opens its details.
  if (c.sel != null) p.district = c.sel;
  return `?${new URLSearchParams(p)}`;
}
