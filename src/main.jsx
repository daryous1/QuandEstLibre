import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, Plus, Share2, ChevronLeft, Check, Users, Sparkles, Copy } from 'lucide-react'
import './style.css'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const db = URL && KEY ? createClient(URL, KEY) : null
const LS = 'quandestlibre-events-v1'
const pad = n => String(n).padStart(2, '0')
const dateISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const dateObj = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12) }
const dateLabel = s => new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(dateObj(s))
const id = () => Math.random().toString(36).slice(2,10)
const read = () => { try { return JSON.parse(localStorage.getItem(LS)||'{}') } catch { return {} } }
const slotsFor = (start,end,step) => { const a=[]; for(let m=start*60;m<end*60;m+=step)a.push(`${pad(Math.floor(m/60))}:${pad(m%60)}`); return a }
const keyFor = (d,t) => `${d}|${t}`

function App(){
  const [events,setEvents] = useState(read)
  const [eventId,setEventId] = useState(new URLSearchParams(location.search).get('id'))
  const [creating,setCreating] = useState(false)
  const [title,setTitle] = useState('')
  const [startDate,setStartDate] = useState(dateISO(new Date()))
  const [dayCount,setDayCount] = useState('7')
  const [startHour,setStartHour] = useState('08')
  const [endHour,setEndHour] = useState('20')
  const [step,setStep] = useState('30')
  const [person,setPerson] = useState('')
  const [chosen,setChosen] = useState({})
  const [notice,setNotice] = useState('')
  const [remoteReady,setRemoteReady] = useState(false)

  const event = eventId ? events[eventId] : null
  useEffect(()=>{localStorage.setItem(LS,JSON.stringify(events))},[events])
  useEffect(()=>{
    const sync=()=>setEventId(new URLSearchParams(location.search).get('id'))
    addEventListener('popstate',sync); return ()=>removeEventListener('popstate',sync)
  },[])
  useEffect(()=>{
    if(!eventId || !db) return
    db.from('events').select('data').eq('id',eventId).maybeSingle().then(({data})=>{
      if(data?.data){setEvents(p=>({...p,[eventId]:data.data}));setRemoteReady(true)}
    })
  },[eventId])

  async function save(ev){
    setEvents(p=>({...p,[ev.id]:ev}))
    if(db){
      const {error}=await db.from('events').upsert({id:ev.id,data:ev,updated_at:new Date().toISOString()})
      if(error) setNotice('Synchronisation impossible : vérifie la configuration Supabase.')
    }
  }
  function open(id){history.pushState({},'',`?id=${id}`);setEventId(id);setChosen({});setPerson('');setCreating(false)}
  function home(){history.pushState({},'',location.pathname);setEventId(null);setCreating(false)}
  function create(e){
    e.preventDefault()
    if(!title.trim()) return setNotice('Ajoute un nom à ton sondage.')
    const dates=Array.from({length:Number(dayCount)},(_,i)=>{const d=dateObj(startDate);d.setDate(d.getDate()+i);return dateISO(d)})
    const ev={id:id(),title:title.trim(),dates,startHour,endHour,step:Number(step),participants:[]}
    save(ev);open(ev.id)
  }
  const times=useMemo(()=>event?slotsFor(Number(event.startHour),Number(event.endHour),event.step):[],[event])
  const counts=useMemo(()=>{
    const o={}
    if(event) for(const d of event.dates) for(const t of times) o[keyFor(d,t)]=event.participants.reduce((n,p)=>n+(p.slots.includes(keyFor(d,t))?1:0),0)
    return o
  },[event,times])
  const max= Math.max(0,...Object.values(counts))
  const best=Object.entries(counts).filter(([,n])=>n===max&&n>0).map(([k])=>k)
  function toggle(k){setChosen(p=>({...p,[k]:!p[k]}))}
  async function submit(){
    if(!person.trim()) return setNotice('Saisis ton prénom.')
    const selected=Object.keys(chosen).filter(k=>chosen[k])
    if(!selected.length) return setNotice('Sélectionne au moins un créneau.')
    const p={id:id(),name:person.trim(),slots:selected}
    await save({...event,participants:[...event.participants,p]})
    setPerson('');setChosen({});setNotice('Tes disponibilités sont enregistrées.')
  }
  async function share(){
    const url=location.href
    if(navigator.share){try{await navigator.share({title:event.title,text:'Indique tes disponibilités :',url})}catch{}}
    else {await navigator.clipboard.writeText(url);setNotice('Lien copié !')}
  }
  const fmtBest=best.slice(0,4).map(k=>{const [d,t]=k.split('|');return `${dateLabel(d)} à ${t}`}).join(' · ')

  return <div className="shell">
    <header><button className="logo" onClick={home}><span><CalendarDays/></span>QuandEstLibre</button><small>Simple. Ensemble.</small></header>
    {notice && <button className="notice" onClick={()=>setNotice('')}><Check size={16}/>{notice} ×</button>}
    {!event ? <main>
      <section className="hero"><div className="eyebrow">ORGANISATION FACILE</div><h1>Trouvons un moment<br/><em>qui convient à tous.</em></h1><p>Crée un sondage, partage le lien et découvre quand tout le monde est disponible.</p><button className="primary" onClick={()=>setCreating(true)}><Plus size={18}/> Créer un sondage</button><div className="noaccount">✓ Sans inscription</div></section>
      {creating && <form className="panel form" onSubmit={create}><div className="paneltop"><h2>Nouveau sondage</h2><button type="button" onClick={()=>setCreating(false)}>Fermer</button></div>
        <label>Nom de l'événement<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. : Réunion de l'équipe" required/></label>
        <div className="twocol"><label>Premier jour<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>Nombre de jours<select value={dayCount} onChange={e=>setDayCount(e.target.value)}>{[3,5,7,10,14,21].map(n=><option key={n}>{n}</option>)}</select></label></div>
        <div className="twocol"><label>Début<select value={startHour} onChange={e=>setStartHour(e.target.value)}>{Array.from({length:24},(_,i)=>pad(i)).map(t=><option key={t}>{t}</option>)}</select></label><label>Fin<select value={endHour} onChange={e=>setEndHour(e.target.value)}>{Array.from({length:24},(_,i)=>pad(i+1)).filter(t=>Number(t)<=24).map(t=><option key={t}>{t}</option>)}</select></label></div>
        <label>Durée des créneaux<select value={step} onChange={e=>setStep(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 heure</option></select></label>
        <button className="primary full">Créer mon sondage</button>
      </form>}
      <section className="features"><article><b>Un lien à partager</b><p>Les participants répondent sans créer de compte.</p></article><article><b>Le meilleur moment</b><p>Repère les horaires qui conviennent au plus grand nombre.</p></article><article><b>Conçu pour Android</b><p>Une grille tactile, lisible et facile à utiliser.</p></article></section>
      <footer>QuandEstLibre · Trouvons un moment ensemble</footer>
    </main> : <main className="event">
      <button className="back" onClick={home}><ChevronLeft size={17}/> Tous les sondages</button>
      <div className="eventtitle"><div><div className="eyebrow">SONDAGE DE DISPONIBILITÉS</div><h1>{event.title}</h1><p>{event.dates.length} jours · Créneaux de {event.step} minutes</p></div><button className="share" onClick={share}><Share2 size={17}/> Partager</button></div>
      <section className="best"><Sparkles/><div><small>MEILLEUR CRÉNEAU ACTUEL</small><b>{max ? fmtBest : 'En attente de réponses'}</b><span>{max ? `${max} personne(s) disponible(s)` : 'Les réponses apparaîtront ici.'}</span></div></section>
      <section className="panel"><h2>Mes disponibilités</h2><p className="hint">Saisis ton prénom puis touche les cases où tu es disponible.</p><label>Ton prénom<input value={person} onChange={e=>setPerson(e.target.value)} placeholder="Ex. : Camille"/></label>
        <div className="gridwrap"><div className="grid" style={{'--days':event.dates.length}}><div className="timehead">Heure</div>{event.dates.map(d=><div className="day" key={d}>{dateLabel(d)}</div>)}
          {times.map(t=><React.Fragment key={t}><div className="time">{t}</div>{event.dates.map(d=>{const k=keyFor(d,t);return <button key={k} className={`cell ${chosen[k]?'mine':''} ${counts[k]?'voted':''}`} onClick={()=>toggle(k)} aria-label={`${d} ${t}`}>{counts[k]||''}</button>})}</React.Fragment>)}
        </div></div>
        <div className="legend"><span><i/> Ta sélection</span><span><i className="other"/> Déjà sélectionné par quelqu'un</span></div>
        <button className="primary full" onClick={submit}><Check size={17}/> Enregistrer mes disponibilités</button>
      </section>
      <section className="panel"><h2>Disponibilités du groupe ({event.participants.length})</h2>{event.participants.length===0?<p className="hint">Pas encore de réponse. Partage le lien pour inviter les participants.</p>:event.participants.map(p=><div className="participant" key={p.id}><b>{p.name}</b><span>{p.slots.length} créneaux</span></div>)}</section>
      <button className="copylink" onClick={()=>{navigator.clipboard.writeText(location.href);setNotice('Lien copié !')}}><Copy size={16}/> Copier le lien</button>
      <footer>{db?'Synchronisation en ligne activée.':'Mode local : les sondages ne sont pas encore partagés entre appareils.'}</footer>
    </main>}
  </div>
}
createRoot(document.getElementById('root')).render(<App/>)
