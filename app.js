const state = { selectedDay: 0, completed: JSON.parse(localStorage.getItem('kansai-slow-travel-completed') || '{}') };
const $ = (id) => document.getElementById(id);
const money = (value) => `¥${value.toLocaleString('ja-JP')}`;
const iconFor = { arrival: '✈', stay: '⌂', food: '⌁', train: '↝', nature: '✦', culture: '◌', cafe: '☕', fun: '★', shopping: '✳' };
const routeMeta = {
  main: { className: 'main', eyebrow: 'MAIN ROUTE', title: '主要行程' },
  emma: { className: 'emma', eyebrow: 'EMMA ROUTE', title: 'Emma 行程' },
  overprint: { className: 'overprint', eyebrow: 'OVERPRINT ROUTE', title: 'Overprint 分流' }
};
const timeToMinutes = (time) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };

function getRouteMeta(route) {
  const key = route || 'main';
  if (routeMeta[key]) return { key, ...routeMeta[key] };
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return { key, className: 'other', eyebrow: `${label} ROUTE`, title: `${label} 行程` };
}

function init() {
  $('trip-title').textContent = TRIP_DATA.title;
  $('trip-subtitle').textContent = TRIP_DATA.subtitle;
  $('trip-date-range').textContent = TRIP_DATA.dateRange;
  $('trip-location').textContent = TRIP_DATA.location;
  $('trip-description').textContent = TRIP_DATA.description;
  $('trip-note').textContent = TRIP_DATA.note;
  $('trip-days').textContent = String(TRIP_DATA.days.length).padStart(2, '0');
  $('total-stops').textContent = TRIP_DATA.days.reduce((sum, day) => sum + day.stops.length, 0);
  $('total-budget').textContent = money(TRIP_DATA.budget.reduce((sum, item) => sum + item.amount, 0));
  renderTabs(); renderRouteCards(); renderBudget(); renderUtilitySections(); renderDay(); updateProgress();
  $('today-button').addEventListener('click', jumpToToday);
  document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.tab-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== button.dataset.panel; });
    document.getElementById(button.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelector('.nav-links').classList.remove('open');
    $('menu-button').setAttribute('aria-expanded', 'false');
  }));
  $('menu-button').addEventListener('click', () => {
    const open = document.querySelector('.nav-links').classList.toggle('open');
    $('menu-button').setAttribute('aria-expanded', String(open));
  });
}

function renderRouteCards() {
  const tones = ['route-card-vermillion', 'route-card-moss', 'route-card-indigo', 'route-card-sand'];
  $('route-cards').innerHTML = TRIP_DATA.days.slice(0, 4).map((day, index) => {
    const lead = day.stops[0];
    return `<button class="route-card ${tones[index % tones.length]}" type="button" data-route-day="${index}">
      <span class="route-card-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="route-card-mark">${iconFor[lead.type] || '•'}</span>
      <span class="route-card-copy"><small>${day.short} / ${day.weekday} · ${lead.place.split('／')[0]}</small><strong>${day.label}</strong><em>${day.summary}</em></span>
      <span class="route-card-arrow">↗</span>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-route-day]').forEach((button) => button.addEventListener('click', () => {
    state.selectedDay = Number(button.dataset.routeDay); renderTabs(); renderDay(); $('itinerary-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function renderTabs() {
  $('day-tabs').innerHTML = TRIP_DATA.days.map((day, index) => `<button class="day-tab ${index === state.selectedDay ? 'active' : ''}" data-day="${index}" type="button"><span>DAY ${index + 1}</span><strong>${day.short}</strong><small>${day.weekday}</small></button>`).join('');
  document.querySelectorAll('.day-tab').forEach((button) => button.addEventListener('click', () => { state.selectedDay = Number(button.dataset.day); renderTabs(); renderDay(); }));
}

function renderDay() {
  const day = TRIP_DATA.days[state.selectedDay];
  $('selected-day-title').innerHTML = `${day.label} <span>DAY ${state.selectedDay + 1}</span>`;
  $('selected-day-summary').textContent = day.summary;
  const routes = day.stops.reduce((groups, stop, originalIndex) => {
    const route = stop.route || 'main';
    let group = groups.find((item) => item.route === route);
    if (!group) { group = { route, firstIndex: originalIndex, stops: [] }; groups.push(group); }
    group.stops.push({ stop, originalIndex });
    return groups;
  }, []).sort((a, b) => (a.route === 'main' ? -1 : b.route === 'main' ? 1 : a.firstIndex - b.firstIndex));
  routes.forEach((group) => group.stops.sort((a, b) => timeToMinutes(a.stop.time) - timeToMinutes(b.stop.time)));
  const hasParallelRoutes = routes.length > 1;
  const routeNotes = (day.routeNotes || []).map(renderRouteNote).join('');
  $('timeline').innerHTML = `${hasParallelRoutes ? '<div class="parallel-note"><strong>平行行程</strong><span>同一天可以同時安排不同人的路線；每個欄位都是獨立行程。</span></div>' : ''}<div class="timeline-board${hasParallelRoutes ? ' has-parallel-routes' : ''}">${routes.map((group) => {
    const meta = getRouteMeta(group.route);
    return `<section class="route-lane route-lane-${meta.className}" aria-label="${meta.title}"><header class="route-lane-head"><div><span class="section-label">${meta.eyebrow}</span><h3>${meta.title}</h3></div><span class="route-lane-count">${group.stops.length} 站</span></header><div class="route-timeline">${group.stops.map(({ stop, originalIndex }) => renderStop(day, stop, originalIndex, meta.key)).join('')}</div></section>`;
  }).join('')}</div>${routeNotes ? `<div class="route-notes">${routeNotes}</div>` : ''}`;
  document.querySelectorAll('.check-wrap input').forEach((input) => input.addEventListener('change', (event) => { state.completed[event.target.dataset.key] = event.target.checked; localStorage.setItem('kansai-slow-travel-completed', JSON.stringify(state.completed)); event.target.closest('.stop').classList.toggle('completed', event.target.checked); updateProgress(); }));
}

function renderRouteNote(note) {
  const meta = getRouteMeta(note.route);
  const sections = (note.sections || []).map((section) => `<article class="route-note-block"><h4>${section.title}</h4><p>${section.text}</p></article>`).join('');
  const tips = (note.tips || []).map((tip) => `<li>${tip}</li>`).join('');
  return `<details class="route-notes-card route-notes-${meta.className}" open><summary><span class="route-notes-summary-copy"><span class="section-label">${meta.eyebrow}</span><strong>${note.title}</strong></span><span class="route-notes-toggle">展開／收合</span></summary><div class="route-notes-body"><p class="route-notes-intro">${note.intro}</p><div class="route-notes-grid">${sections}</div>${tips ? `<section class="route-notes-tips"><h4>${note.tipsTitle || '提醒'}</h4><ul>${tips}</ul></section>` : ''}</div></details>`;
}

function renderStop(day, stop, originalIndex, route) {
    const key = `${day.id}-${route}-${originalIndex}`;
    const checked = Boolean(state.completed[key]);
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.place)}`;
    const links = (stop.links || []).map((link) => `<a href="${link.url}" target="_blank" rel="noopener">${link.label} ↗</a>`).join('');
    return `<article class="stop ${checked ? 'completed' : ''}"><div class="stop-time"><strong>${stop.time}</strong><span>${stop.leave ? `至 ${stop.leave}` : '彈性'}</span></div><div class="timeline-line"><span class="stop-icon">${iconFor[stop.type] || '•'}</span></div><div class="stop-card"><div class="stop-top"><div><span class="stop-kind">${stop.type.toUpperCase()}</span><h3>${stop.title}</h3></div><label class="check-wrap" title="標記完成"><input type="checkbox" ${checked ? 'checked' : ''} data-key="${key}" /><span></span></label></div><a class="place-link" href="${maps}" target="_blank" rel="noopener">⌖ ${stop.place} <span>↗</span></a><div class="stop-meta"><span>↝ ${stop.transport}</span><span>◷ ${stop.duration}</span></div>${links ? `<div class="stop-links">${links}</div>` : ''}<p class="stop-note">${stop.note}</p><div class="stop-cost">預估 <b>${money(stop.cost)}</b></div></div></article>`;
}

function renderBudget() {
  $('budget-grid').innerHTML = TRIP_DATA.budget.map((item) => `<div class="budget-card ${item.tone}"><div class="budget-icon">${item.icon}</div><div><span>${item.label}</span><strong>${money(item.amount)}</strong></div></div>`).join('');
}

function renderUtilitySections() {
  $('reminders-list').innerHTML = TRIP_DATA.reminders.map((item, index) => { const links = (item.links || []).map((link) => `<a class="reminder-link" href="${link.url}" target="_blank" rel="noopener">${link.label} ↗</a>`).join(''); return `<div class="utility-row"><span class="utility-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${item.title}</strong><p>${item.text}</p>${links ? `<div class="reminder-links">${links}</div>` : ''}</div></div>`; }).join('');
  const checks = JSON.parse(localStorage.getItem('kansai-slow-travel-checks') || '{}');
  $('checklist').innerHTML = TRIP_DATA.checklist.map((item) => `<label class="checklist-row"><input type="checkbox" data-check="${item.id}" ${checks[item.id] ? 'checked' : ''}><span class="check-box"></span><span>${item.text}</span></label>`).join('');
  document.querySelectorAll('[data-check]').forEach((input) => input.addEventListener('change', (event) => { checks[event.target.dataset.check] = event.target.checked; localStorage.setItem('kansai-slow-travel-checks', JSON.stringify(checks)); }));
  $('emergency-grid').innerHTML = TRIP_DATA.emergency.map((item) => `<a class="emergency-card" href="${item.action}" target="_blank" rel="noopener"><span>${item.label}</span><strong>${item.value}</strong><small>開啟 ↗</small></a>`).join('');
}

function updateProgress() {
  const total = TRIP_DATA.days.reduce((sum, day) => sum + day.stops.length, 0);
  const done = Object.values(state.completed).filter(Boolean).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  $('progress-text').textContent = `${percent}%`;
  $('progress-bar').style.width = `${percent}%`;
}

function jumpToToday() {
  const start = new Date('2026-10-11T00:00:00');
  const today = new Date();
  const index = Math.floor((today - start) / 86400000);
  state.selectedDay = Math.max(0, Math.min(TRIP_DATA.days.length - 1, index));
  renderTabs(); renderDay();
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
init();
