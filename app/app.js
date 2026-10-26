const STORAGE_KEY = 'prep-planner-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      household: parsed?.household ?? null,
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

function readHousehold() {
  const diet = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(el => el.value);
  return {
    people: Math.max(1, parseInt(document.getElementById('household-size').value, 10) || 1),
    children: Math.max(0, parseInt(document.getElementById('children').value, 10) || 0),
    elderly: Math.max(0, parseInt(document.getElementById('elderly').value, 10) || 0),
    pets: Math.max(0, parseInt(document.getElementById('pets').value, 10) || 0),
    tier: document.getElementById('tier').value,
    space: document.getElementById('space').value,
    storageLocation: document.getElementById('storageLocation').value,
    duration: parseInt(document.getElementById('duration').value, 10) || 3,
    cuisine: document.getElementById('cuisine').value,
    diet,
    cooking: document.getElementById('cooking').value,
    devices: Math.max(0, parseInt(document.getElementById('devices').value, 10) || 0),
    solar: document.getElementById('solar').checked,
    postcode: document.getElementById('postcode').value.trim()
  };
}

function populateForm(h) {
  document.getElementById('household-size').value = h.people;
  document.getElementById('children').value = h.children;
  document.getElementById('elderly').value = h.elderly;
  document.getElementById('pets').value = h.pets;
  document.getElementById('tier').value = h.tier || 'comfortable';
  document.getElementById('space').value = h.space;
  document.getElementById('storageLocation').value = h.storageLocation || 'indoor';
  document.getElementById('duration').value = h.duration;
  document.getElementById('cuisine').value = h.cuisine || 'general';
  document.getElementById('cooking').value = h.cooking;
  document.getElementById('devices').value = h.devices;
  document.getElementById('solar').checked = h.solar !== false;
  document.getElementById('postcode').value = h.postcode || '';
  document.querySelectorAll('input[name="diet"]').forEach(el => {
    el.checked = h.diet.includes(el.value);
  });
}

function localSearchUrl(itemName, postcode) {
  const q = postcode ? `${itemName} shop near ${postcode}` : `${itemName} shop near me`;
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

function onlineSearchUrl(itemName) {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(itemName)}`;
}

function itemKey(catId, itemName) {
  return `${catId}::${itemName}`;
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
  let grandTotal = 0;
  let hasUnpriced = false;

  if (h.storageLocation && h.storageLocation !== 'indoor') {
    const warn = document.createElement('p');
    warn.className = 'climate-warning';
    warn.innerHTML = `Storing this in ${STORAGE_LOCATION_LABELS[h.storageLocation]}? Items marked <span class="tag-climate">keep indoors</span> below are damaged by heat, cold or damp — medication, batteries, power banks, formula and similar. Keep those inside and store only the rest out there.`;
    container.appendChild(warn);
  }

  CATEGORIES.forEach(cat => {
    if (cat.showIf && !cat.showIf(h)) return;

    const visibleItems = cat.items
      .filter(item => !item.showIf || item.showIf(h))
      .map(item => ({ item, qty: item.qty(h), cost: item.cost ? item.cost(h) : 0 }))
      .filter(entry => entry.qty !== null && entry.qty !== undefined);

    if (visibleItems.length === 0) return;

    // Tier decides how much gets included; space further trims the "comfortable" tier.
    visibleItems.sort((a, b) => (b.item.essential === true) - (a.item.essential === true));
    let shown;
    if (h.tier === 'minimum') {
      shown = visibleItems.filter(e => e.item.essential);
    } else if (h.tier === 'luxury') {
      shown = visibleItems;
    } else {
      shown = (h.space === 'tiny' || h.space === 'small')
        ? visibleItems.filter((e, i) => e.item.essential || i < limit)
        : visibleItems;
    }

    if (shown.length === 0) return;

    const section = document.createElement('section');
    section.className = `category category--${cat.id}`;

    const heading = document.createElement('h3');
    heading.textContent = cat.title;
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

    shown.forEach(({ item, qty, cost }) => {
      const key = itemKey(cat.id, item.name);
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
      });

      let costLabel = '';
      if (cost === null || cost === undefined) {
        costLabel = ' <span class="tag-cost tag-cost-varies">cost varies</span>';
        hasUnpriced = true;
      } else {
        costLabel = ` <span class="tag-cost">~£${cost.toFixed(2)}</span>`;
        categoryTotal += cost;
        grandTotal += cost;
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
      onlineLink.textContent = 'Compare online';

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

  const totalBox = document.getElementById('cost-total');
  totalBox.innerHTML = `
    <h3>Estimated total cost</h3>
    <p class="total-figure">~£${grandTotal.toFixed(2)}</p>
    <p class="note">Rough UK high-street planning estimate${hasUnpriced ? ' (excludes medication and cash reserve, which vary per household)' : ''}. Use "Find near me" / "Compare online" on each item to check real prices — you likely already own some of this (torches, blankets, pans), which will bring the real cost down.</p>
  `;

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

document.getElementById('intake-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const household = readHousehold();
  state.household = household;
  saveState(state);
  renderPlan(household);
  document.getElementById('intake').classList.add('hidden');
  document.getElementById('plan').classList.remove('hidden');
});

document.getElementById('edit-household').addEventListener('click', () => {
  document.getElementById('plan').classList.add('hidden');
  document.getElementById('intake').classList.remove('hidden');
});

if (state.household) {
  populateForm(state.household);
  renderPlan(state.household);
  document.getElementById('intake').classList.add('hidden');
  document.getElementById('plan').classList.remove('hidden');
}
