import { useEffect, useMemo, useState } from 'react';
import { useData } from './lib/useData.js';
import { buildView } from './lib/view.js';
import { choicesFromSearch, searchFromChoices } from './lib/url.js';
import CopyLink from './components/CopyLink.jsx';
import ConditionPanel from './components/ConditionPanel.jsx';
import RiskMap from './components/RiskMap.jsx';
import Legend from './components/Legend.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import StormCalendar from './components/StormCalendar.jsx';
import DistrictPanel from './components/DistrictPanel.jsx';

// Default view: southern storms are the strongest signal in the data (citywide +16%).
const INITIAL = { mode: 'direction', dir: 'S', time: 'Night', uhi: 'Strong', sel: 5, unit: 'districts' };

export default function App() {
  const { data, error } = useData();
  // Start from the link the page was opened with, so shared views open as they were sent.
  const [choices, setChoices] = useState(() => choicesFromSearch(window.location.search, INITIAL));
  const update = (patch) => setChoices((c) => ({ ...c, ...patch }));
  const view = useMemo(() => (data ? buildView(data, choices) : null), [data, choices]);
  // [longitude, latitude] from "Find my district"; shown on the map, never stored or sent.
  const [userPoint, setUserPoint] = useState(null);
  const onLocate = ({ point, district }) => {
    setUserPoint(point);
    if (district) update({ sel: district });
  };

  // Keep the address in step with the choices. replaceState, so Back still leaves the page.
  useEffect(() => {
    const { pathname, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${searchFromChoices(choices)}${hash}`);
  }, [choices]);

  if (error) {
    return <main className="status" role="alert"><h1>Map data is missing</h1><p>{error.message}</p></main>;
  }
  if (!view) return <main className="status" aria-busy="true"><p>Loading rainfall data…</p></main>;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">Austin Rainfall Risk Mapper</h1>
        <p className="tagline">Where heavy rain hits hardest, 2000–2024</p>
        <CopyLink />
      </header>

      <div className="layout">
        <ConditionPanel choices={choices} update={update} view={view} />

        <main className="panel center" aria-labelledby="view-title">
          <h2 id="view-title" className="view-title">{view.title}</h2>
          <p className="muted">{view.subtitle} Select a district to see details.</p>
          <p className="insight" aria-live="polite">{view.insight}</p>
          <details className="howto">
            <summary>How to read this map</summary>
            <ul>{view.howTo.map((t) => <li key={t}>{t}</li>)}</ul>
          </details>

          <RiskMap data={data} view={view} choices={choices} userPoint={userPoint} onSelect={(sel) => update({ sel })} />
          <Legend scale={view.scale} {...view.legend} />
          {view.calendar && <StormCalendar calendar={view.calendar} />}
          <ComparisonTable table={view.table} selected={choices.sel} update={update} />
        </main>

        <DistrictPanel view={view} update={update} districtShapes={data.districts} onLocate={onLocate} />
      </div>
    </div>
  );
}
