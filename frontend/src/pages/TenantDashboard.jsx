import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'overview',    icon: '📊', label: 'Overview' },
  { id: 'properties',  icon: '🏢', label: 'Browse Properties' },
  { id: 'agreements',  icon: '📄', label: 'My Agreement' },
  { id: 'payments',    icon: '💳', label: 'Payments' },
]

export default function TenantDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]     = useState('overview')
  const [properties, setProperties]   = useState([])
  const [payments, setPayments]       = useState([])
  const [agreements, setAgreements]   = useState([])
  const [loading, setLoading]         = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [p, pay, ag] = await Promise.allSettled([
      API.get('/properties/all'),   // public — all properties for browsing
      API.get('/payments/my'),      // tenant's own payments
      API.get('/agreements/my'),    // tenant's own agreements
    ])
    setProperties( p.status  === 'fulfilled' && Array.isArray(p.value.data)   ? p.value.data   : [])
    setPayments(   pay.status === 'fulfilled' && Array.isArray(pay.value.data) ? pay.value.data : [])
    setAgreements( ag.status  === 'fulfilled' && Array.isArray(ag.value.data)  ? ag.value.data  : [])
    setLoading(false)
  }

  return (
    <div className={styles.dashboard}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className={styles.content}>
        {loading && <div className={styles.loader}><span className={styles.spin} /></div>}
        {!loading && activeTab === 'overview'   && <TenantOverview   properties={properties} payments={payments} agreements={agreements} user={user} setActiveTab={setActiveTab} />}
        {!loading && activeTab === 'properties' && <BrowseProperties properties={properties} />}
        {!loading && activeTab === 'agreements' && <TenantAgreements agreements={agreements} properties={properties} />}
        {!loading && activeTab === 'payments'   && <TenantPayments   payments={payments} />}
      </div>
    </div>
  )
}

function TenantOverview({ properties, payments, agreements, user, setActiveTab }) {
  const paid    = payments.filter(p => p.status === 'paid').length
  const pending = payments.filter(p => p.status === 'pending').length

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Welcome, {user?.name} 🏡</h2>
          <p className={styles.subtitle}>Your rental dashboard</p>
        </div>
      </div>
      <div className={styles.statsGrid}>
        {[
          { icon: '🏢', label: 'Available Properties', value: properties.length, color: '#667eea', tab: 'properties' },
          { icon: '📄', label: 'My Agreements',         value: agreements.length, color: '#8b5cf6', tab: 'agreements' },
          { icon: '✅', label: 'Paid Payments',          value: paid,              color: '#10b981', tab: 'payments'   },
          { icon: '⏳', label: 'Pending',                value: pending,           color: '#f59e0b', tab: 'payments'   },
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
          <h3>Browse Properties</h3>
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
          {properties.length === 0 && <p className={styles.empty}>No properties available yet</p>}
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
          {payments.length === 0 && <p className={styles.empty}>No payment records yet</p>}
        </div>
      </div>
    </div>
  )
}

function BrowseProperties({ properties }) {
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState('price')
  const [sortDir, setSortDir] = useState('asc')
  const [maxPrice, setMaxPrice] = useState('')
  const [contacted, setContacted] = useState({})

  const filtered = properties
    .filter(p => {
      const matchSearch = p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.location?.toLowerCase().includes(search.toLowerCase())
      const matchPrice = !maxPrice || p.price <= parseFloat(maxPrice)
      return matchSearch && matchPrice
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv?.toLowerCase() }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const handleContact = (id, title) => {
    setContacted(prev => ({ ...prev, [id]: true }))
    toast.success(`Interest sent for "${title}"! Owner will contact you.`)
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Browse Properties</h2>
          <p className={styles.subtitle}>{filtered.length} of {properties.length} properties available</p>
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
          {sortDir === 'asc' ? '↑ Low to High' : '↓ High to Low'}
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
            <button
              className={contacted[p.id] ? styles.contactedBtn : styles.contactBtn}
              onClick={() => handleContact(p.id, p.title)}
              disabled={contacted[p.id]}
            >
              {contacted[p.id] ? '✅ Interest Sent' : 'Show Interest'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>No properties match your search. Try adjusting filters.</p>}
      </div>
    </div>
  )
}

function TenantAgreements({ agreements, properties }) {
  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>My Rental Agreements</h2>
          <p className={styles.subtitle}>{agreements.length} agreements found</p>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th>#</th><th>Property</th><th>Start Date</th><th>End Date</th><th>Rent</th><th>Deposit</th></tr>
          </thead>
          <tbody>
            {agreements.map((ag, i) => {
              const p = properties.find(p => p.id === ag.property_id)
              return (
                <tr key={ag.id}>
                  <td>{i + 1}</td>
                  <td>{p ? <><strong>{p.title}</strong><br /><small>📍 {p.location}</small></> : `Property #${ag.property_id}`}</td>
                  <td>{ag.start_date}</td>
                  <td>{ag.end_date}</td>
                  <td>₹{ag.rent?.toLocaleString()}/mo</td>
                  <td>₹{ag.deposit?.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {agreements.length === 0 && <p className={styles.empty}>No agreements yet. Contact an owner to get started.</p>}
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
          <h2>Payment History</h2>
          <p className={styles.subtitle}>Total: ₹{total.toLocaleString()}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Payments</option>
          <option value="paid">✅ Paid</option>
          <option value="pending">⏳ Pending</option>
          <option value="overdue">❌ Overdue</option>
        </select>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>₹{p.amount?.toLocaleString()}</td>
                <td>{p.date}</td>
                <td><span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status === 'paid' ? '✅' : p.status === 'pending' ? '⏳' : '❌'} {p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No payments found.</p>}
      </div>
    </div>
  )
}
