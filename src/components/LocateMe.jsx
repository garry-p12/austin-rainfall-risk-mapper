import { useState } from 'react';
import { findDistrict } from '../lib/geo.js';

// Asks the browser for the visitor's location and selects the district it falls in.
// The location is only used on this page; nothing is sent anywhere.
const OS_SETTING = 'On a Mac, check System Settings, Privacy & Security, Location Services for this browser. '
  + 'On a phone, check that Location is on.';
const MESSAGES = {
  locating: 'Finding your location…',
  outside: 'Your location is outside Austin’s council districts. Pick a district on the map instead.',
  denied: `Location access is blocked for this page. Allow it in your browser’s site settings, then try again. ${OS_SETTING}`,
  unavailable: `Your device could not work out where it is. ${OS_SETTING} Or pick your district on the map.`,
  timeout: 'Finding your location took too long. Try again, or pick your district on the map.',
  unsupported: 'This browser cannot share a location. Pick your district on the map instead.',
};
// GeolocationPositionError codes.
const ERROR_STATUS = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

// A quick network-based fix first; if that fails for a reason other than permission,
// try once more with high accuracy (GPS on phones), which sometimes succeeds where it did not.
const ATTEMPTS = [
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
];

export default function LocateMe({ districts, onLocate }) {
  const [state, setState] = useState({ status: 'idle', district: null });

  const locate = () => {
    if (!navigator.geolocation) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'locating' });
    const attempt = (i) => navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.longitude, coords.latitude];
        const district = findDistrict(districts, point);
        setState({ status: district ? 'found' : 'outside', district });
        onLocate({ point, district });
      },
      (err) => {
        const status = ERROR_STATUS[err.code] || 'unavailable';
        if (status !== 'denied' && i + 1 < ATTEMPTS.length) attempt(i + 1);
        else setState({ status });
      },
      ATTEMPTS[i],
    );
    attempt(0);
  };

  const message = state.status === 'found' ? `You are in District ${state.district}.` : MESSAGES[state.status];
  return (
    <div className="locate">
      <button type="button" className="toggle" onClick={locate} disabled={state.status === 'locating'}>
        {Object.values(ERROR_STATUS).includes(state.status) ? 'Try again' : 'Find my district'}
      </button>
      <p className="hint" role="status">{message || 'Uses your location. It stays in your browser.'}</p>
    </div>
  );
}
