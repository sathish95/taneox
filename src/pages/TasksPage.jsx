import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, dateFmt, rupee } from '../lib/supabase'
import { Modal, Loader, Empty, Confirm, SearchBox } from '../components/ui'
import {
  Plus, Edit2, Trash2, LayoutGrid, List, BarChart2, Users,
  Flag, Clock, X, ChevronRight, ChevronDown, Target, Zap,
  Play, Check, AlertTriangle, Filter, Eye, UserPlus, RefreshCw
} from 'lucide-react'

/* ─── Constants ─────────────────────────────────────────── */
const STATUSES     = ['backlog','todo','in_progress','qa','ready_for_demo','closed']
const SL           = { backlog:'Backlog', todo:'To Do', in_progress:'In Progress', qa:'QA Testing', ready_for_demo:'Ready for Demo', closed:'Closed' }
const SC           = { backlog:'#64748b', todo:'#3b82f6', in_progress:'#f59e0b', qa:'#8b5cf6', ready_for_demo:'#10b981', closed:'#94a3b8' }
const PC           = { critical:'#e11d48', high:'#f59e0b', medium:'#3b82f6', low:'#10b981' }
const PI           = { critical:'🔴', high:'🟠', medium:'🔵', low:'🟢' }
const PRIOS        = ['critical','high','medium','low']
const STORY_ST     = ['open','in_progress','done','cancelled']
const SPRINT_ST    = ['planning','active','completed']

/* ─── Helpers ───────────────────────────────────────────── */
const Pill = ({label,color,bg}) => (
  <span style={{padding:'2px 9px',borderRadius:4,fontSize:10,fontWeight:700,
    background:bg||`${color}18`,color,border:`1px solid ${color}28`,
    textTransform:'capitalize',whiteSpace:'nowrap'}}>
    {label?.replace(/_/g,' ')}
  </span>
)
const Ava = ({name='?',size=24}) => {
  const i = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div title={name} style={{width:size,height:size,borderRadius:Math.round(size*.3),
      background:'linear-gradient(135deg,var(--c1),#8b5cf6)',
      display:'flex',alignItems:'center',justifyContent:'center',
      color:'#fff',fontSize:Math.round(size*.38),fontWeight:700,flexShrink:0}}>{i}</div>
  )
}
const Kpi = ({label,v,color='var(--c1)',sub}) => (
  <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,
    borderTop:`2px solid ${color}`,padding:'10px 14px'}}>
    <div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:20,color,lineHeight:1,marginBottom:3}}>{v}</div>
    <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
    {sub&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{sub}</div>}
  </div>
)
const ProgBar = ({pct,color='var(--c1)'}) => (
  <div style={{height:4,borderRadius:2,background:'var(--bg-3)',overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.min(100,pct||0)}%`,background:color,borderRadius:2,transition:'width .3s'}}/>
  </div>
)
const isOverdue = t => t.planned_end_date && new Date(t.planned_end_date)<new Date() && t.status!=='closed'

/* ─── Task Form ──────────────────────────────────────────── */
function TaskForm({form,setForm,projects,users,stories,sprints,projectId}) {
  return (
    <div style={{display:'grid',gap:14}}>
      {!projectId && <div className="form-group">
        <label className="form-label">Project *</label>
        <select className="form-select" value={form.project_id||''} onChange={e=>setForm(f=>({...f,project_id:e.target.value,user_story_id:'',sprint_id:''}))}>
          <option value="">Select project…</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>}
      <div className="form-group">
        <label className="form-label">Task Name *</label>
        <input className="form-input" value={form.task_name||''} onChange={e=>setForm(f=>({...f,task_name:e.target.value}))} placeholder="e.g. Build login API" required/>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Module</label>
          <input className="form-input" value={form.module_name||''} onChange={e=>setForm(f=>({...f,module_name:e.target.value}))} placeholder="e.g. Authentication"/>
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-select" value={form.priority||'medium'} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {PRIOS.map(p=><option key={p} value={p}>{PI[p]} {p}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <select className="form-select" value={form.assigned_to||''} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value||null}))}>
            <option value="">Unassigned</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status||'backlog'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            {STATUSES.map(s=><option key={s} value={s}>{SL[s]}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Planned Start</label>
          <input className="form-input" type="date" value={form.planned_start_date||''} onChange={e=>setForm(f=>({...f,planned_start_date:e.target.value}))}/>
        </div>
        <div className="form-group">
          <label className="form-label">Planned End</label>
          <input className="form-input" type="date" value={form.planned_end_date||''} onChange={e=>setForm(f=>({...f,planned_end_date:e.target.value}))}/>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Estimated Hours</label>
          <input className="form-input" type="number" step="0.5" value={form.estimated_hours||''} onChange={e=>setForm(f=>({...f,estimated_hours:e.target.value}))} placeholder="e.g. 8"/>
        </div>
        <div className="form-group">
          <label className="form-label">Actual Hours</label>
          <input className="form-input" type="number" step="0.5" value={form.actual_hours||''} onChange={e=>setForm(f=>({...f,actual_hours:e.target.value}))} placeholder="Logged so far"/>
        </div>
      </div>
      {stories.length>0 && <div className="form-group">
        <label className="form-label">User Story</label>
        <select className="form-select" value={form.user_story_id||''} onChange={e=>setForm(f=>({...f,user_story_id:e.target.value||null}))}>
          <option value="">No story</option>
          {stories.map(s=><option key={s.id} value={s.id}>[{s.story_id}] {s.title}</option>)}
        </select>
      </div>}
      {sprints.length>0 && <div className="form-group">
        <label className="form-label">Sprint</label>
        <select className="form-select" value={form.sprint_id||''} onChange={e=>setForm(f=>({...f,sprint_id:e.target.value||null}))}>
          <option value="">No sprint</option>
          {sprints.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </div>}
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-textarea" rows={3} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Task details, acceptance criteria…"/>
      </div>
    </div>
  )
}

/* ─── Story Form ─────────────────────────────────────────── */
function StoryForm({form,setForm,users,epics,sprints}) {
  return (
    <div style={{display:'grid',gap:14}}>
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input className="form-input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="As a user, I want to…" required/>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-select" value={form.priority||'medium'} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {PRIOS.map(p=><option key={p} value={p}>{PI[p]} {p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Story Points</label>
          <input className="form-input" type="number" min="0" value={form.story_points||0} onChange={e=>setForm(f=>({...f,story_points:parseInt(e.target.value)||0}))}/>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Assignee</label>
          <select className="form-select" value={form.assignee_id||''} onChange={e=>setForm(f=>({...f,assignee_id:e.target.value||null}))}>
            <option value="">Unassigned</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status||'open'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            {STORY_ST.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Epic</label>
          <select className="form-select" value={form.epic_id||''} onChange={e=>setForm(f=>({...f,epic_id:e.target.value||null}))}>
            <option value="">No epic</option>
            {epics.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Sprint</label>
          <select className="form-select" value={form.sprint_id||''} onChange={e=>setForm(f=>({...f,sprint_id:e.target.value||null}))}>
            <option value="">No sprint</option>
            {sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.start_date||''} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.end_date||''} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-textarea" rows={3} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Story details, acceptance criteria…"/>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function TasksPage() {
  const { profile } = useAuth()
  const role    = profile?.role || 'employee'
  const isMgr   = ['admin','ceo','manager','department_head','finance'].includes(role)
  const canEdit = isMgr || role === 'employee'

  /* Data */
  const [projects,  setProjects]  = useState([])
  const [tasks,     setTasks]     = useState([])
  const [stories,   setStories]   = useState([])
  const [sprints,   setSprints]   = useState([])
  const [epics,     setEpics]     = useState([])
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)

  /* Filters */
  const [selProj,   setSelProj]   = useState('')
  const [selSprint, setSelSprint] = useState('')
  const [selModule, setSelModule] = useState('')
  const [selAssign, setSelAssign] = useState('')
  const [selStatus, setSelStatus] = useState('')
  const [selPrio,   setSelPrio]   = useState('')
  const [search,    setSearch]    = useState('')
  const [view,      setView]      = useState('kanban') // kanban | list | stories | sprints | reports

  /* Task modal */
  const [showTask,  setShowTask]  = useState(false)
  const [editTask,  setEditTask]  = useState(null)
  const [taskForm,  setTaskForm]  = useState({})
  const [subTask,   setSubTask]   = useState(false)
  const [delTask,   setDelTask]   = useState(null)

  /* Story modal */
  const [showStory, setShowStory] = useState(false)
  const [editStory, setEditStory] = useState(null)
  const [storyForm, setStoryForm] = useState({})
  const [subStory,  setSubStory]  = useState(false)
  const [delStory,  setDelStory]  = useState(null)

  /* Sprint modal */
  const [showSprint,setShowSprint]= useState(false)
  const [editSprint,setEditSprint]= useState(null)
  const [sprintForm,setSprintForm]= useState({})

  /* Project assign modal */
  const [showAssign,setShowAssign]=useState(false)
  const [assignments,setAssignments]=useState([])
  const [newAssign, setNewAssign] = useState({user_id:'',role:'member'})

  useEffect(()=>{loadAll()},[profile?.id])

  async function loadAll() {
    setLoading(true)
    const [uR, pR] = await Promise.all([
      supabase.from('profiles').select('id,full_name,role').order('full_name'),
      isMgr
        ? supabase.from('projects').select('id,name,code,status').eq('status','active').order('name')
        : supabase.from('project_assignments').select('project:projects(id,name,code,status)').eq('user_id',profile.id)
    ])
    const us = uR.data||[]
    const ps = isMgr ? (pR.data||[]) : (pR.data||[]).map(r=>r.project).filter(Boolean)
    setUsers(us); setProjects(ps)

    if (ps.length>0) {
      const ids = ps.map(p=>p.id)
      const [tR,sR,spR,eR] = await Promise.all([
        supabase.from('project_tasks').select('*,assignee:profiles!assigned_to(id,full_name)').in('project_id',ids).order('created_at',{ascending:false}),
        supabase.from('user_stories').select('*,assignee:profiles!assignee_id(id,full_name)').in('project_id',ids).order('created_at',{ascending:false}),
        supabase.from('sprints').select('*').in('project_id',ids).order('created_at',{ascending:false}),
        supabase.from('epics').select('*').in('project_id',ids),
      ])
      setTasks(tR.data||[]); setStories(sR.data||[])
      setSprints(spR.data||[]); setEpics(eR.data||[])
    }
    setLoading(false)
  }

  /* ── Task save ── */
  async function saveTask(e) {
    e.preventDefault(); setSubTask(true)
    try {
      const p = {
        task_name:taskForm.task_name, description:taskForm.description||null,
        module_name:taskForm.module_name||null, priority:taskForm.priority||'medium',
        assigned_to:taskForm.assigned_to||null, status:taskForm.status||'backlog',
        planned_start_date:taskForm.planned_start_date||null, planned_end_date:taskForm.planned_end_date||null,
        estimated_hours:parseFloat(taskForm.estimated_hours)||null, actual_hours:parseFloat(taskForm.actual_hours)||null,
        user_story_id:taskForm.user_story_id||null, sprint_id:taskForm.sprint_id||null,
        project_id:taskForm.project_id||selProj||projects[0]?.id,
      }
      if (editTask) { await supabase.from('project_tasks').update(p).eq('id',editTask.id) }
      else          { await supabase.from('project_tasks').insert({...p,created_by:profile.id}) }
      setShowTask(false); setEditTask(null); loadAll()
    } catch(e){alert(e.message)} finally{setSubTask(false)}
  }

  /* ── Story save ── */
  async function saveStory(e) {
    e.preventDefault(); setSubStory(true)
    try {
      const p = {
        title:storyForm.title, description:storyForm.description||null,
        priority:storyForm.priority||'medium', status:storyForm.status||'open',
        story_points:parseInt(storyForm.story_points)||0, assignee_id:storyForm.assignee_id||null,
        epic_id:storyForm.epic_id||null, sprint_id:storyForm.sprint_id||null,
        start_date:storyForm.start_date||null, end_date:storyForm.end_date||null,
        project_id:storyForm.project_id||selProj||projects[0]?.id,
      }
      if (editStory) { await supabase.from('user_stories').update(p).eq('id',editStory.id) }
      else           { await supabase.from('user_stories').insert({...p,created_by:profile.id}) }
      setShowStory(false); setEditStory(null); loadAll()
    } catch(e){alert(e.message)} finally{setSubStory(false)}
  }

  /* ── Sprint save ── */
  async function saveSprint() {
    const p = { name:sprintForm.name, goal:sprintForm.goal||null,
      start_date:sprintForm.start_date||null, end_date:sprintForm.end_date||null,
      status:sprintForm.status||'planning',
      project_id:sprintForm.project_id||selProj||projects[0]?.id }
    if (editSprint) await supabase.from('sprints').update(p).eq('id',editSprint.id)
    else            await supabase.from('sprints').insert({...p,created_by:profile.id})
    setShowSprint(false); setEditSprint(null); loadAll()
  }

  /* ── Drag-drop status change ── */
  async function dropOnColumn(e, newStatus) {
    e.preventDefault()
    const tid = e.dataTransfer.getData('task_id')
    if (!tid) return
    await supabase.from('project_tasks').update({status:newStatus}).eq('id',tid)
    setTasks(prev => prev.map(t => t.id===tid ? {...t,status:newStatus} : t))
  }

  /* ── Inline status change ── */
  async function changeStatus(taskId, newStatus) {
    await supabase.from('project_tasks').update({status:newStatus}).eq('id',taskId)
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status:newStatus}:t))
  }

  /* ── Project assignments ── */
  async function loadAssignments(projId) {
    const {data} = await supabase.from('project_assignments')
      .select('*,user:profiles(id,full_name,role)').eq('project_id',projId)
    setAssignments(data||[])
  }
  async function addAssignment() {
    if (!newAssign.user_id||!selProj) return
    await supabase.from('project_assignments').upsert({project_id:selProj,user_id:newAssign.user_id,role:newAssign.role,assigned_by:profile.id})
    loadAssignments(selProj); setNewAssign({user_id:'',role:'member'})
  }
  async function removeAssignment(id) {
    await supabase.from('project_assignments').delete().eq('id',id)
    loadAssignments(selProj)
  }

  /* ── Computed ── */
  const projTasks   = useMemo(()=> tasks.filter(t=>{
    if (selProj   && t.project_id!==selProj)   return false
    if (selSprint && t.sprint_id!==selSprint)  return false
    if (selModule && t.module_name!==selModule) return false
    if (selAssign && t.assigned_to!==selAssign) return false
    if (selStatus && t.status!==selStatus)      return false
    if (selPrio   && t.priority!==selPrio)      return false
    if (search    && !t.task_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [tasks,selProj,selSprint,selModule,selAssign,selStatus,selPrio,search])

  const projStories = useMemo(()=> stories.filter(s=>!selProj||s.project_id===selProj),[stories,selProj])

  const modules = useMemo(()=>[...new Set(tasks.filter(t=>t.module_name).map(t=>t.module_name))],[tasks])

  const kpis = useMemo(()=>{
    const src = projTasks
    return {
      total:       src.length,
      backlog:     src.filter(t=>t.status==='backlog').length,
      todo:        src.filter(t=>t.status==='todo').length,
      inProgress:  src.filter(t=>t.status==='in_progress').length,
      qa:          src.filter(t=>t.status==='qa').length,
      demo:        src.filter(t=>t.status==='ready_for_demo').length,
      closed:      src.filter(t=>t.status==='closed').length,
      overdue:     src.filter(t=>isOverdue(t)).length,
      estHrs:      src.reduce((s,t)=>s+(t.estimated_hours||0),0),
      actHrs:      src.reduce((s,t)=>s+(t.actual_hours||0),0),
    }
  },[projTasks])

  const selProjData = projects.find(p=>p.id===selProj)
  const selSprintData = sprints.find(s=>s.id===selSprint)

  if (loading) return <Loader/>

  /* ── FILTER BAR ── */
  const FilterBar = () => (
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16,padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
      <Filter size={13} style={{color:'var(--text-muted)',flexShrink:0}}/>

      <select className="form-select" value={selProj} onChange={e=>{setSelProj(e.target.value);setSelSprint('')}} style={{width:'auto',fontSize:12}}>
        <option value="">All Projects</option>
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {sprints.filter(s=>!selProj||s.project_id===selProj).length>0 && (
        <select className="form-select" value={selSprint} onChange={e=>setSelSprint(e.target.value)} style={{width:'auto',fontSize:12}}>
          <option value="">All Sprints</option>
          {sprints.filter(s=>!selProj||s.project_id===selProj).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {modules.length>0 && <select className="form-select" value={selModule} onChange={e=>setSelModule(e.target.value)} style={{width:'auto',fontSize:12}}>
        <option value="">All Modules</option>
        {modules.map(m=><option key={m} value={m}>{m}</option>)}
      </select>}

      <select className="form-select" value={selAssign} onChange={e=>setSelAssign(e.target.value)} style={{width:'auto',fontSize:12}}>
        <option value="">All Assignees</option>
        {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
      </select>

      <select className="form-select" value={selStatus} onChange={e=>setSelStatus(e.target.value)} style={{width:'auto',fontSize:12}}>
        <option value="">All Statuses</option>
        {STATUSES.map(s=><option key={s} value={s}>{SL[s]}</option>)}
      </select>

      <select className="form-select" value={selPrio} onChange={e=>setSelPrio(e.target.value)} style={{width:'auto',fontSize:12}}>
        <option value="">All Priorities</option>
        {PRIOS.map(p=><option key={p} value={p}>{PI[p]} {p}</option>)}
      </select>

      <div style={{flex:1,minWidth:160}}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search tasks…"/>
      </div>

      {(selProj||selSprint||selModule||selAssign||selStatus||selPrio||search) && (
        <button className="btn btn-ghost btn-sm" onClick={()=>{setSelProj('');setSelSprint('');setSelModule('');setSelAssign('');setSelStatus('');setSelPrio('');setSearch('')}}>
          <X size={11}/> Clear
        </button>
      )}
    </div>
  )

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Task Management</div>
          <div className="page-subtitle">Jira-style board — {kpis.total} tasks · {projStories.length} stories</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {isMgr && selProj && (
            <button className="btn btn-outline btn-sm" onClick={()=>{loadAssignments(selProj);setShowAssign(true)}}>
              <UserPlus size={13}/> Manage Access
            </button>
          )}
          {isMgr && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{setEditSprint(null);setSprintForm({project_id:selProj||projects[0]?.id,name:'',goal:'',start_date:'',end_date:'',status:'planning'});setShowSprint(true)}}>
              <Zap size={13}/> New Sprint
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={()=>{setEditStory(null);setStoryForm({project_id:selProj||projects[0]?.id,priority:'medium',status:'open',story_points:0});setShowStory(true)}}>
            <Target size={13}/> New Story
          </button>
          <button className="btn btn-primary" onClick={()=>{setEditTask(null);setTaskForm({project_id:selProj||projects[0]?.id,priority:'medium',status:'backlog'});setShowTask(true)}}>
            <Plus size={14}/> New Task
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:10,marginBottom:16}}>
        <Kpi label="Total"        v={kpis.total}      color="#3b82f6"/>
        <Kpi label="Backlog"      v={kpis.backlog}    color="#64748b"/>
        <Kpi label="To Do"        v={kpis.todo}       color="#3b82f6"/>
        <Kpi label="In Progress"  v={kpis.inProgress} color="#f59e0b"/>
        <Kpi label="QA Testing"   v={kpis.qa}         color="#8b5cf6"/>
        <Kpi label="Ready/Demo"   v={kpis.demo}       color="#10b981"/>
        <Kpi label="Closed"       v={kpis.closed}     color="#94a3b8"/>
        <Kpi label="Overdue"      v={kpis.overdue}    color="#e11d48"/>
        <Kpi label="Est. Hours"   v={`${kpis.estHrs}h`} color="#14b8a6"/>
        <Kpi label="Actual Hours" v={`${kpis.actHrs}h`} color="#06b6d4"/>
      </div>

      {/* ── VIEW TABS ── */}
      <div style={{display:'flex',gap:5,marginBottom:16,borderBottom:'1px solid var(--border)',paddingBottom:0}}>
        {[
          {id:'kanban', icon:<LayoutGrid size={13}/>, l:'Kanban Board'},
          {id:'list',   icon:<List size={13}/>,       l:'List View'},
          {id:'stories',icon:<Target size={13}/>,     l:`Stories (${projStories.length})`},
          {id:'sprints',icon:<Zap size={13}/>,        l:`Sprints (${sprints.length})`},
          {id:'reports',icon:<BarChart2 size={13}/>,  l:'Reports'},
        ].map(t=>{
          const active = view===t.id
          return <button key={t.id} onClick={()=>setView(t.id)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:active?700:500,
              background:'transparent',color:active?'var(--c1)':'var(--text-muted)',
              borderBottom:`2px solid ${active?'var(--c1)':'transparent'}`,marginBottom:-1,transition:'all .15s'}}>
            {t.icon}{t.l}
          </button>
        })}
      </div>

      {/* ── FILTER BAR ── */}
      {view!=='reports' && <FilterBar/>}

      {/* ══ KANBAN BOARD ══════════════════════════════════════ */}
      {view==='kanban' && (
        <div style={{overflowX:'auto',paddingBottom:12}}>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${STATUSES.length},minmax(220px,1fr))`,gap:10,minWidth:1320}}>
            {STATUSES.map(status=>{
              const colTasks = projTasks.filter(t=>t.status===status)
              const colColor = SC[status]
              return (
                <div key={status}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>dropOnColumn(e,status)}
                  style={{background:`${colColor}06`,border:`1px solid ${colColor}20`,borderRadius:10,minHeight:300,display:'flex',flexDirection:'column'}}>

                  {/* Column header */}
                  <div style={{padding:'10px 14px',borderBottom:`1px solid ${colColor}20`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:colColor,flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:700,color:colColor}}>{SL[status]}</span>
                    <span style={{marginLeft:'auto',minWidth:20,height:20,borderRadius:4,background:`${colColor}20`,color:colColor,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{colTasks.length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{flex:1,padding:'8px',display:'flex',flexDirection:'column',gap:7,overflowY:'auto',maxHeight:620}}>
                    {colTasks.map(task=>(
                      <KanbanCard key={task.id} task={task} users={users}
                        onEdit={()=>{setEditTask(task);setTaskForm({...task,project_id:task.project_id});setShowTask(true)}}
                        onDelete={()=>setDelTask(task.id)}
                        onStatus={(s)=>changeStatus(task.id,s)}/>
                    ))}
                    {canEdit && (
                      <button onClick={()=>{setEditTask(null);setTaskForm({project_id:selProj||projects[0]?.id,status,priority:'medium'});setShowTask(true)}}
                        style={{width:'100%',padding:'8px',border:`1px dashed ${colColor}40`,borderRadius:7,background:'transparent',cursor:'pointer',fontSize:11,color:`${colColor}80`,fontFamily:'inherit',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${colColor}08`;e.currentTarget.style.borderColor=colColor}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor=`${colColor}40`}}>
                        + Add task
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ LIST VIEW ══════════════════════════════════════════ */}
      {view==='list' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task ID</th><th>Task Name</th><th>Module</th>
                <th>Project</th><th>Assignee</th><th>Priority</th>
                <th>Status</th><th>Planned End</th><th>Est.Hrs</th><th>Act.Hrs</th>
                {canEdit&&<th></th>}
              </tr>
            </thead>
            <tbody>
              {projTasks.length===0
                ? <tr><td colSpan={11} style={{padding:'30px',textAlign:'center',color:'var(--text-muted)'}}>No tasks found</td></tr>
                : projTasks.map(t=>{
                  const proj = projects.find(p=>p.id===t.project_id)
                  const overdue = isOverdue(t)
                  return (
                    <tr key={t.id} style={{background:overdue?'rgba(225,29,72,.03)':'transparent'}}>
                      <td><span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--c1)',fontWeight:700}}>{t.task_id||'—'}</span></td>
                      <td>
                        <div style={{fontWeight:600,fontSize:13,maxWidth:220}}>{t.task_name}</div>
                        {overdue&&<div style={{fontSize:10,color:'var(--rose)',marginTop:1}}>⚠ Overdue</div>}
                      </td>
                      <td><span style={{fontSize:11,color:'var(--text-muted)'}}>{t.module_name||'—'}</span></td>
                      <td><span style={{fontSize:11,color:'var(--text-muted)'}}>{proj?.name||'—'}</span></td>
                      <td>{t.assignee?<div style={{display:'flex',alignItems:'center',gap:6}}><Ava name={t.assignee.full_name} size={20}/><span style={{fontSize:11}}>{t.assignee.full_name.split(' ')[0]}</span></div>:<span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>}</td>
                      <td><span style={{fontSize:12,whiteSpace:'nowrap'}}>{PI[t.priority]} {t.priority}</span></td>
                      <td>
                        <select style={{background:`${SC[t.status]}12`,color:SC[t.status],border:`1px solid ${SC[t.status]}30`,borderRadius:5,padding:'3px 8px',fontSize:11,fontWeight:700,cursor:'pointer',outline:'none',fontFamily:'inherit'}}
                          value={t.status} onChange={e=>changeStatus(t.id,e.target.value)}>
                          {STATUSES.map(s=><option key={s} value={s}>{SL[s]}</option>)}
                        </select>
                      </td>
                      <td><span style={{fontSize:11,color:overdue?'var(--rose)':'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{dateFmt(t.planned_end_date)||'—'}</span></td>
                      <td><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{t.estimated_hours||'—'}</span></td>
                      <td><span style={{fontFamily:'var(--font-mono)',fontSize:11,color:t.actual_hours>t.estimated_hours?'var(--rose)':'var(--text)'}}>{t.actual_hours||'—'}</span></td>
                      {canEdit&&<td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>{setEditTask(t);setTaskForm({...t,project_id:t.project_id});setShowTask(true)}}><Edit2 size={11}/></button>
                          <button className="btn btn-ghost btn-sm btn-icon" style={{color:'var(--rose)'}} onClick={()=>setDelTask(t.id)}><Trash2 size={11}/></button>
                        </div>
                      </td>}
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ══ STORIES VIEW ════════════════════════════════════════ */}
      {view==='stories' && (
        <div>
          {projStories.length===0
            ? <Empty icon="📖" title="No user stories" desc="Create a story to group related tasks"/>
            : projStories.map(s=>{
              const stTasks = tasks.filter(t=>t.user_story_id===s.id)
              const done    = stTasks.filter(t=>t.status==='closed').length
              const pct     = stTasks.length>0 ? Math.round((done/stTasks.length)*100) : 0
              return (
                <div key={s.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:10,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--c1)',fontWeight:700,flexShrink:0}}>{s.story_id||'—'}</span>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{s.title}</div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        <Pill label={s.priority} color={PC[s.priority]}/>
                        <Pill label={s.status} color={s.status==='done'?'#10b981':s.status==='in_progress'?'#f59e0b':'#64748b'}/>
                        {s.story_points>0 && <span style={{fontSize:11,color:'var(--text-muted)'}}>⬡ {s.story_points}pts</span>}
                        {s.assignee && <span style={{fontSize:11,color:'var(--text-muted)'}}>👤 {s.assignee.full_name.split(' ')[0]}</span>}
                      </div>
                    </div>
                    <div style={{width:120}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-muted)',marginBottom:3}}>
                        <span>{done}/{stTasks.length} tasks</span><span>{pct}%</span>
                      </div>
                      <ProgBar pct={pct} color={pct===100?'var(--emerald)':'var(--c1)'}/>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>{setEditTask(null);setTaskForm({project_id:s.project_id,user_story_id:s.id,priority:'medium',status:'backlog'});setShowTask(true)}}><Plus size={11}/> Task</button>
                      {canEdit&&<><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>{setEditStory(s);setStoryForm({...s});setShowStory(true)}}><Edit2 size={11}/></button><button className="btn btn-ghost btn-sm btn-icon" style={{color:'var(--rose)'}} onClick={()=>setDelStory(s.id)}><Trash2 size={11}/></button></>}
                    </div>
                  </div>
                  {stTasks.length>0 && (
                    <div style={{borderTop:'1px solid var(--border)',padding:'8px 16px',display:'flex',gap:6,flexWrap:'wrap'}}>
                      {stTasks.slice(0,6).map(t=>(
                        <span key={t.id} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:5,fontSize:11,background:`${SC[t.status]}12`,color:SC[t.status],border:`1px solid ${SC[t.status]}25`,cursor:'pointer'}}
                          onClick={()=>{setEditTask(t);setTaskForm({...t});setShowTask(true)}}>
                          {t.task_id} · {t.task_name.slice(0,20)}{t.task_name.length>20?'…':''}
                        </span>
                      ))}
                      {stTasks.length>6 && <span style={{fontSize:11,color:'var(--text-muted)'}}>+{stTasks.length-6} more</span>}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}

      {/* ══ SPRINTS VIEW ════════════════════════════════════════ */}
      {view==='sprints' && (
        <div>
          {sprints.filter(s=>!selProj||s.project_id===selProj).length===0
            ? <Empty icon="⚡" title="No sprints" desc="Create a sprint to organise tasks into time-boxed iterations"/>
            : sprints.filter(s=>!selProj||s.project_id===selProj).map(s=>{
              const spTasks  = tasks.filter(t=>t.sprint_id===s.id)
              const spStories= stories.filter(st=>st.sprint_id===s.id)
              const pts      = spStories.reduce((sum,st)=>sum+(st.story_points||0),0)
              const doneStories = spStories.filter(st=>st.status==='done')
              const doneVel  = doneStories.reduce((sum,st)=>sum+(st.story_points||0),0)
              const pct      = spTasks.length>0?Math.round((spTasks.filter(t=>t.status==='closed').length/spTasks.length)*100):0
              const sclr     = {planning:'#64748b',active:'#f59e0b',completed:'#10b981'}[s.status]
              return (
                <div key={s.id} style={{background:'var(--surface)',border:`1px solid ${sclr}25`,borderLeft:`3px solid ${sclr}`,borderRadius:10,marginBottom:10,padding:'14px 18px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontWeight:700,fontSize:14}}>{s.name}</span>
                        <Pill label={s.status} color={sclr}/>
                      </div>
                      {s.goal && <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{s.goal}</div>}
                      <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                        {s.start_date&&<span>📅 {dateFmt(s.start_date)}</span>}
                        {s.end_date&&<span>🏁 {dateFmt(s.end_date)}</span>}
                        <span>📋 {spTasks.length} tasks</span>
                        <span>📖 {spStories.length} stories · {pts} pts</span>
                      </div>
                    </div>
                    <div style={{width:140}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-muted)',marginBottom:4}}>
                        <span>Progress</span><span>{pct}%</span>
                      </div>
                      <ProgBar pct={pct} color={sclr}/>
                      {pts>0&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>Velocity: {doneVel}/{pts} pts</div>}
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      {isMgr&&s.status==='planning'&&<button className="btn btn-primary btn-sm" onClick={async()=>{await supabase.from('sprints').update({status:'active'}).eq('id',s.id);loadAll()}}>▶ Start</button>}
                      {isMgr&&s.status==='active'&&<button className="btn btn-ghost btn-sm" onClick={async()=>{await supabase.from('sprints').update({status:'completed'}).eq('id',s.id);loadAll()}}>✓ Complete</button>}
                      {isMgr&&<><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>{setEditSprint(s);setSprintForm({...s});setShowSprint(true)}}><Edit2 size={11}/></button></>}
                    </div>
                  </div>
                  {spTasks.length>0&&(
                    <div style={{marginTop:12,display:'flex',gap:5,flexWrap:'wrap'}}>
                      {STATUSES.map(st=>{
                        const n=spTasks.filter(t=>t.status===st).length
                        return n>0?<span key={st} style={{padding:'3px 9px',borderRadius:4,fontSize:10,fontWeight:700,background:`${SC[st]}12`,color:SC[st],border:`1px solid ${SC[st]}25`}}>{SL[st]}: {n}</span>:null
                      })}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}

      {/* ══ REPORTS VIEW ════════════════════════════════════════ */}
      {view==='reports' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Project progress */}
          <div className="card">
            <div className="card-header"><span className="card-title">📊 Project Progress</span></div>
            {projects.length===0
              ? <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)'}}>No projects</div>
              : projects.map(p=>{
                const pt   = tasks.filter(t=>t.project_id===p.id)
                const done = pt.filter(t=>t.status==='closed').length
                const pct  = pt.length>0?Math.round((done/pt.length)*100):0
                return (
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{width:160,fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                    <span style={{width:80,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)'}}>{done}/{pt.length} tasks</span>
                    <div style={{flex:1}}><ProgBar pct={pct} color={pct===100?'var(--emerald)':pct>60?'var(--c1)':'var(--amber)'}/></div>
                    <span style={{width:36,fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--text)',textAlign:'right'}}>{pct}%</span>
                  </div>
                )
              })
            }
          </div>

          {/* Resource utilization */}
          <div className="card">
            <div className="card-header"><span className="card-title">👥 Resource Utilization</span></div>
            {users.filter(u=>tasks.some(t=>t.assigned_to===u.id)).map(u=>{
              const ut     = tasks.filter(t=>t.assigned_to===u.id)
              const closed = ut.filter(t=>t.status==='closed').length
              const open   = ut.filter(t=>t.status!=='closed'&&t.status!=='backlog').length
              const hrs    = ut.reduce((s,t)=>s+(t.actual_hours||0),0)
              return (
                <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,width:160,flexShrink:0}}>
                    <Ava name={u.full_name} size={26}/>
                    <div><div style={{fontSize:12,fontWeight:600}}>{u.full_name}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'capitalize'}}>{u.role}</div></div>
                  </div>
                  <div style={{display:'flex',gap:14,flex:1,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--text-muted)'}}>Total: <strong style={{color:'var(--text)'}}>{ut.length}</strong></span>
                    <span style={{fontSize:12,color:'var(--emerald)'}}>Done: <strong>{closed}</strong></span>
                    <span style={{fontSize:12,color:'var(--amber)'}}>Active: <strong>{open}</strong></span>
                    <span style={{fontSize:12,color:'var(--c1)'}}>Hours: <strong style={{fontFamily:'var(--font-mono)'}}>{hrs}h</strong></span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sprint report */}
          {sprints.length>0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">⚡ Sprint Report</span></div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Sprint</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Project</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Tasks</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Planned Pts</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Done Pts</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Velocity</th>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Status</th>
                </tr></thead>
                <tbody>
                  {sprints.map(s=>{
                    const pt=tasks.filter(t=>t.sprint_id===s.id).length
                    const sts=stories.filter(st=>st.sprint_id===s.id)
                    const planned=sts.reduce((a,b)=>a+(b.story_points||0),0)
                    const done=sts.filter(st=>st.status==='done').reduce((a,b)=>a+(b.story_points||0),0)
                    const vel=planned>0?Math.round((done/planned)*100):0
                    return <tr key={s.id}>
                      <td style={{padding:'9px 12px',fontWeight:600,fontSize:12}}>{s.name}</td>
                      <td style={{padding:'9px 12px',fontSize:12,color:'var(--text-muted)'}}>{projects.find(p=>p.id===s.project_id)?.name||'—'}</td>
                      <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{pt}</td>
                      <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{planned}</td>
                      <td style={{padding:'9px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--emerald)'}}>{done}</td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:60}}><ProgBar pct={vel} color={vel>80?'var(--emerald)':vel>50?'var(--amber)':'var(--rose)'}/></div>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{vel}%</span>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px'}}><Pill label={s.status} color={{planning:'#64748b',active:'#f59e0b',completed:'#10b981'}[s.status]}/></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════ */}

      {/* Task modal */}
      <Modal open={showTask} onClose={()=>{setShowTask(false);setEditTask(null)}}
        title={editTask?`Edit Task — ${editTask.task_id}`:'New Task'} size="lg"
        footer={<><button className="btn btn-ghost" onClick={()=>{setShowTask(false);setEditTask(null)}}>Cancel</button><button className="btn btn-primary" onClick={saveTask} disabled={subTask}>{subTask?'Saving…':'Save Task'}</button></>}>
        <TaskForm form={taskForm} setForm={setTaskForm} projects={projects} users={users}
          stories={stories.filter(s=>!taskForm.project_id||s.project_id===taskForm.project_id)}
          sprints={sprints.filter(s=>!taskForm.project_id||s.project_id===taskForm.project_id)}
          projectId={selProj}/>
      </Modal>

      {/* Story modal */}
      <Modal open={showStory} onClose={()=>{setShowStory(false);setEditStory(null)}}
        title={editStory?`Edit Story — ${editStory.story_id}`:'New User Story'} size="lg"
        footer={<><button className="btn btn-ghost" onClick={()=>{setShowStory(false);setEditStory(null)}}>Cancel</button><button className="btn btn-primary" onClick={saveStory} disabled={subStory}>{subStory?'Saving…':'Save Story'}</button></>}>
        <StoryForm form={storyForm} setForm={setStoryForm} users={users}
          epics={epics.filter(e=>!storyForm.project_id||e.project_id===storyForm.project_id)}
          sprints={sprints.filter(s=>!storyForm.project_id||s.project_id===storyForm.project_id)}/>
      </Modal>

      {/* Sprint modal */}
      <Modal open={showSprint} onClose={()=>setShowSprint(false)} title={editSprint?'Edit Sprint':'New Sprint'} size="md"
        footer={<><button className="btn btn-ghost" onClick={()=>setShowSprint(false)}>Cancel</button><button className="btn btn-primary" onClick={saveSprint}>Save Sprint</button></>}>
        <div style={{display:'grid',gap:14}}>
          <div className="form-group"><label className="form-label">Sprint Name *</label><input className="form-input" value={sprintForm.name||''} onChange={e=>setSprintForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Sprint 1 — Auth Module" required/></div>
          <div className="form-group"><label className="form-label">Sprint Goal</label><textarea className="form-textarea" rows={2} value={sprintForm.goal||''} onChange={e=>setSprintForm(f=>({...f,goal:e.target.value}))} placeholder="What we aim to deliver…"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={sprintForm.start_date||''} onChange={e=>setSprintForm(f=>({...f,start_date:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={sprintForm.end_date||''} onChange={e=>setSprintForm(f=>({...f,end_date:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={sprintForm.status||'planning'} onChange={e=>setSprintForm(f=>({...f,status:e.target.value}))}>
                {SPRINT_ST.map(s=><option key={s} value={s}>{s}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Project</label>
              <select className="form-select" value={sprintForm.project_id||''} onChange={e=>setSprintForm(f=>({...f,project_id:e.target.value}))}>
                <option value="">Select…</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>
        </div>
      </Modal>

      {/* Project access modal */}
      <Modal open={showAssign} onClose={()=>setShowAssign(false)}
        title={`Manage Access — ${selProjData?.name||''}`} size="lg"
        footer={<><button className="btn btn-primary" onClick={()=>setShowAssign(false)}>Done</button></>}>
        <div style={{marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:10,color:'var(--text-muted)'}}>CURRENT MEMBERS</div>
          {assignments.length===0
            ? <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic',marginBottom:12}}>No members assigned yet</div>
            : assignments.map(a=>(
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <Ava name={a.user?.full_name||'?'} size={28}/>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{a.user?.full_name}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'capitalize'}}>{a.user?.role}</div></div>
                <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,background:'var(--c1-soft)',color:'var(--c1)',fontWeight:600}}>{a.role}</span>
                <button className="btn btn-ghost btn-sm btn-icon" style={{color:'var(--rose)'}} onClick={()=>removeAssignment(a.id)}><Trash2 size={11}/></button>
              </div>
            ))
          }
        </div>
        <div style={{padding:'14px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:10}}>ADD MEMBER</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Employee</label>
              <select className="form-select" value={newAssign.user_id} onChange={e=>setNewAssign(a=>({...a,user_id:e.target.value}))}>
                <option value="">Select…</option>
                {users.filter(u=>!assignments.some(a=>a.user_id===u.id)).map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-select" value={newAssign.role} onChange={e=>setNewAssign(a=>({...a,role:e.target.value}))}>
                {['member','lead','viewer'].map(r=><option key={r} value={r}>{r}</option>)}
              </select></div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addAssignment} disabled={!newAssign.user_id}><Plus size={12}/> Add Member</button>
        </div>
      </Modal>

      {/* Confirms */}
      <Confirm open={!!delTask} message="Delete this task?" danger
        onConfirm={async()=>{await supabase.from('project_tasks').delete().eq('id',delTask);setDelTask(null);loadAll()}}
        onCancel={()=>setDelTask(null)}/>
      <Confirm open={!!delStory} message="Delete this user story? Tasks linked to it will remain." danger
        onConfirm={async()=>{await supabase.from('user_stories').delete().eq('id',delStory);setDelStory(null);loadAll()}}
        onCancel={()=>setDelStory(null)}/>
    </div>
  )
}

/* ─── Kanban Card ────────────────────────────────────────── */
function KanbanCard({task, users, onEdit, onDelete, onStatus}) {
  const [dragging, setDragging] = useState(false)
  const assignee = users.find(u=>u.id===task.assigned_to)
  const overdue  = isOverdue(task)

  return (
    <div draggable
      onDragStart={e=>{setDragging(true);e.dataTransfer.setData('task_id',task.id)}}
      onDragEnd={()=>setDragging(false)}
      style={{background:'var(--surface)',border:`1px solid ${overdue?'rgba(225,29,72,.3)':'var(--border)'}`,
        borderRadius:8,padding:'10px 12px',cursor:'grab',opacity:dragging?.7:1,
        boxShadow:dragging?'0 4px 16px rgba(0,0,0,.15)':'var(--shadow-sm)',
        transition:'all .15s',borderLeft:`3px solid ${SC[task.status]}`}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow-sm)'}>

      {/* Header row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--c1)',fontWeight:700}}>{task.task_id||''}</span>
        <div style={{display:'flex',gap:3}}>
          <button style={{background:'none',border:'none',cursor:'pointer',padding:2,opacity:.5,color:'var(--text)'}} onClick={onEdit}><Edit2 size={11}/></button>
          <button style={{background:'none',border:'none',cursor:'pointer',padding:2,opacity:.5,color:'var(--rose)'}} onClick={onDelete}><Trash2 size={11}/></button>
        </div>
      </div>

      {/* Task name */}
      <div style={{fontSize:12,fontWeight:600,marginBottom:6,lineHeight:1.4,color:'var(--text)'}}>{task.task_name}</div>

      {/* Tags */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
        <span style={{fontSize:10,whiteSpace:'nowrap'}}>{PI[task.priority]} {task.priority}</span>
        {task.module_name && <span style={{padding:'1px 6px',borderRadius:3,fontSize:10,background:'var(--bg-3)',color:'var(--text-muted)'}}>{task.module_name}</span>}
        {overdue && <span style={{padding:'1px 6px',borderRadius:3,fontSize:10,background:'rgba(225,29,72,.1)',color:'var(--rose)',fontWeight:700}}>OVERDUE</span>}
      </div>

      {/* Footer */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {assignee && <Ava name={assignee.full_name} size={20}/>}
          {task.estimated_hours && <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{task.estimated_hours}h</span>}
        </div>
        {task.planned_end_date && (
          <span style={{fontSize:10,color:overdue?'var(--rose)':'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{dateFmt(task.planned_end_date)}</span>
        )}
      </div>

      {/* Quick status move */}
      <div style={{marginTop:8,display:'flex',gap:3}}>
        {STATUSES.filter(s=>s!==task.status).slice(0,3).map(s=>(
          <button key={s} onClick={()=>onStatus(s)}
            style={{flex:1,padding:'3px 4px',border:`1px solid ${SC[s]}30`,borderRadius:4,background:`${SC[s]}08`,cursor:'pointer',fontSize:9,color:SC[s],fontFamily:'inherit',fontWeight:600,transition:'all .1s',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}
            onMouseEnter={e=>e.currentTarget.style.background=`${SC[s]}18`}
            onMouseLeave={e=>e.currentTarget.style.background=`${SC[s]}08`}>
            → {SL[s].split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  )
}
