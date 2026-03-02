const GRIST_URL = 'data.json';

let allRecords = [];
let filtered = [];

// ── Fetch ──────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(GRIST_URL);
    const json = await res.json();
    allRecords = json.records.map(r => r.fields);
    populateFilters();
    applyFilters();
  } catch (e) {
    document.getElementById('grid').innerHTML =
      `<div class="state-message"><span class="big">✕</span>Failed to load collection. Please try again.</div>`;
  }
}

// ── Filter population ──────────────────────────────────────
function populateFilters() {
  const cultures = [...new Set(allRecords.map(r => r.culture).filter(Boolean))].sort();
  const sel = document.getElementById('filter-culture');
  cultures.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });

  // Top-level instrument families from classification
  const families = [...new Set(allRecords.map(r => {
    const c = r.classification || '';
    return c.split('-')[0].trim();
  }).filter(Boolean))].sort();
  const sel2 = document.getElementById('filter-type');
  families.forEach(f => {
    const o = document.createElement('option');
    o.value = f; o.textContent = f;
    sel2.appendChild(o);
  });
}

// ── Filtering ──────────────────────────────────────────────
function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const culture = document.getElementById('filter-culture').value;
  const type = document.getElementById('filter-type').value;
  const era = document.getElementById('filter-era').value;

  filtered = allRecords.filter(r => {
    if (culture && r.culture !== culture) return false;
    if (type && !(r.classification || '').startsWith(type)) return false;
    if (era) {
      const [from, to] = era.split(',').map(Number);
      const begin = r.objectBeginDate;
      const end = r.objectEndDate;
      if (!begin && !end) return false;
      if ((end || begin) < from || (begin || end) > to) return false;
    }
    if (q) {
      const haystack = [r.title, r.objectName, r.culture, r.medium,
        r.classification, r.country, r.artistDisplayName, r.objectDate]
        .join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  document.getElementById('record-count').textContent = filtered.length.toLocaleString();
  renderGrid();
}

// ── Render ─────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="state-message"><span class="big">∅</span>No instruments match your filters.</div>`;
    return;
  }

  // Render in chunks to keep UI responsive
  grid.innerHTML = '';
  const CHUNK = 100;
  let i = 0;

  function renderChunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(i + CHUNK, filtered.length);
    for (; i < end; i++) {
      frag.appendChild(makeCard(filtered[i], i));
    }
    grid.appendChild(frag);
    if (i < filtered.length) requestAnimationFrame(renderChunk);
  }
  renderChunk();
}

function makeCard(r, idx) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.animationDelay = `${Math.min(idx % 20, 19) * 20}ms`;

  const imgSrc = r.primaryImageSmall || r.primaryImage || '';
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${esc(r.title)}" loading="lazy">`
    : `<div class="no-img">♩</div>`;

  const topFamily = (r.classification || '').split('-')[0].trim();
  const dateStr = r.objectDate || (r.objectBeginDate ? `ca. ${r.objectBeginDate}` : '');

  card.innerHTML = `
    <div class="card-img">${imgHtml}</div>
    <div class="card-body">
      <div class="card-name">${esc(r.title || r.objectName || 'Untitled')}</div>
      <div class="card-culture">${esc(r.culture || r.country || '')}</div>
      <div class="card-meta">${esc(dateStr)}${r.medium ? ' · ' + truncate(r.medium, 40) : ''}</div>
      ${topFamily ? `<div class="card-classification">${esc(topFamily)}</div>` : ''}
    </div>`;

  card.addEventListener('click', () => openModal(r));
  return card;
}

// ── Modal ──────────────────────────────────────────────────
function openModal(r) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-eyebrow').textContent =
    [r.culture || r.country, r.objectDate].filter(Boolean).join(' · ');
  document.getElementById('modal-title').textContent = r.title || r.objectName || 'Untitled';

  // Main image
  const mainImg = document.getElementById('modal-main-img');
  mainImg.src = r.primaryImage || r.primaryImageSmall || '';
  mainImg.alt = r.title || '';

  // Fields
  const fields = [
    ['Object', r.objectName],
    ['Culture', r.culture],
    ['Country', r.country],
    ['Period', r.period],
    ['Date', r.objectDate],
    ['Medium', r.medium],
    ['Dimensions', r.dimensions],
    ['Classification', r.classification],
    ['Maker', r.artistDisplayName],
    ['Credit', r.creditLine],
    ['Accession', r.accessionNumber],
  ].filter(([, v]) => v);

  const fieldsEl = document.getElementById('modal-fields');
  fieldsEl.innerHTML = fields.map(([k, v]) =>
    `<div class="field-row"><span class="field-key">${esc(k)}</span><span class="field-val">${esc(v)}</span></div>`
  ).join('') +
  (r.objectURL ? `<div class="modal-divider"></div><div class="field-row"><span class="field-key">View at</span><span class="field-val"><a href="${esc(r.objectURL)}" target="_blank">metmuseum.org →</a></span></div>` : '');

  // Thumbnails
  const thumbs = [r.primaryImageSmall, ...(r.additionalImages ? r.additionalImages.split('|') : [])]
    .filter(Boolean).slice(0, 6);

  const thumbStrip = document.getElementById('modal-thumbs');
  thumbStrip.innerHTML = thumbs.length > 1 ? thumbs.map((src, i) =>
    `<img src="${src}" class="${i === 0 ? 'active' : ''}" data-full="${i === 0 ? r.primaryImage : src}" alt="">`
  ).join('') : '';

  thumbStrip.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => {
      mainImg.src = img.dataset.full || img.src.replace('web-large', 'original');
      thumbStrip.querySelectorAll('img').forEach(t => t.classList.remove('active'));
      img.classList.add('active');
    });
  });

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── View toggle ────────────────────────────────────────────
document.getElementById('btn-grid').addEventListener('click', () => {
  document.getElementById('grid').classList.remove('list-view');
  document.getElementById('btn-grid').classList.add('active');
  document.getElementById('btn-list').classList.remove('active');
});

document.getElementById('btn-list').addEventListener('click', () => {
  document.getElementById('grid').classList.add('list-view');
  document.getElementById('btn-list').classList.add('active');
  document.getElementById('btn-grid').classList.remove('active');
});

// ── Event listeners ────────────────────────────────────────
let searchTimer;
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 200);
});
document.getElementById('filter-culture').addEventListener('change', applyFilters);
document.getElementById('filter-type').addEventListener('change', applyFilters);
document.getElementById('filter-era').addEventListener('change', applyFilters);
document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('search').value = '';
  document.getElementById('filter-culture').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-era').value = '';
  applyFilters();
});

// ── Helpers ────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

// ── Init ───────────────────────────────────────────────────
loadData();
