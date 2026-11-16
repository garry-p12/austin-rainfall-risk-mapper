import { useEffect, useState } from 'react';

const FILES = {
  meta: 'meta.json',
  districts: 'districts.geojson',
  labels: 'district_labels.geojson',
  direction: 'direction_districts.json',
  grid: 'direction_grid.geojson',
  calendar: 'direction_calendar.json',
  uhi: 'uhi_top3.json',
};
// Files the app can run without. With no storm risk file, the storm risk view is hidden.
const OPTIONAL = { storm: 'storm_risk.json' };

// Load every data file once. Files live in public/data and are produced by
// scripts/build_data.py, so the app never needs to know about the raw research outputs.
export function useData() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const required = Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`${file} could not be loaded (HTTP ${res.status}). Run "npm run data" to build it.`);
      return [key, await res.json()];
    });
    const optional = Object.entries(OPTIONAL).map(([key, file]) => fetch(base + file)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((json) => [key, json]));
    Promise.all([...required, ...optional])
      .then((entries) => setState({ data: Object.fromEntries(entries), error: null }))
      .catch((error) => setState({ data: null, error }));
  }, []);
  return state;
}
