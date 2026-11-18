// Color classes for every measure, tuned for the dark map. All three scales share one language:
// blue = less than usual, a dark warm gray = about usual, orange to red = more than usual.
// The "about usual" gray is the darkest class so it recedes, and the classes that matter stand out.
// Checked in OKLab (2026-11-18): every pair of neighboring classes is at least 15 apart for full
// color vision and at least 12 apart under simulated red-green color blindness (8 is the usual
// target); every fill is at least 3.3:1 against the map background; label text (ink) on each
// fill is at least 4.8:1.
const BLUE = '#4A8FE0';
const PALE_BLUE = '#A9CBF2';
const GRAY = '#6B675F';
const PEACH = '#F9D2A8';
const ORANGE = '#F5953F';
const RED = '#EE3D4A';
const DARK = '#14120E';
const WHITE = '#FFFFFF';

// Top-3 share (time of day + urban heat view): % of storms where a district was
// one of the 3 wettest districts. 30% is the even-share level (3 of 10 districts).
export const TOP3 = [
  { max: 25, name: 'Low', label: 'Under 25%', fill: BLUE, ink: DARK },
  { max: 30, name: 'Moderate', label: '25–30%', fill: GRAY, ink: WHITE },
  { max: 35.0001, name: 'High', label: '30–35%', fill: ORANGE, ink: DARK },
  { max: Infinity, name: 'Very high', label: 'Over 35%', fill: RED, ink: DARK },
];

// Relative rainfall concentration (storm direction view): 1.0 = regional average
// for the same storm. Diverging blue (lighter) to red (heavier).
export const RC = [
  { max: 0.85, name: 'Much lighter', label: 'More than 15% below', fill: BLUE, ink: DARK },
  { max: 0.95, name: 'Lighter', label: '5–15% below', fill: PALE_BLUE, ink: DARK },
  { max: 1.05, name: 'About average', label: 'Within 5%', fill: GRAY, ink: WHITE },
  { max: 1.15, name: 'Heavier', label: '5–15% above', fill: PEACH, ink: DARK },
  { max: 1.25, name: 'Much heavier', label: '15–25% above', fill: ORANGE, ink: DARK },
  { max: Infinity, name: 'Highest', label: 'More than 25% above', fill: RED, ink: DARK },
];

// Storm risk: expected 24-hour rain / NOAA Atlas 14 1-year 24-hour depth.
// 1.0 = a 1-year storm. Same diverging colors as RC, centered on the 1-year storm.
export const SEV = [
  { max: 0.25, name: 'Very low', label: 'Under 0.25×', fill: RC[0].fill, ink: RC[0].ink },
  { max: 0.5, name: 'Low', label: '0.25–0.5×', fill: RC[1].fill, ink: RC[1].ink },
  { max: 0.9, name: 'Moderate', label: '0.5–0.9×', fill: RC[2].fill, ink: RC[2].ink },
  { max: 1.1, name: 'Elevated', label: '0.9–1.1×', fill: RC[3].fill, ink: RC[3].ink },
  { max: 1.5, name: 'High', label: '1.1–1.5×', fill: RC[4].fill, ink: RC[4].ink },
  { max: Infinity, name: 'Very high', label: 'Over 1.5×', fill: RC[5].fill, ink: RC[5].ink },
];

export const classify = (scale, v) => scale.find((c) => v < c.max);

// MapLibre "step" expression matching RC, for coloring grid cells by a property.
export const rcStepExpression = (property) => [
  'step', ['get', property],
  RC[0].fill, RC[0].max, RC[1].fill, RC[1].max, RC[2].fill, RC[2].max,
  RC[3].fill, RC[3].max, RC[4].fill, RC[4].max, RC[5].fill,
];
