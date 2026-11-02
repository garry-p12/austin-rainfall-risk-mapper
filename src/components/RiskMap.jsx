import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
// MapLibre finds its worker next to its own module file, which breaks once Vite bundles it.
// Import the worker as an asset so dev and production builds both serve it at a real URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { rcStepExpression } from '../lib/scales.js';
import { DISTRICTS, DIR_NAMES } from '../lib/format.js';
import { gridCellTip } from '../lib/view.js';

maplibregl.setWorkerUrl(workerUrl);

// Dark vector basemap from OpenFreeMap (OpenStreetMap data, no API key). If the style fails
// to load, the map still works: data layers draw on a plain background color.
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#121212' } }],
};

const loadBasemapStyle = () =>
  fetch(BASEMAP_STYLE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`basemap style ${r.status}`))))
    // The style's own camera would override our Austin bounds, so drop it.
    .then(({ center, zoom, bearing, pitch, ...style }) => style)
    .catch(() => FALLBACK_STYLE);

// Arrow points the way the storm travels (a storm from the south moves north = 0°).
const TRAVEL_ANGLE = { N: 180, NE: 225, E: 270, SE: 315, S: 0, SW: 45, W: 90, NW: 135 };

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function RiskMap({ data, view, choices, userPoint, onSelect }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef({});
  const youMarker = useRef(null);
  const cellPopup = useRef(null);
  const ready = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const applyRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dirRef = useRef(choices.dir);
  dirRef.current = choices.dir;

  // Create the map once, after the basemap style is fetched (or has failed).
  useEffect(() => {
    let map;
    let cancelled = false;
    loadBasemapStyle().then((style) => {
      if (cancelled) return;
      map = new maplibregl.Map({
        container: container.current,
        style,
        bounds: data.meta.bounds,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      map.on('load', () => {
        // promoteId lets us color each district through feature-state without rebuilding the source.
        map.addSource('districts', { type: 'geojson', data: data.districts, promoteId: 'district' });
        map.addSource('grid', { type: 'geojson', data: data.grid });

        map.addLayer({ id: 'grid-fill', type: 'fill', source: 'grid', layout: { visibility: 'none' },
          paint: { 'fill-color': rcStepExpression('rc_S'), 'fill-opacity': 0.85, 'fill-antialias': false } });
        map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts',
          paint: { 'fill-color': ['coalesce', ['feature-state', 'fill'], '#4A5568'], 'fill-opacity': 0.82 } });
        map.addLayer({ id: 'district-line', type: 'line', source: 'districts',
          paint: { 'line-color': '#121212', 'line-width': 1.2 } });
        map.addLayer({ id: 'district-selected', type: 'line', source: 'districts',
          filter: ['==', ['get', 'district'], -1], paint: { 'line-color': '#FFFFFF', 'line-width': 3 } });

        map.on('click', 'district-fill', (e) => {
          const d = e.features?.[0]?.properties?.district;
          if (d) onSelectRef.current(Number(d));
        });
        map.on('mouseenter', 'district-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'district-fill', () => { map.getCanvas().style.cursor = ''; });

        // Grid mode: hover (or tap) a cell to read its exact value.
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: 'none', className: 'cell-tip' });
        cellPopup.current = popup;
        const showCell = (e) => {
          const props = e.features?.[0]?.properties;
          if (props) popup.setLngLat(e.lngLat).setText(gridCellTip(props, dirRef.current)).addTo(map);
        };
        map.on('mousemove', 'grid-fill', showCell);
        map.on('click', 'grid-fill', showCell);
        map.on('mouseleave', 'grid-fill', () => popup.remove());

        // District labels are real buttons, so they work with keyboard and screen readers.
        for (const f of data.labels.features) {
          const d = f.properties.district;
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'map-label';
          el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectRef.current(d); });
          markers.current[d] = { el, marker: new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map) };
        }
        ready.current = true;
        setLoaded(true);
        applyRef.current?.();
      });
    });

    return () => {
      cancelled = true;
      ready.current = false;
      youMarker.current = null;
      setLoaded(false);
      map?.remove();
      mapRef.current = null;
    };
  }, [data]);

  // Restyle whenever the choices change. Cheap: 10 feature-states, one paint property, 10 labels.
  // Also run once the map finishes loading, since that can happen after this effect.
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !ready.current) return;
      const grid = view.isDir && choices.unit === 'grid';
      for (const d of DISTRICTS) {
        const info = view.districts[d];
        map.setFeatureState({ source: 'districts', id: d }, { fill: info.cls.fill });
        const m = markers.current[d];
        if (m) {
          m.el.innerHTML = `<strong>D${d}</strong><span>${info.label}</span>`;
          m.el.setAttribute('aria-label', `District ${d}, ${info.label}`);
          m.el.setAttribute('aria-pressed', String(d === choices.sel));
        }
      }
      map.setLayoutProperty('grid-fill', 'visibility', grid ? 'visible' : 'none');
      if (grid) map.setPaintProperty('grid-fill', 'fill-color', rcStepExpression(`rc_${choices.dir}`));
      map.setPaintProperty('district-fill', 'fill-opacity', grid ? 0 : 0.82);
      map.setPaintProperty('district-line', 'line-color', grid ? 'rgba(18,18,18,0.9)' : '#121212');
      map.setFilter('district-selected', ['==', ['get', 'district'], choices.sel]);
      if (!grid) cellPopup.current?.remove();

      // "Find my district" marker. Not a button: it only shows where the visitor is.
      if (userPoint && !youMarker.current) {
        const el = document.createElement('div');
        el.className = 'you-are-here';
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', 'Your location');
        youMarker.current = new maplibregl.Marker({ element: el }).setLngLat(userPoint).addTo(map);
      } else if (userPoint) {
        youMarker.current.setLngLat(userPoint);
      }
    };
    applyRef.current = apply;
    apply();
  }, [view, choices, userPoint]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map" role="region" aria-label="Map of Austin council districts. Use the district buttons on the map or the ranking to select a district." />
      {!loaded && <div className="map-loading" role="status">Loading map…</div>}
      {view.isDir && (
        <div className="storm-badge" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" style={{ transform: `rotate(${TRAVEL_ANGLE[choices.dir]}deg)`, transition: prefersReducedMotion() ? 'none' : 'transform 250ms ease' }}>
            <path d="M12 3 L12 21 M12 3 L6 9 M12 3 L18 9" fill="none" stroke="#90CAF9" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Storm moving<br /><strong>from the {DIR_NAMES[choices.dir]}</strong></span>
        </div>
      )}
    </div>
  );
}
