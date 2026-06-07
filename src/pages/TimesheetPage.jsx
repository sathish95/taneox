import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, rupee, dateFmt } from '../lib/supabase'
import { Loader, Empty, Modal } from '../components/ui'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { Plus, Download, LogIn, LogOut, Edit2, Trash2 } from 'lucide-react'

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const todayStr = () => new Date().toISOString().split('T')[0]

function fmtTime(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}) }
  catch { return '—' }
}

function workingDays(start, end) {
  let days = 0
  const cur = new Date(start), endD = new Date(end)
  while (cur <= endD) { if (cur.getDay()!==0&&cur.getDay()!==6) days++; cur.setDate(cur.getDate()+1) }
  return days
}

function calcHpd(st, et) {
  if (!st||!et) return 0
  const [sh,sm]=st.split(':').map(Number), [eh,em]=et.split(':').map(Number)
  return Math.round(((eh*60+em)-(sh*60+sm))/60*100)/100
}

const initForm = () => ({
  user_id:'', start_date:todayStr(), end_date:todayStr(),
  start_time:'09:00', end_time:'18:00', project_id:'', comment:''
})

export default function TimesheetPage() {
  const { profile } = useAuth()
  const role  = profile?.role||'employee'
  const isMgr = ['admin','ceo','manager','hr','finance'].includes(role)

  const [logs,     setLogs]    = useState([])
  const [users,    setUsers]   = useState([])
  const [projects, setProjects]= useState([])
  const [rates,    setRates]   = useState([])
  const [loading,  setLoading] = useState(true)
  const [selUser,  setSelUser] = useState('')
  const [dateRange, setDateRange] = useState(()=>{
    const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0')
    return { from:`${y}-${m}-01`, to:new Date(y,d.getMonth()+1,0).toISOString().split('T')[0] }
  })
  const [showAdd,  setShowAdd] = useState(false)
  const [editing,  setEditing] = useState(null)
  const [form,     setForm]    = useState(initForm())
  const [saving,   setSaving]  = useState(false)
  const [err,      setErr]     = useState('')

  useEffect(() => { if (!isMgr) setSelUser(profile?.id||'') }, [profile?.id])
  useEffect(() => { loadAll() }, [selUser, dateRange])

  async function loadAll() {
    setLoading(true)
    const start = dateRange.from
    const end   = dateRange.to
    const uid   = isMgr ? (selUser||undefined) : profile?.id

    let q = supabase.from('time_logs')
      .select('*, employee:profiles!employee_id(id,full_name,role), project:projects(id,name,code)')
      .gte('work_date',start).lte('work_date',end)
      .order('work_date',{ascending:false}).order('check_in',{ascending:false})
    if (uid) q = q.eq('employee_id',uid)

    const [lR,uR,pR,rR] = await Promise.all([
      q,
      isMgr ? supabase.from('profiles').select('id,full_name,role').order('full_name') : Promise.resolve({data:[]}),
      supabase.from('projects').select('id,name,code').eq('status','active').order('name'),
      supabase.from('resource_rates').select('employee_id,monthly_salary,hourly_rate'),
    ])
    setLogs(lR.data||[]); setUsers(uR.data||[])
    setProjects(pR.data||[]); setRates(rR.data||[])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault(); setErr('')
    const uid = isMgr ? form.user_id : profile?.id
    if (!uid)             { setErr('Please select an employee'); return }
    if (!form.start_date) { setErr('Start date is required'); return }
    if (!form.end_date)   { setErr('End date is required'); return }
    if (!form.start_time) { setErr('Start time is required'); return }
    if (!form.end_time)   { setErr('End time is required'); return }
    const hpd = calcHpd(form.start_time, form.end_time)
    if (hpd<=0) { setErr('End time must be after start time'); return }
    if (new Date(form.end_date)<new Date(form.start_date)) { setErr('End date must be on or after start date'); return }
    setSaving(true)
    try {
      if (editing) {
        const ds = form.start_date
        const {error} = await supabase.from('time_logs').update({
          employee_id:uid, project_id:form.project_id||null,
          work_date:ds, check_in:`${ds}T${form.start_time}:00`,
          check_out:`${ds}T${form.end_time}:00`, hours_worked:hpd,
          comment:form.comment||null,
        }).eq('id',editing.id)
        if (error) throw new Error(error.message)
      } else {
        const rows=[], cur=new Date(form.start_date), endD=new Date(form.end_date)
        while (cur<=endD) {
          if (cur.getDay()!==0&&cur.getDay()!==6) {
            const ds=cur.toISOString().split('T')[0]
            rows.push({employee_id:uid,project_id:form.project_id||null,
              work_date:ds,check_in:`${ds}T${form.start_time}:00`,
              check_out:`${ds}T${form.end_time}:00`,hours_worked:hpd,comment:form.comment||null})
          }
          cur.setDate(cur.getDate()+1)
        }
        if (!rows.length) throw new Error('No working days in range (weekends excluded)')
        const {error} = await supabase.from('time_logs').insert(rows)
        if (error) throw new Error(error.message)
      }
      setShowAdd(false); setEditing(null); setForm(initForm()); loadAll()
    } catch(e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteEntry(id) {
    if (!window.confirm('Delete this entry?')) return
    await supabase.from('time_logs').delete().eq('id',id); loadAll()
  }

  function openEdit(log) {
    const ds = log.work_date||log.check_in?.split('T')[0]||todayStr()
    setEditing(log)
    setForm({ user_id:log.employee_id, start_date:ds, end_date:ds,
      start_time:fmtTime(log.check_in), end_time:fmtTime(log.check_out),
      project_id:log.project_id||'', comment:log.comment||'' })
    setErr(''); setShowAdd(true)
  }

  function getRate(uid) { return rates.find(r=>r.employee_id===uid) }

  const totalHours = logs.reduce((s,l)=>s+(l.hours_worked||0),0)
  const byUser = {}
  logs.forEach(l=>{
    const uid=l.employee_id, name=l.employee?.full_name||'?'
    if (!byUser[uid]) byUser[uid]={name,role:l.employee?.role,hours:0,days:new Set()}
    byUser[uid].hours += l.hours_worked||0
    if (l.work_date) byUser[uid].days.add(l.work_date)
  })

  function exportCSV() {
    const rows=[['Date','Employee','Project','Hours','Check In','Check Out','Work Done']]
    logs.forEach(l=>rows.push([l.work_date,l.employee?.full_name||'',l.project?.name||'',
      l.hours_worked||'',fmtTime(l.check_in),fmtTime(l.check_out),l.comment||'']))
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download=`timesheet-${dateRange.from}-to-${dateRange.to}.csv`; a.click()
  }

  /* Live preview */
  const hpd   = calcHpd(form.start_time, form.end_time)
  const days  = (form.start_date&&form.end_date&&form.end_date>=form.start_date)
                  ? workingDays(form.start_date, form.end_date) : 0
  const total = Math.round(hpd*days*100)/100

  if (loading) return <Loader/>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Timesheet</div>
          <div className="page-subtitle">Manual time entries — same data as check-in/check-out</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={13}/> Export CSV</button>
          <button className="btn btn-primary" onClick={()=>{setEditing(null);setForm(initForm());setErr('');setShowAdd(true)}}><Plus size={14}/> Add Entry</button>
        </div>
      </div>

      {/* Filters + stats */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        {isMgr && (
          <select className="form-select" value={selUser} onChange={e=>setSelUser(e.target.value)} style={{width:'auto'}}>
            <option value="">All Users</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
          </select>
        )}
        <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} label="Pick date range"/>
        <div style={{marginLeft:'auto',display:'flex',gap:20}}>
          {[{l:'Total Hours',v:`${totalHours.toFixed(1)}h`,c:'var(--c1)'},
            {l:'Entries',v:logs.length,c:'var(--emerald)'}].map(s=>(
            <div key={s.l} style={{textAlign:'right'}}>
              <div style={{fontWeight:800,fontSize:20,color:s.c,fontFamily:'var(--font-mono)'}}>{s.v}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager user cards */}
      {isMgr && Object.keys(byUser).length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:20}}>
          {Object.entries(byUser).map(([uid,u])=>{
            const r=getRate(uid), hr=r?(r.hourly_rate||r.monthly_salary/(22*8)):null
            return (
              <div key={uid} className="card" style={{padding:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{u.name}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <div style={{padding:'8px',borderRadius:8,background:'var(--surface-2)',textAlign:'center'}}>
                    <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:18,color:'var(--c1)'}}>{u.hours.toFixed(1)}h</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>Hours</div>
                  </div>
                  <div style={{padding:'8px',borderRadius:8,background:'var(--surface-2)',textAlign:'center'}}>
                    <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:18,color:'var(--emerald)'}}>{u.days.size}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>Days</div>
                  </div>
                </div>
                {hr && <div style={{padding:'8px 10px',borderRadius:8,background:'#f0fdf4',border:'1px solid #bbf7d0',fontSize:12,fontWeight:600,color:'#15803d'}}>
                  💰 Est: {rupee(Math.round(u.hours*hr))} @ ₹{hr.toFixed(0)}/hr
                </div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Log table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <span style={{fontWeight:700,fontSize:14}}>{dateRange.from} → {dateRange.to} — Time Logs</span>
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>{logs.length} entries · {totalHours.toFixed(1)}h</span>
        </div>
        {logs.length===0 ? <Empty icon="⏱" title="No entries" desc={`No logs for ${dateRange.from} – ${dateRange.to}`}/> : (
          <table>
            <thead><tr>
              <th>Date</th>
              {isMgr&&<th>Employee</th>}
              <th>Project</th>
              <th>Check In</th><th>Check Out</th><th>Hours</th><th>Work Done</th>
              <th style={{width:80}}>Actions</th>
            </tr></thead>
            <tbody>
              {logs.map(l=>(
                <tr key={l.id}>
                  <td style={{fontWeight:600,fontSize:13,whiteSpace:'nowrap'}}>{dateFmt(l.work_date)}</td>
                  {isMgr&&<td><div style={{fontWeight:600,fontSize:13}}>{l.employee?.full_name}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'capitalize'}}>{l.employee?.role}</div></td>}
                  <td>{l.project?<span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,background:'var(--c1-soft)',color:'var(--c1)'}}>{l.project.name}</span>:<span style={{color:'var(--text-muted)',fontSize:12}}>—</span>}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--emerald)',fontWeight:600}}>{fmtTime(l.check_in)}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:l.check_out?'var(--rose)':'var(--amber)'}}>
                    {l.check_out ? fmtTime(l.check_out) : '⏳ Active'}
                  </td>
                  <td><span style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:15,color:'var(--c1)'}}>{l.hours_worked!=null?`${l.hours_worked}h`:'—'}</span></td>
                  <td style={{fontSize:12,color:'var(--text-muted)',maxWidth:180,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.comment||'—'}</td>
                  <td><div style={{display:'flex',gap:4}}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(l)}><Edit2 size={12}/></button>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{color:'var(--rose)'}} onClick={()=>deleteEntry(l.id)}><Trash2 size={12}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditing(null);setErr('')}}
        title={editing?'Edit Time Entry':'Add Timesheet Entry'} size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setEditing(null)}}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?'Saving…':editing?'Update Entry':days>1?`Add ${days} Entries`:'Add Entry'}
          </button>
        </>}>

        {err && <div className="alert alert-danger" style={{marginBottom:12}}>{err}</div>}

        {/* Employee (managers only) */}
        {isMgr && (
          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select className="form-select" value={form.user_id} onChange={e=>setForm(f=>({...f,user_id:e.target.value}))} required>
              <option value="">Select employee…</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
        )}

        {/* ── Date range ── */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date *</label>
            <input className="form-input" type="date" value={form.start_date}
              onChange={e=>setForm(f=>({...f,start_date:e.target.value,end_date:f.end_date<e.target.value?e.target.value:f.end_date}))}
              required/>
          </div>
          <div className="form-group">
            <label className="form-label">End Date *{editing&&<span style={{color:'var(--text-muted)',fontSize:10,fontWeight:400}}> (single day when editing)</span>}</label>
            <input className="form-input" type="date" value={form.end_date}
              min={form.start_date}
              onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}
              disabled={!!editing}
              required/>
          </div>
        </div>

        {/* ── Time range ── */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Time *</label>
            <input className="form-input" type="time" value={form.start_time}
              onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} required/>
          </div>
          <div className="form-group">
            <label className="form-label">End Time *</label>
            <input className="form-input" type="time" value={form.end_time}
              onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} required/>
          </div>
        </div>

        {/* ── Live preview ── */}
        {form.start_time && form.end_time && (
          hpd<=0
            ? <div className="alert alert-danger" style={{marginBottom:12}}>⚠ End time must be after start time</div>
            : <div style={{padding:'12px 16px',borderRadius:10,background:'var(--c1-soft)',border:'1px solid rgba(59,130,246,.2)',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:editing?'1fr 1fr':'1fr 1fr 1fr',gap:10,marginBottom:days>1?8:0}}>
                  {[
                    {l:'Per Day',    v:`${hpd}h`,   c:'var(--c1)'},
                    ...(!editing?[{l:'Working Days',v:days,         c:'var(--violet)'}]:[]),
                    {l:'Total Hours',v:`${editing?hpd:total}h`,c:'var(--emerald)'},
                  ].map(s=>(
                    <div key={s.l} style={{padding:'10px 8px',borderRadius:8,background:'var(--surface)',textAlign:'center',border:'1px solid var(--border)'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:22,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {!editing && days>1 && <div style={{fontSize:10,color:'var(--text-muted)',textAlign:'center'}}>Creates {days} separate log entries — weekends excluded</div>}
              </div>
        )}

        {/* Project */}
        <div className="form-group">
          <label className="form-label">Project</label>
          <select className="form-select" value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
            <option value="">No project</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>

        {/* Work description */}
        <div className="form-group">
          <label className="form-label">What did you work on?</label>
          <textarea className="form-textarea" value={form.comment}
            onChange={e=>setForm(f=>({...f,comment:e.target.value}))}
            placeholder="Brief description of work done…" style={{minHeight:70}}/>
        </div>

        {/* Pay estimate */}
        {hpd>0 && (() => {
          const uid  = isMgr ? form.user_id : profile?.id
          const r    = uid ? getRate(uid) : null
          if (!r) return null
          const hr   = r.hourly_rate||(r.monthly_salary/(22*8))
          const pay  = Math.round((editing?hpd:total)*hr)
          return (
            <div style={{padding:'8px 14px',borderRadius:8,background:'#f0fdf4',border:'1px solid #bbf7d0',fontSize:12,fontWeight:600,color:'#15803d'}}>
              💰 Estimated pay: {rupee(pay)} ({editing?hpd:total}h @ ₹{hr.toFixed(0)}/hr)
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
