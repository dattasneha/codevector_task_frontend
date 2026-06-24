import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

/* ── Constants ─────────────────────────────────────────── */

const CATEGORIES = [
  { key: '',                   label: 'All Products',  icon: '🏷️' },
  { key: 'kitchen essentials', label: 'Kitchen',       icon: '🍳' },
  { key: 'cleaning supplies',  label: 'Cleaning',      icon: '🧹' },
  { key: 'office supplies',    label: 'Office',        icon: '📎' },
  { key: 'electronics',        label: 'Electronics',   icon: '⚡' },
  { key: 'books',              label: 'Books',         icon: '📚' },
  { key: 'clothing',           label: 'Clothing',      icon: '👕' },
  { key: 'toys',               label: 'Toys',          icon: '🎮' },
  { key: 'food & beverage',    label: 'Food & Bev',    icon: '🍕' },
  { key: 'home & decor',       label: 'Home & Decor',  icon: '🏠' },
];

const CATEGORY_COLORS = {
  'kitchen essentials': '#ff6b6b',
  'cleaning supplies':  '#4ecdc4',
  'office supplies':    '#45b7d1',
  'electronics':        '#7c6cff',
  'books':              '#f0c644',
  'clothing':           '#ff85a2',
  'toys':               '#26de81',
  'food & beverage':    '#fd9644',
  'home & decor':       '#a55eea',
};

const PAGE_SIZE = 20;

/* ── Formatters ────────────────────────────────────────── */

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(price));
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;

  // Future date
  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    const days = Math.floor(absDiff / 86400000);
    if (days > 0) return `in ${days}d`;
    const hrs = Math.floor(absDiff / 3600000);
    if (hrs > 0) return `in ${hrs}h`;
    return 'just now';
  }

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function prettyName(name) {
  // "product-123456" → "Product #123456"
  return name.replace(/^product-/, 'Product #');
}

/* ── ProductCard ───────────────────────────────────────── */

function ProductCard({ product, index }) {
  const color = CATEGORY_COLORS[product.category] || '#7c6cff';

  return (
    <article
      className="card"
      style={{
        '--card-accent': color,
        animationDelay: `${(index % PAGE_SIZE) * 25}ms`,
      }}
    >
      <div className="card__top">
        <span
          className="card__badge"
          style={{ backgroundColor: `${color}18`, color, borderColor: `${color}30` }}
        >
          {product.category}
        </span>
        <span className="card__id">#{product.id}</span>
      </div>

      <h3 className="card__name">{prettyName(product.name)}</h3>

      <div className="card__price">{formatPrice(product.price)}</div>

      <div className="card__meta">
        <span title={`Created ${new Date(product.created_at).toLocaleString()}`}>
          Updated {timeAgo(product.updated_at)}
        </span>
      </div>
    </article>
  );
}

/* ── Skeleton Card ─────────────────────────────────────── */

function SkeletonCard({ index }) {
  return (
    <div className="card card--skeleton" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="skel skel--badge" />
      <div className="skel skel--title" />
      <div className="skel skel--price" />
      <div className="skel skel--meta" />
    </div>
  );
}

/* ── App ───────────────────────────────────────────────── */

export default function App() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);

  const sentinelRef = useRef(null);
  const abortRef = useRef(null);

  /* ── Fetch ─────────────────────────────── */

  const fetchProducts = useCallback(
    async (cursor = null, append = false) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (cursor) {
          params.set('cursorUpdatedAt', cursor.updatedAt);
          params.set('cursorId', cursor.id);
        }

        const t0 = performance.now();
        const API_BASE = import.meta.env.DEV ? '' : 'https://codevector-task-au48.onrender.com';
        const res = await fetch(`${API_BASE}/products?${params}`, {
          signal: controller.signal,
        });
        setLatency(Math.round(performance.now() - t0));

        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();

        setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
        setNextCursor(data.nextCursor);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [category],
  );

  /* ── Reset on category change ──────────── */

  useEffect(() => {
    setProducts([]);
    setNextCursor(null);
    setInitialLoad(true);
    fetchProducts(null, false);
  }, [category, fetchProducts]);

  /* ── Infinite scroll ───────────────────── */

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && nextCursor && !loading) {
          fetchProducts(nextCursor, true);
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loading, fetchProducts]);

  /* ── Handlers ──────────────────────────── */

  const pickCategory = (key) => {
    if (key === category) return;
    setCategory(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Render ────────────────────────────── */

  return (
    <div className="app">
      {/* ── Header ──────────────────────── */}
      <header className="header" id="header">
        <div className="header__inner">
          <div className="header__brand">
            <span className="header__logo" aria-hidden="true">🛍️</span>
            <div>
              <h1 className="header__title">Product Catalog</h1>
              <p className="header__sub">
                Browse 200k+ products · cursor-based pagination
              </p>
            </div>
          </div>

          <div className="header__metrics">
            <div className="metric" id="metric-loaded">
              <span className="metric__val">{products.length.toLocaleString()}</span>
              <span className="metric__label">loaded</span>
            </div>
            {latency !== null && (
              <div className="metric" id="metric-latency">
                <span className="metric__val">{latency}<small>ms</small></span>
                <span className="metric__label">latency</span>
              </div>
            )}
            {nextCursor && (
              <div className="metric metric--accent" id="metric-cursor">
                <span className="metric__val">●</span>
                <span className="metric__label">has more</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Category Nav ────────────────── */}
      <nav className="filters" id="category-filter" aria-label="Filter by category">
        <div className="filters__track">
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            const accent = cat.key ? CATEGORY_COLORS[cat.key] : undefined;
            return (
              <button
                key={cat.key}
                id={`filter-${cat.key || 'all'}`}
                className={`pill ${active ? 'pill--active' : ''}`}
                onClick={() => pickCategory(cat.key)}
                style={active && accent ? { '--pill-accent': accent } : undefined}
                aria-pressed={active}
              >
                <span className="pill__icon">{cat.icon}</span>
                <span className="pill__text">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Main Grid ───────────────────── */}
      <main className="main" id="product-list">
        {error && (
          <div className="banner banner--error" role="alert">
            <span>⚠️ {error}</span>
            <button className="banner__btn" onClick={() => fetchProducts(null, false)}>
              Retry
            </button>
          </div>
        )}

        {initialLoad ? (
          <div className="grid">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty" id="empty-state">
            <span className="empty__icon">📦</span>
            <h2 className="empty__title">No products found</h2>
            <p className="empty__sub">Try selecting a different category</p>
          </div>
        ) : (
          <>
            <div className="grid">
              {products.map((p, i) => (
                <ProductCard key={`${p.id}`} product={p} index={i} />
              ))}
            </div>

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="sentinel" id="scroll-sentinel">
              {loading && (
                <div className="loader">
                  <div className="loader__spinner" />
                  <span>Loading more products…</span>
                </div>
              )}
              {!nextCursor && !loading && (
                <div className="end-msg">
                  ✨ You've reached the end — {products.length.toLocaleString()} products loaded
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
