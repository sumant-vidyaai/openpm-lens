import { TABLE_ADAPTERS, coverageMatrix, type CoverageCell } from '@openpm-lens/core';

const SYMBOL: Record<CoverageCell, { mark: string; text: string }> = {
  yes: { mark: '✓', text: 'Yes' },
  no: { mark: '✗', text: 'No' },
  check: { mark: '?', text: 'Check' },
};

export function CoverageScreen() {
  const rows = coverageMatrix();
  const notes = [...new Set(rows.map((r) => r.note).filter((n): n is string => !!n))];
  return (
    <section aria-labelledby="cov-h">
      <h2 id="cov-h">What each tool's export can supply</h2>
      <p className="lead">
        Built from each tool's public documentation. A tool that cannot supply an input cannot feed the metric that
        needs it, and the app says so instead of guessing. Please confirm against a real export from your own setup.
      </p>
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Tool coverage</caption>
          <thead>
            <tr>
              <th scope="col">Input or result</th>
              {TABLE_ADAPTERS.map((a) => <th scope="col" key={a.id}>{a.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((c, i) => (
                  <td key={TABLE_ADAPTERS[i]?.id ?? i}>
                    <span aria-hidden="true">{SYMBOL[c].mark} </span>{SYMBOL[c].text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.map((n) => <p className="note" key={n}>{n}</p>)}
    </section>
  );
}
