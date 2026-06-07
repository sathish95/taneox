import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTabVisibility, DEFAULT_TABS } from '../context/TabVisibilityContext'
import { Alert } from '../components/ui'
import {
  Settings, GitBranch, DollarSign, Bell, Tag, FileText,
  Save, Plus, Trash2, Edit2, Check, X, Users, Eye, EyeOff, Shield
} from 'lucide-react'

const TAB_DEFS = [
  { key: 'dashboard',   label: 'Dashboard',        emoji: '🏠' },
  { key: 'expenses',    label: 'Expenses',          emoji: '🧾' },
  { key: 'travel',      label: 'Travel Requests',   emoji: '✈️' },
  { key: 'approvals',   label: 'Approvals',         emoji: '✅' },
  { key: 'leave',       label: 'Leave Management',  emoji: '📅' },
  { key: 'resources',   label: 'Resource Tracking', emoji: '⏱' },
  { key: 'vendors',     label: 'Vendors',           emoji: '🏪' },
  { key: 'projects',    label: 'Projects',          emoji: '📁' },
  { key: 'budget',      label: 'Budget',            emoji: '💰' },
  { key: 'assets',      label: 'Assets',            emoji: '📦' },
  { key: 'procurement', label: 'Procurement',       emoji: '🛒' },
  { key: 'invoices',    label: 'Invoices',          emoji: '📄' },
  { key: 'fundflow',    label: 'Fund Flow',         emoji: '💸' },
  { key: 'pos',         label: 'Purchase Orders',   emoji: '📋' },
  { key: 'grn',         label: 'GRN',               emoji: '📦' },
  { key: 'users',       label: 'Users',             emoji: '👥' },
  { key: 'reports',     label: 'Reports',           emoji: '📊' },
  { key: 'settings',    label: 'Settings',          emoji: '⚙️' },
]

const ROLE_DEFS = [
  { key: 'manager',  label: 'Manager',  color: '#0284c7' },
  { key: 'finance',  label: 'Finance',  color: '#059669' },
  { key: 'hr',       label: 'HR',       color: '#0891b2' },
  { key: 'employee', label: 'Employee', color: '#d97706' },
]

// ── Tab Visibility (Admin Feature) ──
function TabVisibilityTab() {
  const { config, saveConfig } = useTabVisibility()
  const [local, setLocal] = useState(config)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLocal(config) }, [config])

  function toggle(role, tab) {
    setLocal(prev => ({
      ...prev,
      [role]: { ...prev[role], [tab]: !prev[role]?.[tab] }
    }))
  }

  function save() {
    saveConfig(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function resetRole(role) {
    setLocal(prev => ({ ...prev, [role]: { ...DEFAULT_TABS[role] } }))
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>Tab Visibility by Role</h3>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
          Control which tabs are visible for each user role. Admin and CEO always see all tabs.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {ROLE_DEFS.map(role => (
          <div key={role.key} style={{ border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: `${role.color}10`, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color="#fff" />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: role.color }}>{role.label}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => resetRole(role.key)} style={{ fontSize: 12 }}>
                Reset to Default
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {TAB_DEFS.map(tab => {
                  const visible = local[role.key]?.[tab.key] !== false
                  return (
                    <button key={tab.key} onClick={() => toggle(role.key, tab.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        borderRadius: 10, border: `1.5px solid ${visible ? role.color + '40' : 'var(--border)'}`,
                        background: visible ? `${role.color}10` : 'var(--surface)',
                        cursor: 'pointer', transition: 'all .15s', textAlign: 'left'
                      }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: visible ? role.color : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                        {visible ? <Eye size={12} color="#fff" /> : <EyeOff size={12} color="#94a3b8" />}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: visible ? role.color : 'var(--ink-muted)' }}>
                        {tab.emoji} {tab.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {saved && <Alert type="success" message="Tab visibility settings saved!" />}
        <button className="btn btn-primary" onClick={save} style={{ marginTop: saved ? 12 : 0 }}>
          <Save size={15} /> Save Visibility Settings
        </button>
      </div>
    </div>
  )
}

// ── Approval Chain Config ──
const DEFAULT_CHAINS = {
  employee: ['Manager','CEO','Finance'],
  manager:  ['CEO','Finance'],
  finance:  ['Manager','CEO'],
  hr:       ['Manager','CEO','Finance'],
}
const STEP_CLR = { Manager:'#3b82f6', 'Dept Head':'#8b5cf6', CEO:'#e11d48', Finance:'#10b981', HR:'#0891b2' }
const ALL_STEPS = ['Manager','Dept Head','CEO','Finance','HR']
const ROLE_CLR  = { employee:'#3b82f6', manager:'#10b981', finance:'#10b981', hr:'#0891b2' }

function ApprovalChainTab() {
  const [chains, setChains] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nx_approval_chains') || 'null') || DEFAULT_CHAINS }
    catch { return DEFAULT_CHAINS }
  })
  const [saved, setSaved] = useState(false)

  function toggle(role, step) {
    setChains(prev => {
      const cur  = prev[role] || []
      const next = cur.includes(step) ? cur.filter(s => s !== step) : [...cur, step]
      return { ...prev, [role]: next }
    })
  }

  function save() {
    localStorage.setItem('nx_approval_chains', JSON.stringify(chains))
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  function reset() { setChains(DEFAULT_CHAINS) }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>Approval Chain by Submitter Role</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
            Configure which approvers are required. Saved to this browser.
            For team-wide changes, update <code style={{ background:'var(--bg-3)', padding:'1px 5px', borderRadius:3, fontSize:11 }}>src/lib/approvalFlow.js</code>.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reset}>↺ Reset Defaults</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
        {Object.entries(chains).map(([role, steps]) => (
          <div key={role} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            {/* Role label + live chain preview */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <span style={{ padding:'3px 12px', borderRadius:4, fontSize:11, fontWeight:700,
                background:`${ROLE_CLR[role]||'#6366f1'}15`, color:ROLE_CLR[role]||'#6366f1',
                textTransform:'capitalize', minWidth:80, textAlign:'center' }}>
                {role.replace('_',' ')}
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>submits →</span>
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                {steps.length === 0
                  ? <span style={{ fontSize:11, color:'var(--amber)', fontStyle:'italic' }}>Direct approval (no steps)</span>
                  : steps.map((s, i) => (
                    <span key={s} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {i > 0 && <span style={{ color:'var(--text-muted)', fontSize:14 }}>→</span>}
                      <span style={{ padding:'3px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                        background:`${STEP_CLR[s]||'#6366f1'}15`, color:STEP_CLR[s]||'#6366f1' }}>{s}</span>
                    </span>
                  ))
                }
                <span style={{ color:'var(--text-muted)', fontSize:14 }}>→</span>
                <span style={{ padding:'3px 10px', borderRadius:4, fontSize:11, fontWeight:700, background:'#dcfce7', color:'#15803d' }}>✓ Approved</span>
              </div>
            </div>

            {/* Toggle buttons */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {ALL_STEPS.map(step => {
                const active = steps.includes(step)
                return (
                  <button key={step} onClick={() => toggle(role, step)}
                    style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600,
                      fontFamily:'inherit', transition:'all .15s',
                      background: active ? STEP_CLR[step]||'#6366f1' : 'var(--surface-2)',
                      color: active ? '#fff' : 'var(--text-soft)',
                      border: `1.5px solid ${active ? STEP_CLR[step]||'#6366f1' : 'var(--border)'}` }}>
                    {active ? '✓ ' : '+ '}{step}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding:'10px 14px', borderRadius:8, background:'#fef3c7', border:'1px solid #fde68a', fontSize:12, color:'#92400e', marginBottom:14 }}>
        ⚠ Changes are saved to <strong>this browser only</strong>. For all team members, update <code>src/lib/approvalFlow.js</code> and redeploy.
      </div>

      {saved && <div className="alert alert-success" style={{ marginBottom:14 }}>✓ Approval chains saved!</div>}
      <button className="btn btn-primary" onClick={save}><Save size={14}/> Save Approval Chains</button>
    </div>
  )
}



function BudgetConfigTab() {
  const [depts, setDepts] = useState([])
  const [budgets, setBudgets] = useState({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [d, b] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('budgets').select('*')
      ])
      setDepts(d.data || [])
      const map = {}
      ;(b.data || []).forEach(b => { map[b.department_id] = b })
      setBudgets(map)
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    for (const dept of depts) {
      const b = budgets[dept.id]
      if (!b) continue
      await supabase.from('budgets').upsert({ department_id: dept.id, annual_budget: b.annual_budget || 0, monthly_budget: b.monthly_budget || 0 }, { onConflict: 'department_id' })
    }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>

  return (
    <div>
      <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>Department Budget Configuration</h3>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: 20 }}>Set annual and monthly budgets for each department.</p>
      <table className="data-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Department</th><th>Annual Budget (₹)</th><th>Monthly Budget (₹)</th></tr></thead>
        <tbody>
          {depts.map(dept => (
            <tr key={dept.id}>
              <td style={{ fontWeight: 600 }}>{dept.name}</td>
              <td><input type="number" className="form-input" value={budgets[dept.id]?.annual_budget || ''} style={{ width: 160 }} onChange={e => setBudgets(p => ({ ...p, [dept.id]: { ...p[dept.id], department_id: dept.id, annual_budget: parseFloat(e.target.value) || 0 } }))} placeholder="0" /></td>
              <td><input type="number" className="form-input" value={budgets[dept.id]?.monthly_budget || ''} style={{ width: 160 }} onChange={e => setBudgets(p => ({ ...p, [dept.id]: { ...p[dept.id], department_id: dept.id, monthly_budget: parseFloat(e.target.value) || 0 } }))} placeholder="0" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {saved && <Alert type="success" message="Budget configuration saved!" />}
      <button className="btn btn-primary" onClick={save}><Save size={15} /> Save Budgets</button>
    </div>
  )
}

// ── Expense Categories ──
function ExpenseCategoriesTab() {
  const [cats, setCats] = useState(['Travel & Transport','Food & Meals','Accommodation','Office Supplies','Software & Subscriptions','Training & Education','Marketing','Utilities','Equipment','Medical','Entertainment','Miscellaneous'])
  const [newCat, setNewCat] = useState('')
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [saved, setSaved] = useState(false)

  function add() { if (newCat.trim()) { setCats([...cats, newCat.trim()]); setNewCat('') } }
  function remove(i) { setCats(cats.filter((_, idx) => idx !== i)) }
  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div>
      <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>Expense Categories</h3>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: 20 }}>Manage the list of expense categories available when submitting.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="form-input" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name..." onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 1, maxWidth: 300 }} />
        <button className="btn btn-primary" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginBottom: 20 }}>
        {cats.map((cat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
            <Tag size={13} style={{ color: 'var(--c1)', flexShrink: 0 }} />
            {editing === i ? (
              <>
                <input className="form-input" value={editVal} onChange={e => setEditVal(e.target.value)} style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }} autoFocus />
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { const c=[...cats]; c[i]=editVal; setCats(c); setEditing(null) }}><Check size={13} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(null)}><X size={13} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500 }}>{cat}</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditing(i); setEditVal(cat) }}><Edit2 size={12} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#ef4444' }} onClick={() => remove(i)}><Trash2 size={12} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      {saved && <Alert type="success" message="Categories saved!" />}
      <button className="btn btn-primary" onClick={save}><Save size={15} /> Save Categories</button>
    </div>
  )
}

// ── GST Settings ──
function GSTSettingsTab() {
  const [s, setS] = useState({ gstin: '', business_name: '', address: '', state: '', state_code: '', cgst_rate: 9, sgst_rate: 9, igst_rate: 18, default_hsn: '', include_gst_in_invoices: true, auto_calculate: true })
  const [saved, setSaved] = useState(false)
  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  const set = (k, v) => setS(p => ({ ...p, [k]: v }))

  return (
    <div>
      <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>GST Configuration</h3>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: 20 }}>Configure GST details for invoices and procurement.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {[['gstin','GSTIN','29ABCDE1234F1Z5',false],['business_name','Business Name','Acme Pvt. Ltd.',false],['address','Registered Address','123, MG Road...',true],['state','State','Karnataka',false],['state_code','State Code','29',false],['default_hsn','Default HSN Code','998313',false]].map(([k,label,ph,full]) => (
          <div key={k} style={{ gridColumn: full ? '1/-1' : 'auto' }}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={s[k]} placeholder={ph} onChange={e => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <h4 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>GST Rates</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[['cgst_rate','CGST Rate (%)'],['sgst_rate','SGST Rate (%)'],['igst_rate','IGST Rate (%)']].map(([k,l]) => (
          <div key={k}><label className="form-label">{l}</label><input type="number" className="form-input" value={s[k]} onChange={e => set(k, parseFloat(e.target.value)||0)} min={0} max={28} step={0.5} /></div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[['include_gst_in_invoices','Include GST breakdown in invoices'],['auto_calculate','Auto-calculate GST on amounts']].map(([k,l]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={s[k]} onChange={() => set(k, !s[k])} style={{ width: 16, height: 16, accentColor: 'var(--c1)' }} />
            {l}
          </label>
        ))}
      </div>
      {saved && <Alert type="success" message="GST settings saved!" />}
      <button className="btn btn-primary" onClick={save}><Save size={15} /> Save GST Settings</button>
    </div>
  )
}

const TABS = [
  { id: 'visibility', label: 'Tab Visibility', icon: <Eye size={15} /> },
  { id: 'approval', label: 'Approval Chain', icon: <GitBranch size={15} /> },
  { id: 'budget', label: 'Budget Config', icon: <DollarSign size={15} /> },
  { id: 'categories', label: 'Expense Categories', icon: <Tag size={15} /> },
  { id: 'gst', label: 'GST Settings', icon: <FileText size={15} /> },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('visibility')
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Settings</div><div className="page-subtitle">Configure system-wide settings and permissions</div></div>
      </div>

      <div className="table-wrap">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto', padding: '0 4px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.86rem', color: activeTab === t.id ? 'var(--c1)' : 'var(--ink-muted)', borderBottom: activeTab === t.id ? '2.5px solid var(--c1)' : '2.5px solid transparent', transition: 'all .15s', marginBottom: -1, whiteSpace: 'nowrap' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '24px' }}>
          {activeTab === 'visibility' && <TabVisibilityTab />}
          {activeTab === 'approval' && <ApprovalChainTab />}
          {activeTab === 'budget' && <BudgetConfigTab />}
          {activeTab === 'categories' && <ExpenseCategoriesTab />}
          {activeTab === 'gst' && <GSTSettingsTab />}
        </div>
      </div>
    </div>
  )
}
