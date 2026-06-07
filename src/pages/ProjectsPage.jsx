import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, rupee, dateFmt } from '../lib/supabase'
import { Modal, Loader, Empty, Confirm, SearchBox } from '../components/ui'
import {
  Plus, Edit2, Trash2, FolderOpen, Eye, ArrowLeft,
  Target, Users, DollarSign, Calendar, CheckCircle,
  Clock, TrendingUp, Flag, ChevronRight
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'

const STATUSES  = ['active','on_hold','completed','cancelled']
const STATUS_C  = { active:'#10b981', on_hold:'#f59e0b', completed:'#6366f1', cancelled:'#ef4444' }
const MS_STATUS = ['pending','in_progress','completed','delayed']
const MS_COLORS = { pending:'#94a3b8', in_progress:'#f59e0b', completed:'#10b981', delayed:'#ef4444' }
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PIE_CLR   = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6']

const initProj = () => ({ name:'', description:'', budget:'', start_date:'', end_date:'', status:'active' })
const initMS   = () => ({ title:'', description:'', start_date:'', due_date:'', actual_start:'', actual_end:'', budget:'', status:'pending' })

export default function ProjectsPage() {
  const { profile } = useAuth()
  const role    = profile?.role || 'employee'
  const canEdit = ['admin','ceo','manager','finance','department_head'].includes(role)

  /* ─ list state ─ */
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(initProj())
  const [delProj,   setDelProj]   = useState(null)

  /* ─ detail state ─ */
  const [detail,    setDetail]    = useState(null)   // selected project object
  const [detailData,setDetailData]= useState(null)   // { expenses, timelogs, members, milestones }
  const [detailLoad,setDetailLoad]= useState(false)

  /* ─ milestone state ─ */
  const [showMS,    setShowMS]    = useState(false)
  const [editMS,    setEditMS]    = useState(null)
  const [msForm,    setMsForm]    = useState(initMS())
  const [delMS,     setDelMS]     = useState(null)
  const [subMS,     setSubMS]     = useState(false)

  useEffect(() => { loadList() }, [])

  /* ═══ LIST ═══════════════════════════════════════════════ */
  async function loadList() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending:false })
    setProjects(data || [])
    setLoading(false)
  }

  async function saveProject(e) {
    e.preventDefault()
    try {
      const p = { name:form.name, description:form.description||null, budget:parseFloat(form.budget)||0,
                  start_date:form.start_date||null, end_date:form.end_date||null, status:form.status }
      if (editing) await supabase.from('projects').update(p).eq('id',editing.id)
      else { const code='PRJ-'+Date.now().toString().slice(-6); await supabase.from('projects').insert({...p,code,created_by:profile.id}) }
      setShowModal(false); loadList()
      if (detail?.id === editing?.id) openDetail({ ...detail, ...p })
    } catch(e) { alert(e.message) }
  }

  /* ═══ DETAIL ═════════════════════════════════════════════ */
  async function openDetail(proj) {
    setDetail(proj); setDetailLoad(true); setDetailData(null)
    const [expRes, logRes, msRes] = await Promise.all([
      supabase.from('expense_requests').select('amount,total_amount,status,expense_date,category,requester:profiles!requested_by(full_name)').eq('project_id', proj.id),
      supabase.from('time_logs').select('hours_worked,work_date,employee:profiles!employee_id(full_name,role)').eq('project_id', proj.id),
      supabase.from('project_milestones').select('*').eq('project_id', proj.id).order('due_date'),
    ])
    setDetailData({
      expenses:   expRes.data || [],
      timelogs:   logRes.data || [],
      milestones: msRes.data || [],
    })
    setDetailLoad(false)
  }

  /* ═══ MILESTONES ══════════════════════════════════════════ */
  async function saveMS(e) {
    e.preventDefault(); setSubMS(true)
    try {
      const p = { title:msForm.title, description:msForm.description||null,
                  start_date:msForm.start_date||null, due_date:msForm.due_date||null,
                  actual_start:msForm.actual_start||null, actual_end:msForm.actual_end||null,
                  budget:parseFloat(msForm.budget)||0,
                  status:msForm.status, project_id:detail.id }
      if (editMS) await supabase.from('project_milestones').update(p).eq('id',editMS.id)
      else await supabase.from('project_milestones').insert({ ...p, created_by:profile.id })
      setShowMS(false); setEditMS(null); setMsForm(initMS()); openDetail(detail)
    } catch(e) { alert(e.message) }
    finally { setSubMS(false) }
  }

  async function deleteMS(id) {
    await supabase.from('project_milestones').delete().eq('id', id)
    setDelMS(null); openDetail(detail)
  }

  /* ═══ COMPUTED ════════════════════════════════════════════ */
  const filtered = projects.filter(p => !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()))

  function buildExpenseChart(expenses) {
    const map = {}
    expenses.forEach(e => {
      const m = MONTHS[new Date(e.expense_date || e.created_at).getMonth()]
      map[m] = (map[m]||0) + (e.total_amount || e.amount || 0)
    })
    return MONTHS.map(m => ({ month:m, amount: map[m]||0 }))
  }

  function buildResourceMatrix(timelogs) {
    const map = {}
    timelogs.forEach(l => {
      const name = l.employee?.full_name || 'Unknown'
      map[name] = (map[name]||0) + (l.hours_worked||0)
    })
    return Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours*10)/10 }))
      .sort((a,b) => b.hours - a.hours)
  }

  function buildCategoryPie(expenses) {
    const map = {}
    expenses.forEach(e => { map[e.category||'Other'] = (map[e.category||'Other']||0) + (e.total_amount||e.amount||0) })
    return Object.entries(map).map(([name,value]) => ({ name, value })).slice(0,6)
  }

  /* ═══ RENDER — DETAIL VIEW ════════════════════════════════ */
  if (detail) {
    const proj    = detail
    const data    = detailData
    const pct     = proj.budget>0 ? Math.min(100,Math.round((proj.spent/proj.budget)*100)) : 0
    const over    = proj.spent > proj.budget
    const sc      = STATUS_C[proj.status] || '#6366f1'
    const expChart= data ? buildExpenseChart(data.expenses) : []
    const resMatrix=data ? buildResourceMatrix(data.timelogs) : []
    const catPie  = data ? buildCategoryPie(data.expenses) : []
    const totalExp= data ? data.expenses.reduce((s,e)=>s+(e.total_amount||e.amount||0),0) : 0
    const totalHrs= data ? data.timelogs.reduce((s,l)=>s+(l.hours_worked||0),0) : 0
    const msTotal = data ? data.milestones.reduce((s,m)=>s+(m.budget||0),0) : 0
    const msDone  = data ? data.milestones.filter(m=>m.status==='completed').length : 0

    return (
      <div>
        {/* Back + header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <ArrowLeft size={15} /> All Projects
          </button>
          <ChevronRight size={14} style={{ color:'#94a3b8' }} />
          <span style={{ fontWeight:700, fontSize:16 }}>{proj.name}</span>
          <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:`${sc}15`, color:sc, textTransform:'capitalize', marginLeft:4 }}>{proj.status}</span>
          {canEdit && (
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setEditing(proj); setForm({ name:proj.name, description:proj.description||'', budget:proj.budget||'', start_date:proj.start_date||'', end_date:proj.end_date||'', status:proj.status }); setShowModal(true) }}>
                <Edit2 size={13} /> Edit Project
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditMS(null); setMsForm(initMS()); setShowMS(true) }}>
                <Plus size={13} /> Add Milestone
              </button>
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { l:'Total Budget',  v:rupee(proj.budget),       c:'#6366f1', icon:<DollarSign size={16}/> },
            { l:'Total Spent',   v:rupee(proj.spent||0),     c:'#f59e0b', icon:<TrendingUp size={16}/> },
            { l:'Remaining',     v:rupee((proj.budget||0)-(proj.spent||0)), c:over?'#ef4444':'#10b981', icon:<Target size={16}/> },
            { l:'Expense Total', v:rupee(totalExp),          c:'#ec4899', icon:<DollarSign size={16}/> },
            { l:'Hours Logged',  v:`${Math.round(totalHrs)}h`, c:'#3b82f6', icon:<Clock size={16}/> },
            { l:'Milestones',    v:data ? `${msDone}/${data.milestones.length}` : '—', c:'#8b5cf6', icon:<Flag size={16}/> },
          ].map(s=>(
            <div key={s.l} style={{ background:'#fff', borderRadius:14, padding:'14px 16px', border:`1.5px solid ${s.c}20`, borderTop:`4px solid ${s.c}` }}>
              <div style={{ color:s.c, marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.c, lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Budget bar */}
        <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13, fontWeight:600 }}>
            <span>Budget Utilization</span>
            <span style={{ color: over?'#ef4444':'#10b981' }}>{pct}% used{over?' ⚠ OVER BUDGET':''}</span>
          </div>
          <div style={{ height:10, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: over?'#ef4444':pct>75?'#f59e0b':'#10b981', borderRadius:99, transition:'width .3s' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginTop:6 }}>
            <span>Spent: {rupee(proj.spent||0)}</span>
            <span>Milestone alloc: {rupee(msTotal)}</span>
            <span>Budget: {rupee(proj.budget)}</span>
          </div>
        </div>

        {detailLoad ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}><div className="spinner" /></div>
        ) : data && (
          <>
            {/* Charts row */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:20 }}>
              {/* Expense by month */}
              <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14 }}>
                  💰 Monthly Expense Spend
                </div>
                <div style={{ padding:'16px 20px' }}>
                  {expChart.every(d=>d.amount===0) ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>No expenses linked yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={expChart}>
                        <defs>
                          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v=>[rupee(v),'Expenses']} contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid #e2e8f0' }} />
                        <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#expGrad)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Category pie */}
              <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14 }}>
                  📊 Spend by Category
                </div>
                <div style={{ padding:'16px 20px' }}>
                  {catPie.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8', fontSize:13 }}>No data</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={catPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                            {catPie.map((_,i)=><Cell key={i} fill={PIE_CLR[i%PIE_CLR.length]}/>)}
                          </Pie>
                          <Tooltip formatter={v=>[rupee(v)]} contentStyle={{ borderRadius:10, fontSize:11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:4 }}>
                        {catPie.map((d,i)=>(
                          <div key={d.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:8, height:8, borderRadius:2, background:PIE_CLR[i%PIE_CLR.length] }}/>
                              <span style={{ color:'#475569' }}>{d.name}</span>
                            </div>
                            <span style={{ fontWeight:700, color:PIE_CLR[i%PIE_CLR.length] }}>{rupee(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Resource utilization matrix */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14 }}>
                👥 Resource Utilization Matrix
              </div>
              {resMatrix.length === 0 ? (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'#94a3b8' }}>No time logs for this project yet</div>
              ) : (
                <div style={{ padding:'16px 20px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:16 }}>
                    {resMatrix.map((r,i)=>{
                      const maxHrs = resMatrix[0]?.hours || 1
                      const pct = Math.round((r.hours/maxHrs)*100)
                      return (
                        <div key={r.name} style={{ padding:'12px 14px', borderRadius:12, background:`${PIE_CLR[i%PIE_CLR.length]}08`, border:`1.5px solid ${PIE_CLR[i%PIE_CLR.length]}20` }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontWeight:700, fontSize:13 }}>{r.name.split(' ')[0]}</span>
                            <span style={{ fontWeight:800, fontSize:14, color:PIE_CLR[i%PIE_CLR.length] }}>{r.hours}h</span>
                          </div>
                          <div style={{ height:6, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:PIE_CLR[i%PIE_CLR.length], borderRadius:99 }}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={resMatrix.slice(0,8)} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize:10 }} tickFormatter={v=>v.split(' ')[0]} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${v}h`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={v=>[`${v} hours`,'Hours Worked']} contentStyle={{ borderRadius:10, fontSize:12 }} />
                      <Bar dataKey="hours" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Milestones */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:14 }}>🏁 Milestones ({data.milestones.length})</span>
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditMS(null); setMsForm(initMS()); setShowMS(true) }}>
                    <Plus size={13} /> Add Milestone
                  </button>
                )}
              </div>
              {data.milestones.length === 0 ? (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏁</div>
                  No milestones yet — add one to track project progress
                </div>
              ) : (
                <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                  {data.milestones.map((ms,i)=>{
                    const mc = MS_COLORS[ms.status] || '#94a3b8'
                    return (
                      <div key={ms.id} style={{ display:'flex', gap:14, padding:'14px 16px', borderRadius:12, border:`1.5px solid ${mc}25`, background:`${mc}06`, position:'relative' }}>
                        {/* Timeline dot */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                          <div style={{ width:14, height:14, borderRadius:'50%', background:mc, border:`2px solid #fff`, boxShadow:`0 0 0 2px ${mc}` }}/>
                          {i < data.milestones.length-1 && <div style={{ width:2, flex:1, background:`${mc}30`, marginTop:4 }}/>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                            <div>
                              <div style={{ fontWeight:700, fontSize:14 }}>{ms.title}</div>
                              {ms.description && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{ms.description}</div>}
                              <div style={{ display:'flex', gap:12, marginTop:6, fontSize:12, flexWrap:'wrap' }}>
                                {ms.start_date && <span style={{ color:'#64748b', display:'flex', alignItems:'center', gap:4 }}>📅 {dateFmt(ms.start_date)}</span>}{ms.due_date && <span style={{ color:'#64748b', display:'flex', alignItems:'center', gap:4 }}>🏁 {dateFmt(ms.due_date)}</span>}{ms.actual_start && <span style={{ color:'#10b981', fontSize:11 }}>✓ Started {dateFmt(ms.actual_start)}</span>}{ms.actual_end && <span style={{ color:'#6366f1', fontSize:11 }}>✓ Done {dateFmt(ms.actual_end)}</span>}
                                {ms.budget > 0 && <span style={{ color:'#6366f1', fontWeight:700 }}>₹{ms.budget.toLocaleString('en-IN')}</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                              <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:`${mc}15`, color:mc, textTransform:'capitalize' }}>{ms.status?.replace('_',' ')}</span>
                              {canEdit && <>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditMS(ms); setMsForm({ title:ms.title, description:ms.description||'', start_date:ms.start_date||'', due_date:ms.due_date||'', actual_start:ms.actual_start||'', actual_end:ms.actual_end||'', budget:ms.budget||'', status:ms.status||'pending' }); setShowMS(true) }}><Edit2 size={12}/></button>
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color:'#ef4444' }} onClick={() => setDelMS(ms.id)}><Trash2 size={12}/></button>
                              </>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Expense list */}
            {data.expenses.length > 0 && (
              <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e2e8f0', overflow:'hidden', marginTop:20 }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14 }}>🧾 Linked Expenses ({data.expenses.length})</div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Requester</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Category</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Amount</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Status</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Date</th>
                  </tr></thead>
                  <tbody>
                    {data.expenses.slice(0,10).map((e,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600 }}>{e.requester?.full_name||'—'}</td>
                        <td style={{ padding:'10px 16px' }}><span style={{ padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:700, background:'#dbeafe', color:'#1d4ed8' }}>{e.category}</span></td>
                        <td style={{ padding:'10px 16px', fontWeight:700 }}>{rupee(e.total_amount||e.amount)}</td>
                        <td style={{ padding:'10px 16px' }}><span style={{ padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:700, background:e.status==='approved'?'#dcfce7':e.status==='rejected'?'#fee2e2':'#fef3c7', color:e.status==='approved'?'#15803d':e.status==='rejected'?'#dc2626':'#b45309', textTransform:'capitalize' }}>{e.status}</span></td>
                        <td style={{ padding:'10px 16px', fontSize:12, color:'#64748b' }}>{dateFmt(e.expense_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Edit Project Modal */}
        <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'New Project'}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveProject}>{editing ? 'Update' : 'Create'}</button>
          </>}>
          <ProjectForm form={form} setForm={setForm} />
        </Modal>

        {/* Milestone Modal */}
        <Modal open={showMS} onClose={() => setShowMS(false)} title={editMS ? 'Edit Milestone' : 'Add Milestone'} size="lg"
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowMS(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveMS} disabled={subMS}>{subMS ? 'Saving…' : editMS ? 'Update' : 'Add Milestone'}</button>
          </>}>
          <div className="form-group">
            <label className="form-label">Milestone Title *</label>
            <input className="form-input" value={msForm.title} onChange={e=>setMsForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Phase 1 Complete" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Planned Start Date</label>
              <input className="form-input" type="date" value={msForm.start_date} onChange={e=>setMsForm(f=>({...f,start_date:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Planned End / Due Date</label>
              <input className="form-input" type="date" value={msForm.due_date} onChange={e=>setMsForm(f=>({...f,due_date:e.target.value}))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Actual Start Date</label>
              <input className="form-input" type="date" value={msForm.actual_start} onChange={e=>setMsForm(f=>({...f,actual_start:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Actual End Date</label>
              <input className="form-input" type="date" value={msForm.actual_end} onChange={e=>setMsForm(f=>({...f,actual_end:e.target.value}))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Budget Allocated (₹)</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#64748b', fontWeight:700 }}>₹</span>
                <input className="form-input" type="number" value={msForm.budget} onChange={e=>setMsForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={{ paddingLeft:24 }} />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {MS_STATUS.map(s=>{
                const mc = MS_COLORS[s]
                return (
                  <button key={s} type="button" onClick={()=>setMsForm(f=>({...f,status:s}))}
                    style={{ padding:'8px 4px', borderRadius:10, border:`2px solid ${msForm.status===s?mc:'#e2e8f0'}`, background:msForm.status===s?`${mc}15`:'#fff', color:msForm.status===s?mc:'#475569', fontWeight:700, fontSize:11, cursor:'pointer', textAlign:'center', textTransform:'capitalize' }}>
                    {s.replace('_',' ')}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={msForm.description} onChange={e=>setMsForm(f=>({...f,description:e.target.value}))} placeholder="What needs to be done for this milestone?" />
          </div>
          {detail && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:12 }}>
              <span style={{ fontWeight:700, color:'#15803d' }}>Project: </span>
              <span style={{ color:'#15803d' }}>{detail.name}</span>
              {msForm.budget > 0 && <span style={{ color:'#15803d', marginLeft:10 }}>• Allocating {rupee(parseFloat(msForm.budget)||0)}</span>}
            </div>
          )}
        </Modal>

        <Confirm open={!!delMS} message="Delete this milestone?" danger onConfirm={()=>deleteMS(delMS)} onCancel={()=>setDelMS(null)} />
      </div>
    )
  }

  /* ═══ RENDER — LIST VIEW ══════════════════════════════════ */
  const CARD_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6']
  if (loading) return <Loader />

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Project Management</div><div className="page-subtitle">ThingsaliveWork — Track projects, budgets and milestones</div></div>
        {canEdit && <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initProj()); setShowModal(true) }}><Plus size={15}/> New Project</button>}
      </div>

      <div className="stats-grid" style={{ marginBottom:20 }}>
        {[
          { l:'Total',    v:projects.length,                                     c:'#6366f1' },
          { l:'Active',   v:projects.filter(p=>p.status==='active').length,      c:'#10b981' },
          { l:'Budget',   v:rupee(projects.reduce((s,p)=>s+(p.budget||0),0)),   c:'#3b82f6' },
          { l:'Spent',    v:rupee(projects.reduce((s,p)=>s+(p.spent||0),0)),    c:'#f59e0b' },
          { l:'Remaining',v:rupee(projects.reduce((s,p)=>s+(p.budget||0)-(p.spent||0),0)), c:'#8b5cf6' },
        ].map(s=>(
          <div key={s.l} className="stat-card" style={{ borderTopColor:s.c }}>
            <div className="stat-value" style={{ fontSize:18, color:s.c }}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16 }}><SearchBox value={search} onChange={setSearch} placeholder="Search projects…" /></div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {filtered.length === 0 ? <div style={{ gridColumn:'1/-1' }}><Empty icon="📁" title="No projects" desc="Create your first project" /></div>
        : filtered.map((p,idx)=>{
          const color = CARD_COLORS[idx%CARD_COLORS.length]
          const pct = p.budget>0 ? Math.min(100,Math.round((p.spent/p.budget)*100)) : 0
          const over = p.spent > p.budget
          const sc = STATUS_C[p.status] || '#6366f1'
          return (
            <div key={p.id} style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.04)', cursor:'pointer', transition:'all .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.1)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.04)'}}>
              <div style={{ height:5, background:`linear-gradient(90deg,${color},${color}88)` }} />
              <div style={{ padding:'18px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:`${color}12`, display:'flex', alignItems:'center', justifyContent:'center', color }}>
                    <FolderOpen size={20}/>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:`${sc}15`, color:sc, textTransform:'capitalize' }}>{p.status}</span>
                    {canEdit && <>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={e=>{e.stopPropagation();setEditing(p);setForm({name:p.name,description:p.description||'',budget:p.budget||'',start_date:p.start_date||'',end_date:p.end_date||'',status:p.status});setShowModal(true)}} title="Edit"><Edit2 size={12}/></button>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{color:'#ef4444'}} onClick={e=>{e.stopPropagation();setDelProj(p.id)}} title="Delete"><Trash2 size={12}/></button>
                    </>}
                  </div>
                </div>
                <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>{p.name}</div>
                {p.code && <div style={{ fontFamily:'monospace', fontSize:11, color:'#94a3b8', marginBottom:6 }}>{p.code}</div>}
                {p.description && <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</div>}
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'#94a3b8' }}>Budget used</span>
                    <span style={{ fontWeight:700, color:over?'#ef4444':color }}>{pct}%{over?' ⚠':''}</span>
                  </div>
                  <div style={{ height:6, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:over?'#ef4444':pct>75?'#f59e0b':color, borderRadius:99 }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4, color:'#94a3b8' }}>
                    <span>{rupee(p.spent||0)} spent</span><span>{rupee(p.budget)} budget</span>
                  </div>
                </div>
                {(p.start_date||p.end_date) && (
                  <div style={{ fontSize:11, color:'#94a3b8', borderTop:'1px solid #f1f5f9', paddingTop:10, display:'flex', gap:12, marginBottom:10 }}>
                    {p.start_date && <span>📅 {dateFmt(p.start_date)}</span>}
                    {p.end_date && <span>🏁 {dateFmt(p.end_date)}</span>}
                  </div>
                )}
                {/* View Detail button */}
                <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', borderColor:`${color}30`, color }} onClick={()=>openDetail(p)}>
                  <Eye size={13}/> View Details & Milestones
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'New Project'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveProject}>{editing ? 'Update' : 'Create Project'}</button>
        </>}>
        <ProjectForm form={form} setForm={setForm} />
      </Modal>

      <Confirm open={!!delProj} message="Delete this project? All linked expenses will remain but will lose project association." danger
        onConfirm={async()=>{ await supabase.from('projects').delete().eq('id',delProj); setDelProj(null); loadList() }}
        onCancel={()=>setDelProj(null)} />
    </div>
  )
}

function ProjectForm({ form, setForm }) {
  return (
    <>
      <div className="form-group"><label className="form-label">Project Name *</label>
        <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. ThingsaliveWork" required /></div>
      <div className="form-group"><label className="form-label">Status</label>
        <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
          {['active','on_hold','completed','cancelled'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1).replace('_',' ')}</option>)}
        </select></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Budget (₹)</label>
          <div style={{position:'relative'}}><span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#64748b',fontWeight:700}}>₹</span>
          <input className="form-input" type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={{paddingLeft:24}}/></div></div>
        <div className="form-group"><label className="form-label">Start Date</label>
          <input className="form-input" type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
      </div>
      <div className="form-group"><label className="form-label">End Date</label>
        <input className="form-input" type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></div>
      <div className="form-group"><label className="form-label">Description</label>
        <textarea className="form-textarea" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Project description and goals…"/></div>
    </>
  )
}
