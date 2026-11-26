# EMBERWING — Wildfire Water Bomber

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zhengxinjia82-dev/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zhengxinjia82-dev/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

EMBERWING — a wildfire water-bomber flight game: skim the lake to fill a 3,000 L tank, climb out over the pines at sunset, and drop it on 21 fires across 7 legs of Ember Valley. Fuel is a decision, not a bar: push on light, or divert to the strip and refuel while the fire spreads.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 (or open game/index.html directly).

## How to play

- **Pitch:** ↑ / ↓. **Bank & turn:** ← / →. **Throttle:** W / S.
- **Drop water:** hold SPACE over a fire (aim upwind — the wind steals the drop).
- **Flaps:** F (slower stall, more drag). **Camera:** C (chase / cockpit). **Pause:** P. **Mute:** M. **Restart:** R.
- Scoop by skimming the lake at 12–48 m/s with an empty tank; land on the dirt strip to refuel.
- Fires out: 12,500 pts each, plus accuracy bonus and chain multiplier; leg time bonus up to 40,000; perfect landing 25,000.

## What is in the game

- Software-3D sunset canyon: heightfield valley, lake with sun shimmer, pine forest, dirt airstrip, smoke columns, target rings.
- Live instruments: attitude indicator, airspeed, altimeter, heading compass, vertical speed, fuel, water, throttle lever, stall / overspeed / BINGO warnings.
- 7 named legs (Pine Hollow → Sunset Pass), 21 fires, 5 wind states, synthesized engine / wind / splash / chime audio — no audio files, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=xa8prb5s&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
