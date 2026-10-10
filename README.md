# andrea-sofia-dev.github.io

My portfolio as one lap of a night race. Scrolling drives an open-wheel car round a city circuit: it waits on the
grid for the lights to go out, passes a checkpoint for each section, pits at the garage of the project you are
reading, and crosses the finish line at the end. Racing, video games and the gym are my hobbies, so they are all in.

**Live: [andrea-sofia-dev.github.io](https://andrea-sofia-dev.github.io)**

![The home page: name and title on the left; on the right the car on the grid under a light gate, with the game HUD](public/og.png)

## What's in it

- **Scroll is the throttle.** Each section is a stop on the lap. Between stops a chase camera follows the car;
  scroll fast and you get the nitro flame, speed lines, a wider field of view and a touch of chromatic aberration.
- **The sections live on the circuit.** "How I work" plays on the pit wall screen (a terminal typing an agent
  session); each project has a team garage; the skills are plates on the rack of the paddock gym.
- **Pit stops.** In the projects section the car pits at the garage of the card in the middle of the screen, and
  the crew does a stop: jacks up, wheels off and on, lollipop up.
- **Game HUD.** Radar minimap and event feed, XP and levels, lap clock, speedometer with gear and nitro, toasts
  for lights out, checkpoints, the speed trap and pit stops, race results at the finish.
- **Night look.** Wet asphalt that reflects the car and the neon (a planar mirror under a see-through road),
  bloom, neon reflections on the paint, a skyline and a grandstand full of phone flashes.
- **Everything is built in code.** The car, the garages, the gym: no 3D models, no textures from outside, no real
  team or brand.
- **Two languages**, English and Italian, picked from the browser and switchable.

## Accessibility and performance

- Text first: all the content is plain HTML, readable before the 3D loads and without WebGL at all. The HUD is
  decoration and is hidden from screen readers; it sits under the text panels, so it never covers what you read.
- `prefers-reduced-motion`: no driving, no camera flights, no HUD. The scene cuts between still shots and renders
  only when something changes.
- About 11 KB of JavaScript for the page; Three.js and the scene (~170 KB gzipped) load after the text.
- Phones skip the wet-asphalt mirror. If the first frames are slow, the mirror and the bloom are turned off and
  the resolution drops to 1×.
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
steered the look: the first version was a space scene, then a military airfield, then this night race with the car,
the pit stops and the HUD I asked for. The agent wrote the code and checked every round in headless Chrome at
desktop and phone sizes: a screenshot of every section, console errors, horizontal overflow. Then it fixed what it
found.

## Structure

```
index.html            page content (English) and meta tags
src/main.js           language switch, scroll → lap position, card ↔ garage links
src/scene.js          renderer, camera shots, chase camera, post-processing, race events
src/hud.js            the game HUD
src/terminal.js       the typed terminal on the pit wall screen (canvas texture)
src/content.js        projects, skills, terminal script, Italian text
src/world/track.js    the circuit: spline, asphalt, kerbs, start line
src/world/car.js      the car, lofted through oval cross-sections
src/world/base.js     start gantry, pit wall screen, garages, grandstand, floodlights, skyline
src/world/pit.js      pit lane, crews and the pit stop
src/world/street.js   light-gate checkpoints, route arrows, speed trap
src/world/gym.js      the paddock gym
src/style.css         layout, theme and HUD
```

## License

Code: [MIT](LICENSE). Text, name and images: © Andrea Sofia.
