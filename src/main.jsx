import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, Plus, Share2, ChevronLeft, Check, Sparkles, Copy, RefreshCw } from 'lucide-react'
import './style.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
let db = null
let configError = ''
try {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    configError = 'Connexion Supabase absente. Vérifie les deux Secrets GitHub et relance le déploiement.'
  } else {
    db = createClient(SUPABASE_URL, SUPABASE_KEY)
  }
} catch (error) {
  configError = `Configuration Supabase invalide : ${error.message}`
}

const pad = n => String(n).padStart(2, '0')
const dateISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dateObj = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
const dateLabel = s => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(dateObj(s))
const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 12)
const getEventId = () => new URLSearchParams(window.location.search).get('id')
const linkFor = id => {
  const u = new URL(import.meta.env.BASE_URL, window.location.origin)
  u.searchParams.set('id', id)
  return u.href
}
const slotsFor = (start, end, step) => {
  const a = []
  for (let m = start * 60; m < end * 60; m += step) a.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  return a
}
const keyFor = (d, t) => `${d}|${t}`

function App() {
  const [eventId, setEventId] = useState(getEventId)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(Boolean(getEventId()))
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(dateISO(new Date()))
  const [dayCount, setDayCount] = useState('7')
  const [startHour, setStartHour] = useState('08')
  const [endHour, setEndHour] = useState('20')
  const [step, setStep] = useState('15')
  const [person, setPerson] = useState('')
  const [chosen, setChosen] = useState({})
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const sync = () => {
      setEventId(getEventId())
      setEvent(null)
      setChosen({})
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      setLoadError('')
      setEvent(null)
      return
    }
    if (!db) {
      setLoading(false)
      setLoadError(configError)
      setEvent(null)
      return
    }

    let alive = true
    setLoading(true)
    setLoadError('')
    setEvent(null)

    const fetchEvent = async (initial = false) => {
      try {
        const { data, error } = await db.from('events').select('data').eq('id', eventId).maybeSingle()
        if (!alive) return
        if (error) {
          if (initial) {
            setLoadError(`Impossible de charger le sondage depuis Supabase : ${error.message}`)
            setLoading(false)
          }
          return
        }
        if (!data?.data) {
          if (initial) {
            setLoadError('Sondage introuvable dans Supabase. S’il a été créé avant la configuration en ligne, recrée-le et partage le nouveau lien.')
            setLoading(false)
          }
          return
        }
        setEvent(data.data)
        setLoadError('')
        setLoading(false)
      } catch (error) {
        if (alive && initial) {
          setLoadError(`Connexion impossible : ${error.message}`)
          setLoading(false)
        }
      }
    }

    fetchEvent(true)
    const interval = window.setInterval(() => fetchEvent(false), 12000)
    const onFocus = () => fetchEvent(false)
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [eventId, retry])

  function home() {
    window.history.pushState({}, '', import.meta.env.BASE_URL)
    setEventId(null)
    setCreating(false)
    setEvent(null)
    setNotice('')
  }

  async function create(e) {
    e.preventDefault()
    if (!db) return setNotice(configError)
    if (!title.trim()) return setNotice('Ajoute un nom à ton sondage.')
    if (Number(endHour) <= Number(startHour)) return setNotice('L’heure de fin doit être après l’heure de début.')
    const dates = Array.from({ length: Number(dayCount) }, (_, i) => {
      const d = dateObj(startDate)
      d.setDate(d.getDate() + i)
      return dateISO(d)
    })
    const ev = { id: newId(), title: title.trim(), dates, startHour, endHour, step: Number(step), participants: [] }
    setSaving(true)
    try {
      const { error } = await db.from('events').insert({ id: ev.id, data: ev, updated_at: new Date().toISOString() })
      if (error) throw error
      // Ne proposer le lien qu'une fois le sondage confirmé dans Supabase.
      window.history.pushState({}, '', linkFor(ev.id))
      setChosen({})
      setPerson('')
      setCreating(false)
      setEventId(ev.id)
      setNotice('Sondage enregistré en ligne. Tu peux partager son lien !')
    } catch (error) {
      setNotice(`Création impossible dans Supabase : ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const times = useMemo(() => event ? slotsFor(Number(event.startHour), Number(event.endHour), event.step) : [], [event])
  const counts = useMemo(() => {
    const o = {}
    if (event) for (const d of event.dates) for (const t of times) {
      const k = keyFor(d, t)
      o[k] = (event.participants || []).reduce((n, p) => n + (p.slots.includes(k) ? 1 : 0), 0)
    }
    return o
  }, [event, times])
  const max = Math.max(0, ...Object.values(counts))
  const best = Object.entries(counts).filter(([, n]) => n === max && n > 0).map(([k]) => k)
  const fmtBest = best.slice(0, 4).map(k => {
    const [d, t] = k.split('|')
    return `${dateLabel(d)} à ${t}`
  }).join(' · ')

  function toggle(k) { setChosen(p => ({ ...p, [k]: !p[k] })) }

  async function submit() {
    if (!db || !event) return setNotice('Ce sondage n’est pas connecté à Supabase.')
    if (!person.trim()) return setNotice('Saisis ton prénom.')
    const selected = Object.keys(chosen).filter(k => chosen[k])
    if (!selected.length) return setNotice('Sélectionne au moins un créneau.')
    setSaving(true)
    try {
      const { data, error: readError } = await db.from('events').select('data').eq('id', event.id).single()
      if (readError) throw readError
      const current = data.data
      const p = { id: newId(), name: person.trim(), slots: selected }
      const changed = { ...current, participants: [...(current.participants || []), p] }
      const { error: writeError } = await db.from('events').update({ data: changed, updated_at: new Date().toISOString() }).eq('id', event.id)
      if (writeError) throw writeError
      setEvent(changed)
      setPerson('')
      setChosen({})
      setNotice('Tes disponibilités ont bien été enregistrées en ligne.')
    } catch (error) {
      setNotice(`Enregistrement impossible : ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    const url = linkFor(event.id)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Lien du sondage copié !')
    } catch {
      window.prompt('Copie ce lien pour le partager :', url)
    }
  }

  async function share() {
    const url = linkFor(event.id)
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: 'Indique tes disponibilités :', url }) }
      catch (error) { if (error.name !== 'AbortError') await copyLink() }
    } else {
      await copyLink()
    }
  }

  return <div className="shell">
    <header><button className="logo" onClick={home}><span><CalendarDays /></span>QuandEstLibre</button><small>Simple. Ensemble.</small></header>
    {notice && <button className="notice" onClick={() => setNotice('')}><Check size={16} />{notice} ×</button>}
    {!eventId ? <main>
      <section className="hero"><div className="eyebrow">ORGANISATION FACILE</div><h1>Trouvons un moment<br /><em>qui convient à tous.</em></h1><p>Crée un sondage, partage le lien et découvre quand tout le monde est disponible.</p>
        {!db && <div className="alert"><b>Application non connectée</b><p>{configError}</p></div>}
        <button className="primary" disabled={!db} onClick={() => setCreating(true)}><Plus size={18} /> Créer un sondage</button><div className="noaccount">✓ Sans inscription</div>
      </section>
      {creating && <form className="panel form" onSubmit={create}><div className="paneltop"><h2>Nouveau sondage</h2><button type="button" onClick={() => setCreating(false)}>Fermer</button></div>
        <label>Nom de l'événement<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. : Réunion de l'équipe" required /></label>
        <div className="twocol"><label>Premier jour<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required /></label><label>Nombre de jours<select value={dayCount} onChange={e => setDayCount(e.target.value)}>{[3, 5, 7, 10, 14, 21].map(n => <option key={n}>{n}</option>)}</select></label></div>
        <div className="twocol"><label>Début<select value={startHour} onChange={e => setStartHour(e.target.value)}>{Array.from({ length: 24 }, (_, i) => pad(i)).map(t => <option key={t}>{t}</option>)}</select></label><label>Fin<select value={endHour} onChange={e => setEndHour(e.target.value)}>{Array.from({ length: 24 }, (_, i) => pad(i + 1)).map(t => <option key={t}>{t}</option>)}</select></label></div>
        <label>Durée des créneaux<select value={step} onChange={e => setStep(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 heure</option></select></label>
        <button className="primary full" disabled={saving}>{saving ? 'Enregistrement en ligne…' : 'Créer mon sondage'}</button>
      </form>}
      <section className="features"><article><b>Un lien à partager</b><p>Les participants répondent sans créer de compte.</p></article><article><b>Le meilleur moment</b><p>Repère les horaires qui conviennent au plus grand nombre.</p></article><article><b>Conçu pour Android</b><p>Une grille tactile, lisible et facile à utiliser.</p></article></section>
      <footer>QuandEstLibre · Trouvons un moment ensemble</footer>
    </main> : loading ? <main className="statepanel"><h1>Chargement du sondage…</h1><p>Récupération des données depuis Supabase.</p></main> : loadError ? <main className="statepanel"><div className="alert"><h1>Impossible d’ouvrir ce sondage</h1><p>{loadError}</p><p>Identifiant du sondage : <code>{eventId}</code></p></div><button className="primary" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16} /> Réessayer</button><button className="back" onClick={home}>Retour à l’accueil</button></main> : event ? <main className="event">
      <button className="back" onClick={home}><ChevronLeft size={17} /> Accueil</button>
      <div className="eventtitle"><div><div className="eyebrow">SONDAGE DE DISPONIBILITÉS</div><h1>{event.title}</h1><p>{event.dates.length} jours · Créneaux de {event.step} minutes</p></div><button className="share" onClick={share}><Share2 size={17} /> Partager</button></div>
      <section className="best"><Sparkles /><div><small>MEILLEUR CRÉNEAU ACTUEL</small><b>{max ? fmtBest : 'En attente de réponses'}</b><span>{max ? `${max} personne(s) disponible(s)` : 'Les réponses apparaîtront ici.'}</span></div></section>
      <section className="panel"><h2>Mes disponibilités</h2><p className="hint">Saisis ton prénom puis touche les cases où tu es disponible.</p><label>Ton prénom<input value={person} onChange={e => setPerson(e.target.value)} placeholder="Ex. : Camille" /></label>
        <div className="gridwrap"><div className="grid" style={{ '--days': event.dates.length }}><div className="timehead">Heure</div>{event.dates.map(d => <div className="day" key={d}>{dateLabel(d)}</div>)}
          {times.map(t => <React.Fragment key={t}><div className="time">{t}</div>{event.dates.map(d => { const k = keyFor(d, t); return <button key={k} className={`cell ${chosen[k] ? 'mine' : ''} ${counts[k] ? 'voted' : ''}`} onClick={() => toggle(k)} aria-label={`${d} ${t}`}>{counts[k] || ''}</button> })}</React.Fragment>)}
        </div></div>
        <div className="legend"><span><i /> Ta sélection</span><span><i className="other" /> Déjà sélectionné par quelqu'un</span></div>
        <button className="primary full" disabled={saving} onClick={submit}><Check size={17} /> {saving ? 'Enregistrement…' : 'Enregistrer mes disponibilités'}</button>
      </section>
      <section className="panel"><h2>Disponibilités du groupe ({(event.participants || []).length})</h2>{(event.participants || []).length === 0 ? <p className="hint">Pas encore de réponse. Partage le lien pour inviter les participants.</p> : event.participants.map(p => <div className="participant" key={p.id}><b>{p.name}</b><span>{p.slots.length} créneaux</span></div>)}</section>
      <button className="copylink" onClick={copyLink}><Copy size={16} /> Copier le lien du sondage</button>
      <p className="hint">Lien direct : <a href={linkFor(event.id)}>{linkFor(event.id)}</a></p>
      <footer>Synchronisation Supabase activée · Mise à jour automatique des réponses</footer>
    </main> : <main className="statepanel"><h1>Sondage indisponible</h1><button className="primary" onClick={() => setRetry(v => v + 1)}>Réessayer</button></main>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
