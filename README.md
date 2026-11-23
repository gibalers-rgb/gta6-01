[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gibalers-rgb/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solara Heat — an open-world crime game

**Solara Heat** is a complete top-down open-world crime game in the spirit of
GTA 6, built from scratch for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01)
on make.fun. It runs offline in a desktop browser from its own static files —
no network requests, no libraries, all art drawn in code and all sound
synthesized with WebAudio.

You are **Leo Vane**, a wheelman who owes the fixer Kane Duarte two grand.
Run five story jobs for **Mira Solano**, steal cars, outrun the Solara PD, and
take the city back — or just cruise Beachfront in a stolen taxi and see how
long you last at five stars.

## Play

Serve `game/` with any static server and open `game/index.html`:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot (Shift to sprint) |
| E | Steal / enter a car, step out |
| W/S, A/D, Space | Drive, steer, handbrake |
| Mouse + click | Aim and shoot (R reload, 1/2/3 weapons) |
| ENTER | Take Mira's next job / advance dialogue |
| ESC | Pause, save, quit to title |
| F | Change radio station |
| M | Toggle music |

## What is in the game

- **A city to explore** — Solara Bay: Old Town, Downtown, The Hills, Marina,
  Midtown, the Pier 9 docks and a beachfront, with traffic, pedestrians, parks,
  parking lots and a day/night cycle.
- **On foot and by car** — steal any traffic car (sedan, taxi, sport, truck,
  van — even a police cruiser), with arcade handling, crashes, smoke and wrecks.
- **Wanted level 1–5** — stealing, shooting and killing raise the heat; police
  cruisers chase and ram, officers on foot try to arrest you, and laying low
  loses the tail. Busted or wasted costs you cash and a trip to the station
  or the hospital.
- **Five story missions** — Borrowed Wheels, Three Drops, Lose the Heat,
  Dockside Grab, and The Solara Score, with phone dialogue from Mira.
- **Side work** — taxi fares, 12 hidden cash stashes, health/armor/ammo
  pickups, an SMG to find.
- **HUD with minimap** — mission tracker, cash, health/armor, wanted stars,
  weapon and ammo, speed, clock, district name, and a live minimap with
  mission, police, fare and stash blips.
- **Save** — progress autosaves after every mission and on pause; continue
  from the title screen.
- **Sound** — synthesized engine hum, sirens, gunfire, jingles and a bass
  groove; no audio files.

## Structure

```
game/
  index.html        page + canvas shell
  src/
    main.js         boot, loop, input, save/load, render pass
    city.js         Solara Bay: roads, blocks, beach, docks, collision
    vehicles.js     traffic AI + player car physics + car drawing
    people.js       pedestrians
    police.js       wanted level, pursuit cars, foot officers, busted/wasted
    combat.js       weapons, bullets, pickups
    missions.js     five story jobs + taxi fares
    hud.js          HUD, minimap, menus, dialogue
    audio.js        WebAudio synth: SFX + music sequencer
    fx.js           particles, floating text, screen shake
    rng.js          seeded random + math helpers
    shots.js        ?shot= staging for screenshots
main.ts             entry program: copies game/ + screenshots/ to /output
                    and writes dossier.json with vendor/makefun-game.ts
```

Screenshots under `screenshots/` are real renders of this game's own code,
staged with `?shot=chase|street|docks|sunset`.

## License

MIT — see [LICENSE](LICENSE). An original game: no Rockstar Games names,
characters, art, music or assets.
