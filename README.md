# Leonida Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Leonida Bay** — an open-world crime game in the spirit of GTA 6, built for make.fun's
"Make GTA 6" bounty. A whole sun-soaked fictional city to explore on foot and by car:
traffic, pedestrians, cars to steal, a wanted level with police who respond, six story
missions, combat, taxi fares, hidden packages, a day/night cycle and a save that
remembers your progress. Everything is original — our own city, characters, names and
art. No Rockstar assets, no network requests, no build step: plain static files that
play offline in a desktop browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## Play

- **WASD / arrows** — move on foot, drive when in a car
- **E** — get in / out of a car, take a taxi fare
- **Click** — punch, or shoot when you have the pistol
- **Shift** — run
- **Space** — handbrake while driving
- **P** — pause, **M** — mute

## The story

Nia Solano is new in Leonida Bay. Her fixer, Rook Delgado, has six jobs for her:
a taxi ride to the Sunset Diner, a "borrowed" Comet GT, a brawl on Ocean Beach, a
heat-soaked chase through downtown, crates at the Port of Leonida, and a finale
against Vic Marino — the man who runs the bay.

Between missions: drive a taxi for fares, hunt 20 hidden packages, lose the cops at
Pay 'n Spray, and try not to get Wasted or Busted.

## Layout

| File | What it holds |
| --- | --- |
| `main.ts` | The entrypoint: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `game/index.html` | The page that loads the game |
| `game/src/main.js` | Boot and the one loop |
| `game/src/world.js` | The simulation: player, missions, wanted, fares, pickups |
| `game/src/city.js` | The city: roads, blocks, buildings, park, port, beach |
| `game/src/vehicles.js` | Car physics, traffic AI, police and parked spawns |
| `game/src/pedestrians.js` | Pedestrians, taxi fares, fleeing crowds |
| `game/src/police.js` | The wanted system and police pursuit |
| `game/src/missions.js` | The six story missions and their objectives |
| `game/src/combat.js` | Bullets, melee and particles |
| `game/src/render.js` | Drawing the city, day/night light, effects |
| `game/src/hud.js` | HUD, minimap, subtitles and menus |
| `game/src/audio.js` | Synthesised WebAudio sound (no audio files) |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/save.js` | localStorage save / load |
| `game/src/ui.js` | Screens and dialogue state |
| `game/src/shots.js` | The four deterministic screenshot scenes |
| `game/src/config.js` | Tuning and palette |
| `game/src/random.js` | Seeded random numbers |

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
