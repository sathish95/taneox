import { useState, useEffect } from 'react'
import { supabase, dateFmt } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal, Loader, Empty } from '../components/ui'
import { Plus, Edit2, Trash2, Eye, EyeOff, Megaphone, Trophy, Newspaper, Lightbulb } from 'lucide-react'

/* ── Table name map ── */
const TABLE = {
  announcements: 'announcements',
  awards:        'awards',
  news:          'news_posts',
  hackathon:     'hackathon_topics',
}

/* ── Per-tab default forms ── */
const DEFAULTS = {
  announcements: { title:'', content:'', type:'info', is_active:true, pinned:false, expires_at:'' },
  awards:        { title:'', description:'', icon:'🏆', color:'#f59e0b', awarded_to:'', award_date:new Date().toISOString().split('T')[0], is_active:true },
  news:          { title:'', content:'', image_url:'', category:'update', is_published:false },
  hackathon:     { title:'', description:'', difficulty:'medium', tags:'', is_active:true },
}

const TABS = [
  { id:'announcements', label:'Announcements', icon:<Megaphone size={14}/> },
  { id:'awards',        label:'Awards',        icon:<Trophy size={14}/> },
  { id:'news',          label:'News Posts',    icon:<Newspaper size={14}/> },
  { id:'hackathon',     label:'Hackathon',     icon:<Lightbulb size={14}/> },
]

/* ── Fields that must never be sent to Supabase ── */
const JOIN_FIELDS = [
  'awarded_to_user','recipient','created_at','updated_at',
  'employee','project','requester'
]

export default function AdminContentPage() {
  const { profile } = useAuth()
  const [tab,       setTab]     = useState('announcements')
  const [rows,      setRows]    = useState([])
  const [users,     setUsers]   = useState([])
  const [loading,   setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing] = useState(null)
  const [form,      setForm]    = useState({})
  const [saving,    setSaving]  = useState(false)
  const [err,       setErr]     = useState('')

  useEffect(() => { loadRows() }, [tab])

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,role').order('full_name')
      .then(({ data }) => setUsers(data || []))
  }, [])

  /* ── Load rows for current tab ── */
  async function loadRows() {
    setLoading(true); setErr('')
    const table = TABLE[tab]
    // Use plain select — no join aliases that may cause issues
    let q = supabase.from(table).select('*').order('created_at', { ascending: false })
    // For awards join recipient separately
    if (tab === 'awards') {
      q = supabase.from(table)
        .select('*, awarded_to_user:profiles!awarded_to(full_name)')
        .order('created_at', { ascending: false })
    }
    const { data, error } = await q
    if (error) { setErr('Load error: ' + error.message); setRows([]) }
    else setRows(data || [])
    setLoading(false)
  }

  /* ── Build clean payload ── */
  function buildPayload(isNew) {
    const raw = { ...form }

    // Handle hackathon tags: string → array
    if (tab === 'hackathon' && typeof raw.tags === 'string') {
      raw.tags = raw.tags.split(',').map(t => t.trim()).filter(Boolean)
    }

    // Set published_at for news
    if (tab === 'news' && raw.is_published && !raw.published_at) {
      raw.published_at = new Date().toISOString()
    }

    // Strip join alias fields and DB-managed fields
    const strip = isNew ? ['id', ...JOIN_FIELDS] : ['id', 'created_by', ...JOIN_FIELDS]
    strip.forEach(k => delete raw[k])

    // Empty string → null
    Object.keys(raw).forEach(k => {
      if (raw[k] === '') raw[k] = null
    })

    if (isNew) raw.created_by = profile.id

    return raw
  }

  /* ── Save (insert or update) ── */
  async function handleSave() {
    setErr('')
    if (!form.title?.trim()) { setErr('Title is required'); return }
    setSaving(true)
    try {
      const table = TABLE[tab]
      const payload = buildPayload(!editing)

      let error
      if (editing) {
        ;({ error } = await supabase.from(table).update(payload).eq('id', editing.id))
      } else {
        ;({ error } = await supabase.from(table).insert(payload))
      }

      if (error) throw new Error(error.message)
      setShowModal(false); setEditing(null); setForm({})
      loadRows()
    } catch (e) {
      setErr('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ── Toggle active/published ── */
  async function handleToggle(item) {
    const table = TABLE[tab]
    const field = tab === 'news' ? 'is_published' : 'is_active'
    const val   = !item[field]
    const update = { [field]: val }
    if (tab === 'news' && val && !item.published_at) {
      update.published_at = new Date().toISOString()
    }
    const { error } = await supabase.from(table).update(update).eq('id', item.id)
    if (error) setErr(error.message); else loadRows()
  }

  /* ── Delete ── */
  async function handleDelete(id) {
    if (!window.confirm('Delete this item?')) return
    const { error } = await supabase.from(TABLE[tab]).delete().eq('id', id)
    if (error) setErr(error.message); else loadRows()
  }

  /* ── Open create ── */
  function openCreate() {
    setEditing(null); setErr('')
    setForm({ ...DEFAULTS[tab] })
    setShowModal(true)
  }

  /* ── Open edit ── */
  function openEdit(item) {
    setEditing(item); setErr('')
    const f = { ...item }
    // tags array → string for editing
    if (tab === 'hackathon' && Array.isArray(f.tags)) f.tags = f.tags.join(', ')
    setForm(f)
    setShowModal(true)
  }

  const isActive = item => tab === 'news' ? item.is_published : item.is_active
  const addLabel = tab === 'hackathon' ? 'Topic' : tab === 'news' ? 'News Post' : tab === 'awards' ? 'Award' : 'Announcement'

  /* ════ RENDER ════════════════════════════════════════════ */
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Landing Page Content</div>
          <div className="page-subtitle">Manage announcements, awards, news and hackathon topics shown on the public landing page</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14}/> Add {addLabel}
        </button>
      </div>

      {err && <div className="alert alert-danger" style={{ marginBottom:14 }}>{err}</div>}

      {/* ── Tab bar ── */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', border:'none', background:'transparent', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit',
              color: tab===t.id ? 'var(--c1)' : 'var(--text-muted)',
              borderBottom: tab===t.id ? '2px solid var(--c1)' : '2px solid transparent',
              marginBottom: -1, transition:'all .15s' }}>
            {t.icon} {t.label}
            <span style={{ padding:'1px 7px', borderRadius:99, fontSize:10, fontWeight:700, background: tab===t.id ? 'var(--c1-soft)' : 'var(--bg-3)', color: tab===t.id ? 'var(--c1)' : 'var(--text-muted)' }}>
              {rows.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Data table ── */}
      {loading ? <Loader/> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                {tab==='announcements' && <><th>Type</th><th>Pinned</th></>}
                {tab==='awards'        && <><th>Recipient</th><th>Date</th></>}
                {tab==='news'          && <><th>Category</th><th>Image</th></>}
                {tab==='hackathon'     && <><th>Difficulty</th><th>Tags</th></>}
                <th>Status</th>
                <th>Created</th>
                <th style={{ width:100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={8} style={{ padding:0 }}>
                    <Empty icon="📝" title={`No ${addLabel}s yet`} desc={`Click "Add ${addLabel}" to create the first one`}/>
                  </td></tr>
                : rows.map(item => (
                  <tr key={item.id}>
                    <td className="td-bold" style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</td>

                    {tab==='announcements' && <>
                      <td><span className="badge badge-info" style={{ fontSize:10, textTransform:'capitalize' }}>{item.type}</span></td>
                      <td style={{ fontSize:16 }}>{item.pinned ? '📌' : ''}</td>
                    </>}

                    {tab==='awards' && <>
                      <td style={{ fontSize:13 }}>{item.awarded_to_user?.full_name || <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Unassigned</span>}</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{dateFmt(item.award_date)}</td>
                    </>}

                    {tab==='news' && <>
                      <td><span className="badge badge-teal" style={{ fontSize:10, textTransform:'capitalize' }}>{item.category}</span></td>
                      <td style={{ fontSize:16 }}>{item.image_url ? '🖼️' : ''}</td>
                    </>}

                    {tab==='hackathon' && <>
                      <td>
                        <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
                          background: item.difficulty==='hard'||item.difficulty==='expert' ? '#fee2e2' : item.difficulty==='medium' ? '#fef3c7' : '#dcfce7',
                          color:      item.difficulty==='hard'||item.difficulty==='expert' ? '#b91c1c' : item.difficulty==='medium' ? '#92400e' : '#15803d' }}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td style={{ fontSize:11, color:'var(--text-muted)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '—'}
                      </td>
                    </>}

                    <td>
                      <span style={{ padding:'2px 10px', borderRadius:4, fontSize:10, fontWeight:700, textTransform:'uppercase',
                        background: isActive(item) ? '#dcfce7' : '#f1f5f9',
                        color:      isActive(item) ? '#15803d' : '#64748b' }}>
                        {isActive(item) ? (tab==='news' ? 'Published' : 'Active') : (tab==='news' ? 'Draft' : 'Hidden')}
                      </span>
                    </td>

                    <td style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{dateFmt(item.created_at)}</td>

                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title={isActive(item)?'Hide':'Show'} onClick={() => handleToggle(item)}>
                          {isActive(item) ? <EyeOff size={13}/> : <Eye size={13}/>}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)}>
                          <Edit2 size={13}/>
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color:'var(--rose)' }} onClick={() => handleDelete(item.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ════ MODAL ════ */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); setErr('') }}
        title={`${editing ? 'Edit' : 'Add'} ${addLabel}`} size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={() => { setShowModal(false); setEditing(null) }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
          </button>
        </>}>

        {err && <div className="alert alert-danger" style={{ marginBottom:14 }}>{err}</div>}

        {/* ── Announcements ── */}
        {tab === 'announcements' && <>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Announcement title" required/>
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea className="form-textarea" style={{ minHeight:100 }} value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Write the announcement body…" required/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type||'info'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {['info','success','warning','event'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expires At (optional)</label>
              <input className="form-input" type="datetime-local" value={form.expires_at||''} onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{ accentColor:'var(--c1)', width:14, height:14 }}/>
              Active (visible on landing)
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <input type="checkbox" checked={!!form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} style={{ accentColor:'var(--c1)', width:14, height:14 }}/>
              📌 Pinned (show first)
            </label>
          </div>
        </>}

        {/* ── Awards ── */}
        {tab === 'awards' && <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Award Title *</label>
              <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Employee of the Month" required/>
            </div>
            <div className="form-group">
              <label className="form-label">Icon (emoji)</label>
              <input className="form-input" value={form.icon||'🏆'} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} maxLength={4} style={{ fontSize:22, textAlign:'center' }}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What this award is for…"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Award To (Employee)</label>
              <select className="form-select" value={form.awarded_to||''} onChange={e=>setForm(f=>({...f,awarded_to:e.target.value||null}))}>
                <option value="">Not yet assigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Award Date</label>
              <input className="form-input" type="date" value={form.award_date||''} onChange={e=>setForm(f=>({...f,award_date:e.target.value}))}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Accent Color</label>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <input type="color" value={form.color||'#f59e0b'} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{ height:38, width:60, border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', padding:2 }}/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)' }}>{form.color||'#f59e0b'}</span>
              </div>
            </div>
            <div className="form-group" style={{ display:'flex', alignItems:'flex-end', paddingBottom:6 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{ accentColor:'var(--c1)', width:14, height:14 }}/>
                Show on landing page
              </label>
            </div>
          </div>
        </>}

        {/* ── News ── */}
        {tab === 'news' && <>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="News post headline" required/>
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea className="form-textarea" style={{ minHeight:120 }} value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Write the full news post…" required/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Image URL (optional)</label>
              <input className="form-input" value={form.image_url||''} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))} placeholder="https://example.com/image.jpg"/>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category||'update'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {['update','event','milestone','product','general'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {form.image_url && (
            <img src={form.image_url} alt="preview" style={{ width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8, marginBottom:10, border:'1px solid var(--border)' }} onError={e=>e.target.style.display='none'}/>
          )}
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <input type="checkbox" checked={!!form.is_published} onChange={e=>setForm(f=>({...f,is_published:e.target.checked,published_at:e.target.checked?new Date().toISOString():null}))} style={{ accentColor:'var(--c1)', width:14, height:14 }}/>
            Publish now (visible on landing page)
          </label>
        </>}

        {/* ── Hackathon ── */}
        {tab === 'hackathon' && <>
          <div className="form-group">
            <label className="form-label">Topic Title *</label>
            <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. AI-powered expense categorisation" required/>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the challenge and what participants should build…"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select className="form-select" value={form.difficulty||'medium'} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
                {[['easy','🟢 Easy'],['medium','🟡 Medium'],['hard','🔴 Hard'],['expert','🟣 Expert']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={typeof form.tags==='string' ? form.tags : (form.tags||[]).join(', ')} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="AI, Finance, React"/>
            </div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{ accentColor:'var(--c1)', width:14, height:14 }}/>
            Active (show on landing page)
          </label>
        </>}
      </Modal>
    </div>
  )
}
