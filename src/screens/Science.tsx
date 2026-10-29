import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BackBar, Title } from '../components/PageHeader'
import { PRINCIPLES } from '../data/science'

const TONE = { 'Well supported': 'bg-good/15 text-good', 'Fairly supported': 'bg-accent/15 text-accent', 'Rule of thumb': 'bg-warn/15 text-warn' } as const

export default function Science() {
  const [sp] = useSearchParams()
  const focus = sp.get('s')
  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(`sci-${focus}`)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [focus])

  return (
    <div className="space-y-4">
      <BackBar />
      <Title sub="Why ARLog coaches the way it does">The science</Title>
      <div className="card text-sm text-mute">
        ARLog is built around muscle growth. Every suggestion it makes traces back to one of the points below. These are plain-language summaries of published research, written by the app&rsquo;s author, checked against the papers&rsquo; abstracts and review articles. They are not medical advice, and the exact numbers are practical choices where research gives a range. Read the papers if the details matter to you.
      </div>
      {PRINCIPLES.map((p, i) => (
        <section key={p.id} id={`sci-${p.id}`} className={`rise card space-y-2.5 ${focus === p.id ? 'ring-2 ring-accent' : ''}`} style={{ ['--i' as string]: Math.min(i, 6) }}>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-extrabold leading-tight">{p.title}</h2>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[p.confidence]}`}>{p.confidence}</span>
          </div>
          <div><div className="label mb-0.5">What ARLog does</div><p className="text-[15px] leading-snug">{p.rule}</p></div>
          <div><div className="label mb-0.5">What the research found</div><p className="text-[15px] leading-snug text-mute">{p.evidence}</p></div>
          <div><div className="label mb-0.5">Limits</div><p className="text-[15px] leading-snug text-mute">{p.caveat}</p></div>
          {p.cites.length > 0 && (
            <div>
              <div className="label mb-1">Sources</div>
              <ul className="space-y-1.5 text-[13px] leading-snug text-mute">
                {p.cites.map((c, k) => (
                  <li key={k}>{c.text}{c.url && <> <a href={c.url} target="_blank" rel="noreferrer" className="text-accent underline">Open</a></>}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
