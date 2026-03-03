const { createApp, ref, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

createApp({
  setup() {
    // ── State ──────────────────────────────────────────────────
    const allRecords = ref([]);
    const loading = ref(true);
    const error = ref(false);

    const searchRaw = ref('');
    const search = ref('');
    const culture = ref('');
    const type = ref('');
    const era = ref('');
    const view = ref('grid');

    const modalIndex = ref(-1);
    const modalThumbIdx = ref(0);

    // ── Debounced search ───────────────────────────────────────
    let searchTimer;
    watch(searchRaw, (v) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { search.value = v.toLowerCase().trim(); }, 200);
    });

    // ── Derived data ───────────────────────────────────────────
    const cultures = computed(() =>
      [...new Set(allRecords.value.map(r => r.culture).filter(Boolean))].sort()
    );

    const types = computed(() =>
      [...new Set(allRecords.value.map(r =>
        (r.classification || '').split('-')[0].trim()
      ).filter(Boolean))].sort()
    );

    const filtered = computed(() => {
      const q = search.value;
      const c = culture.value;
      const t = type.value;
      const e = era.value;
      return allRecords.value.filter(r => {
        if (c && r.culture !== c) return false;
        if (t && !(r.classification || '').startsWith(t)) return false;
        if (e) {
          const [from, to] = e.split(',').map(Number);
          const begin = r.objectBeginDate;
          const end = r.objectEndDate;
          if (!begin && !end) return false;
          if ((end || begin) < from || (begin || end) > to) return false;
        }
        if (q) {
          const hay = [r.title, r.objectName, r.culture, r.medium,
            r.classification, r.country, r.artistDisplayName, r.objectDate]
            .join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    });

    const hasAnyFilter = computed(() =>
      !!(searchRaw.value || culture.value || type.value || era.value)
    );

    // ── Modal computed ─────────────────────────────────────────
    const modalItem = computed(() =>
      modalIndex.value >= 0 ? filtered.value[modalIndex.value] : null
    );

    const modalThumbs = computed(() => {
      const r = modalItem.value;
      if (!r) return [];
      return [r.primaryImageSmall, ...(r.additionalImages ? r.additionalImages.split('|') : [])]
        .filter(Boolean).slice(0, 6);
    });

    const modalImgSrc = computed(() => {
      const r = modalItem.value;
      if (!r) return '';
      const thumbs = modalThumbs.value;
      if (thumbs.length > 1 && modalThumbIdx.value < thumbs.length) {
        const src = thumbs[modalThumbIdx.value];
        return modalThumbIdx.value === 0
          ? (r.primaryImage || src)
          : src.replace('web-large', 'original');
      }
      return r.primaryImage || r.primaryImageSmall || '';
    });

    const modalFields = computed(() => {
      const r = modalItem.value;
      if (!r) return [];
      return [
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
    });

    // Reset thumb index when switching items
    watch(modalIndex, () => { modalThumbIdx.value = 0; });

    // ── Methods ────────────────────────────────────────────────
    function family(r) {
      return (r.classification || '').split('-')[0].trim();
    }

    function dateStr(r) {
      return r.objectDate || (r.objectBeginDate ? `ca. ${r.objectBeginDate}` : '');
    }

    function truncate(s, n) {
      return s.length > n ? s.slice(0, n) + '\u2026' : s;
    }

    function clearAll() {
      searchRaw.value = '';
      search.value = '';
      culture.value = '';
      type.value = '';
      era.value = '';
    }

    function openModal(idx) {
      modalIndex.value = idx;
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modalIndex.value = -1;
      document.body.style.overflow = '';
    }

    // ── Keyboard navigation ────────────────────────────────────
    function onKeydown(e) {
      if (modalIndex.value < 0) return;
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft' && modalIndex.value > 0) modalIndex.value--;
      else if (e.key === 'ArrowRight' && modalIndex.value < filtered.value.length - 1) modalIndex.value++;
    }

    onMounted(() => document.addEventListener('keydown', onKeydown));
    onUnmounted(() => document.removeEventListener('keydown', onKeydown));

    // ── Fetch data ─────────────────────────────────────────────
    onMounted(async () => {
      try {
        const res = await fetch('data.json');
        const json = await res.json();
        allRecords.value = json.records.map(r => r.fields);
      } catch {
        error.value = true;
      } finally {
        loading.value = false;
      }
    });

    return {
      loading, error, allRecords, filtered,
      searchRaw, culture, type, era, view,
      cultures, types, hasAnyFilter,
      modalIndex, modalItem, modalThumbIdx, modalThumbs, modalImgSrc, modalFields,
      family, dateStr, truncate, clearAll, openModal, closeModal,
    };
  }
}).mount('#app');
