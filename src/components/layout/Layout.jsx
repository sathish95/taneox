import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTabVisibility } from '../../context/TabVisibilityContext'
import {
  LayoutDashboard, Receipt, Users, FolderOpen, PieChart, Box, CheckSquare,
  FileText, TrendingUp, Settings, LogOut, Menu, X, ChevronLeft,
  Truck, Plane, ShoppingCart, Briefcase, CreditCard, Building2, Package, BarChart2,
  Calendar, Clock, FileSpreadsheet, Megaphone
} from 'lucide-react'

const roleColor = {
  admin: '#7c3aed', ceo: '#dc2626', manager: '#0284c7',
  finance: '#16a34a', employee: '#d97706', department_head: '#0284c7'
}
const roleLabel = {
  admin: 'Administrator', ceo: 'Chief Executive', manager: 'Manager',
  finance: 'Finance', employee: 'Employee', department_head: 'Dept. Head'
}

const ALL_NAV = [
  { section: 'Overview', items: [
    { to: '/', tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Expenses & Travel', items: [
    { to: '/expenses', tab: 'expenses', label: 'Expenses', icon: Receipt },
    { to: '/travel', tab: 'travel', label: 'Travel Requests', icon: Plane },
    { to: '/approvals', tab: 'approvals', label: 'Approvals', icon: CheckSquare, roles: ['admin','ceo','manager','department_head','hr'] },
  ]},
  { section: 'Operations', items: [
    { to: '/projects', tab: 'projects', label: 'Projects', icon: FolderOpen },
    { to: '/budget', tab: 'budget', label: 'Budget', icon: PieChart },
    { to: '/assets', tab: 'assets', label: 'Assets', icon: Box },
  ]},
  { section: 'Procurement', items: [
    { to: '/vendors', tab: 'vendors', label: 'Vendors', icon: Truck, roles: ['admin','ceo','manager','finance','department_head'] },
    { to: '/procurement', tab: 'procurement', label: 'Purchase Req.', icon: ShoppingCart, roles: ['admin','ceo','manager','department_head','hr'] },
    { to: '/invoices', tab: 'invoices', label: 'Invoices', icon: FileText, roles: ['admin','ceo','manager','finance'] },
    { to: '/fundflow', tab: 'fundflow', label: 'Fund Flow', icon: TrendingUp, roles: ['admin','ceo','finance'] },
    { to: '/pos', tab: 'pos', label: 'Purchase Orders', icon: Package, roles: ['admin','ceo','manager','finance'] },
    { to: '/grn', tab: 'grn', label: 'GRN', icon: Briefcase, roles: ['admin','ceo','manager','finance'] },
  ]},
  { section: 'HR & Resources', items: [
    { to: '/leave', tab: 'leave', label: 'Leave Management', icon: Calendar },
    { to: '/resources', tab: 'resources', label: 'Resource Tracking', icon: Clock },
    { to: '/timesheet', tab: 'timesheet', label: 'Timesheet', icon: FileSpreadsheet },
  ]},
  { section: 'Admin', items: [
    { to: '/users', tab: 'users', label: 'Users', icon: Users, roles: ['admin','ceo','manager','finance'] },
    { to: '/reports', tab: 'reports', label: 'Reports', icon: BarChart2 },
    { to: '/settings', tab: 'settings', label: 'Settings', icon: Settings, roles: ['admin','ceo'] },
    { to: '/content', tab: 'content', label: 'Landing Content', icon: Megaphone, roles: ['admin','ceo'] },
  ]},
]


function TopbarCheckIn({ profile }) {
  const [activeLog, setActiveLog] = useState(null)
  const [projects,  setProjects]  = useState([])
  const [selProj,   setSelProj]   = useState('')
  const [task,      setTask]      = useState('')
  const [elapsed,   setElapsed]   = useState('')
  const [open,      setOpen]      = useState(false)
  const [busy,      setBusy]      = useState(false)

  useEffect(() => { loadActive(); supabase.from('projects').select('id,name,code').eq('status','active').order('name').then(({data})=>setProjects(data||[])) }, [profile?.id])
  useEffect(() => {
    if (!activeLog) { setElapsed(''); return }
    function tick(){const d=Date.now()-new Date(activeLog.check_in).getTime();const h=Math.floor(d/3600000);const m=Math.floor((d%3600000)/60000);const s=Math.floor((d%60000)/1000);setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)}
    tick(); const t=setInterval(tick,1000); return()=>clearInterval(t)
  }, [activeLog])

  async function loadActive() {
    if (!profile?.id) return
    const {data} = await supabase.from('time_logs').select('id,check_in,project:projects(id,name)').eq('employee_id',profile.id).is('check_out',null).limit(1).maybeSingle()
    setActiveLog(data)
  }
  async function doCheckIn() {
    setBusy(true)
    await supabase.from('time_logs').insert({ employee_id:profile.id, project_id:selProj||null, check_in:new Date().toISOString(), work_date:new Date().toISOString().split('T')[0], comment:task||null })
    await loadActive(); setOpen(false); setTask(''); setBusy(false)
  }
  async function doCheckOut() {
    if (!activeLog) return; setBusy(true)
    const now=new Date(); const hrs=Math.round((now-new Date(activeLog.check_in))/3600000*100)/100
    await supabase.from('time_logs').update({ check_out:now.toISOString(), hours_worked:hrs }).eq('id',activeLog.id)
    setActiveLog(null); setElapsed(''); setOpen(false); setBusy(false)
  }

  const isIn = !!activeLog

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 14px', borderRadius:20,
          border:`1.5px solid ${isIn?'var(--emerald)':'var(--border)'}`,
          background:isIn?'rgba(5,150,105,.08)':'var(--surface-2)',
          color:isIn?'var(--emerald)':'var(--text-soft)',
          cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, transition:'all .2s' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:isIn?'var(--emerald)':'var(--text-muted)', animation:isIn?'pulse-dot 2s ease infinite':'none' }}/>
        {isIn
          ? <span style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:13, letterSpacing:'.02em' }}>{elapsed}</span>
          : <span>Check In</span>
        }
        <span style={{ fontSize:9, opacity:.6 }}>{open?'▲':'▼'}</span>
      </button>

      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
          <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:290, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'var(--shadow-lg)', zIndex:200, padding:16 }}>
            {isIn ? (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:'var(--emerald)', animation:'pulse-dot 2s ease infinite' }}/>
                  <span style={{ fontWeight:700, fontSize:13, color:'var(--emerald)' }}>Active Session</span>
                </div>
                <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--surface-2)', marginBottom:12 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{activeLog?.project?.name || 'No project'}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:900, fontSize:26, color:'var(--emerald)', lineHeight:1.1, marginTop:4 }}>{elapsed}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>Since {new Date(activeLog.check_in).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <button className="btn btn-danger" style={{ width:'100%', justifyContent:'center' }} onClick={doCheckOut} disabled={busy}>
                  {busy?'⏳ Checking out…':'🚪 Check Out'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>📍 Check In</div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:5 }}>Project</div>
                  <select className="form-select" value={selProj} onChange={e=>setSelProj(e.target.value)} style={{ fontSize:12 }}>
                    <option value="">No specific project</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:5 }}>What are you working on?</div>
                  <input className="form-input" value={task} onChange={e=>setTask(e.target.value)} placeholder="Brief task description…" style={{ fontSize:12 }} onKeyDown={e=>e.key==='Enter'&&doCheckIn()}/>
                </div>
                <button className="btn btn-success" style={{ width:'100%', justifyContent:'center' }} onClick={doCheckIn} disabled={busy}>
                  {busy?'⏳ Checking in…':'✅ Check In'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { profile, signOut } = useAuth()
  const { isTabVisible } = useTabVisibility()
  const navigate = useNavigate()
  const location = useLocation()
  const role = profile?.role || 'employee'
  const color = roleColor[role] || '#6366f1'
  const initials = (profile?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Close sidebar on mobile nav
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  async function handleSignOut() { await signOut(); navigate('/login') }

  // Build visible nav
  const visibleNav = ALL_NAV.map(section => ({
    ...section,
    items: section.items.filter(item => {
      // Role guard
      if (item.roles && !item.roles.includes(role)) return false
      // Tab visibility guard (admin/ceo bypass this)
      if (!isTabVisible(item.tab)) return false
      return true
    })
  })).filter(s => s.items.length > 0)

  const pageMap = {
    '/': 'Dashboard', '/expenses': 'Expenses', '/travel': 'Travel Requests',
    '/approvals': 'Approvals', '/vendors': 'Vendors', '/projects': 'Projects',
    '/budget': 'Budget', '/assets': 'Assets', '/procurement': 'Procurement',
    '/invoices': 'Invoices', '/fundflow': 'Fund Flow', '/pos': 'Purchase Orders',
    '/grn': 'GRN', '/users': 'Users', '/settings': 'Settings', '/reports': 'Reports',
    '/timesheet': 'Timesheet', '/content': 'Landing Content',
  }
  const pageTitle = pageMap[location.pathname] || 'ThingsAlive NeoX'

  const SidebarContent = () => (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ '--role-color': color }}>
      {/* Logo */}
      <div className="sidebar-logo">
        {!collapsed && <div className="logo-text">ThingsAlive <span>NeoX</span></div>}
        {collapsed && <div className="logo-icon">PP</div>}
        <button className="collapse-btn desktop-only" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
          <ChevronLeft size={16} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <button className="collapse-btn mobile-only" onClick={() => setSidebarOpen(false)}>
          <X size={16} />
        </button>
      </div>

      {/* Profile chip */}
      <div className="sidebar-profile" style={{ background: `${color}15`, borderColor: `${color}25` }}>
        <div className="avatar" style={{ background: color }}>{initials}</div>
        {!collapsed && (
          <div className="profile-info">
            <div className="profile-name">{profile?.full_name?.split(' ')[0] || 'User'}</div>
            <div className="profile-role" style={{ color }}>{roleLabel[role] || role}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {visibleNav.map(section => (
          <div key={section.section} className="nav-section">
            {!collapsed && <div className="nav-section-label">{section.section}</div>}
            {section.items.map(item => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  style={({ isActive }) => isActive ? { '--link-color': color } : {}}>
                  <Icon size={17} className="nav-icon" />
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="sidebar-footer">
        <button className="nav-link signout-btn" onClick={handleSignOut}>
          <LogOut size={17} className="nav-icon" />
          {!collapsed && <span className="nav-label">Sign Out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Desktop sidebar */}
      <div className="desktop-sidebar"><SidebarContent /></div>

      {/* Mobile sidebar */}
      <div className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}><SidebarContent /></div>

      {/* Main */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="topbar-title">{pageTitle}</div>
          <div className="topbar-right">
            <TopbarCheckIn/>
            <div className="topbar-avatar" style={{ background: color }}>{initials}</div>
          </div>
        </header>

        {/* Content */}
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
