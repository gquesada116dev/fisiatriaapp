/**
 * Shared markdown renderer for Claude's structured output.
 * Supports: H1-H4, HR, bullets, numbered lists, bold, code, tables, images.
 */
export function renderMd(md: string): React.ReactNode[] {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const inline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let n = 0;
    const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`b${n++}`}>{m[2]}</strong>);
      else if (m[3]) parts.push(<code key={`c${n++}`}>{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={key++} className="border-bone-200 my-4" />);
      i++;
    } else if (/^#\s+/.test(line) && !/^##/.test(line)) {
      out.push(<h1 key={key++}>{line.replace(/^#\s+/, "")}</h1>);
      i++;
    } else if (/^####\s+/.test(line)) {
      out.push(<h4 key={key++}>{line.replace(/^####\s+/, "")}</h4>);
      i++;
    } else if (/^###\s+/.test(line)) {
      out.push(<h3 key={key++}>{line.replace(/^###\s+/, "")}</h3>);
      i++;
    } else if (/^##\s+/.test(line)) {
      out.push(<h2 key={key++}>{line.replace(/^##\s+/, "")}</h2>);
      i++;
    } else if (/^!\[/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) {
        // eslint-disable-next-line @next/next/no-img-element
        out.push(<img key={key++} src={m[2]} alt={m[1]} className="w-full max-h-80 object-contain rounded-xl border border-bone-200 my-4" />);
      }
      i++;
    } else if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      const [head, , ...body] = rows;
      out.push(
        <div key={key++} className="overflow-x-auto my-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {head?.map((cell, ci) => (
                  <th key={ci} className="border border-bone-300 bg-bone-100 px-3 py-1.5 text-left font-semibold text-ink-800">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-bone-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-bone-200 px-3 py-1.5 text-ink-700">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-5 my-1 space-y-0.5">
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ul>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="list-decimal pl-5 my-1 space-y-0.5">
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ol>
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      const paras: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|[-*]\s|\d+\.\s|\|)/.test(lines[i])) {
        paras.push(lines[i]);
        i++;
      }
      out.push(<p key={key++}>{inline(paras.join(" "))}</p>);
    }
  }
  return out;
}
