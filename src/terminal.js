import { CanvasTexture, SRGBColorSpace } from 'three';

// A terminal drawn on a 2D canvas and used as a texture on the 3D monitor.
// Commands are typed one character at a time; their output appears all at once, like a real shell.

const W = 1280;
const H = 780;
const BAR = 58;
const LINE = 46;
const TOP = 108;
const LEFT = 40;
const MAX_LINES = Math.floor((H - TOP) / LINE) + 1;
const MONO = '"JetBrains Mono Variable", ui-monospace, Consolas, monospace';
const TYPE_SPEED = 34; // characters per second
const HOLD = 5; // seconds the finished session stays on screen

const STYLE = {
  cmd: { prefix: '$ ', prefixColor: '#5cf2b0', color: '#e8eef7' },
  user: { prefix: '> ', prefixColor: '#38e1ff', color: '#e8eef7' },
  step: { prefix: '● ', prefixColor: '#a78bfa', color: '#b9c4d6' },
  ok: { prefix: '✓ ', prefixColor: '#5cf2b0', color: '#cfe9dc' },
  dim: { prefix: '  ', prefixColor: '#647089', color: '#7d8aa0' },
};

export class Terminal {
  constructor({ scripts, lang = 'en', animated = true }) {
    this.scripts = scripts;
    this.animated = animated;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.chrome = drawChrome();
    this.scanlines = drawScanlines();
    this.blink = 0;
    this.cursorOn = true;
    this.setLang(lang);
    // The canvas only uses the web font once it has loaded.
    document.fonts?.load(`27px ${MONO}`).then(() => {
      this.chrome = drawChrome();
      this.draw();
    });
  }

  setLang(lang) {
    this.script = this.scripts[lang] || this.scripts.en;
    this.restart();
  }

  restart() {
    this.shown = this.animated ? 0 : this.script.length; // lines fully on screen
    this.typed = 0; // characters typed on the current line
    this.wait = 0.8;
    this.hold = 0;
    this.draw();
  }

  // Returns true when the texture changed.
  update(dt) {
    if (!this.animated) return false;
    this.blink += dt;
    const cursorOn = this.blink % 1 < 0.55;
    let changed = cursorOn !== this.cursorOn;
    this.cursorOn = cursorOn;

    if (this.wait > 0) {
      this.wait -= dt;
    } else if (this.shown < this.script.length) {
      const line = this.script[this.shown];
      if (line.type === 'cmd' || line.type === 'user') {
        const before = Math.floor(this.typed);
        this.typed += dt * TYPE_SPEED;
        if (this.typed >= line.text.length) {
          this.shown++;
          this.typed = 0;
          this.wait = 0.55;
          changed = true;
        } else if (Math.floor(this.typed) !== before) {
          changed = true;
        }
      } else {
        this.shown++;
        this.wait = 0.4;
        changed = true;
      }
    } else {
      this.hold += dt;
      if (this.hold > HOLD) {
        this.restart();
        return true;
      }
    }

    if (changed) this.draw();
    return changed;
  }

  draw() {
    const { ctx } = this;
    ctx.drawImage(this.chrome, 0, 0);

    const lines = this.script.slice(0, this.shown).map((l) => ({ ...l }));
    const typing = this.shown < this.script.length && this.isTyped(this.script[this.shown]);
    if (typing) {
      const current = this.script[this.shown];
      lines.push({ ...current, text: current.text.slice(0, Math.floor(this.typed)) });
    } else if (this.shown >= this.script.length) {
      lines.push({ type: 'cmd', text: '' }); // idle prompt
    }

    const visible = lines.slice(-MAX_LINES);
    ctx.font = `400 27px ${MONO}`;
    ctx.textBaseline = 'alphabetic';
    let y = TOP;
    let endX = LEFT;
    for (const line of visible) {
      const style = STYLE[line.type];
      ctx.fillStyle = style.prefixColor;
      ctx.fillText(style.prefix, LEFT, y);
      const x = LEFT + ctx.measureText(style.prefix).width;
      ctx.fillStyle = style.color;
      ctx.fillText(line.text, x, y);
      endX = x + ctx.measureText(line.text).width;
      y += LINE;
    }

    // Block cursor at the end of the line being typed (or on the idle prompt).
    const showCursor = (typing || this.shown >= this.script.length || !this.animated) && this.cursorOn;
    if (showCursor) {
      ctx.fillStyle = '#38e1ff';
      ctx.fillRect(endX + 4, y - LINE - 22, 15, 28);
    }

    ctx.drawImage(this.scanlines, 0, 0);
    this.texture.needsUpdate = true;
  }

  isTyped(line) {
    return line.type === 'cmd' || line.type === 'user';
  }
}

// Background and title bar: drawn once, copied on every frame.
function drawChrome() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createLinearGradient(0, 0, W, H);
  glow.addColorStop(0, 'rgba(56, 225, 255, 0.06)');
  glow.addColorStop(1, 'rgba(167, 139, 250, 0.05)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0c1220';
  ctx.fillRect(0, 0, W, BAR);
  ctx.fillStyle = 'rgba(140, 170, 255, 0.16)';
  ctx.fillRect(0, BAR - 2, W, 2);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(34 + i * 30, BAR / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = '#647089';
  ctx.textAlign = 'center';
  ctx.fillText('claude — ~/projects/site', W / 2, BAR / 2 + 8);
  ctx.textAlign = 'left';
  return c;
}

// Faint CRT scanlines on top of the text.
function drawScanlines() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  return c;
}
