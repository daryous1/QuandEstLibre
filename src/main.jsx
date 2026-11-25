import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, Plus, Share2, ChevronLeft, Check, Sparkles, Copy, RefreshCw, Users, X, MousePointer2, PencilLine, Eye, Trash2, ArrowUpRight } from 'lucide-react'
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

// Historique propre à ce navigateur : aucun compte et aucune table Supabase supplémentaire.
const HISTORY_KEY = 'quandestlibre_history_v1'
const readHistory = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(item => item && typeof item.id === 'string' && item.id.length < 128 && typeof item.title === 'string')
      .slice(0, 100)
  } catch {
    return []
  }
}

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
  const [step, setStep] = useState('30')
  const [person, setPerson] = useState('')
  const [chosen, setChosen] = useState({})
  const [selectionMode, setSelectionMode] = useState(false)
  const [inspectedSlot, setInspectedSlot] = useState(null)
  const popoverRef = useRef(null)
  const dragRef = useRef(null)
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState(readHistory)
  const [existingLink, setExistingLink] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const sync = () => {
      setEventId(getEventId())
      setEvent(null)
      setChosen({})
      setInspectedSlot(null)
      setSelectionMode(false)
      dragRef.current = null
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

  // La carte flottante se ferme au clic à l'extérieur, au défilement et avec Échap.
  useEffect(() => {
    if (!inspectedSlot) return
    const outside = e => {
      if (popoverRef.current?.contains(e.target) || e.target.closest?.('[data-slot]')) return
      setInspectedSlot(null)
    }
    const escape = e => { if (e.key === 'Escape') setInspectedSlot(null) }
    const dismiss = () => setInspectedSlot(null)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', dismiss)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [inspectedSlot])

  // Conserver un sondage uniquement après sa création ou une participation réussie.
  // Ouvrir un simple lien ne l'ajoute pas à la liste personnelle.
  function rememberPoll(poll, role) {
    const previous = readHistory()
    const existing = previous.find(item => item.id === poll.id)
    const entry = {
      id: poll.id,
      title: poll.title,
      created: Boolean(existing?.created || role === 'created'),
      participated: Boolean(existing?.participated || role === 'participated'),
      savedAt: Date.now()
    }
    const next = [entry, ...previous.filter(item => item.id !== poll.id)].slice(0, 100)
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      setHistory(next)
      return true
    } catch {
      return false
    }
  }

  function openSavedPoll(id) {
    window.history.pushState({}, '', linkFor(id))
    setEventId(id)
    setEvent(null)
    setLoading(true)
    setLoadError('')
    setChosen({})
    setCreating(false)
    setInspectedSlot(null)
    setSelectionMode(false)
    setNotice('')
    dragRef.current = null
  }

  function removeSavedPoll(id) {
    const poll = history.find(item => item.id === id)
    if (!poll) return
    if (!window.confirm(`Retirer « ${poll.title} » de la liste sur cet appareil ? Le sondage en ligne restera accessible via son lien.`)) return
    const next = readHistory().filter(item => item.id !== id)
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      setHistory(next)
      setNotice('Sondage retiré de cet appareil. Il reste disponible en ligne.')
    } catch {
      setNotice('Impossible de modifier l’historique sur cet appareil. Vérifie les paramètres de stockage du navigateur.')
    }
  }

  // Pour retrouver des sondages créés avant cette version, un lien peut être
  // ajouté manuellement : impossible d'inférer l'ancien historique depuis Supabase.
  async function addExistingPoll(e) {
    e.preventDefault()
    if (!db) return setNotice(configError)
    const text = existingLink.trim()
    let id = ''
    try { id = new URL(text, window.location.origin).searchParams.get('id') || '' } catch { /* lien incorrect */ }
    if (!id && /^[a-z0-9_-]{6,128}$/i.test(text)) id = text
    if (!/^[a-z0-9_-]{6,128}$/i.test(id)) return setNotice('Colle un lien de sondage valide contenant ?id=…')
    setImporting(true)
    try {
      const { data, error } = await db.from('events').select('data').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data?.data) return setNotice('Ce sondage est introuvable dans Supabase.')
      const stored = rememberPoll(data.data, 'saved')
      if (!stored) return setNotice('Le navigateur n’autorise pas l’enregistrement local de l’historique.')
      setExistingLink('')
      setNotice('Sondage ajouté à ton historique local.')
    } catch (error) {
      setNotice(`Impossible d’ajouter ce sondage : ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  function home() {
    window.history.pushState({}, '', import.meta.env.BASE_URL)
    setEventId(null)
    setCreating(false)
    setEvent(null)
    setNotice('')
    setInspectedSlot(null)
    setSelectionMode(false)
    dragRef.current = null
  }

  async function create(e) {
    e.preventDefault()
    if (!db) return setNotice(configError)
    if (!title.trim()) return setNotice('Ajoute un nom à ton sondage.')
    const days = Number(dayCount)
    if (!Number.isInteger(days) || days < 1 || days > 31) return setNotice('Indique un nombre de jours entier entre 1 et 31.')
    if (Number(endHour) <= Number(startHour)) return setNotice('L’heure de fin doit être après l’heure de début.')
    const dates = Array.from({ length: days }, (_, i) => {
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
      setInspectedSlot(null)
      setSelectionMode(false)
      setPerson('')
      setCreating(false)
      setEventId(ev.id)
      setLoading(true)
      const stored = rememberPoll(ev, 'created')
      setNotice(stored
        ? 'Sondage enregistré en ligne et ajouté à ton historique local.'
        : 'Sondage enregistré en ligne. Le navigateur n’autorise pas l’enregistrement de l’historique local.')
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

  // En mode consultation, ne PAS modifier les disponibilités : afficher une carte
  // à côté de la case. La carte est fixe pour ne pas être coupée par la grille défilante.
  function inspectSlot(k, target) {
    const rect = target.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12))
    const n = (event?.participants || []).filter(p => Array.isArray(p.slots) && p.slots.includes(k)).length
    const estimatedHeight = Math.min(340, 169 + Math.ceil(n / 2) * 37)
    const below = window.innerHeight - rect.bottom
    const preferredTop = below > estimatedHeight + 12 ? rect.bottom + 10 : rect.top - estimatedHeight - 10
    const top = Math.max(12, Math.min(preferredTop, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 24) - 12))
    setInspectedSlot({ key: k, left, top, width })
  }

  // Le tracé sélectionne (ou désélectionne) toutes les cases traversées.
  // Le premier créneau détermine le sens, comme dans When2Meet.
  function onGridPointerDown(e) {
    if (!selectionMode || (e.pointerType === 'mouse' && e.button !== 0)) return
    const cell = e.target.closest('[data-slot]')
    if (!cell || !e.currentTarget.contains(cell)) return
    const key = cell.dataset.slot
    const value = !Boolean(chosen[key])
    dragRef.current = {
      pointerId: e.pointerId, value, visited: new Set([key]),
      last: { x: e.clientX, y: e.clientY }
    }
    setChosen(p => ({ ...p, [key]: value }))
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }

  function onGridPointerMove(e) {
    const drag = dragRef.current
    if (!selectionMode || !drag || drag.pointerId !== e.pointerId) return
    const grid = e.currentTarget
    const x0 = drag.last.x, y0 = drag.last.y
    const dx = e.clientX - x0, dy = e.clientY - y0
    // Échantillonnage intermédiaire : évite de sauter des cases lors d'un mouvement rapide.
    const steps = Math.max(1, Math.min(100, Math.ceil(Math.hypot(dx, dy) / 12)))
    const added = []
    for (let i = 1; i <= steps; i++) {
      const el = document.elementFromPoint(x0 + dx * i / steps, y0 + dy * i / steps)
      const cell = el?.closest?.('[data-slot]')
      if (!cell || !grid.contains(cell)) continue
      const key = cell.dataset.slot
      if (!drag.visited.has(key)) {
        drag.visited.add(key)
        added.push(key)
      }
    }
    drag.last = { x: e.clientX, y: e.clientY }
    if (added.length) setChosen(p => {
      const next = { ...p }
      added.forEach(key => { next[key] = drag.value })
      return next
    })
  }

  function onGridPointerUp(e) {
    if (dragRef.current?.pointerId !== e.pointerId) return
    onGridPointerMove(e)
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const slotParticipants = inspectedSlot
    ? (event?.participants || []).filter(p => Array.isArray(p.slots) && p.slots.includes(inspectedSlot.key))
    : []

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
      const stored = rememberPoll(current, 'participated')
      setNotice(stored
        ? 'Tes disponibilités ont été enregistrées et ce sondage figure dans ton historique.'
        : 'Tes disponibilités sont en ligne, mais l’historique local n’a pas pu être enregistré.')
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
    <header><button className="logo" onClick={home}><span><CalendarDays /></span>QuandEstLibre</button></header>
    {notice && <button className="notice" onClick={() => setNotice('')}><Check size={16} />{notice} ×</button>}
    {!eventId ? <main>
      <section className="hero"><h1>Mes sondages</h1><p>Crée un sondage ou retrouve ceux enregistrés sur cet appareil.</p>
        {!db && <div className="alert"><b>Application non connectée</b><p>{configError}</p></div>}
        <button className="primary" disabled={!db} onClick={() => setCreating(p => !p)}><Plus size={18} /> {creating ? 'Masquer le formulaire' : 'Créer un sondage'}</button>
      </section>
      {creating && <form className="panel form" onSubmit={create}><div className="paneltop"><h2>Nouveau sondage</h2><button type="button" onClick={() => setCreating(false)}>Fermer</button></div>
        <label>Nom de l'événement<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. : Réunion de l'équipe" required /></label>
        <div className="twocol"><label>Premier jour<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required /></label><label>Nombre de jours<input type="number" min="1" max="31" step="1" inputMode="numeric" value={dayCount} onChange={e => setDayCount(e.target.value)} required /></label></div>
        <div className="twocol"><label>Début<select value={startHour} onChange={e => setStartHour(e.target.value)}>{Array.from({ length: 24 }, (_, i) => pad(i)).map(t => <option key={t}>{t}</option>)}</select></label><label>Fin<select value={endHour} onChange={e => setEndHour(e.target.value)}>{Array.from({ length: 24 }, (_, i) => pad(i + 1)).map(t => <option key={t}>{t}</option>)}</select></label></div>
        <label>Durée des créneaux<select value={step} onChange={e => setStep(e.target.value)}><option value="30">30 minutes</option><option value="60">1 heure</option></select></label>
        <button className="primary full" disabled={saving}>{saving ? 'Enregistrement en ligne…' : 'Créer mon sondage'}</button>
      </form>}
      <section className="panel history-panel" aria-labelledby="history-heading">
        <div className="history-heading"><h2 id="history-heading">Sondages enregistrés ({history.length})</h2><small>Sur cet appareil uniquement</small></div>
        {history.length === 0 ? <p className="hint">Aucun sondage dans ton historique. Les sondages que tu crées ou auxquels tu réponds apparaîtront ici.</p>
          : <div className="history-list">{history.map(item => <article className="history-item" key={item.id}>
              <div className="history-info"><b>{item.title}</b><div className="history-tags">
                {item.created && <span>Créé</span>}{item.participated && <span>Participation</span>}{!item.created && !item.participated && <span>Ajouté par lien</span>}
              </div></div>
              <div className="history-actions">
                <button type="button" className="open-poll" onClick={() => openSavedPoll(item.id)} aria-label={`Ouvrir ${item.title}`}><ArrowUpRight size={16} /> Ouvrir</button>
                <button type="button" className="remove-poll" onClick={() => removeSavedPoll(item.id)} aria-label={`Retirer ${item.title} de cet appareil`} title="Retirer de cet appareil"><Trash2 size={16} /> Retirer</button>
              </div>
            </article>)}</div>}
        <details className="history-import"><summary>Ajouter un ancien sondage par son lien</summary>
          <form onSubmit={addExistingPoll} className="history-import-form">
            <label htmlFor="history-url">Lien du sondage</label>
            <input id="history-url" type="url" placeholder="https://…/?id=…" value={existingLink} onChange={e => setExistingLink(e.target.value)} required />
            <button type="submit" disabled={importing || !db}>{importing ? 'Vérification…' : 'Ajouter'}</button>
          </form>
        </details>
        <p className="history-footnote">Retirer un sondage ici ne le supprime pas de Supabase et n’affecte pas les autres participants. Cette liste disparaît si tu effaces les données de ce navigateur.</p>
      </section>
      <footer>QuandEstLibre</footer>
    </main> : loading ? <main className="statepanel"><h1>Chargement du sondage…</h1><p>Récupération des données depuis Supabase.</p></main> : loadError ? <main className="statepanel"><div className="alert"><h1>Impossible d’ouvrir ce sondage</h1><p>{loadError}</p><p>Identifiant du sondage : <code>{eventId}</code></p></div><button className="primary" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16} /> Réessayer</button><button className="back" onClick={home}>Retour à l’accueil</button></main> : event ? <main className="event">
      <button className="back" onClick={home}><ChevronLeft size={17} /> Accueil</button>
      <div className="eventtitle"><div><div className="eyebrow">SONDAGE DE DISPONIBILITÉS</div><h1>{event.title}</h1><p>{event.dates.length} jours · Créneaux de {event.step} minutes</p></div><button className="share" onClick={share}><Share2 size={17} /> Partager</button></div>
      <section className="best"><Sparkles /><div><small>MEILLEUR CRÉNEAU ACTUEL</small><b>{max ? fmtBest : 'En attente de réponses'}</b><span>{max ? `${max} personne(s) disponible(s)` : 'Les réponses apparaîtront ici.'}</span></div></section>
      <section className="panel"><h2>Mes disponibilités</h2>
        <p className="hint">Saisis ton prénom, sélectionne les créneaux qui te conviennent, puis enregistre ta réponse.</p>
        <label>Ton prénom<input value={person} onChange={e => setPerson(e.target.value)} placeholder="Ex. : Camille" /></label>
        <div className={`mode-row ${selectionMode ? 'mode-selecting' : ''}`}>
          <div className="mode-description">
            <div className="mode-symbol">{selectionMode ? <PencilLine size={19} /> : <Eye size={19} />}</div>
            <div><b>{selectionMode ? 'Mode sélection actif' : 'Mode consultation'}</b>
              <small>{selectionMode ? 'Clique ou glisse pour cocher tes créneaux.' : 'Touche un créneau pour découvrir les personnes disponibles.'}</small></div>
          </div>
          <button type="button" className={`selection-button ${selectionMode ? 'is-active' : ''}`}
            aria-pressed={selectionMode}
            onClick={() => { setSelectionMode(p => !p); setInspectedSlot(null); dragRef.current = null }}>
            {selectionMode ? <><Check size={17} /> Terminer la sélection</> : <><MousePointer2 size={17} /> Commencer la sélection</>}
          </button>
        </div>
        <p className="mode-help">{selectionMode
          ? 'Glisse le doigt ou la souris sur les créneaux, ou touche-les un par un. Termine la sélection pour revenir à la consultation.'
          : 'Les cases sont en lecture seule : touche une case pour voir les prénoms dans une fenêtre flottante. Pour indiquer tes disponibilités, appuie sur « Commencer la sélection ».'}</p>
        <div className={`gridwrap ${selectionMode ? 'drag-active' : ''}`} onScroll={() => setInspectedSlot(null)}>
          <div className="grid" style={{ '--days': event.dates.length }}
            onPointerDown={onGridPointerDown}
            onPointerMove={onGridPointerMove}
            onPointerUp={onGridPointerUp}
            onPointerCancel={() => { dragRef.current = null }}
            onLostPointerCapture={() => { dragRef.current = null }}>
            <div className="timehead">Heure</div>{event.dates.map(d => <div className="day" key={d}>{dateLabel(d)}</div>)}
            {times.map(t => <React.Fragment key={t}><div className="time">{t}</div>{event.dates.map(d => {
              const k = keyFor(d, t)
              return <button key={k} type="button" data-slot={k}
                className={`cell ${chosen[k] ? 'mine' : ''} ${counts[k] ? 'voted' : ''} ${inspectedSlot?.key === k && !selectionMode ? 'inspected' : ''}`}
                onClick={e => {
                  if (!selectionMode) inspectSlot(k, e.currentTarget)
                  else if (e.detail === 0) setChosen(p => ({ ...p, [k]: !p[k] })) // clavier
                }}
                aria-pressed={selectionMode ? Boolean(chosen[k]) : undefined}
                aria-label={`${dateLabel(d)} à ${t} : ${counts[k] || 0} personne(s) disponible(s)${chosen[k] ? ', sélectionné' : ''}`}>
                {counts[k] || ''}
              </button>
            })}</React.Fragment>)}
          </div>
        </div>
        {!selectionMode && inspectedSlot && <aside ref={popoverRef} className="slot-popover"
          role="dialog" aria-modal="false" aria-label="Personnes disponibles pour le créneau"
          style={{ left: inspectedSlot.left, top: inspectedSlot.top, width: inspectedSlot.width }}>
          <div className="slot-details-top">
            <div><span className="slot-eyebrow"><Users size={14} /> Disponibilités</span>
              <h3>{dateLabel(inspectedSlot.key.split('|')[0])} à {inspectedSlot.key.split('|')[1]}</h3></div>
            <button type="button" className="close-details" onClick={() => setInspectedSlot(null)} aria-label="Fermer"><X size={17} /></button>
          </div>
          <p className="slot-count">{slotParticipants.length} {slotParticipants.length > 1 ? 'personnes disponibles' : 'personne disponible'}</p>
          {slotParticipants.length ? <div className="slot-names">{slotParticipants.map((p,i) =>
            <span className="slot-name" key={`${p.id || p.name}-${i}`}>{p.name}</span>)}</div>
            : <p className="slot-empty">Personne n'a encore indiqué être disponible à ce créneau.</p>}
          <p className="slot-explain">Pour indiquer ta disponibilité, utilise le bouton « Commencer la sélection ».</p>
        </aside>}
        <div className="legend"><span><i /> Ta sélection</span><span><i className="other" /> Déjà sélectionné par quelqu'un</span><span>Les chiffres indiquent le nombre de personnes</span></div>
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
