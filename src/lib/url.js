import { CONDITIONS, DIRECTIONS, DISTRICTS } from './format.js';

// The current choices live in the page address so a view can be shared as a link, e.g.
//   ?view=direction&dir=E&unit=grid&district=5
//   ?view=uhi&time=night&heat=strong&district=10
// Only the parameters that matter for the chosen view are written. Anything missing or
// not recognized falls back to the defaults, so an old or mistyped link still opens.

const TIMES = [...new Set(CONDITIONS.map(([t]) => t))]; // Day, Night
const HEATS = [...new Set(CONDITIONS.map(([, u]) => u))]; // Strong, Moderate, Weak
const UNITS = ['districts', 'grid'];
const MODES = { direction: 'direction', uhi: 'uhi' };

// Case-insensitive match against a list of allowed values; returns the canonical spelling.
const pick = (value, allowed) => allowed.find((a) => String(a).toLowerCase() === String(value ?? '').toLowerCase());

export function choicesFromSearch(search, defaults) {
  const p = new URLSearchParams(search);
  const district = Number(p.get('district'));
  return {
    mode: MODES[p.get('view')] ?? defaults.mode,
    dir: pick(p.get('dir'), DIRECTIONS) ?? defaults.dir,
    unit: pick(p.get('unit'), UNITS) ?? defaults.unit,
    time: pick(p.get('time'), TIMES) ?? defaults.time,
    uhi: pick(p.get('heat'), HEATS) ?? defaults.uhi,
    sel: DISTRICTS.includes(district) ? district : defaults.sel,
  };
}

export function searchFromChoices(c) {
  const p = c.mode === 'direction'
    ? { view: 'direction', dir: c.dir, unit: c.unit, district: c.sel }
    : { view: 'uhi', time: c.time.toLowerCase(), heat: c.uhi.toLowerCase(), district: c.sel };
  return `?${new URLSearchParams(p)}`;
}
