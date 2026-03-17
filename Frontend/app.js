/* ============================================================
   LEETCODE RECOMMENDER — app.js
   ============================================================ */

const API = 'http://localhost:8000';   

/* ── State ───────────────────────────────────────────────── */
const state = {
  currentSection: 'dashboard',
  problems:  { page: 1, limit: 20, total: 0, pages: 1, search: '', difficulty: '', topic: '', company: '', faang: false, sort: 'frequency', order: 'desc' },
  top:       { n: 10, metric: 'frequency', difficulty: '', faang: false },
  recommend: { selectedId: null, selectedTitle: '' },
  stats:     null,
  topicStats: [],
};

/* ── DOM refs ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ═══════════════════════════════════════════════════════════
   BACKGROUND CANVAS
═══════════════════════════════════════════════════════════ */
function initCanvas() {
  const canvas = $('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(232,255,0,0.03)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,255,0,${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }

  resize();
  createParticles();
  animate();
  window.addEventListener('resize', () => { resize(); createParticles(); });
}

/* ═══════════════════════════════════════════════════════════
   TOASTER
═══════════════════════════════════════════════════════════ */
const ICONS = { success: '✓', error: '✕', info: '⬡' };

function toast(msg, type = 'info', duration = 3000) {
  const container = $('toaster');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${ICONS[type] || '⬡'}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 500);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════════ */
function initNavbar() {
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinks  = document.querySelector('.nav-links');

  hamburger?.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
  });

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const section = a.dataset.section;
      if (section) navigateTo(section);
      navLinks.classList.remove('open');
    });
  });
}

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const target = document.querySelector(`#section-${section}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const navLink = document.querySelector(`[data-section="${section}"]`);
  navLink?.classList.add('active');

  state.currentSection = section;

  // Load section data
  if (section === 'dashboard') loadDashboard();
  if (section === 'problems') loadProblems();
  if (section === 'recommend') { /* wait for user input */ }
  if (section === 'analytics') loadAnalytics();
}

/* ═══════════════════════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════════════════════ */
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

/* ═══════════════════════════════════════════════════════════
   ANIMATIONS (GSAP-like pure JS)
═══════════════════════════════════════════════════════════ */
function fadeIn(el, delay = 0, fromY = 20) {
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = `translateY(${fromY}px)`;
  el.style.transition = `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`;
  requestAnimationFrame(() => {
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay * 1000);
  });
}

function animateCards(cards, baseDelay = 0) {
  cards.forEach((card, i) => {
    const delay = baseDelay + i * 0.06;
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`;
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, delay * 1000);
  });
}

function animateCounter(el, target, duration = 1200) {
  if (!el) return;
  const start = Date.now();
  const tick = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  tick();
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    // Stats
    if (!state.stats) {
      state.stats = await apiFetch('/api/stats');
    }
    renderStats(state.stats);

    // Top 5 by frequency
    const top5 = await apiFetch('/api/top?n=5&metric=frequency');
    renderTopMini(top5.data, 'dash-top-freq', 'Frequency');

    // Top 5 FAANG
    const top5f = await apiFetch('/api/top?n=5&metric=likes&faang_only=true');
    renderTopMini(top5f.data, 'dash-top-faang', 'Likes');

  } catch(e) {
    toast('Failed to load dashboard data', 'error');
    console.error(e);
  }
}

function renderStats(s) {
  const grid = $('stats-grid');
  if (!grid) return;
  const items = [
    { icon: '⬡', value: s.total,            label: 'Total Problems'   },
    { icon: '◎', value: s.easy,             label: 'Easy'             },
    { icon: '◈', value: s.medium,           label: 'Medium'           },
    { icon: '◆', value: s.hard,             label: 'Hard'             },
    { icon: '⬟', value: s.faang,            label: 'FAANG Asked'      },
    { icon: '⬡', value: s.unique_topics,    label: 'Unique Topics'    },
    { icon: '⬢', value: s.unique_companies, label: 'Companies'        },
  ];
  grid.innerHTML = items.map(it => `
    <div class="stat-card">
      <span class="stat-icon">${it.icon}</span>
      <span class="stat-value" data-target="${it.value}">0</span>
      <span class="stat-label">${it.label}</span>
    </div>
  `).join('');

  const cards = grid.querySelectorAll('.stat-card');
  animateCards([...cards]);

  // Animate counters with a slight delay
  setTimeout(() => {
    grid.querySelectorAll('.stat-value').forEach(el => {
      animateCounter(el, parseInt(el.dataset.target));
    });
  }, 400);
}

function renderTopMini(problems, containerId, metricLabel) {
  const container = $(containerId);
  if (!container) return;
  if (!problems.length) { container.innerHTML = '<p class="empty-state">No data</p>'; return; }

  container.innerHTML = problems.map((p, i) => `
    <div class="rec-card" data-id="${p.id}" style="opacity:0;transform:translateX(-20px)">
      <div class="rank-indicator rank-${i < 3 ? i+1 : 'n'}">${i+1}</div>
      <div class="rec-body">
        <div class="rec-title">${p.title}</div>
        <div class="rec-meta">
          <span class="difficulty-badge ${p.difficulty}">${p.difficulty}</span>
          <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--neon-dim)">
            ${metricLabel}: ${p[metricLabel.toLowerCase()] ?? p.frequency}
          </span>
        </div>
      </div>
    </div>
  `).join('');

  const cards = container.querySelectorAll('.rec-card');
  setTimeout(() => animateCards([...cards]), 200);

  container.querySelectorAll('.rec-card').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
  });
}

/* ═══════════════════════════════════════════════════════════
   PROBLEMS LIST
═══════════════════════════════════════════════════════════ */
async function loadProblems() {
  const container = $('problems-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const { page, limit, search, difficulty, topic, company, faang, sort, order } = state.problems;
  const params = new URLSearchParams({
    page, limit,
    search, difficulty, topic, company,
    faang_only: faang,
    sort_by: sort, order,
  });

  try {
    const data = await apiFetch(`/api/problems?${params}`);
    state.problems.total = data.total;
    state.problems.pages = data.total_pages;
    renderProblems(data.data, container);
    renderPagination();
    $('problems-count').textContent = `${data.total.toLocaleString()} problems`;
  } catch(e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><p>Failed to load problems</p></div>';
    toast('Failed to load problems', 'error');
  }
}

function renderProblems(problems, container) {
  if (!problems.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No problems match your filters</p></div>';
    return;
  }
  container.innerHTML = `<div class="problems-grid">` +
    problems.map(p => problemCard(p)).join('') +
  `</div>`;

  setTimeout(() => {
    const cards = container.querySelectorAll('.problem-card');
    animateCards([...cards]);
    cards.forEach(card => {
      card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
    });
  }, 50);
}

function problemCard(p) {
  const topics = p.related_topics.slice(0, 3);
  const faangBadge = p.asked_by_faang ? `<span class="faang-badge">⬡ FAANG</span>` : '';
  return `
    <div class="problem-card glow-border" data-id="${p.id}" style="opacity:0;transform:translateY(20px)">
      <div class="card-header">
        <span class="card-num">#${p.id}</span>
        <span class="card-title">${p.title}</span>
        <span class="difficulty-badge ${p.difficulty}">${p.difficulty}</span>
      </div>
      <div class="card-meta">
        <span>⬡ ${p.frequency?.toFixed(1) ?? '—'}</span>
        <span>▲ ${p.likes?.toLocaleString()}</span>
        <span>★ ${p.rating}</span>
        ${faangBadge}
      </div>
      <div class="card-tags">
        ${topics.map(t => `<span class="tag">${t}</span>`).join('')}
        ${p.related_topics.length > 3 ? `<span class="tag">+${p.related_topics.length - 3}</span>` : ''}
      </div>
    </div>
  `;
}

function renderPagination() {
  const wrap = $('pagination');
  if (!wrap) return;
  const { page, pages } = state.problems;

  let html = `
    <button class="page-btn" onclick="changePage(${page-1})" ${page <= 1 ? 'disabled' : ''}>‹</button>
  `;

  const delta = 2;
  let range = [];
  for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) range.push(i);
  if (page - delta > 2)   range = ['…', ...range];
  if (page + delta < pages - 1) range = [...range, '…'];
  if (pages > 1) range = [1, ...range, pages];
  else range = [1];

  range.forEach(p => {
    if (p === '…') {
      html += `<span class="page-info">…</span>`;
    } else {
      html += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
    }
  });

  html += `<button class="page-btn" onclick="changePage(${page+1})" ${page >= pages ? 'disabled' : ''}>›</button>`;
  wrap.innerHTML = html;
}

function changePage(p) {
  if (p < 1 || p > state.problems.pages) return;
  state.problems.page = p;
  loadProblems();
  window.scrollTo({ top: document.querySelector('#section-problems')?.offsetTop ?? 0, behavior: 'smooth' });
}

/* ── Filters init ───────────────────────────────────────── */
async function initFilters() {
  try {
    const topics = await apiFetch('/api/topics');
    const topicSel = $('filter-topic');
    if (topicSel) {
      topicSel.innerHTML = '<option value="">All Topics</option>' +
        topics.map(t => `<option value="${t}">${t}</option>`).join('');
    }
  } catch(e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════
   TOP PROBLEMS
═══════════════════════════════════════════════════════════ */
async function loadTop() {
  const container = $('top-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const { n, metric, difficulty, faang } = state.top;
  const params = new URLSearchParams({ n, metric, difficulty, faang_only: faang });

  try {
    const data = await apiFetch(`/api/top?${params}`);
    renderTopList(data.data, container, metric);
  } catch(e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><p>Failed to load</p></div>';
    toast('Failed to load top problems', 'error');
  }
}

function renderTopList(problems, container, metric) {
  if (!problems.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No problems found</p></div>';
    return;
  }
  container.innerHTML = problems.map((p, i) => `
    <div class="rec-card" data-id="${p.id}" style="opacity:0;transform:translateX(-20px)">
      <div class="rank-indicator rank-${i < 3 ? i+1 : 'n'}">${i+1}</div>
      <div class="rec-body">
        <div class="rec-title">${p.title}</div>
        <div class="rec-meta">
          <span class="difficulty-badge ${p.difficulty}">${p.difficulty}</span>
          <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--neon-dim)">
            ${metric}: ${p[metric]?.toLocaleString() ?? '—'}
          </span>
          ${p.asked_by_faang ? '<span class="faang-badge" style="font-size:0.65rem">⬡ FAANG</span>' : ''}
        </div>
      </div>
      <span class="difficulty-badge ${p.difficulty}" style="flex-shrink:0">${p.difficulty}</span>
    </div>
  `).join('');

  setTimeout(() => {
    const cards = container.querySelectorAll('.rec-card');
    animateCards([...cards]);
    cards.forEach(card => card.addEventListener('click', () => openModal(parseInt(card.dataset.id))));
  }, 50);
}

/* ═══════════════════════════════════════════════════════════
   RECOMMENDATIONS
═══════════════════════════════════════════════════════════ */
let acTimeout;
function initRecommend() {
  const input    = $('rec-search-input');
  const dropdown = $('rec-autocomplete');

  input?.addEventListener('input', () => {
    clearTimeout(acTimeout);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.remove('show'); return; }
    acTimeout = setTimeout(async () => {
      try {
        const results = await apiFetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
        renderAutocomplete(results, dropdown, input);
      } catch(e) { /* ignore */ }
    }, 250);
  });

  document.addEventListener('click', e => {
    if (!input?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.remove('show');
    }
  });
}

function renderAutocomplete(results, dropdown, input) {
  if (!results.length) { dropdown.classList.remove('show'); return; }
  dropdown.innerHTML = results.map(r => `
    <div class="autocomplete-item" data-id="${r.id}" data-title="${r.title}">
      <span class="ac-title">${r.title}</span>
      <span class="ac-diff difficulty-badge ${r.difficulty}">${r.difficulty}</span>
    </div>
  `).join('');
  dropdown.classList.add('show');

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      const id    = parseInt(item.dataset.id);
      const title = item.dataset.title;
      input.value = title;
      dropdown.classList.remove('show');
      state.recommend.selectedId    = id;
      state.recommend.selectedTitle = title;
      loadRecommendations(id, title);
    });
  });
}

async function loadRecommendations(id, title) {
  const recSource = $('rec-source');
  const recList   = $('rec-list');

  if (recSource) {
    recSource.innerHTML = `
      <div class="rec-source-card">
        <div class="source-label">Finding similar to</div>
        <div class="source-title">${title}</div>
      </div>
    `;
  }

  if (recList) recList.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const data = await apiFetch(`/api/recommend/${id}?n=15`);
    renderRecommendations(data.recommendations, recList);
    toast(`Found ${data.recommendations.length} similar problems`, 'success');
  } catch(e) {
    if (recList) recList.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><p>Failed to load recommendations</p></div>';
    toast('Failed to load recommendations', 'error');
  }
}

function renderRecommendations(recs, container) {
  if (!recs.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No similar problems found</p></div>';
    return;
  }
  container.innerHTML = `<div class="recs-header">⬡ ${recs.length} similar problems found</div>` +
    recs.map((r, i) => `
      <div class="rec-card" data-id="${r.id}" style="opacity:0;transform:translateX(-20px)">
        <div class="rank-indicator rank-${i < 3 ? i+1 : 'n'}">${i+1}</div>
        <div class="rec-body">
          <div class="rec-title">${r.title}</div>
          <div class="rec-meta">
            <span class="difficulty-badge ${r.difficulty}">${r.difficulty}</span>
            <span>⬡ ${r.frequency?.toFixed(1) ?? '—'}</span>
            ${r.asked_by_faang ? '<span class="faang-badge" style="font-size:0.65rem">⬡ FAANG</span>' : ''}
          </div>
        </div>
        <span class="sim-score">${(r.similarity_score * 100).toFixed(0)}%</span>
      </div>
    `).join('');

  setTimeout(() => {
    const cards = container.querySelectorAll('.rec-card');
    cards.forEach((card, i) => {
      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateX(0)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease, border-color 0.28s ease, box-shadow 0.28s ease, transform 0.28s ease';
      }, i * 60);
      card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
    });
  }, 50);
}

/* ═══════════════════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [stats, topicStats] = await Promise.all([
      state.stats ? Promise.resolve(state.stats) : apiFetch('/api/stats'),
      apiFetch('/api/topic_stats?top_n=12'),
    ]);
    state.stats      = stats;
    state.topicStats = topicStats;
    renderAnalytics(stats, topicStats);
  } catch(e) {
    toast('Failed to load analytics', 'error');
  }
}

function renderAnalytics(stats, topicStats) {
  // Difficulty SVG donut
  const svgWrap = $('difficulty-chart');
  if (svgWrap) {
    const total = stats.easy + stats.medium + stats.hard;
    const easyPct = stats.easy / total;
    const medPct  = stats.medium / total;

    svgWrap.innerHTML = `
      <div class="progress-ring-wrap">
        <div class="ring-item">
          ${donutSVG(easyPct, '#00e676', 60)}
          <div class="ring-val easy" style="margin-top:4px">${stats.easy}</div>
          <div class="ring-label">Easy</div>
        </div>
        <div class="ring-item">
          ${donutSVG(medPct, '#ffa726', 60)}
          <div class="ring-val medium" style="margin-top:4px">${stats.medium}</div>
          <div class="ring-label">Medium</div>
        </div>
        <div class="ring-item">
          ${donutSVG(1 - easyPct - medPct, '#ef5350', 60)}
          <div class="ring-val hard" style="margin-top:4px">${stats.hard}</div>
          <div class="ring-label">Hard</div>
        </div>
      </div>
    `;
  }

  // Topic bars
  const topicWrap = $('topic-chart');
  if (topicWrap && topicStats.length) {
    const max = topicStats[0].count;
    topicWrap.innerHTML = `<div class="topic-bars">` +
      topicStats.map((t, i) => `
        <div class="topic-bar-item" style="opacity:0">
          <span class="topic-bar-label">${t.topic}</span>
          <div class="topic-bar-track">
            <div class="topic-bar-fill" data-width="${(t.count/max*100).toFixed(1)}"></div>
          </div>
          <span class="topic-bar-count">${t.count}</span>
        </div>
      `).join('') +
    `</div>`;

    // animate bars
    setTimeout(() => {
      topicWrap.querySelectorAll('.topic-bar-item').forEach((item, i) => {
        setTimeout(() => {
          item.style.transition = 'opacity 0.4s ease';
          item.style.opacity = '1';
          const fill = item.querySelector('.topic-bar-fill');
          if (fill) fill.style.width = fill.dataset.width + '%';
        }, i * 80);
      });
    }, 300);
  }
}

function donutSVG(pct, color, size) {
  const r = 24, cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const dash  = circ * pct;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="6"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        style="filter:drop-shadow(0 0 6px ${color}66)"/>
    </svg>
  `;
}

/* ═══════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════ */
async function openModal(id) {
  const overlay = $('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="modal">
      <div class="spinner-wrap"><div class="spinner"></div></div>
    </div>
  `;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  try {
    const p = await apiFetch(`/api/problems/${id}`);
    renderModal(p);
  } catch(e) {
    overlay.querySelector('.modal').innerHTML = `
      <button class="modal-close" onclick="closeModal()">✕</button>
      <p style="color:var(--hard)">Failed to load problem details</p>
    `;
    toast('Failed to load problem', 'error');
  }
}

function renderModal(p) {
  const overlay = $('modal-overlay');
  if (!overlay) return;
  const topics    = p.related_topics.map(t => `<span class="tag">${t}</span>`).join('');
  const companies = p.companies.map(c => `<span class="company-chip">${c}</span>`).join('');
  const faangBadge = p.asked_by_faang ? `<span class="faang-badge">⬡ FAANG</span>` : '';

  // Format description: replace markdown backtick code
  const desc = p.description
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\\n/g, '\n');

  overlay.querySelector('.modal').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="modal-title">${p.title}</div>
    <div class="modal-meta">
      <span class="difficulty-badge ${p.difficulty}">${p.difficulty}</span>
      <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--muted)">
        #${p.id} &nbsp;⬡ freq: ${p.frequency?.toFixed(1) ?? '—'} &nbsp;★ ${p.rating} &nbsp;▲ ${p.likes?.toLocaleString()}
      </span>
      ${faangBadge}
    </div>
    <div class="modal-section-title">Description</div>
    <div class="modal-desc">${desc}</div>
    ${topics ? `<div class="modal-section-title">Topics</div><div class="modal-tags">${topics}</div>` : ''}
    ${companies ? `<div class="modal-section-title">Companies</div><div class="modal-companies">${companies}</div>` : ''}
    <div class="modal-actions">
      <a href="${p.url}" target="_blank" rel="noopener" class="btn-primary">⬡ Solve on LeetCode</a>
      <button class="btn-secondary" onclick="closeModal();navigateTo('recommend');prefillRecommend(${p.id},'${p.title.replace(/'/g,"\\'")}')">
        ⬡ Find Similar
      </button>
    </div>
  `;
}

function closeModal() {
  const overlay = $('modal-overlay');
  overlay?.classList.remove('show');
  document.body.style.overflow = '';
}

function prefillRecommend(id, title) {
  const input = $('rec-search-input');
  if (input) {
    input.value = title;
    state.recommend.selectedId    = id;
    state.recommend.selectedTitle = title;
    loadRecommendations(id, title);
  }
}

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
function initScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════════════════════════
   INIT ALL
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  initCanvas();
  initNavbar();

  // Animate page header
  const eyebrow = document.querySelector('.page-header .eyebrow');
  const h1      = document.querySelector('.page-header h1');
  const subp    = document.querySelector('.page-header p');

  if (eyebrow) { eyebrow.style.transition='opacity 0.6s ease'; setTimeout(()=>eyebrow.style.opacity='1', 200); }
  if (h1)      { h1.style.transition='opacity 0.7s ease, transform 0.7s ease'; setTimeout(()=>{h1.style.opacity='1';h1.style.transform='none';}, 400); }
  if (subp)    { subp.style.transition='opacity 0.7s ease'; setTimeout(()=>subp.style.opacity='1', 600); }

  // Load initial section
  await loadDashboard();

  // Init filters (background)
  initFilters();
  initRecommend();
  initScrollReveal();

  // Wire up Top section tab buttons
  document.querySelectorAll('[data-top-n]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-top-n]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.top.n = parseInt(btn.dataset.topN);
      loadTop();
    });
  });

  document.querySelectorAll('[data-top-metric]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-top-metric]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.top.metric = btn.dataset.topMetric;
      loadTop();
    });
  });

  document.querySelectorAll('[data-top-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-top-diff]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.top.difficulty = btn.dataset.topDiff;
      loadTop();
    });
  });

  // Wire up Problems filters
  $('filter-difficulty')?.addEventListener('change', e => {
    state.problems.difficulty = e.target.value;
    state.problems.page = 1;
    loadProblems();
  });
  $('filter-topic')?.addEventListener('change', e => {
    state.problems.topic = e.target.value;
    state.problems.page = 1;
    loadProblems();
  });
  $('filter-sort')?.addEventListener('change', e => {
    state.problems.sort = e.target.value;
    state.problems.page = 1;
    loadProblems();
  });
  $('filter-faang')?.addEventListener('click', () => {
    state.problems.faang = !state.problems.faang;
    $('filter-faang').classList.toggle('active', state.problems.faang);
    state.problems.page = 1;
    loadProblems();
  });

  // Search input (problems)
  let searchTimer;
  $('problems-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.problems.search = e.target.value.trim();
      state.problems.page = 1;
      loadProblems();
    }, 350);
  });

  // Modal ESC close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  $('modal-overlay')?.addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
  });

  // Keyboard shortcut: '/' to focus search
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const searchEl = $('problems-search') || $('rec-search-input');
      if (document.activeElement !== searchEl) {
        e.preventDefault();
        searchEl?.focus();
      }
    }
  });
});
