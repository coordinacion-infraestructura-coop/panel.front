// Markdown mínimo para las respuestas del agente: párrafos, títulos, listas, negrita, cursiva,
// código en línea y tablas con pipes. Arma nodos de React (nunca innerHTML), así un texto del
// modelo no puede inyectar HTML.
import { Fragment, type ReactNode } from 'react'

function enLinea(texto: string, clave: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g
  let ultimo = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index))
    const t = m[0]
    const k = `${clave}-${i++}`
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k} className="px-1 rounded bg-slate-100 text-[0.9em]">{t.slice(1, -1)}</code>)
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    ultimo = m.index + t.length
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo))
  return out
}

const celdas = (linea: string) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

export function Markdown({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const bloques: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lineas.length) {
    const l = lineas[i]
    const k = `md-${n++}`
    if (!l.trim()) {
      i++
      continue
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l)
    if (titulo) {
      bloques.push(<p key={k} className="font-semibold text-gov-navy mt-3 mb-1">{enLinea(titulo[2], k)}</p>)
      i++
      continue
    }
    if (l.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1] ?? '')) {
      const cab = celdas(l)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && lineas[i].trim().startsWith('|')) filas.push(celdas(lineas[i++]))
      bloques.push(
        <div key={k} className="overflow-x-auto my-2">
          <table className="text-sm border-collapse">
            <thead><tr>{cab.map((c, j) => <th key={j} className="text-left font-semibold border-b border-slate-300 px-2 py-1">{enLinea(c, `${k}h${j}`)}</th>)}</tr></thead>
            <tbody>{filas.map((f, r) => <tr key={r} className="border-b border-slate-100">{f.map((c, j) => <td key={j} className="px-2 py-1">{enLinea(c, `${k}${r}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    const vineta = /^\s*([-*•]|\d+[.)])\s+/
    if (vineta.test(l)) {
      const ordenada = /^\s*\d/.test(l)
      const items: string[] = []
      while (i < lineas.length && vineta.test(lineas[i])) items.push(lineas[i++].replace(vineta, ''))
      const Lista = ordenada ? 'ol' : 'ul'
      bloques.push(
        <Lista key={k} className={`${ordenada ? 'list-decimal' : 'list-disc'} pl-5 my-1 space-y-0.5`}>
          {items.map((it, j) => <li key={j}>{enLinea(it, `${k}-${j}`)}</li>)}
        </Lista>,
      )
      continue
    }
    // La primera línea se consume siempre (si no, una línea con "|" que no es tabla no avanzaría).
    const parrafo: string[] = [lineas[i++]]
    while (i < lineas.length && lineas[i].trim() && !vineta.test(lineas[i]) && !/^#{1,4}\s/.test(lineas[i]) && !lineas[i].trim().startsWith('|'))
      parrafo.push(lineas[i++])
    bloques.push(
      <p key={k} className="my-1">
        {parrafo.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(p, `${k}-${j}`)}</Fragment>)}
      </p>,
    )
  }
  return <div className="text-[15px] leading-relaxed text-slate-800">{bloques}</div>
}
