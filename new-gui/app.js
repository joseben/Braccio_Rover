(() => {
  'use strict';

  // Servo order matches the firmware: base, shoulder, elbow, wrist vertical, wrist rotation, gripper
  const JOINTS = [
    { name: 'Base',           min: 0,  max: 180, home: 90 },
    { name: 'Shoulder',       min: 20, max: 160, home: 90 },
    { name: 'Elbow',          min: 0,  max: 180, home: 90 },
    { name: 'Wrist vertical', min: 0,  max: 180, home: 90 },
    { name: 'Wrist roll',     min: 0,  max: 180, home: 90 },
    { name: 'Gripper',        min: 15, max: 70,  home: 40 },
  ];
  const PRESETS = [
    { name: 'Home',  note: 'Neutral pose', v: [90, 90, 90, 90, 90, 40] },
    { name: 'Rest',  note: 'Folded, parked', v: [90, 40, 160, 160, 90, 70] },
    { name: 'Reach', note: 'Arm extended', v: [90, 120, 90, 90, 90, 70] },
    { name: 'Grab',  note: 'Low, gripper shut', v: [90, 130, 60, 70, 90, 20] },
  ];

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(Math.round(n)).padStart(3, '0');
  const state = JOINTS.map((j) => j.home);
  let selected = 0;

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- build joint rows ----------
  const jointsEl = $('joints');
  const rows = JOINTS.map((j, i) => {
    const el = document.createElement('div');
    el.className = 'joint-row';
    el.innerHTML = `
      <div class="joint-top">
        <span class="joint-idx">${i + 1}</span>
        <span class="joint-name">${j.name}</span>
        <button class="step" data-d="-1" aria-label="decrease">−</button>
        <span class="joint-val mono">${j.home}°</span>
        <button class="step" data-d="1" aria-label="increase">+</button>
      </div>
      <input type="range" min="${j.min}" max="${j.max}" value="${j.home}">
      <div class="range-meta mono"><span>${j.min}°</span><span>${j.max}°</span></div>`;
    jointsEl.appendChild(el);
    const input = el.querySelector('input');
    input.addEventListener('input', () => { select(i); setJoint(i, +input.value, $('liveDrag').checked); });
    input.addEventListener('change', () => { if (!$('liveDrag').checked) markDirty(); });
    el.querySelectorAll('.step').forEach((b) =>
      b.addEventListener('click', () => { select(i); setJoint(i, state[i] + +b.dataset.d * 5, true); }));
    el.addEventListener('pointerdown', () => select(i));
    return { el, input, val: el.querySelector('.joint-val') };
  });

  function select(i) {
    selected = i;
    rows.forEach((r, k) => r.el.classList.toggle('sel', k === i));
  }

  function clamp(i, v) { return Math.max(JOINTS[i].min, Math.min(JOINTS[i].max, Math.round(v))); }

  function setJoint(i, v, send) {
    state[i] = clamp(i, v);
    render();
    if (send) queueSend(); else markDirty();
  }

  function setAll(values, send = true) {
    values.forEach((v, i) => (state[i] = clamp(i, v)));
    render();
    if (send) queueSend(); else markDirty();
  }

  // ---------- rendering ----------
  function render() {
    rows.forEach((r, i) => {
      r.input.value = state[i];
      r.val.textContent = state[i] + '°';
      const p = ((state[i] - JOINTS[i].min) / (JOINTS[i].max - JOINTS[i].min)) * 100;
      r.input.style.setProperty('--p', p + '%');
    });
    $('hudPose').textContent = `B ${pad(state[0])} · S ${pad(state[1])} · E ${pad(state[2])}`;
    $('dialBaseVal').textContent = state[0] + '°';
    $('dialRotVal').textContent = state[4] + '°';
    $('needleBase').style.transform = `rotate(${state[0] - 90}deg)`;
    $('needleRot').style.transform = `rotate(${state[4] - 90}deg)`;
    drawArm();
  }

  // side-view stick model: Braccio 90° = straight/vertical for each joint
  function drawArm() {
    const rad = (d) => (d * Math.PI) / 180;
    const o = { x: 90, y: 186 };
    const a1 = state[1];                          // upper arm angle from +x axis
    const a2 = a1 + (state[2] - 90);              // forearm
    const a3 = a2 + (state[3] - 90);              // wrist
    const seg = (p, a, len) => ({ x: p.x + Math.cos(rad(a)) * len, y: p.y - Math.sin(rad(a)) * len });
    const p1 = seg(o, a1, 62), p2 = seg(p1, a2, 62), p3 = seg(p2, a3, 38);
    const set = (id, a) => Object.entries(a).forEach(([k, v]) => $(id).setAttribute(k, v));
    const line = (id, a, b) => set(id, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    line('l1', o, p1); line('l2', p1, p2); line('l3', p2, p3);
    const open = ((state[5] - 15) / 55) * 34 + 4;  // jaw spread in degrees
    const j1 = seg(p3, a3 + open, 20), j2 = seg(p3, a3 - open, 20);
    line('jawA', p3, j1); line('jawB', p3, j2);
    [[ 'j0', o ], [ 'j1', p1 ], [ 'j2', p2 ], [ 'j3', p3 ]].forEach(([id, p]) => set(id, { cx: p.x, cy: p.y }));
  }

  // decorative ticks + grid
  (function decorate() {
    const ns = 'http://www.w3.org/2000/svg';
    ['ticks', 'ticks2'].forEach((id) => {
      for (let a = 0; a < 360; a += 15) {
        const l = document.createElementNS(ns, 'line');
        const r = (a * Math.PI) / 180, inner = a % 45 ? 38 : 34;
        l.setAttribute('x1', 50 + Math.sin(r) * inner); l.setAttribute('y1', 50 - Math.cos(r) * inner);
        l.setAttribute('x2', 50 + Math.sin(r) * 42);    l.setAttribute('y2', 50 - Math.cos(r) * 42);
        $(id).appendChild(l);
      }
    });
    const g = document.querySelector('.grid-lines');
    for (let x = 20; x < 260; x += 30) { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', 0); l.setAttribute('y2', 195); g.appendChild(l); }
    for (let y = 15; y < 195; y += 30) { const l = document.createElementNS(ns, 'line'); l.setAttribute('y1', y); l.setAttribute('y2', y); l.setAttribute('x1', 0); l.setAttribute('x2', 260); g.appendChild(l); }
  })();

  // ---------- sending (one request in flight, latest pose wins) ----------
  let inFlight = false, pending = false, dirty = false;
  function markDirty() { dirty = true; $('btnSend').hidden = $('liveDrag').checked; }
  function queueSend() { pending = true; if (!inFlight) flush(); }

  async function flush() {
    if (!pending) return;
    pending = false; inFlight = true; dirty = false;
    const q = state.map((v, i) => `servo${i + 1}=${v}`).join('&');
    const t0 = performance.now();
    setPill('pillBoard', 'wait');
    try {
      const res = await fetch(`/control?${q}`, { cache: 'no-store' });
      const text = await res.text();
      const ok = res.ok && !/fail/i.test(text);
      setPill('pillBoard', ok ? 'ok' : 'bad');
      $('pillLatency').textContent = Math.round(performance.now() - t0) + ' ms';
      if (!ok) toast('Arm unreachable — check BOARD_IP');
    } catch {
      setPill('pillBoard', 'bad');
      $('pillLatency').textContent = '— ms';
      toast('Server unreachable');
    }
    inFlight = false;
    if (pending) flush();
  }

  function setPill(id, cls) { $(id).className = 'pill ' + cls + (id === 'pillLatency' ? ' mono' : ''); }

  // ---------- presets / buttons ----------
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = `${p.name}<small>${p.note}</small>`;
    b.addEventListener('click', () => { setAll(p.v); toast(`Preset: ${p.name}`); });
    $('presets').appendChild(b);
  });
  $('btnHome').addEventListener('click', () => { setAll(PRESETS[0].v); toast('Home'); });
  $('btnOpen').addEventListener('click', () => setJoint(5, JOINTS[5].max, true));
  $('btnClose').addEventListener('click', () => setJoint(5, JOINTS[5].min, true));
  $('btnSend').addEventListener('click', () => { queueSend(); $('btnSend').hidden = true; });
  $('liveDrag').addEventListener('change', () => { $('btnSend').hidden = $('liveDrag').checked || !dirty; });

  // ---------- keyboard ----------
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '6') return select(+k - 1);
    if (k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
      const d = (k === 'arrowright' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      setJoint(selected, state[selected] + d, $('liveDrag').checked);
    } else if (k === 'h') setAll(PRESETS[0].v);
    else if (k === ' ') { e.preventDefault(); setJoint(5, state[5] > 42 ? JOINTS[5].min : JOINTS[5].max, true); }
    else if (k === 'c') $('btnCross').click();
    else if (k === 's' && !e.ctrlKey && !e.metaKey) $('btnSnap').click();
    else if (k === 'f') $('btnFull').click();
  });

  // ---------- camera ----------
  const feed = $('feed');
  let retryT;
  function connectCam() {
    clearTimeout(retryT);
    setPill('pillVideo', 'wait');
    $('camOffline').classList.remove('show');
    feed.src = '/video?t=' + Date.now();
  }
  feed.addEventListener('load', () => {
    setPill('pillVideo', 'ok');
    $('liveBadge').classList.remove('off');
  });
  feed.addEventListener('error', () => {
    setPill('pillVideo', 'bad');
    $('liveBadge').classList.add('off');
    $('camOffline').classList.add('show');
    retryT = setTimeout(connectCam, 5000);
  });
  $('btnRetry').addEventListener('click', connectCam);

  $('btnCross').addEventListener('click', () => {
    $('crosshair').classList.toggle('on');
    $('btnCross').classList.toggle('on');
  });
  $('btnFull').addEventListener('click', () => {
    document.fullscreenElement ? document.exitFullscreen() : $('camWrap').requestFullscreen?.();
  });
  $('btnSnap').addEventListener('click', () => {
    if (!feed.naturalWidth) return toast('No frame to capture');
    try {
      const c = document.createElement('canvas');
      c.width = feed.naturalWidth; c.height = feed.naturalHeight;
      c.getContext('2d').drawImage(feed, 0, 0);
      const a = document.createElement('a');
      a.download = `braccio-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
      toast('Snapshot saved');
    } catch { toast('Snapshot failed'); }
  });

  setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString([], { hour12: false }); }, 1000);

  // ---------- init ----------
  select(0);
  render();
  connectCam();
})();
