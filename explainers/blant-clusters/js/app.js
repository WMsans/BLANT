// Page wiring: spine of pipeline chambers, narration, the source panel, controls and persistence.
(function () {
  'use strict';
  const D = SIM.run();
  const steps = [...STEPS_A(D), ...STEPS_B(D), ...STEPS_C(D)];
  steps.forEach(s => { s.textLen = s.text.replace(/<[^>]+>/g, '').length; });

  const CH = [
    ['The idea', 'why counting small pictures works'],
    ['bash setup', 'options, inputs, network stats'],
    ['blant ×k', 'sample graphlets in parallel'],
    ['awk #1', 'keep dense graphlets, tally'],
    ['sort -gr', 'rank by tally'],
    ['awk #2', 'grow communities'],
    ['sort | awk #3', 'drop exact duplicates'],
    ['merge', 'overlap filter, report'],
  ];
  const $ = id => document.getElementById(id);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ---- spine ----
  const spine = $('spine'), chEls = [], tickEls = [], pipes = [];
  CH.forEach(([name, sub], c) => {
    if (c === 0) spine.insertAdjacentHTML('beforeend', '<div class="part">The idea</div>');
    if (c === 1) spine.insertAdjacentHTML('beforeend', '<div class="part">The script, line by line</div>');
    if (c > 1) { const p = document.createElement('div'); p.className = 'pipe'; spine.appendChild(p); pipes[c] = p; }
    const b = document.createElement('div');
    b.className = 'ch'; b.tabIndex = 0; b.setAttribute('role', 'button');
    const idx = steps.map((s, i) => s.ch === c ? i : -1).filter(i => i >= 0);
    const subs = [...new Set(idx.map(i => steps[i].sub).filter(Boolean))];
    b.innerHTML = `<b>${name}</b><span>${sub}</span><div class="ticks">${idx.map(i => `<i data-i="${i}" title="Step ${i + 1}"></i>`).join('')}</div>` +
      (subs.length ? `<div class="subs">${subs.map(s => `<div data-sub="${s}">${s}</div>`).join('')}</div>` : '');
    b.addEventListener('click', e => { const t = e.target.closest('i[data-i]'); player.go(t ? +t.dataset.i : idx[0]); player.setPlaying(false); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); player.go(idx[0]); } });
    spine.appendChild(b); chEls[c] = b;
    b.querySelectorAll('i[data-i]').forEach(t => tickEls[+t.dataset.i] = t);
  });

  // ---- source ----
  const src = $('src');
  src.innerHTML = SRC.map((l, i) => `<div data-l="${i + 1}"><i>${i + 1}</i>${HL.highlight(l) || ' '}</div>`).join('');
  const lineEls = [...src.children];
  function showCode(s) {
    lineEls.forEach(e => e.className = '');
    const ranges = s.lines || [];
    ranges.forEach(([a, b]) => { for (let l = a; l <= Math.min(b, SRC.length); l++) lineEls[l - 1].className = 'in'; });
    const focus = s.focus != null ? [].concat(s.focus) : ranges.length && ranges[0][1] - ranges[0][0] < 12 ? [...Array(ranges[0][1] - ranges[0][0] + 1).keys()].map(k => ranges[0][0] + k) : [];
    focus.forEach(l => lineEls[l - 1] && (lineEls[l - 1].className = 'on'));
    $('range').textContent = ranges.length ? ranges.map(([a, b]) => a === b ? a : `${a}–${b}`).join(', ') : '';
    const t = lineEls[(focus[0] || (ranges[0] && ranges[0][0]) || 1) - 1];
    if (t) src.scrollTo({ top: t.offsetTop - src.clientHeight * .3, behavior: 'smooth' });
  }

  // ---- step hook ----
  function onStep(i) {
    const s = steps[i];
    $('title').textContent = s.title;
    $('narr').innerHTML = s.text;
    $('count').textContent = `${i + 1} / ${steps.length}`;
    $('bar').style.width = `${(i + 1) / steps.length * 100}%`;
    chEls.forEach((e, c) => e.classList.toggle('on', c === s.ch));
    tickEls.forEach((t, j) => { t.classList.toggle('now', j === i); t.classList.toggle('done', j < i); });
    pipes.forEach((p, c) => { if (p) { p.classList.toggle('flow', c <= s.ch); p.classList.toggle('hot', c === s.ch); } });
    const on = chEls[s.ch];
    on.querySelectorAll('.subs div').forEach(d => d.classList.toggle('now', d.dataset.sub === s.sub));
    if (window.matchMedia('(max-width:1100px)').matches) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    showCode(s);
    try { localStorage.setItem('blant-clusters-step', i); } catch (e) { /* storage may be blocked */ }
    if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', '#' + (i + 1));
  }
  function onPlay(v) { const b = $('play'); b.setAttribute('aria-pressed', v); b.textContent = v ? '❚❚' : '▶'; b.setAttribute('aria-label', v ? 'Pause' : 'Play'); }

  const player = ENGINE.Player($('cv'), steps, { onStep, onPlay });
  $('prev').onclick = () => player.prev();
  $('next').onclick = () => player.next();
  $('play').onclick = () => player.toggle();
  $('again').onclick = () => player.replay();
  $('cv').addEventListener('click', () => player.next());
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('.ch')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); player.next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); player.prev(); }
    else if (e.key === ' ') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'Home') player.go(0);
    else if (e.key === 'End') player.go(steps.length - 1);
  });

  let start = 0;
  const h = parseInt(location.hash.slice(1), 10);
  if (h >= 1 && h <= steps.length) start = h - 1;
  else { try { const v = parseInt(localStorage.getItem('blant-clusters-step'), 10); if (v >= 0 && v < steps.length) start = v; } catch (e) { /* ignore */ } }
  const begin = () => player.go(start);
  const faces = ['400 20px "STIX Two Text"', 'italic 400 20px "STIX Two Text"', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"', '700 20px Archivo', '400 20px Archivo'];
  const ready = document.fonts ? Promise.all(faces.map(f => document.fonts.load(f))).catch(() => null) : Promise.resolve();
  Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(begin);
  window.__player = player; window.__steps = steps;
})();
