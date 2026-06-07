import { useState, useEffect } from 'react'
import { supabase, dateFmt, rupee } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal, Loader, Empty } from '../components/ui'
import { Plus, Edit2, Trash2, Eye, EyeOff, Save } from 'lucide-react'

/* ─── Table map ─── */
const TABLE = {
  announcements: 'announcements',
  awards:        'awards',
  news:          'news_posts',
  hackathon:     'hackathon_topics',
}

/* ─── Default blank forms ─── */
const BLANK = {
  announcements: { title:'', content:'', type:'info', is_active:true, pinned:false, expires_at:'' },
  awards:        { title:'', description:'', icon:'🏆', color:'#f59e0b', awarded_to:'', award_date:new Date().toISOString().slice(0,10), is_active:true },
  news:          { title:'', content:'', image_url:'', category:'update', is_published:false },
  hackathon:     { title:'', description:'', difficulty:'medium', tags:'', is_active:true },
}

const TABS = [
  { id:'announcements', label:'Announcements', icon:'📢' },
  { id:'awards',        label:'Awards',        icon:'🏆' },
  { id:'news',          label:'News Posts',    icon:'📰' },
  { id:'hackathon',     label:'Hackathon',     icon:'💡' },
]

export default function AdminContentPage() {
  const { profile } = useAuth()
  const [tab,      setTab]    = useState('announcements')
  const [rows,     setRows]   = useState([])
  const [users,    setUsers]  = useState([])
  const [projects, setProj]   = useState([])
  const [loading,  setLoading]= useState(true)
  const [showModal,setShow]   = useState(false)
  const [editing,  setEditing]= useState(null)
  const [form,     setForm]   = useState({})
  const [saving,   setSaving] = useState(false)
  const [err,      setErr]    = useState('')

  useEffect(() => { load() }, [tab])
  useEffect(() => {
    supabase.from('profiles').select('id,full_name,role').order('full_name')
      .then(({ data }) => setUsers(data || []))
  }, [])

  async function load() {
    setLoading(true); setErr('')
    const table = TABLE[tab]
    /* Only awards has the awarded_to FK join */
    const select = tab === 'awards'
      ? '*, recipient:profiles!awarded_to(full_name)'
      : '*'
    const { data, error } = await supabase
      .from(table).select(select)
      .order('created_at', { ascending: false })
    if (error) setErr(`Failed to load: ${error.message}`)
    setRows(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.title?.trim()) { setErr('Title is required'); return }
    setSaving(true); setErr('')
    try {
      const table = TABLE[tab]
      /* Build clean payload — no join aliases, no id */
      const payload = { ...BLANK[tab], ...form }
      delete payload.id
      delete payload.created_at
      delete payload.updated_at
      delete payload.recipient        /* awards join alias */
      delete payload.awarded_to_user  /* old join alias */
      payload.created_by = profile.id

      /* Convert tags string → array for hackathon */
      if (tab === 'hackathon' && typeof payload.tags === 'string') {
        payload.tags = payload.tags.split(',').map(t => t.trim()).filter(Boolean)
      }
      /* Set published_at when publishing news */
      if (tab === 'news' && payload.is_published && !editing?.published_at) {
        payload.published_at = new Date().toISOString()
      }
      /* Empty string → null */
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })

      let error
      if (editing) {
        const { created_by, ...updatePayload } = payload
        ;({ error } = await supabase.from(table).update(updatePayload).eq('id', editing.id))
      } else {
        ;({ error } = await supabase.from(table).insert(payload))
      }

      if (error) throw new Error(error.message)
      setShow(false); setEditing(null); setForm({})
      load()
    } catch(e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(item) {
    const table = TABLE[tab]
    const field = tab === 'news' ? 'is_published' : 'is_active'
    const update = { [field]: !item[field] }
    if (tab === 'news' && !item.is_published) update.published_at = new Date().toISOString()
    const { error } = await supabase.from(table).update(update).eq('id', item.id)
    if (error) setErr(error.message); else load()
  }

  async function deleteItem(id) {
    if (!window.confirm('Delete this item?')) return
    const { error } = await supabase.from(TABLE[tab]).delete().eq('id', id)
    if (error) setErr(error.message); else load()
  }

  function openCreate() {
    setEditing(null); setErr('')
    setForm({ ...BLANK[tab] })
    setShow(true)
  }

  function openEdit(item) {
    setEditing(item); setErr('')
    const f = { ...item }
    /* Flatten join alias */
    if (f.recipient) { delete f.recipient }
    /* tags array → string */
    if (Array.isArray(f.tags)) f.tags = f.tags.join(', ')
    setForm(f)
    setShow(true)
  }

  const isActive = item => tab === 'news' ? item.is_published : item.is_active
  const addLabel = tab==='hackathon'?'Topic':tab==='news'?'News Post':tab==='awards'?'Award':'Announcement'

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Landing Page Content</div>
          <div className="page-subtitle">Manage announcements, awards, news and hackathon topics shown on the public landing page</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14}/> Add {addLabel}</button>
      </div>

      {err && <div className="alert alert-danger" style={{marginBottom:14}}>{err}</div>}

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,
              border:`1.5px solid ${tab===t.id?'var(--c1)':'var(--border)'}`,
              background:tab===t.id?'var(--c1)':'var(--surface)',cursor:'pointer',
              color:tab===t.id?'#fff':'var(--text-soft)',fontWeight:tab===t.id?700:500,
              fontSize:13,fontFamily:'inherit',transition:'all .15s'}}>
            <span style={{fontSize:15}}>{t.icon}</span> {t.label}
            <span style={{padding:'1px 7px',borderRadius:999,fontSize:10,fontWeight:700,
              background:tab===t.id?'rgba(255,255,255,.25)':'var(--bg-3)',
              color:tab===t.id?'#fff':'var(--text-muted)'}}>
              {rows.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? <Loader/> : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <span style={{fontWeight:700,fontSize:13}}>{rows.length} {addLabel}{rows.length!==1?'s':''}</span>
          </div>
          <table>
            <thead><tr>
              <th>Title</th>
              {tab==='announcements' && <><th>Type</th><th>Pinned</th></>}
              {tab==='awards'        && <><th>Recipient</th><th>Date</th></>}
              {tab==='news'          && <><th>Category</th><th>Image</th></>}
              {tab==='hackathon'     && <><th>Difficulty</th><th>Tags</th></>}
              <th>Status</th>
              <th>Created</th>
              <th style={{width:100}}>Actions</th>
            </tr></thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={7}><Empty icon={TABS.find(t=>t.id===tab)?.icon} title={`No ${addLabel}s yet`} desc={`Click "Add ${addLabel}" to create one`}/></td></tr>
                : rows.map(item => (
                  <tr key={item.id}>
                    <td className="td-bold" style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</td>
                    {tab==='announcements' && <>
                      <td><span className={`badge badge-${item.type==='success'?'success':item.type==='warning'?'warning':item.type==='event'?'purple':'info'}`} style={{fontSize:10}}>{item.type}</span></td>
                      <td style={{fontSize:16}}>{item.pinned?'📌':''}</td>
                    </>}
                    {tab==='awards' && <>
                      <td style={{fontSize:13}}>{item.recipient?.full_name || <span style={{color:'var(--text-muted)'}}>Unassigned</span>}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{dateFmt(item.award_date)}</td>
                    </>}
                    {tab==='news' && <>
                      <td><span className="badge badge-teal" style={{fontSize:10,textTransform:'capitalize'}}>{item.category}</span></td>
                      <td>{item.image_url?'🖼️':''}</td>
                    </>}
                    {tab==='hackathon' && <>
                      <td><span className={`badge badge-${item.difficulty==='hard'||item.difficulty==='expert'?'danger':item.difficulty==='medium'?'warning':'success'}`} style={{fontSize:10}}>{item.difficulty}</span></td>
                      <td style={{fontSize:11,color:'var(--text-muted)',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{Array.isArray(item.tags)?item.tags.join(', '):item.tags||'—'}</td>
                    </>}
                    <td>
                      <span style={{padding:'3px 9px',borderRadius:4,fontSize:10,fontWeight:700,textTransform:'uppercase',
                        background:isActive(item)?'#dcfce7':'var(--bg-3)',
                        color:isActive(item)?'#15803d':'var(--text-muted)'}}>
                        {isActive(item)?(tab==='news'?'Published':'Active'):(tab==='news'?'Draft':'Hidden')}
                      </span>
                    </td>
                    <td style={{fontSize:11,color:'var(--text-muted)'}}>{dateFmt(item.created_at)}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>toggleActive(item)} title={isActive(item)?'Hide':'Publish'}>
                          {isActive(item)?<EyeOff size={13}/>:<Eye size={13}/>}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(item)}><Edit2 size={13}/></button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{color:'var(--rose)'}} onClick={()=>deleteItem(item.id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      <Modal open={showModal} onClose={()=>{setShow(false);setErr('')}} title={`${editing?'Edit':'Add'} ${addLabel}`} size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setShow(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={13}/> {saving?'Saving…':'Save'}</button>
        </>}>

        {err && <div className="alert alert-danger" style={{marginBottom:14}}>{err}</div>}

        {/* ── Announcements ── */}
        {tab==='announcements' && <>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Announcement headline"/>
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea className="form-textarea" style={{minHeight:100}} value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Full announcement text…"/>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.type||'info'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {['info','success','warning','event'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Expires At (optional)</label>
              <input className="form-input" type="datetime-local" value={form.expires_at||''} onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',gap:24,marginTop:4}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
              <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{accentColor:'var(--c1)',width:15,height:15}}/>
              Show on landing page
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
              <input type="checkbox" checked={!!form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} style={{accentColor:'var(--c1)',width:15,height:15}}/>
              📌 Pin to top
            </label>
          </div>
        </>}

        {/* ── Awards ── */}
        {tab==='awards' && <>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Award Title *</label>
              <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Employee of the Month"/></div>
            <div className="form-group"><label className="form-label">Icon (emoji)</label>
              <input className="form-input" value={form.icon||'🏆'} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} maxLength={4} style={{fontSize:24,textAlign:'center'}}/></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What this award is for…"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Award To</label>
              <select className="form-select" value={form.awarded_to||''} onChange={e=>setForm(f=>({...f,awarded_to:e.target.value||null}))}>
                <option value="">Not yet assigned</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Award Date</label>
              <input className="form-input" type="date" value={form.award_date||''} onChange={e=>setForm(f=>({...f,award_date:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',gap:20,alignItems:'center',marginTop:4}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Accent Color</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:5}}>
                <input type="color" value={form.color||'#f59e0b'} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{height:38,width:60,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',padding:2}}/>
                <span style={{fontSize:12,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{form.color||'#f59e0b'}</span>
              </div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,marginTop:14}}>
              <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{accentColor:'var(--c1)',width:15,height:15}}/>
              Show on landing
            </label>
          </div>
        </>}

        {/* ── News Posts ── */}
        {tab==='news' && <>
          <div className="form-group"><label className="form-label">Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="News headline"/></div>
          <div className="form-group"><label className="form-label">Content *</label>
            <textarea className="form-textarea" style={{minHeight:120}} value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Full article content…"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Image URL</label>
              <input className="form-input" value={form.image_url||''} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))} placeholder="https://…"/></div>
            <div className="form-group"><label className="form-label">Category</label>
              <select className="form-select" value={form.category||'update'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {['update','event','milestone','product','general'].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select></div>
          </div>
          {form.image_url && <img src={form.image_url} alt="" style={{width:'100%',maxHeight:130,objectFit:'cover',borderRadius:8,marginBottom:10,border:'1px solid var(--border)'}} onError={e=>e.target.style.display='none'}/>}
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
            <input type="checkbox" checked={!!form.is_published} onChange={e=>setForm(f=>({...f,is_published:e.target.checked}))} style={{accentColor:'var(--c1)',width:15,height:15}}/>
            Publish now (show on landing page)
          </label>
        </>}

        {/* ── Hackathon ── */}
        {tab==='hackathon' && <>
          <div className="form-group"><label className="form-label">Topic Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. AI-powered expense categorization"/></div>
          <div className="form-group"><label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the challenge…"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Difficulty</label>
              <select className="form-select" value={form.difficulty||'medium'} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
                {[['easy','🟢 Easy'],['medium','🟡 Medium'],['hard','🔴 Hard'],['expert','🟣 Expert']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={typeof form.tags==='string'?form.tags:(form.tags||[]).join(', ')} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="AI, React, Finance"/></div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
            <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{accentColor:'var(--c1)',width:15,height:15}}/>
            Active (show on landing page)
          </label>
        </>}
      </Modal>
    </div>
  )
}
