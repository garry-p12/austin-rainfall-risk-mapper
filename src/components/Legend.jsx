export default function Legend({ scale, title, note }) {
  return (
    <div className="legend">
      <span className="legend-title">{title}:</span>
      <ul>
        {scale.map((c) => (
          <li key={c.name}><span className="swatch" style={{ background: c.fill }} aria-hidden="true" />{c.name} <span className="muted">({c.label.toLowerCase()})</span></li>
        ))}
      </ul>
      <p className="muted small">{note}</p>
    </div>
  );
}
