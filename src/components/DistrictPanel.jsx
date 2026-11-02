// Right-hand panel: the selected district in words, across all conditions, and the ranking.
export default function DistrictPanel({ view, update }) {
  const { selected, ranked, districts, isDir } = view;
  const max = isDir ? 1.4 : 45;
  return (
    <aside className="panel side" aria-label="Selected district">
      <p className="eyebrow">Selected district</p>
      <h2 className="district-name">{selected.name}</h2>
      <span className="chip" style={{ background: selected.cls.fill, color: selected.cls.ink }}>{selected.cls.name}</span>
      <p className="sentence">{selected.sentence}</p>

      <h3>{selected.compareTitle}</h3>
      <div className="compare">
        {selected.compare.map((c) => (
          <div key={c.key} className={`compare-cell${c.active ? ' active' : ''}`} style={{ background: c.cls.fill, color: c.cls.ink }}>
            <small>{c.label}</small><strong>{c.value}</strong>
          </div>
        ))}
      </div>

      <h3>All districts, highest first</h3>
      <ol className="ranking">
        {ranked.map((d) => (
          <li key={d}>
            <button type="button" aria-pressed={d === selected.district} onClick={() => update({ sel: d })}>
              <span className="rank-id">D{d}</span>
              <span className="bar"><span style={{ width: `${Math.min(100, (districts[d].value / max) * 100)}%`, background: districts[d].cls.fill }} /></span>
              <span className="rank-val">{districts[d].label}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
