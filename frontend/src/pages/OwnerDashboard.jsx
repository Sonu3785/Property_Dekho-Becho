import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'overview',   icon: '📊', label: 'Overview'   },
  { id: 'properties', icon: '🏢', label: 'Properties'  },
  { id: 'tenants',    icon: '👥', label: 'Tenants'     },
  { id: 'agreements', icon: '📄', label: 'Agreements'  },
  { id: 'payments',   icon: '💳', label: 'Payments'    },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]   = useState('overview')
  const [properties, setProperties] = useState([])
  const [tenants, setTenants]       = useState([])
  const [payments, setPayments]     = useState([])
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [p, t, pay, ag] = await Promise.allSettled([
      API.get('/properties/'),
      API.get('/tenants/'),
      API.get('/payments/'),
      API.get('/agreements/'),
    ])
    setProperties(p.status   === 'fulfilled' && Array.isArray(p.value.data)   ? p.value.data   : [])
    setTenants(   t.status   === 'fulfilled' && Array.isArray(t.value.data)   ? t.value.data   : [])
    setPayments(  pay.status === 'fulfilled' && Array.isArray(pay.value.data) ? pay.value.data : [])
    setAgreements(ag.status  === 'fulfilled' && Array.isArray(ag.value.data)  ? ag.value.data  : [])
    setLoading(false)
  }

  const ctx = { properties, tenants, payments, agreements, refresh: fetchAll, user }

  return (
    <div className={styles.dashboard}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className={styles.content}>
        {loading
          ? <div className={styles.loader}><span className={styles.spin} /></div>
          : <>
            {activeTab === 'overview'   && <Overview   {...ctx} setActiveTab={setActiveTab} />}
            {activeTab === 'properties' && <Properties {...ctx} />}
            {activeTab === 'tenants'    && <Tenants    {...ctx} />}
            {activeTab === 'agreements' && <Agreements {...ctx} />}
            {activeTab === 'payments'   && <Payments   {...ctx} />}
          </>
        }
      </div>
    </div>
  )
}

/* ── OVERVIEW ─────────────────────────────────────────────────── */
function Overview({ properties, tenants, payments, agreements, setActiveTab, user }) {
  const paid  = payments.filter(p => p.status === 'paid').length
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0)

  const stats = [
    { icon: '🏢', label: 'Properties',  value: properties.length,  color: '#667eea', tab: 'properties' },
    { icon: '👥', label: 'Tenants',      value: tenants.length,     color: '#06b6d4', tab: 'tenants'    },
    { icon: '📄', label: 'Agreements',   value: agreements.length,  color: '#8b5cf6', tab: 'agreements' },
    { icon: '✅', label: 'Paid Rents',   value: paid,               color: '#10b981', tab: 'payments'   },
  ]

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Good day, {user?.name} 👋</h2>
          <p className={styles.subtitle}>Portfolio overview • Total collected ₹{total.toLocaleString()}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s, i) => (
          <div key={i} className={styles.statCard} onClick={() => setActiveTab(s.tab)} style={{ borderTopColor: s.color }}>
            <div className={styles.statIcon} style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div><div className={styles.statValue}>{s.value}</div><div className={styles.statLabel}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Property cards preview */}
      <h3 className={styles.sectionHeading}>Your Properties</h3>
      {properties.length === 0
        ? <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🏢</div>
            <p>No properties yet. Go to <strong>Properties</strong> tab to add your first one!</p>
          </div>
        : <div className={styles.cardGrid}>
            {properties.slice(0, 6).map(p => <PropCard key={p.id} p={p} />)}
          </div>
      }

      <div className={styles.overviewGrid} style={{ marginTop: '2rem' }}>
        <div className={styles.overviewCard}>
          <h3>Recent Tenants</h3>
          {tenants.slice(0, 5).map(t => (
            <div key={t.id} className={styles.listRow}>
              <div className={styles.miniAvatar}>{t.name?.[0]?.toUpperCase()}</div>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>{t.name}</div>
                <div className={styles.listSub}>{t.email}</div>
              </div>
              <div className={styles.listBadge2}>#{t.property_id}</div>
            </div>
          ))}
          {tenants.length === 0 && <p className={styles.empty}>No tenants yet</p>}
        </div>
        <div className={styles.overviewCard}>
          <h3>Recent Payments</h3>
          {payments.slice(0, 5).map(p => (
            <div key={p.id} className={styles.listRow}>
              <span className={styles.listIcon}>💰</span>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>₹{p.amount?.toLocaleString()}</div>
                <div className={styles.listSub}>{p.date}</div>
              </div>
              <span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status}</span>
            </div>
          ))}
          {payments.length === 0 && <p className={styles.empty}>No payments yet</p>}
        </div>
      </div>
    </div>
  )
}

function PropCard({ p, onDelete }) {
  return (
    <div className={styles.propCard}>
      <div className={styles.propCardHeader}>
        <span className={styles.propIcon}>🏢</span>
        {onDelete && <button className={styles.deleteBtn} onClick={() => onDelete(p.id)}>🗑️</button>}
      </div>
      <h4>{p.title}</h4>
      <p className={styles.propLocation}>📍 {p.location}</p>
      <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
      <div className={styles.propId}>ID #{p.id}</div>
    </div>
  )
}

/* ── PROPERTIES ───────────────────────────────────────────────── */
function Properties({ properties, user, refresh }) {
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('title')
  const [sortDir, setSortDir]   = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ title: '', location: '', price: '' })
  const [saving, setSaving]     = useState(false)

  const filtered = properties
    .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv||'').toLowerCase() }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/properties/', { title: form.title, location: form.location, price: parseFloat(form.price), owner_id: user?.id || 1 })
      toast.success('Property added! 🏢')
      refresh(); setShowForm(false); setForm({ title: '', location: '', price: '' })
    } catch { toast.error('Failed to add property') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property?')) return
    try { await API.delete(`/properties/${id}`); toast.success('Deleted'); refresh() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>My Properties</h2><p className={styles.subtitle}>{properties.length} properties listed</p></div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Property'}</button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>📋 Add New Property</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Title (e.g. 2BHK Flat Kothrud)"  value={form.title}    onChange={e => setForm({ ...form, title: e.target.value })} required />
            <input placeholder="Location (e.g. Pune, Maharashtra)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
            <input type="number" placeholder="Rent per month (₹)"  value={form.price}    onChange={e => setForm({ ...form, price: e.target.value })} required min="0" />
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : '✓ Add Property'}</button>
          </form>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search title or location…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="title">Sort: Title</option>
          <option value="location">Sort: Location</option>
          <option value="price">Sort: Price</option>
        </select>
        <button className={styles.sortBtn} onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {filtered.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>🏢</div><p>No properties found. {search ? 'Try a different search.' : 'Click "+ Add Property" to get started!'}</p></div>
        : <div className={styles.cardGrid}>{filtered.map(p => <PropCard key={p.id} p={p} onDelete={handleDelete} />)}</div>
      }
    </div>
  )
}

/* ── TENANTS ──────────────────────────────────────────────────── */
function Tenants({ tenants, properties, refresh }) {
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('name')
  const [sortDir, setSortDir]   = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', phone: '', email: '', property_id: '' })
  const [saving, setSaving]     = useState(false)

  const filtered = tenants
    .filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search))
    .sort((a, b) => { let av = String(a[sortBy]||'').toLowerCase(), bv = String(b[sortBy]||'').toLowerCase(); return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1) })

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await API.post('/tenants/', { ...form, property_id: parseInt(form.property_id) })
      toast.success('Tenant added!'); refresh(); setShowForm(false); setForm({ name:'',phone:'',email:'',property_id:'' })
    } catch { toast.error('Failed to add') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Tenants</h2><p className={styles.subtitle}>{tenants.length} registered tenants</p></div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Tenant'}</button>
      </div>
      {showForm && (
        <div className={styles.formBox}>
          <h3>👤 Add Tenant</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Full Name"    value={form.name}  onChange={e => setForm({...form,name:e.target.value})} required />
            <input placeholder="Phone"        value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} required />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required />
            <select value={form.property_id} onChange={e => setForm({...form,property_id:e.target.value})} required>
              <option value="">— Select Property —</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title} · {p.location}</option>)}
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving?'Saving...':'✓ Add Tenant'}</button>
          </form>
        </div>
      )}
      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search name, email or phone…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option><option value="email">Sort: Email</option>
        </select>
        <button className={styles.sortBtn} onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑ Asc':'↓ Desc'}</button>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Property</th></tr></thead>
          <tbody>
            {filtered.map(t => {
              const prop = properties.find(p => p.id === t.property_id)
              return (
                <tr key={t.id}>
                  <td><div className={styles.tenantName}><div className={styles.miniAvatar}>{t.name?.[0]?.toUpperCase()}</div>{t.name}</div></td>
                  <td>{t.phone}</td><td>{t.email}</td>
                  <td><span className={styles.badge}>{prop ? prop.title : `#${t.property_id}`}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length===0 && <p className={styles.empty}>No tenants found.</p>}
      </div>
    </div>
  )
}

/* ── AGREEMENTS ───────────────────────────────────────────────── */
function Agreements({ properties, tenants, agreements, refresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ tenant_id:'', property_id:'', start_date:'', end_date:'', rent:'', deposit:'' })
  const [saving, setSaving]     = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await API.post('/agreements/', { tenant_id:parseInt(form.tenant_id), property_id:parseInt(form.property_id), start_date:form.start_date, end_date:form.end_date, rent:parseFloat(form.rent), deposit:parseFloat(form.deposit) })
      toast.success('Agreement created!'); refresh(); setShowForm(false); setForm({tenant_id:'',property_id:'',start_date:'',end_date:'',rent:'',deposit:''})
    } catch { toast.error('Failed to create') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Rental Agreements</h2><p className={styles.subtitle}>{agreements.length} agreements</p></div>
        <button className={styles.addBtn} onClick={()=>setShowForm(v=>!v)}>{showForm?'✕ Cancel':'+ New Agreement'}</button>
      </div>
      {showForm && (
        <div className={styles.formBox}>
          <h3>📄 Create Agreement</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <select value={form.tenant_id}   onChange={e=>setForm({...form,tenant_id:e.target.value})} required><option value="">— Tenant —</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select value={form.property_id} onChange={e=>setForm({...form,property_id:e.target.value})} required><option value="">— Property —</option>{properties.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
            <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} required />
            <input type="date" value={form.end_date}   onChange={e=>setForm({...form,end_date:e.target.value})} required />
            <input type="number" placeholder="Monthly Rent ₹"   value={form.rent}    onChange={e=>setForm({...form,rent:e.target.value})} required />
            <input type="number" placeholder="Security Deposit ₹" value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})} required />
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving?'Creating...':'✓ Create'}</button>
          </form>
        </div>
      )}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Tenant</th><th>Property</th><th>Start</th><th>End</th><th>Rent</th><th>Deposit</th></tr></thead>
          <tbody>
            {agreements.map((ag,i) => {
              const t=tenants.find(t=>t.id===ag.tenant_id), p=properties.find(p=>p.id===ag.property_id)
              return <tr key={ag.id}><td>{i+1}</td><td>{t?.name||`#${ag.tenant_id}`}</td><td>{p?.title||`#${ag.property_id}`}</td><td>{ag.start_date}</td><td>{ag.end_date}</td><td>₹{ag.rent?.toLocaleString()}</td><td>₹{ag.deposit?.toLocaleString()}</td></tr>
            })}
          </tbody>
        </table>
        {agreements.length===0 && <p className={styles.empty}>No agreements yet.</p>}
      </div>
    </div>
  )
}

/* ── PAYMENTS ─────────────────────────────────────────────────── */
function Payments({ payments, tenants, refresh }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ tenant_id:'', amount:'', date:'', status:'paid' })
  const [saving, setSaving]             = useState(false)

  const filtered = payments.filter(p => {
    const t = tenants.find(t=>t.id===p.tenant_id)
    return (statusFilter==='all'||p.status===statusFilter) &&
      (t?.name?.toLowerCase().includes(search.toLowerCase()) || String(p.tenant_id).includes(search))
  })
  const total = filtered.reduce((s,p)=>s+(p.amount||0),0)

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await API.post('/payments/', { tenant_id:parseInt(form.tenant_id), amount:parseFloat(form.amount), date:form.date, status:form.status })
      toast.success('Payment recorded!'); refresh(); setShowForm(false); setForm({tenant_id:'',amount:'',date:'',status:'paid'})
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Payments</h2><p className={styles.subtitle}>{payments.length} total · ₹{total.toLocaleString()} shown</p></div>
        <button className={styles.addBtn} onClick={()=>setShowForm(v=>!v)}>{showForm?'✕ Cancel':'+ Record Payment'}</button>
      </div>
      {showForm && (
        <div className={styles.formBox}>
          <h3>💳 Record Payment</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <select value={form.tenant_id} onChange={e=>setForm({...form,tenant_id:e.target.value})} required><option value="">— Tenant —</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <input type="number" placeholder="Amount ₹" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required />
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required />
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="paid">✅ Paid</option><option value="pending">⏳ Pending</option><option value="overdue">❌ Overdue</option>
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving?'Saving...':'✓ Record'}</button>
          </form>
        </div>
      )}
      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search tenant…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">All</option><option value="paid">✅ Paid</option><option value="pending">⏳ Pending</option><option value="overdue">❌ Overdue</option>
        </select>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Tenant</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((p,i)=>{
              const t=tenants.find(t=>t.id===p.tenant_id)
              return <tr key={p.id}><td>{i+1}</td><td><div className={styles.tenantName}><div className={styles.miniAvatar}>{t?.name?.[0]?.toUpperCase()||'?'}</div>{t?.name||`#${p.tenant_id}`}</div></td><td>₹{p.amount?.toLocaleString()}</td><td>{p.date}</td><td><span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status==='paid'?'✅':p.status==='pending'?'⏳':'❌'} {p.status}</span></td></tr>
            })}
          </tbody>
        </table>
        {filtered.length===0 && <p className={styles.empty}>No payments found.</p>}
      </div>
    </div>
  )
}
