# Solmar Heat — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Entry for the [gta6-01 bounty — "Make GTA 6"](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun/bounty/gta6-01).

## The game

Rio Vance just got out, and Solmar Bay — a sun-soaked coastal city of pastel
roofs, palm-lined beaches and wide avenues — is wide open. Explore it on foot
and by car, steal what you need, outrun the law, and run four jobs for cash.

- **Open city**: drive and walk a hand-built grid city with traffic,
  pedestrians, a beach, a park, a spray shop, a hideout and the docks.
- **Steal and drive**: walk up to any parked or cruising car and press **E**.
  A witness means heat; a clean steal means nobody saw a thing.
- **Wanted level**: 0–5 stars. Running over pedestrians, carjacking in front
  of witnesses and ramming cops raise it; police cars spawn and chase. Lay
  low to cool off, or pay the spray shop $150 for a new paint job and clean
  plates. Get caught on foot and you are **BUSTED**; lose all your health
  and you are **WASTED**.
- **Missions**: a four-job story — *Borrowed Wheels*, *Dockside Drop*,
  *Street Cash*, *The Getaway* (timed, with the cops already on you) — then
  free roam as King of Solmar with cash bags that keep appearing.
- **HUD**: cash, health, wanted stars, speed, mission objective, live
  minimap, and toast messages. Title screen, pause, game-over screens, and
  a best-cash save in `localStorage`.
- **Sound**: fully synthesized with the Web Audio API (engine hum, sirens,
  pickups, crashes) — no audio files, no network requests. **M** mutes.

## Play it

Serve the `game/` folder with any static server and open `game/index.html`
in desktop Chrome. No build step, no network requests, no libraries.

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/
```

Controls: **WASD** move / drive · **E** steal or exit a car ·
**SHIFT** run · **P** pause · **M** mute · **ENTER** start · **R** restart.

## Files

| File | Job |
| --- | --- |
| `main.ts` | Entrypoint: copies `game/` + `screenshots/` to the output dir and writes `dossier.json` |
| `game/index.html` | Page shell and canvas |
| `game/src/main.js` | Game loop, state machine, camera, `?scene=` staging |
| `game/src/config.js` | Every tuning number in one place |
| `game/src/city.js` | Seeded city generation, roads, collision |
| `game/src/input.js` | Keyboard state and press edges |
| `game/src/audio.js` | Synthesized WebAudio effects |
| `game/src/actors.js` | Player, traffic, pedestrians, police, wanted level |
| `game/src/missions.js` | The four-job story chain and free roam |
| `game/src/render.js` | World, cars, HUD, minimap, screens |
| `vendor/makefun-game.ts` | The kit's dossier library, unchanged |

Everything is original: the city, the characters, the story and the art are
our own — nothing from any commercial game.

## License

MIT — see [LICENSE](LICENSE).
