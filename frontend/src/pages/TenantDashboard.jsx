import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'properties', icon: '🏢', label: 'Browse Properties' },
  { id: 'payments', icon: '💳', label: 'My Payments' },
]

export default function TenantDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [properties, setProperties] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [p, pay] = await Promise.all([
        API.get('/properties/'),
        API.get('/payments/'),
      ])
      setProperties(Array.isArray(p.data) ? p.data : [])
      setPayments(Array.isArray(pay.data) ? pay.data : [])
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.dashboard}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className={styles.content}>
        {loading && <div className={styles.loader}><span className={styles.spin} /></div>}
        {!loading && activeTab === 'overview' && <TenantOverview properties={properties} payments={payments} user={user} setActiveTab={setActiveTab} />}
        {!loading && activeTab === 'properties' && <BrowseProperties properties={properties} />}
        {!loading && activeTab === 'payments' && <TenantPayments payments={payments} />}
      </div>
    </div>
  )
}

function TenantOverview({ properties, payments, user, setActiveTab }) {
  const paid = payments.filter(p => p.status === 'paid').length
  const pending = payments.filter(p => p.status === 'pending').length

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Welcome, {user?.name} 🏡</h2>
          <p className={styles.subtitle}>Your rental overview</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {[
          { icon: '🏢', label: 'Available Properties', value: properties.length, color: '#667eea', tab: 'properties' },
          { icon: '💳', label: 'Total Payments', value: payments.length, color: '#10b981', tab: 'payments' },
          { icon: '✅', label: 'Paid', value: paid, color: '#06b6d4', tab: 'payments' },
          { icon: '⏳', label: 'Pending', value: pending, color: '#f59e0b', tab: 'payments' },
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
          <h3>Available Properties</h3>
          {properties.slice(0, 5).map(p => (
            <div key={p.id} className={styles.listRow}>
              <span className={styles.listIcon}>🏢</span>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>{p.title}</div>
                <div className={styles.listSub}>📍 {p.location}</div>
              </div>
              <div className={styles.listBadge}>₹{p.price?.toLocaleString()}</div>
            </div>
          ))}
          {properties.length === 0 && <p className={styles.empty}>No properties available</p>}
        </div>
        <div className={styles.overviewCard}>
          <h3>Payment History</h3>
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
          {payments.length === 0 && <p className={styles.empty}>No payment records</p>}
        </div>
      </div>
    </div>
  )
}

function BrowseProperties({ properties }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('price')
  const [sortDir, setSortDir] = useState('asc')
  const [maxPrice, setMaxPrice] = useState('')

  const filtered = properties
    .filter(p => {
      const matchSearch =
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.location?.toLowerCase().includes(search.toLowerCase())
      const matchPrice = !maxPrice || p.price <= parseFloat(maxPrice)
      return matchSearch && matchPrice
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Browse Properties</h2>
          <p className={styles.subtitle}>{filtered.length} of {properties.length} properties</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍 Search by name or location..." value={search} onChange={e => setSearch(e.target.value)} />
        <input className={styles.search} style={{ maxWidth: 200 }} type="number" placeholder="Max Price (₹)" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="price">Sort: Price</option>
          <option value="title">Sort: Title</option>
          <option value="location">Sort: Location</option>
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
              <span className={styles.availBadge}>Available</span>
            </div>
            <h4>{p.title}</h4>
            <p className={styles.propLocation}>📍 {p.location}</p>
            <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
            <button className={styles.contactBtn} onClick={() => toast.success('Contact request sent!')}>
              Contact Owner
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>No properties match your search</p>}
      </div>
    </div>
  )
}

function TenantPayments({ payments }) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = statusFilter === 'all' ? payments : payments.filter(p => p.status === statusFilter)
  const total = filtered.reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>My Payments</h2>
          <p className={styles.subtitle}>Total shown: ₹{total.toLocaleString()}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Payments</option>
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
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
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
