// Color classes for both measures. Colors follow NOAA URRD's dark theme.

// Top-3 share (time of day + urban heat view): % of storms where a district was
// one of the 3 wettest districts. 30% is the even-share level (3 of 10 districts).
export const TOP3 = [
  { max: 25, name: 'Low', label: 'Under 25%', fill: '#81BD92', ink: '#121212' },
  { max: 30, name: 'Moderate', label: '25–30%', fill: '#DED413', ink: '#121212' },
  { max: 35.0001, name: 'High', label: '30–35%', fill: '#E5A01C', ink: '#121212' },
  { max: Infinity, name: 'Very high', label: 'Over 35%', fill: '#D61C21', ink: '#FFFFFF' },
];

// Relative rainfall concentration (storm direction view): 1.0 = regional average
// for the same storm. Diverging blue (lighter) to red (heavier).
export const RC = [
  { max: 0.85, name: 'Much lighter', label: 'More than 15% below', fill: '#2B6CB0', ink: '#FFFFFF' },
  { max: 0.95, name: 'Lighter', label: '5–15% below', fill: '#7FB3E0', ink: '#121212' },
  { max: 1.05, name: 'About average', label: 'Within 5%', fill: '#CBD5E0', ink: '#121212' },
  { max: 1.15, name: 'Heavier', label: '5–15% above', fill: '#F6AD7B', ink: '#121212' },
  { max: 1.25, name: 'Much heavier', label: '15–25% above', fill: '#E5653A', ink: '#121212' },
  { max: Infinity, name: 'Highest', label: 'More than 25% above', fill: '#C21F1F', ink: '#FFFFFF' },
];

export const classify = (scale, v) => scale.find((c) => v < c.max);

// MapLibre "step" expression matching RC, for coloring grid cells by a property.
export const rcStepExpression = (property) => [
  'step', ['get', property],
  RC[0].fill, RC[0].max, RC[1].fill, RC[1].max, RC[2].fill, RC[2].max,
  RC[3].fill, RC[3].max, RC[4].fill, RC[4].max, RC[5].fill,
];
