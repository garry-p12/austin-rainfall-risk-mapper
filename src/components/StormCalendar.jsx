// When storms from the chosen direction reach the city: by month and by 3-hour window.
// Bars are drawn with plain HTML. Screen readers get a list per chart; everyone can open the table.
function Bars({ title, caption, bars }) {
  return (
    <figure className="cal-chart">
      <figcaption><strong>{title}</strong> <span className="muted">{caption}</span></figcaption>
      <div className="cal-bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b) => (
          <div key={b.key} className="cal-col">
            <div className="cal-track">
              <span className="cal-fill" style={{ height: `${b.height * 100}%` }}>
                {b.peak && <span className="cal-peak">{b.label}</span>}
              </span>
            </div>
            <span className="cal-tick">{b.tick}</span>
            <span className="cal-tip">{b.tip}</span>
          </div>
        ))}
      </div>
      <ul className="visually-hidden">{bars.map((b) => <li key={b.key}>{b.tip}</li>)}</ul>
    </figure>
  );
}

export default function StormCalendar({ calendar }) {
  const { title, summary, caption, months, hours, note } = calendar;
  return (
    <section className="table-section" aria-labelledby="calendar-title">
      <h2 id="calendar-title">{title}</h2>
      <p className="calendar-summary">{summary}</p>
      <div className="cal-charts">
        <Bars title="Month" caption={caption} bars={months} />
        <Bars title="Time of day" caption="3-hour windows" bars={hours} />
      </div>
      <details className="howto">
        <summary>Show the numbers</summary>
        <div className="cal-tables">
          {[['Month', months], ['Time of day', hours]].map(([head, bars]) => (
            <table key={head} className="cal-table">
              <thead><tr><th scope="col">{head}</th><th scope="col">Storms</th><th scope="col">Share</th></tr></thead>
              <tbody>
                {bars.map((b) => <tr key={b.key}><th scope="row">{b.key}</th><td>{b.count}</td><td>{b.label}</td></tr>)}
              </tbody>
            </table>
          ))}
        </div>
      </details>
      <p className="muted small">{note}</p>
    </section>
  );
}
