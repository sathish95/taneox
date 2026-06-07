import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTabVisibility } from '../../context/TabVisibilityContext'
import { supabase } from '../../lib/supabase'
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


/* ══════════════════════════════════════════════════════════
   TOP-RIGHT CHECK-IN WIDGET
══════════════════════════════════════════════════════════ */
function CheckInWidget({ profile }) {
  const [open,       setOpen]      = useState(false)
  const [activeLog,  setActiveLog] = useState(null)
  const [projects,   setProjects]  = useState([])
  const [projectId,  setProjectId] = useState('')
  const [comment,    setComment]   = useState('')
  const [elapsed,    setElapsed]   = useState('')
  const [loading,    setLoading]   = useState(false)

  useEffect(() => { if (profile?.id) fetchState() }, [profile?.id])

  useEffect(() => {
    if (!activeLog?.check_in) { setElapsed(''); return }
    const tick = () => {
      const diff = (Date.now() - new Date(activeLog.check_in)) / 1000
      const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = Math.floor(diff % 60)
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeLog])

  async function fetchState() {
    const today = new Date().toISOString().split('T')[0]
    const [logRes, projRes] = await Promise.all([
      supabase.from('time_logs').select('*, project:projects(name)').eq('employee_id', profile.id)
        .eq('work_date', today).is('check_out', null).order('check_in', { ascending:false }).limit(1),
      supabase.from('projects').select('id,name').eq('status','active').order('name'),
    ])
    setActiveLog(logRes.data?.[0] || null)
    setProjects(projRes.data || [])
  }

  async function handleCheckIn() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('time_logs').insert({
      employee_id: profile.id,
      project_id:  projectId || null,
      work_date:   today,
      check_in:    new Date().toISOString(),
      comment:     comment || null,
    })
    if (error) { alert(error.message); setLoading(false); return }
    setOpen(false); setComment(''); fetchState()
    setLoading(false)
  }

  async function handleCheckOut() {
    if (!activeLog) return
    setLoading(true)
    const now  = new Date()
    const diff = (now - new Date(activeLog.check_in)) / 3600000
    const hrs  = Math.round(diff * 100) / 100
    const { error } = await supabase.from('time_logs').update({
      check_out:    now.toISOString(),
      hours_worked: hrs,
    }).eq('id', activeLog.id)
    if (error) { alert(error.message); setLoading(false); return }
    setOpen(false); setActiveLog(null); fetchState()
    setLoading(false)
  }

  const checkedIn = !!activeLog

  return (
    <div style={{ position:'relative' }}>
      {/* Trigger button */}
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8,
          border:`1.5px solid ${checkedIn?'#10b981':'var(--border)'}`,
          background:checkedIn?'#f0fdf4':'var(--surface)', cursor:'pointer', fontFamily:'inherit',
          fontSize:12, fontWeight:700, color:checkedIn?'#15803d':'var(--text-soft)',
          transition:'all .2s', whiteSpace:'nowrap' }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:checkedIn?'#10b981':'var(--text-muted)',
          flexShrink:0, animation:checkedIn?'pulse-dot 2s ease infinite':undefined }}/>
        {checkedIn ? <>✓ Checked In {elapsed && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, opacity:.8 }}>{elapsed}</span>}</> : 'Check In'}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:299 }} onClick={() => setOpen(false)}/>
          <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300, width:300,
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
            boxShadow:'var(--shadow-lg)', padding:18 }}>

            {checkedIn ? (
              /* ── Checked In State ── */
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:'#10b981', animation:'pulse-dot 2s ease infinite' }}/>
                  <span style={{ fontWeight:700, fontSize:13, color:'#15803d' }}>Checked In</span>
                </div>
                <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--bg-3)', marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Current Session</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:22, color:'var(--c1)' }}>{elapsed}</div>
                  {activeLog?.project?.name && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>📁 {activeLog.project.name}</div>}
                  {activeLog?.comment && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, fontStyle:'italic' }}>"{activeLog.comment}"</div>}
                </div>
                <button className="btn btn-danger" style={{ width:'100%', justifyContent:'center' }}
                  onClick={handleCheckOut} disabled={loading}>
                  {loading ? 'Saving…' : '⏹ Check Out & Save Hours'}
                </button>
              </div>
            ) : (
              /* ── Not Checked In ── */
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Start your work session</div>
                <div className="form-group">
                  <label className="form-label">Project (optional)</label>
                  <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">What are you working on?</label>
                  <input className="form-input" value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Brief task description…" onKeyDown={e => e.key==='Enter' && handleCheckIn()}/>
                </div>
                <button className="btn btn-success" style={{ width:'100%', justifyContent:'center' }}
                  onClick={handleCheckIn} disabled={loading}>
                  {loading ? 'Saving…' : '▶ Check In Now'}
                </button>
                <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', marginTop:8 }}>
                  {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short' })}
                </div>
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
            <CheckInWidget profile={profile} />
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
