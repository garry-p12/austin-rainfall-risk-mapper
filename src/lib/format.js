export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Compass layout for the 3x3 picker; '' is the Austin center cell.
export const COMPASS = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
export const DIR_NAMES = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
export const CONDITIONS = [
  ['Day', 'Strong'], ['Day', 'Moderate'], ['Day', 'Weak'],
  ['Night', 'Strong'], ['Night', 'Moderate'], ['Night', 'Weak'],
];
export const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Arrival hours grouped into 3-hour windows (Austin local time). `tick` labels the bar,
// `range` names the window, `between` fits "most often between ___".
export const HOUR_BINS = [
  { tick: '12 AM', range: '12–3 AM', between: 'midnight and 3 AM' },
  { tick: '3 AM', range: '3–6 AM', between: '3 and 6 AM' },
  { tick: '6 AM', range: '6–9 AM', between: '6 and 9 AM' },
  { tick: '9 AM', range: '9 AM–12 PM', between: '9 AM and noon' },
  { tick: 'Noon', range: '12–3 PM', between: 'noon and 3 PM' },
  { tick: '3 PM', range: '3–6 PM', between: '3 and 6 PM' },
  { tick: '6 PM', range: '6–9 PM', between: '6 and 9 PM' },
  { tick: '9 PM', range: '9 PM–12 AM', between: '9 PM and midnight' },
];

// 1.32 -> "+32%", 0.84 -> "−16%", 1.0 -> "±0%"
export function pct(v) {
  const p = Math.round((v - 1) * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`;
}
export const share = (v) => `${v.toFixed(1)}%`;
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// 24.3 km/h -> "15 mph"
export const mph = (kmh) => `${Math.round(kmh * 0.621371)} mph`;
// 2.5 -> "about 2.5 hours", 1 -> "about 1 hour"
export const aboutHours = (h) => `about ${h} hour${h === 1 ? '' : 's'}`;
