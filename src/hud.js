// The game HUD drawn over the 3D scene: radar minimap and event feed (Call of Duty style),
// speedometer with nitro, speed trap and pit stop read-outs (Need for Speed style), XP and race results.
// It is decoration: everything it says is also in the page, so it is hidden from screen readers.

const TEXT = {
  en: {
    checkpoint: 'CHECKPOINT',
    trap: 'SPEED TRAP',
    pit: 'PIT STOP',
    go: 'GO!',
    finish: 'FINISH',
    results: 'RACE RESULTS',
    time: 'Time',
    top: 'Top speed',
    checkpoints: 'Checkpoints',
    pits: 'Best pit stop',
    xp: 'XP earned',
    lap: 'LAP',
    pos: 'POS',
    sections: ['How I work', 'Projects', 'Skills'],
  },
  it: {
    checkpoint: 'CHECKPOINT',
    trap: 'AUTOVELOX',
    pit: 'PIT STOP',
    go: 'VIA!',
    finish: 'TRAGUARDO',
    results: 'RISULTATI DELLA GARA',
    time: 'Tempo',
    top: 'Velocità massima',
    checkpoints: 'Checkpoint',
    pits: 'Pit stop migliore',
    xp: 'XP guadagnati',
    lap: 'GIRO',
    pos: 'POS',
    sections: ['Come lavoro', 'Progetti', 'Competenze'],
  },
};

const XP = { gate: 500, pit: 300, finish: 1000 };
const LEVEL = 1000;
const RADAR_METRES = 120; // radius shown on the radar

export function createHud({ root, map, lang }) {
  let t = TEXT[lang] || TEXT.en;
  root.innerHTML = `
    <div class="hud-radar">
      <canvas width="336" height="336"></canvas>
      <div class="hud-level"><span class="hud-lv"></span><span class="hud-bar"><i></i></span><span class="hud-xp"></span></div>
    </div>
    <div class="hud-race"><span class="hud-pos"></span><span class="hud-lap"></span><span class="hud-clock">00:00.00</span></div>
    <ul class="hud-feed"></ul>
    <div class="hud-toast"></div>
    <div class="hud-results" hidden></div>
    <div class="hud-speedo">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path class="hud-arc-bg" d="M 38 162 A 88 88 0 1 1 162 162" />
        <path class="hud-arc" d="M 38 162 A 88 88 0 1 1 162 162" />
      </svg>
      <div class="hud-kmh"><b>0</b><span>KM/H</span></div>
      <div class="hud-gear">N</div>
      <div class="hud-nos"><span>NOS</span><i><b></b></i></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const canvas = $('.hud-radar canvas');
  const ctx = canvas.getContext('2d');
  const arc = $('.hud-arc');
  const arcLength = arc.getTotalLength();
  arc.style.strokeDasharray = `${arcLength}`;
  const kmhEl = $('.hud-kmh b');
  const gearEl = $('.hud-gear');
  const nosEl = $('.hud-nos b');
  const clockEl = $('.hud-clock');
  const feed = $('.hud-feed');
  const toast = $('.hud-toast');
  const results = $('.hud-results');

  const state = { xp: 0, gates: new Set(), pits: [], top: 0, start: 0, end: 0, running: false, nos: 1, kmh: -1 };
  let last = performance.now();

  function labels() {
    $('.hud-pos').textContent = `${t.pos} 1/1`;
    $('.hud-lap').textContent = `${t.lap} 1/1`;
    renderXp();
  }

  function renderXp() {
    const level = Math.floor(state.xp / LEVEL) + 1;
    $('.hud-lv').textContent = `LV ${level}`;
    $('.hud-xp').textContent = `${state.xp.toLocaleString('en-US')} XP`;
    $('.hud-bar i').style.width = `${((state.xp % LEVEL) / LEVEL) * 100}%`;
  }

  function addXp(amount) {
    state.xp += amount;
    renderXp();
  }

  function pushFeed(text, amount, tone = '') {
    const li = document.createElement('li');
    li.className = tone;
    li.innerHTML = '<span></span><b></b>';
    li.firstChild.textContent = text;
    li.lastChild.textContent = amount ? `+${amount}` : '';
    feed.prepend(li);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => li.classList.add('is-old'), 5000);
  }

  function showToast(title, detail = '', tone = '') {
    toast.className = `hud-toast ${tone}`;
    toast.innerHTML = '<b></b><span></span>';
    toast.firstChild.textContent = title;
    toast.lastChild.textContent = detail;
    void toast.offsetWidth; // restart the animation
    toast.classList.add('is-on');
  }

  function format(ms) {
    const s = Math.max(0, ms) / 1000;
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  }

  function drawRadar(frame) {
    const size = canvas.width;
    const c = size / 2;
    const scale = (c - 8) / RADAR_METRES;
    const fx = Math.sin(frame.heading);
    const fz = Math.cos(frame.heading);
    // Driver's forward is up, driver's right is right.
    const project = ([x, z]) => {
      const dx = x - frame.x;
      const dz = z - frame.z;
      return [c + (dx * -fz + dz * fx) * scale, c - (dx * fx + dz * fz) * scale];
    };
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(4, 8, 14, 0.78)';
    ctx.fillRect(0, 0, size, size);
    // Range rings and sweep.
    ctx.strokeStyle = 'rgba(56, 225, 255, 0.12)';
    ctx.lineWidth = 2;
    for (const r of [0.33, 0.66]) {
      ctx.beginPath();
      ctx.arc(c, c, (c - 2) * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (ctx.createConicGradient) {
      const sweep = ctx.createConicGradient((performance.now() / 1000) * 2.2, c, c);
      sweep.addColorStop(0, 'rgba(56, 225, 255, 0.28)');
      sweep.addColorStop(0.12, 'rgba(56, 225, 255, 0)');
      sweep.addColorStop(1, 'rgba(56, 225, 255, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, size, size);
    }
    // Track, pit lane.
    const path = (points, width, color, dash = []) => {
      ctx.beginPath();
      points.forEach((p, i) => {
        const [x, y] = project(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.lineJoin = 'round';
    path(map.track, 14, 'rgba(232, 238, 247, 0.16)');
    path(map.track, 3, 'rgba(232, 238, 247, 0.7)');
    path(map.pitLane, 3, 'rgba(56, 225, 255, 0.8)', [6, 6]);
    // Objectives.
    const dot = (p, color, s = 9) => {
      const [x, y] = project(p);
      ctx.fillStyle = color;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    };
    map.gates.forEach((g, i) => dot(g, state.gates.has(i) ? 'rgba(53, 224, 122, 0.9)' : '#ffd23f', 11));
    map.garages.forEach((g) => dot(g.at, `#${g.color.toString(16).padStart(6, '0')}`, 12));
    dot(map.trap, '#ff5f7a', 9);
    dot(map.finish, '#e8eef7', 12);
    ctx.restore();
    // The car: an arrow in the middle, pointing up.
    ctx.fillStyle = '#38e1ff';
    ctx.shadowColor = '#38e1ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(c, c - 14);
    ctx.lineTo(c + 10, c + 11);
    ctx.lineTo(c, c + 5);
    ctx.lineTo(c - 10, c + 11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(56, 225, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  labels();

  return {
    setLanguage(l) {
      t = TEXT[l] || TEXT.en;
      labels();
    },
    // Called every frame by the scene.
    frame(frame) {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      drawRadar(frame);
      if (frame.kmh !== state.kmh) {
        state.kmh = frame.kmh;
        kmhEl.textContent = frame.kmh;
        arc.style.strokeDashoffset = `${arcLength * (1 - Math.min(frame.kmh / 340, 1))}`;
        gearEl.textContent = frame.kmh < 3 ? 'N' : String(Math.min(8, 1 + Math.floor(frame.kmh / 42)));
      }
      // Nitro drains while flat out and refills when cruising.
      const boosting = frame.speed > 0.55;
      state.nos = Math.min(1, Math.max(0, state.nos + dt * (boosting ? -0.45 : 0.12)));
      nosEl.style.width = `${state.nos * 100}%`;
      root.classList.toggle('is-boosting', boosting);
      if (state.running) clockEl.textContent = format(now - state.start);
    },
    event(e) {
      if (e.type === 'go') {
        state.running = true;
        state.start = performance.now();
        showToast(t.go, '', 'is-go');
      } else if (e.type === 'gate') {
        const first = !state.gates.has(e.index);
        state.gates.add(e.index);
        if (first) addXp(XP.gate);
        showToast(`${t.checkpoint} ${e.index + 1}/3`, first ? `+${XP.gate} XP` : t.sections[e.index]);
        pushFeed(`${t.checkpoint} · ${t.sections[e.index]}`, first ? XP.gate : 0);
      } else if (e.type === 'trap') {
        state.top = Math.max(state.top, e.kmh);
        addXp(e.kmh);
        showToast(t.trap, `${e.kmh} KM/H`, 'is-trap');
        pushFeed(`${t.trap} · ${e.kmh} km/h`, e.kmh, 'is-trap');
      } else if (e.type === 'pit') {
        state.pits.push(e.seconds);
        addXp(XP.pit);
        showToast(t.pit, `${e.seconds.toFixed(2)} s`, 'is-pit');
        pushFeed(`${t.pit} · ${e.id} · ${e.seconds.toFixed(2)} s`, XP.pit, 'is-pit');
      } else if (e.type === 'finish') {
        state.top = Math.max(state.top, e.topKmh);
        if (state.running) {
          state.running = false;
          state.end = performance.now();
          addXp(XP.finish);
        }
        showToast(t.finish, '', 'is-finish');
        const best = state.pits.length ? `${Math.min(...state.pits).toFixed(2)} s` : '—';
        results.innerHTML = `<h3>${t.results}</h3><dl>
          <div><dt>${t.time}</dt><dd>${format(state.end - state.start)}</dd></div>
          <div><dt>${t.top}</dt><dd>${state.top} km/h</dd></div>
          <div><dt>${t.checkpoints}</dt><dd>${state.gates.size}/3</dd></div>
          <div><dt>${t.pits}</dt><dd>${best}</dd></div>
          <div><dt>${t.xp}</dt><dd>${state.xp.toLocaleString('en-US')}</dd></div></dl>`;
        results.hidden = false;
      }
    },
    // The results card only shows at the finish.
    section(name) {
      if (name !== 'contact') results.hidden = true;
      else if (results.innerHTML) results.hidden = false;
    },
  };
}
