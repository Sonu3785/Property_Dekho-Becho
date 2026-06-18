import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'properties', icon: '🏢', label: 'Properties' },
  { id: 'tenants', icon: '👥', label: 'Tenants' },
  { id: 'agreements', icon: '📄', label: 'Agreements' },
  { id: 'payments', icon: '💳', label: 'Payments' },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [p, t, pay] = await Promise.allSettled([
        API.get('/properties/'),
        API.get('/tenants/'),
        API.get('/payments/'),
      ])
      setProperties(p.status === 'fulfilled' && Array.isArray(p.value.data) ? p.value.data : [])
      setTenants(t.status === 'fulfilled' && Array.isArray(t.value.data) ? t.value.data : [])
      setPayments(pay.status === 'fulfilled' && Array.isArray(pay.value.data) ? pay.value.data : [])
    } catch (e) { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.dashboard}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className={styles.content}>
        {loading && <div className={styles.loader}><span className={styles.spin} /></div>}
        {!loading && activeTab === 'overview' && <Overview properties={properties} tenants={tenants} payments={payments} setActiveTab={setActiveTab} user={user} />}
        {!loading && activeTab === 'properties' && <Properties properties={properties} refresh={fetchAll} />}
        {!loading && activeTab === 'tenants' && <Tenants tenants={tenants} properties={properties} refresh={fetchAll} />}
        {!loading && activeTab === 'agreements' && <Agreements properties={properties} tenants={tenants} refresh={fetchAll} />}
        {!loading && activeTab === 'payments' && <Payments payments={payments} tenants={tenants} refresh={fetchAll} />}
      </div>
    </div>
  )
}

// ─── OVERVIEW ────────────────────────────────────────────────────
function Overview({ properties, tenants, payments, setActiveTab, user }) {
  const totalRent = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const paidCount = payments.filter(p => p.status === 'paid').length

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Good day, {user?.name} 👋</h2>
          <p className={styles.subtitle}>Here's your property summary</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {[
          { icon: '🏢', label: 'Properties', value: properties.length, color: '#667eea', tab: 'properties' },
          { icon: '👥', label: 'Tenants', value: tenants.length, color: '#06b6d4', tab: 'tenants' },
          { icon: '💳', label: 'Total Payments', value: payments.length, color: '#10b981', tab: 'payments' },
          { icon: '✅', label: 'Paid', value: paidCount, color: '#f59e0b', tab: 'payments' },
        ].map((s, i) => (
          <div key={i} className={styles.statCard} onClick={() => setActiveTab(s.tab)} style={{ borderTopColor: s.color }}>
            <div className={styles.statIcon} style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.overviewGrid}>
        <div className={styles.overviewCard}>
          <h3>Recent Properties</h3>
          {properties.slice(0, 4).map(p => (
            <div key={p.id} className={styles.listRow}>
              <span className={styles.listIcon}>🏢</span>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>{p.title}</div>
                <div className={styles.listSub}>{p.location}</div>
              </div>
              <div className={styles.listBadge}>₹{p.price?.toLocaleString()}</div>
            </div>
          ))}
          {properties.length === 0 && <p className={styles.empty}>No properties yet</p>}
        </div>
        <div className={styles.overviewCard}>
          <h3>Recent Tenants</h3>
          {tenants.slice(0, 4).map(t => (
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
      </div>
    </div>
  )
}

// ─── PROPERTIES ───────────────────────────────────────────────────
function Properties({ properties, refresh }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', price: '', owner_id: 1 })
  const [saving, setSaving] = useState(false)

  const filtered = properties
    .filter(p =>
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.title || !form.location || !form.price) return toast.error('Fill all fields')
    setSaving(true)
    try {
      const res = await API.post('/properties/', { ...form, price: parseFloat(form.price) })
      if (res.data.success !== false) {
        toast.success('Property added!'); refresh(); setShowForm(false)
        setForm({ title: '', location: '', price: '', owner_id: 1 })
      } else toast.error(res.data.error)
    } catch { toast.error('Failed to add') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property?')) return
    try {
      await API.delete(`/properties/${id}`)
      toast.success('Property deleted'); refresh()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Properties</h2>
          <p className={styles.subtitle}>{properties.length} total properties</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Property'}
        </button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>Add New Property</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Property Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
            <input type="number" placeholder="Price (₹/month)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            <input type="number" placeholder="Owner ID" value={form.owner_id} onChange={e => setForm({ ...form, owner_id: parseInt(e.target.value) })} required />
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Property'}
            </button>
          </form>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍 Search by title or location..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="title">Sort: Title</option>
          <option value="location">Sort: Location</option>
          <option value="price">Sort: Price</option>
        </select>
        <button className={styles.sortBtn} onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      <div className={styles.cardGrid}>
        {filtered.map(p => (
          <div key={p.id} className={styles.propCard}>
            <div className={styles.propCardHeader}>
              <span className={styles.propIcon}>🏢</span>
              <button className={styles.deleteBtn} onClick={() => handleDelete(p.id)}>🗑️</button>
            </div>
            <h4>{p.title}</h4>
            <p className={styles.propLocation}>📍 {p.location}</p>
            <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
            <div className={styles.propMeta}>Owner ID: {p.owner_id}</div>
          </div>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>No properties found</p>}
      </div>
    </div>
  )
}

// ─── TENANTS ──────────────────────────────────────────────────────
function Tenants({ tenants, properties, refresh }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', property_id: '' })
  const [saving, setSaving] = useState(false)

  const filtered = tenants
    .filter(t =>
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.phone?.includes(search)
    )
    .sort((a, b) => {
      let av = a[sortBy] || '', bv = b[sortBy] || ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone || !form.property_id) return toast.error('Fill all fields')
    setSaving(true)
    try {
      await API.post('/tenants/', { ...form, property_id: parseInt(form.property_id) })
      toast.success('Tenant added!'); refresh(); setShowForm(false)
      setForm({ name: '', phone: '', email: '', property_id: '' })
    } catch { toast.error('Failed to add') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Tenants</h2>
          <p className={styles.subtitle}>{tenants.length} registered tenants</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Tenant'}
        </button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>Add New Tenant</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Phone Number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} required>
              <option value="">Select Property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title} — {p.location}</option>)}
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Tenant'}
            </button>
          </form>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍 Search tenants..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="email">Sort: Email</option>
        </select>
        <button className={styles.sortBtn} onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>Name {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th>Phone</th>
              <th onClick={() => { setSortBy('email'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>Email {sortBy === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th>Property</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td>
                  <div className={styles.tenantName}>
                    <div className={styles.miniAvatar}>{t.name?.[0]?.toUpperCase()}</div>
                    {t.name}
                  </div>
                </td>
                <td>{t.phone}</td>
                <td>{t.email}</td>
                <td><span className={styles.badge}>Property #{t.property_id}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No tenants found</p>}
      </div>
    </div>
  )
}

// ─── AGREEMENTS ───────────────────────────────────────────────────
function Agreements({ properties, tenants, refresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', property_id: '', start_date: '', end_date: '', rent: '', deposit: '' })
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/agreements/', {
        ...form,
        tenant_id: parseInt(form.tenant_id),
        property_id: parseInt(form.property_id),
        rent: parseFloat(form.rent),
        deposit: parseFloat(form.deposit)
      })
      toast.success('Agreement created!'); refresh(); setShowForm(false)
      setForm({ tenant_id: '', property_id: '', start_date: '', end_date: '', rent: '', deposit: '' })
    } catch { toast.error('Failed to create') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Agreements</h2>
          <p className={styles.subtitle}>Create and manage rental agreements</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ New Agreement'}
        </button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>Create Rental Agreement</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} required>
              <option value="">Select Tenant</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
            </select>
            <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} required>
              <option value="">Select Property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title} — {p.location}</option>)}
            </select>
            <input type="date" placeholder="Start Date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            <input type="date" placeholder="End Date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
            <input type="number" placeholder="Monthly Rent (₹)" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} required />
            <input type="number" placeholder="Security Deposit (₹)" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} required />
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Creating...' : 'Create Agreement'}
            </button>
          </form>
        </div>
      )}

      <div className={styles.infoBox}>
        <span>📄</span>
        <p>Agreements are linked between tenants and properties. Use the form above to create new rental agreements.</p>
      </div>
    </div>
  )
}

// ─── PAYMENTS ─────────────────────────────────────────────────────
function Payments({ payments, tenants, refresh }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', amount: '', date: '', status: 'paid' })
  const [saving, setSaving] = useState(false)

  const filtered = payments.filter(p => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchSearch = String(p.tenant_id).includes(search) || p.status?.includes(search)
    return matchStatus && matchSearch
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/payments/', {
        ...form,
        tenant_id: parseInt(form.tenant_id),
        amount: parseFloat(form.amount)
      })
      toast.success('Payment recorded!'); refresh(); setShowForm(false)
      setForm({ tenant_id: '', amount: '', date: '', status: 'paid' })
    } catch { toast.error('Failed to record') }
    finally { setSaving(false) }
  }

  const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Payments</h2>
          <p className={styles.subtitle}>{payments.length} total • ₹{totalAmount.toLocaleString()} shown</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Record Payment'}
        </button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>Record Payment</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} required>
              <option value="">Select Tenant</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="number" placeholder="Amount (₹)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </form>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍 Search payments..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Tenant ID</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>Tenant #{p.tenant_id}</td>
                <td>₹{p.amount?.toLocaleString()}</td>
                <td>{p.date}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[p.status]}`}>
                    {p.status === 'paid' ? '✅' : p.status === 'pending' ? '⏳' : '❌'} {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No payments found</p>}
      </div>
    </div>
  )
}
