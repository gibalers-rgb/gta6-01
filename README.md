# Marisol Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marisol Bay** — an open-world crime game in the spirit of GTA 6, built for make.fun's
"Make GTA 6" bounty. A whole sun-soaked fictional coastal city to explore on foot and
by car: traffic, walkers, cars to steal, a wanted level with police who respond, seven
story jobs, combat, taxi fares, hidden packages, a day/night cycle with lit windows,
garage repairs, and a save that remembers your progress. Everything is original — our
own city, characters, names and art. No Rockstar assets, no network requests, no build
step: plain static files that play offline in a desktop browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## Play

- **WASD / arrows** — move on foot, drive when in a car
- **E** — get in / out of a car, take a taxi fare
- **Click** — punch, or shoot when you have the pistol
- **H** — honk the horn while driving (nearby walkers turn to look)
- **Shift** — sprint
- **Space** — handbrake while driving
- **P** — pause, **M** — mute

## The story

Lucia "Lux" Vega is new in Marisol Bay. Her fixer, Eddie Marlow, has seven jobs for
her: a cab ride to the Marisol Diner, a "borrowed" Solara GT, a brawl on the Boardwalk,
a heat-soaked chase through downtown, crates at the Port of Marisol, a finale against
Silas Vane — the man who runs the bay — and one last timed run to prove the bay is
hers.

Between jobs: drive a cab for fares, hunt 20 hidden packages, lose the cops at
Spray 'n Go, fix a battered car at Eddie's Garage for $50, shake a wanted level clean
for a $100 bonus, and try not to get Wasted or Busted.

## Layout

| File | What it holds |
| --- | --- |
| `main.ts` | The entrypoint: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | Tiny static server for local play (`node serve.ts`, port 8080) |
| `game/index.html` | The page that loads the game |
| `game/src/boot.js` | Boot and the one loop |
| `game/src/world.js` | The simulation: hero, jobs, wanted, fares, pickups, repairs |
| `game/src/city.js` | The city: streets, blocks, buildings, plaza, docks, beach, pier |
| `game/src/cars.js` | Car physics, traffic AI, police and parked spawns |
| `game/src/walkers.js` | Walkers, taxi fares, fleeing crowds, horn reactions |
| `game/src/cops.js` | The wanted system and police pursuit |
| `game/src/story.js` | The seven story jobs and their objectives |
| `game/src/fight.js` | Bullets, melee, particles, skid marks |
| `game/src/render.js` | Drawing the city, day/night light, speed zoom, headlights |
| `game/src/hud.js` | HUD, minimap, speedometer, subtitles and menus |
| `game/src/audio.js` | Synthesised WebAudio sound, horn and a music loop (no audio files) |
| `game/src/input.js` | Keyboard and pointer |
| `game/src/save.js` | localStorage save / load |
| `game/src/screens.js` | Screens and dialogue state |
| `game/src/shots.js` | The four deterministic screenshot scenes |
| `game/src/tuning.js` | Tuning, palette, places and districts |
| `game/src/rng.js` | Seeded random numbers |

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
