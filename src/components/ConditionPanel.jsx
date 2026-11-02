import { COMPASS, DIR_NAMES } from '../lib/format.js';

// A row of toggle buttons; aria-pressed tells screen readers which one is on.
function Toggle({ options, value, onChange, columns }) {
  return (
    <div className="toggles" style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" className="toggle" aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}>
          {o.label}{o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

export default function ConditionPanel({ choices, update, view }) {
  const isDir = choices.mode === 'direction';
  return (
    <aside className="panel side" aria-label="Storm conditions">
      <fieldset>
        <legend>Group storms by</legend>
        <Toggle columns={1} value={choices.mode} onChange={(mode) => update({ mode })}
          options={[{ value: 'direction', label: 'Storm direction' }, { value: 'uhi', label: 'Time of day and urban heat' }]} />
      </fieldset>

      {isDir ? (
        <>
          <fieldset>
            <legend>Storm comes from</legend>
            <div className="compass">
              {COMPASS.map((d) => (d ? (
                <button key={d} type="button" className="toggle" aria-pressed={d === choices.dir}
                  aria-label={`From the ${DIR_NAMES[d]}`} onClick={() => update({ dir: d })}>{d}</button>
              ) : <span key="austin" className="compass-center" aria-hidden="true">★</span>))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Map unit</legend>
            <Toggle value={choices.unit} onChange={(unit) => update({ unit })}
              options={[{ value: 'districts', label: 'Districts' }, { value: 'grid', label: '1 km grid' }]} />
          </fieldset>
        </>
      ) : (
        <>
          <fieldset>
            <legend>Time of day</legend>
            <Toggle value={choices.time} onChange={(time) => update({ time })}
              options={[{ value: 'Day', label: 'Day', sub: '8 AM–8 PM' }, { value: 'Night', label: 'Night', sub: '8 PM–8 AM' }]} />
          </fieldset>
          <fieldset>
            <legend>Urban heat island strength</legend>
            <p className="hint">How much warmer the city was than the countryside around the storm</p>
            <Toggle value={choices.uhi} onChange={(uhi) => update({ uhi })}
              options={['Strong', 'Moderate', 'Weak'].map((u) => ({ value: u, label: u }))} />
          </fieldset>
        </>
      )}

      <div className="count">
        <strong>{view.storms.toLocaleString()} storms</strong>
        <span>{view.stormsNote}</span>
      </div>
    </aside>
  );
}
