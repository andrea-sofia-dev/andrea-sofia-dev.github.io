# andrea-sofia-dev.github.io

My portfolio as a small 3D scene: a terminal where an AI agent ships a change, my projects orbiting around it,
and the tools I use as a constellation. Scroll, and the camera flies from one to the next.

**Live: [andrea-sofia-dev.github.io](https://andrea-sofia-dev.github.io)**

![The home page: name and title on the left, a glowing 3D terminal with three orbiting project nodes on the right](public/og.png)

## What's in it

- **Three.js, no framework.** About 10 KB of JavaScript for the page itself; Three.js (~150 KB gzipped) loads
  after the text, in its own chunk.
- **The terminal is a canvas texture.** The session is typed one character at a time and the texture is redrawn
  only when something changes.
- **Scroll drives the camera.** Each section has a shot; the camera holds while the section is centred and flies
  between shots. The mouse adds a little parallax.
- **Cards and 3D are linked.** Hover a project card and its node lights up; click a node and its card scrolls into
  view. Labels fade when a node passes behind the monitor.
- **Two languages**, English and Italian, picked from the browser and switchable.

## Accessibility and performance

- Text first: all the content is plain HTML, readable before the 3D loads and without WebGL at all.
- `prefers-reduced-motion`: no camera flights and no idle animation. The scene cuts between shots and renders only
  when something changes.
- If the first frames are slow, the bloom is turned off and the resolution drops to 1×.
- Self-hosted fonts. No cookies, no analytics, no requests to third parties.

## Run it

```bash
git clone https://github.com/andrea-sofia-dev/andrea-sofia-dev.github.io.git
cd andrea-sofia-dev.github.io
npm install && npm run dev
```

`npm run build` writes the site to `dist/`. `npm run check` fails if a text has no Italian translation.
Every push to `main` is deployed to GitHub Pages by GitHub Actions.

## How it was built

Agentically, with Claude Code. I set the goal and the constraints (text first, no trackers, works on a phone) and
reviewed each step. The agent wrote the code, then checked it in headless Chrome at desktop and phone sizes:
a screenshot of every section, console errors, horizontal overflow. Then it fixed what it found.

## Structure

```
index.html        page content (English) and meta tags
src/main.js       language switch, scroll → camera, card ↔ node links
src/scene.js      Three.js scene: camera shots, orbits, bloom, labels
src/terminal.js   the typed terminal (canvas texture)
src/content.js    projects, skills, terminal script, Italian text
src/style.css     layout and theme
```

## License

Code: [MIT](LICENSE). Text, name and images: © Andrea Sofia.
