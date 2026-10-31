const STORAGE_KEY = 'prep-planner-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      // normalizeHousehold is defined below but hoisted (function declaration),
      // so this is safe to call here.
      household: normalizeHousehold(parsed?.household ?? null),
      checked: parsed?.checked ?? {},
      removed: parsed?.removed ?? {}
    };
  } catch {
    return { household: null, checked: {}, removed: {} };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private browsing etc.) — plan still works for this visit
  }
}

let state = loadState();

// Single source of truth for safe defaults. Applied both to freshly-read form
// data and to whatever's been pulled out of localStorage, so a household
// object saved before a field existed (e.g. no `diet`, no `cuisine`) can
// never reach render code as undefined — that's what was crashing the app
// for returning users, and silently blanking the food list.
function normalizeHousehold(h) {
  if (!h) return h;
  return {
    people: Math.max(1, parseInt(h.people, 10) || 1),
    children: Math.max(0, parseInt(h.children, 10) || 0),
    elderly: Math.max(0, parseInt(h.elderly, 10) || 0),
    pets: Math.max(0, parseInt(h.pets, 10) || 0),
    tier: h.tier || 'comfortable',
    space: h.space || 'small',
    storageLocation: h.storageLocation || 'indoor',
    duration: Math.max(1, parseInt(h.duration, 10) || 3),
    cuisine: h.cuisine || 'general',
    diet: Array.isArray(h.diet) ? h.diet : [],
    cooking: h.cooking || 'none',
    devices: Math.max(0, parseInt(h.devices, 10) || 0),
    solar: h.solar !== false,
    postcode: typeof h.postcode === 'string' ? h.postcode.trim() : ''
  };
}

function readHousehold() {
  const diet = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(el => el.value);
  return normalizeHousehold({
    people: document.getElementById('household-size').value,
    children: document.getElementById('children').value,
    elderly: document.getElementById('elderly').value,
    pets: document.getElementById('pets').value,
    tier: document.getElementById('tier').value,
    space: document.getElementById('space').value,
    storageLocation: document.getElementById('storageLocation').value,
    duration: document.getElementById('duration').value,
    cuisine: document.getElementById('cuisine').value,
    diet,
    cooking: document.getElementById('cooking').value,
    devices: document.getElementById('devices').value,
    solar: document.getElementById('solar').checked,
    postcode: document.getElementById('postcode').value
  });
}

// Expects an already-normalized household (see normalizeHousehold) — every
// field is guaranteed present, so no defensive fallbacks needed here.
function populateForm(h) {
  document.getElementById('household-size').value = h.people;
  document.getElementById('children').value = h.children;
  document.getElementById('elderly').value = h.elderly;
  document.getElementById('pets').value = h.pets;
  document.getElementById('tier').value = h.tier;
  document.getElementById('space').value = h.space;
  document.getElementById('storageLocation').value = h.storageLocation;
  document.getElementById('duration').value = h.duration;
  document.getElementById('cuisine').value = h.cuisine;
  document.getElementById('cooking').value = h.cooking;
  document.getElementById('devices').value = h.devices;
  document.getElementById('solar').checked = h.solar;
  document.getElementById('postcode').value = h.postcode;
  document.querySelectorAll('input[name="diet"]').forEach(el => {
    el.checked = h.diet.includes(el.value);
  });
}

// Item names carry planning detail in parentheses ("Rice (dry, long-life)") that
// makes a poor search query — strip it down to the searchable part.
function searchTerm(itemName) {
  return itemName.replace(/\([^)]*\)/g, '').split(/[—–]/)[0].replace(/\s+/g, ' ').trim();
}

function localSearchUrl(itemName, postcode) {
  const term = searchTerm(itemName);
  const q = postcode ? `${term} shop near ${postcode}` : `${term} shop near me`;
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

function onlineSearchUrl(itemName) {
  return `https://www.amazon.co.uk/s?k=${encodeURIComponent(searchTerm(itemName))}`;
}

function itemKey(catId, item) {
  return `${catId}::${item.id || item.name}`;
}

// Replays the fade/slide-in animation on an element that persists across
// renders (CSS animations don't restart just because content changed).
function playEnter(el) {
  el.classList.remove('enter-anim');
  void el.offsetWidth; // force reflow
  el.classList.add('enter-anim');
}

const TIER_LABELS = {
  minimum: 'Minimum',
  comfortable: 'Comfortable',
  luxury: 'Thorough'
};

const STORAGE_LOCATION_LABELS = {
  indoor: 'inside the house',
  loft: 'the loft/attic',
  outbuilding: 'a garage/shed'
};

const CATEGORY_ICONS = {
  water: '💧',
  food: '🍽️',
  cooking: '🔥',
  power: '🔋',
  warmth: '🧥',
  health: '🩹',
  documents: '📄',
  children: '🧸',
  elderly: '🫂',
  wellbeing: '🎲',
  pets: '🐾'
};

// Updates just the progress/cost summary box without touching the category
// list — used on every checkbox toggle so ticking an item off doesn't
// re-trigger the whole list's entrance animation.
function updateProgressSummary(h) {
  let grandTotal = 0;
  let essentialTotal = 0;
  let doneCount = 0;
  let doneCost = 0;
  let activeCount = 0;
  let hasUnpriced = false;
  const limit = SPACE_LIMITS[h.space] ?? 6;

  CATEGORIES.forEach(cat => {
    if (cat.showIf && !cat.showIf(h)) return;
    shownItemsForCategory(cat, h, limit).forEach(({ item, cost }) => {
      const key = itemKey(cat.id, item);
      if (state.removed[key]) return;
      activeCount += 1;
      if (cost === null || cost === undefined) {
        hasUnpriced = true;
      } else {
        grandTotal += cost;
        if (item.essential) essentialTotal += cost;
        if (state.checked[key]) doneCost += cost;
      }
      if (state.checked[key]) doneCount += 1;
    });
  });

  const totalBox = document.getElementById('cost-total');
  const pct = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;
  totalBox.innerHTML = `
    <h3>Estimated total cost</h3>
    <p class="total-figure">~£${grandTotal.toFixed(2)}</p>
    <p class="essentials-figure">Essentials only: ~£${essentialTotal.toFixed(2)}</p>
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${doneCount} of ${activeCount} bought${doneCount > 0 ? ` · ~£${doneCost.toFixed(2)} so far` : ''}</span>
    </div>
    <p class="note">Rough UK high-street planning estimate${hasUnpriced ? ' (excludes medication and cash reserve, which vary per household)' : ''}. Use "Find near me" / "Search Amazon" on each item to check real prices — you likely already own some of this (torches, blankets, pans), which will bring the real cost down.</p>
  `;
  return totalBox;
}

// Shared by renderPlan (builds the DOM) and updateProgressSummary (just
// tallies numbers) so the two can never disagree about what's "shown".
function shownItemsForCategory(cat, h, limit) {
  const visibleItems = cat.items
    .filter(item => !item.showIf || item.showIf(h))
    .map(item => ({ item, qty: item.qty(h), cost: item.cost ? item.cost(h) : 0 }))
    .filter(entry => entry.qty !== null && entry.qty !== undefined);

  if (h.tier === 'minimum') {
    return visibleItems.filter(e => e.item.essential);
  }
  if (h.tier === 'luxury') {
    return visibleItems;
  }
  const essentials = visibleItems.filter(e => e.item.essential);
  const optionals = visibleItems.filter(e => !e.item.essential);
  return essentials.concat(optionals.slice(0, limit));
}

function renderPlan(h) {
  document.getElementById('plan-summary').textContent =
    `Plan for ${h.people} ${h.people === 1 ? 'person' : 'people'}` +
    (h.children ? `, including ${h.children} under 5` : '') +
    (h.elderly ? `, ${h.elderly} with additional needs` : '') +
    (h.pets ? `, ${h.pets} pet(s)` : '') +
    `, covering ${h.duration} day(s). ${TIER_LABELS[h.tier] || 'Comfortable'} level, fitted to "${h.space}" storage space, kept in ${STORAGE_LOCATION_LABELS[h.storageLocation] || 'the house'}.`;

  const limit = SPACE_LIMITS[h.space] ?? 6;
  const container = document.getElementById('categories');
  container.innerHTML = '';

  if (h.storageLocation && h.storageLocation !== 'indoor') {
    const warn = document.createElement('p');
    warn.className = 'climate-warning';
    warn.innerHTML = `Storing this in ${STORAGE_LOCATION_LABELS[h.storageLocation]}? Items marked <span class="tag-climate">keep indoors</span> below are damaged by heat, cold or damp — medication, batteries, power banks, formula and similar. Keep those inside and store only the rest out there.`;
    container.appendChild(warn);
  }

  CATEGORIES.forEach(cat => {
    if (cat.showIf && !cat.showIf(h)) return;

    const shown = shownItemsForCategory(cat, h, limit);
    if (shown.length === 0) return;

    const section = document.createElement('section');
    section.className = `category category--${cat.id}`;

    const heading = document.createElement('h3');
    const icon = CATEGORY_ICONS[cat.id];
    heading.innerHTML = (icon ? `<span class="category-icon" aria-hidden="true">${icon}</span> ` : '') + cat.title;
    section.appendChild(heading);

    if (cat.note) {
      const note = document.createElement('p');
      note.className = 'category-note';
      note.textContent = cat.note;
      section.appendChild(note);
    }

    const relevantDietNotes = h.diet
      .filter(d => DIET_NOTES[d] && (cat.id === 'food' || cat.id === 'cooking'))
      .map(d => DIET_NOTES[d]);
    if (relevantDietNotes.length) {
      const dn = document.createElement('p');
      dn.className = 'diet-note';
      dn.textContent = relevantDietNotes.join(' ');
      section.appendChild(dn);
    }

    const list = document.createElement('ul');
    list.className = 'item-list';
    let categoryTotal = 0;
    let dividerInserted = false;
    const hasOptionals = shown.some(e => !e.item.essential);

    shown.forEach(({ item, qty, cost }) => {
      const key = itemKey(cat.id, item);

      if (hasOptionals && !item.essential && !dividerInserted) {
        const divider = document.createElement('li');
        divider.className = 'item-divider';
        divider.textContent = 'Also recommended';
        list.appendChild(divider);
        dividerInserted = true;
      }

      const li = document.createElement('li');
      li.className = 'item';

      if (state.removed[key]) {
        li.classList.add('removed');
        const text = document.createElement('span');
        text.innerHTML = `<strong>${item.name}</strong> — removed from your plan`;

        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'link-btn';
        restoreBtn.textContent = 'Add back';
        restoreBtn.addEventListener('click', () => {
          delete state.removed[key];
          saveState(state);
          renderPlan(h);
        });

        li.appendChild(text);
        li.appendChild(restoreBtn);
        list.appendChild(li);
        return;
      }

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!state.checked[key];
      checkbox.addEventListener('change', () => {
        state.checked[key] = checkbox.checked;
        saveState(state);
        li.classList.toggle('done', checkbox.checked);
        updateProgressSummary(h);
      });

      let costLabel = '';
      if (cost === null || cost === undefined) {
        costLabel = ' <span class="tag-cost tag-cost-varies">cost varies</span>';
      } else {
        costLabel = ` <span class="tag-cost">~£${cost.toFixed(2)}</span>`;
        categoryTotal += cost;
      }

      const climateTag = item.climateSensitive && h.storageLocation && h.storageLocation !== 'indoor'
        ? ' <span class="tag-climate">keep indoors</span>'
        : '';

      const text = document.createElement('span');
      text.innerHTML = `<strong>${item.name}</strong> — ${qty}` + costLabel + (item.essential ? ' <span class="tag-essential">essential</span>' : '') + climateTag;

      label.appendChild(checkbox);
      label.appendChild(text);
      li.appendChild(label);
      if (state.checked[key]) li.classList.add('done');

      const links = document.createElement('div');
      links.className = 'item-links';

      const localLink = document.createElement('a');
      localLink.href = localSearchUrl(item.name, h.postcode);
      localLink.target = '_blank';
      localLink.rel = 'noopener';
      localLink.textContent = 'Find near me';

      const onlineLink = document.createElement('a');
      onlineLink.href = onlineSearchUrl(item.name);
      onlineLink.target = '_blank';
      onlineLink.rel = 'noopener';
      onlineLink.textContent = 'Search Amazon';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-btn link-btn-muted';
      removeBtn.textContent = 'Not needed';
      removeBtn.title = 'Remove from plan — e.g. you already own this';
      removeBtn.addEventListener('click', () => {
        state.removed[key] = true;
        saveState(state);
        renderPlan(h);
      });

      links.appendChild(localLink);
      links.appendChild(onlineLink);
      links.appendChild(removeBtn);
      li.appendChild(links);

      list.appendChild(li);
    });

    const subtotal = document.createElement('p');
    subtotal.className = 'category-subtotal';
    subtotal.textContent = `Category estimate: ~£${categoryTotal.toFixed(2)}`;
    section.appendChild(list);
    section.appendChild(subtotal);
    container.appendChild(section);
  });

  playEnter(updateProgressSummary(h));

  renderMaintenance();
}

function renderMaintenance() {
  const box = document.getElementById('maintenance');
  box.innerHTML = `
    <h4>Maintenance reminders</h4>
    <ul>
      <li>Check bottled water and tinned food "best before" dates every 6 months; rotate stock into normal use before it expires.</li>
      <li>Test torches, radio and power banks every 3 months; replace batteries that have degraded.</li>
      <li>Check gas canisters are sealed and stove ignites correctly every 6 months.</li>
      <li>Review this plan if household size, health needs, or address changes.</li>
    </ul>
  `;
}

// Moves keyboard/screen-reader focus to a panel's heading after it's shown —
// without this, switching views gives no cue to anyone not looking at the
// screen that anything happened.
function focusHeading(panelId) {
  const heading = document.querySelector(`#${panelId} h2`);
  if (heading) heading.focus();
}

document.getElementById('intake-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const household = readHousehold();
  state.household = household;
  saveState(state);
  renderPlan(household);
  document.getElementById('intake').classList.add('hidden');
  document.getElementById('plan').classList.remove('hidden');
  playEnter(document.getElementById('plan'));
  focusHeading('plan');
});

document.getElementById('edit-household').addEventListener('click', () => {
  document.getElementById('plan').classList.add('hidden');
  document.getElementById('intake').classList.remove('hidden');
  playEnter(document.getElementById('intake'));
  focusHeading('intake');
});

document.getElementById('print-plan').addEventListener('click', () => {
  window.print();
});

document.getElementById('start-over').addEventListener('click', () => {
  if (!confirm('Clear your saved plan and start again? This removes it from this device only — it cannot be undone.')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
  location.reload();
});

if (state.household) {
  populateForm(state.household);
  renderPlan(state.household);
  document.getElementById('intake').classList.add('hidden');
  document.getElementById('plan').classList.remove('hidden');
  playEnter(document.getElementById('plan'));
} else {
  playEnter(document.getElementById('intake'));
}

const lastUpdatedEl = document.getElementById('last-updated');
if (lastUpdatedEl && typeof LAST_UPDATED !== 'undefined') {
  lastUpdatedEl.textContent = `Last updated: ${LAST_UPDATED}`;
}
