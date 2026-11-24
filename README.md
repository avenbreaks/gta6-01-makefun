# gta6-01-makefun

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/avenbreaks/gta6-01-makefun/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/avenbreaks/gta6-01-makefun/reward.svg)](https://make.fun/bounty/gta6-01)

Neon Harbor — a top-down open-world crime game: steal cars, outrun the police, and run three story missions across a living city.

You are a small-time driver in Neon Harbor, a sunset city of neon and salt air. Pick up a package at the docks, lose the heat, then run it to the lighthouse before the clock dies — or just cruise, steal whatever has wheels, and see how many stars you can survive.

**What's in the game**

- A 2400×1800 open city: gridded streets, colourful blocks, a park, a beach and the sea, a dock pier, a hideout and a lighthouse
- On foot (WASD, Shift to run) and behind the wheel (W/S gas and brake, A/D steering, drift and skid marks); get in and out of cars with E
- Car theft: yank a driver out of their car and the wanted level climbs
- 14 AI traffic cars and 20 pedestrians who flee when trouble starts
- A 0–5 star wanted system with police cars that spawn, chase and ram you; get caught on foot or wreck your ride and it's BUSTED / WASTED
- Combat: punch with Space, shoot a pistol with F or click (find the gun and ammo in the city)
- Three story missions with objective text, a gold map marker and an on-screen direction arrow
- HUD with health and cash, wanted stars, a live minimap, and a mission timer
- Title screen, pause, localStorage saves (continue with C) and autosave
- WebAudio synth sound only: engine hum, two-tone sirens, pickup blips, crashes and gunshots (M to mute)
- Deterministic screenshot scenes via `?shot=start|play|end&seed=1`

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080

No build step, no network requests, no libraries — vanilla JS ES modules and Canvas 2D.

<sub>Entered on [make.fun](https://make.fun/?ref=rm0h50bh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
