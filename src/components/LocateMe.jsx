import { useState } from 'react';
import { findDistrict } from '../lib/geo.js';

// Asks the browser for the visitor's location and selects the district it falls in.
// The location is only used on this page; nothing is sent anywhere.
const MESSAGES = {
  locating: 'Finding your location…',
  outside: 'Your location is outside Austin’s council districts. Pick a district on the map instead.',
  denied: 'Location access is off for this page. Pick your district on the map instead.',
  failed: 'Could not find your location. Pick your district on the map instead.',
  unsupported: 'This browser cannot share a location. Pick your district on the map instead.',
};

export default function LocateMe({ districts, onLocate }) {
  const [state, setState] = useState({ status: 'idle', district: null });

  const locate = () => {
    if (!navigator.geolocation) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.longitude, coords.latitude];
        const district = findDistrict(districts, point);
        setState({ status: district ? 'found' : 'outside', district });
        onLocate({ point, district });
      },
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const message = state.status === 'found' ? `You are in District ${state.district}.` : MESSAGES[state.status];
  return (
    <div className="locate">
      <button type="button" className="toggle" onClick={locate} disabled={state.status === 'locating'}>
        Find my district
      </button>
      <p className="hint" role="status">{message || 'Uses your location. It stays in your browser.'}</p>
    </div>
  );
}
