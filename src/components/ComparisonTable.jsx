// Districts x directions (or conditions). Every cell is a button that updates the map.
export default function ComparisonTable({ table, selected, update }) {
  return (
    <section className="table-section" aria-labelledby="table-title">
      <h2 id="table-title">{table.title}</h2>
      <p className="muted">{table.note}</p>
      <div className="table-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">District</span></th>
              {table.columns.map((c) => (
                <th key={c.key} scope="col">
                  <button type="button" aria-pressed={c.active} onClick={() => update(c.set)}>
                    {c.head}<small>{c.sub}</small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.district} className={r.district === selected ? 'row-active' : undefined}>
                <th scope="row">
                  <button type="button" aria-pressed={r.district === selected} onClick={() => update({ sel: r.district })}>D{r.district}</button>
                </th>
                {r.cells.map((cell, i) => {
                  const active = r.district === selected && table.columns[i].active;
                  return (
                    <td key={cell.key}>
                      <button type="button" className={`cell${active ? ' active' : ''}`}
                        style={{ background: cell.cls.fill, color: cell.cls.ink }}
                        aria-label={`District ${r.district}, ${table.columns[i].head} ${table.columns[i].sub}: ${cell.label}`}
                        onClick={() => update({ ...cell.set, sel: r.district })}>
                        {cell.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {table.footer && (
            <tfoot>
              <tr>
                <th scope="row">City avg.</th>
                {table.footer.map((f) => <td key={f.key} className="city-avg">{f.label}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
