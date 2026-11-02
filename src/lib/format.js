export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Compass layout for the 3x3 picker; '' is the Austin center cell.
export const COMPASS = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
export const DIR_NAMES = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
export const CONDITIONS = [
  ['Day', 'Strong'], ['Day', 'Moderate'], ['Day', 'Weak'],
  ['Night', 'Strong'], ['Night', 'Moderate'], ['Night', 'Weak'],
];
export const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 1.32 -> "+32%", 0.84 -> "−16%", 1.0 -> "±0%"
export function pct(v) {
  const p = Math.round((v - 1) * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`;
}
export const share = (v) => `${v.toFixed(1)}%`;
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
