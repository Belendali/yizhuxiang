# 一炷香 · 序章（雪寺）

A short 3D web prologue: a traveler crosses a snowfield to a mountain temple, finds the things it has lost in the snow, talks with the Buddha, and offers the first stick of incense. Built with Three.js. Most geometry, textures and sound are procedural; the Buddha, the traveler, the paper lanterns, the roof-corner bells, the singing bowl, the path's stone lamps, the snowy pines (and a bare winter tree) around the temple, and the cherry trees of 落花谷 are models in assets/models (each falls back to a procedural stand-in if it fails to load). The snow trees were generated at millions of triangles; they are shipped with their texture colours baked into vertex colours and simplified to about 15k triangles. The cherry trees (assets/models/sakura.glb) are a Sketchfab set of three game-ready trees with alpha-tested blossom cards, kept in one file as nodes `big` / `small` / `small2`; the small ones have some blossom cards and bark detail removed so the instanced forest stays light.

## Run

```bash
cd ~/Desktop/Work/yizhuxiang
python3 -m http.server 8000
```

Then open http://localhost:8000. It needs to be served over http because ES modules don't load from `file://`. Three.js and the fonts load from a CDN.

## Controls

- Desktop: WASD / arrow keys to move, Shift to walk faster, mouse to look. The first click captures the mouse; Esc releases it.
- Phone: hold to walk forward, drag to turn.
- E / click / tap: push the door (when standing at it), take a stick of incense, offer it.
- Hold E / mouse / screen at the altar: light the incense from the candle.
- Top-right icons: globe = language (中文 / English / 日本語), note = music on/off. Keys: L cycles language, M toggles music (these also work while the mouse is captured). Both choices are remembered.

## Story

1. The walk in through the snow (opening shot, then the player's camera). The door opens.
2. Inside: look around the hall, walk to the cushion, take, light and offer a stick of incense.
3. With the smoke rising, the Buddha speaks: 你来了, then one question (two replies or "……", silence; waiting 14 s also counts; keys 1 / 2 / 3 work too), then the errand: the temple has dropped a few things in the snow, bring them back.
4. 修庙: the traveler rises and comes out onto the platform; the door closes behind. Four lost things now glow in the snow: the 雪寺 plaque (on the platform, right of the door), the chime from the front-left roof corner (behind the hall), a paper lantern (in the snow left of the path) and the hall's bronze singing bowl (right of the path; once home it sits on its cushion by the altar). Tap to pick one up; it floats at the traveler's shoulder and flies home once the traveler is back on the platform. The lanterns light again when theirs comes back. Until all four are home the door stays shut. With all four home the Buddha says "进来吧" and the door stands ajar.
5. Back inside (no look-around this time), at the cushion, the second talk, with no question and no teaching: 多谢你 / 肯为一座旧庙停下的人 不多, then 今夜 安心睡吧 / 明早 雪会停 / 明天 再继续上路吧.
6. Night: the view draws back from the altar (一炷香 / 故事开始), fades to black, and in the dark one quiet line, 雪 下了一夜. Then the traveler wakes in 落花谷: the temple is gone and the snow has stopped.
7. 第一章 · 落花谷: the traveler wakes under an old blossom tree, seen through their eyes (blossom overhead, then the valley ahead), then the view draws back behind them. The temple is gone. Free walk (`src/valley.js`). The chapter's story and play are still to be designed.

While the lost things are being found, a quiet list sits top-left: 匾 灯 铃 香, each with a dot (hollow = missing, ember = carried, filled = home).

Directed shots (the opening, the hall look-around, the door, leaving, the night, waking) ignore the mouse and touch; only the movement keys can cut the opening and the hall look-around short.

Spots and dialogue live in `src/main.js` (`spots`, `TALK_FIRST`, `TALK_AFTER`); the words are in `src/i18n.js`.

## Models

- `assets/models/buddha.glb`: the sculpted Buddha (Meshy, about 250k triangles, 8.6 MB). It replaces the procedural figure once it loads; if it fails to load, the procedural one stays. Fit and colour are set by `STATUE` in `src/interior.js` (`height`, `turn`, `tint`, `roughness`, `env`).

- `assets/models/traveler.glb`: the player character (Meshy + Mixamo rig, about 30k triangles) with its clips. `src/actor.js` blends Idle_4 / Walking / Running by ground speed (shared phase, so no foot sliding) and mixes in Short_Breathe_and_Look_Around after standing still. The only procedural layer is a small forward lean for the tired stretch in the snow. Bows and hand-held props were left out on purpose. Clip names are mapped in `CLIPS` at the top of that file. If the model fails to load, the procedural traveler is used.

## Camera

- Opening: after "Set out", an 11 s shot with letterbox bars brings the player in. It comes down out of the storm, passes the traveler to a close look under the hat, then goes over the shoulder to the temple far ahead, and ends exactly on the follow camera. Moving or tapping after 2 s skips it. From then on the camera is the player's; the game never takes it over while they walk.
- Snow: between z ≈ 33 and 26 the traveler is worn out: slower, leaning into the wind, louder wind. The camera stays the player's.
- Stairs: the body follows the feet (`actor.feet`), so neither foot sinks into a tread.
- Entering the hall: about 8 s looking around through the traveler's eyes (pillars and window light, beams, the other side, then the Buddha). Moving or tapping after 2.6 s skips it, and the view then draws back to the follow camera.
- At the altar everything is first person: the stick is held just below the view, lighting leans in to the candle, offering leans in to the burner. The ending lifts the gaze to the Buddha, then rises and draws back to show the traveler standing before the altar.

## Files

- `src/i18n.js`: every on-screen line and prompt in Chinese, English and Japanese.
- `src/main.js`: renderer, post-processing, story state machine, camera, input.
- `src/exterior.js`: snowy valley, temple, roof, rope and tassels, lanterns, rocks, pines.
- `src/repair.js`: the repair quest: the lost things lying in the snow (with a warm light pool and rising motes), carrying them, and their flight home.
- `src/models.js`: loads each model once, then fits and anchors a clone for each place it is used; `propParts` / `instancesFromModel` turn a model into InstancedMeshes for the forests.
- `src/temple-detail.js`: the temple's finer architecture: bracket sets and rafters under the eaves, the painted main beam, the 雪寺 plaque, lacquered pillars on carved bases, timber-framed plaster walls, wind chimes at the roof corners, the finial, and the platform's balustrade and stair borders.
- `src/interior.js`: hall, altar, Buddha, candles, burner, dust and smoke.
- `src/traveler.js`: the traveler, with walking and bowing animation.
- `src/fx.js`: snow and dust particles, incense smoke, footprints, light shafts.
- `src/materials.js`: shader patch that lets snow settle on upward-facing surfaces, plus canvas textures.
- `src/audio.js`: Web Audio wind, footsteps, singing bowl, and a generative temple score (om drone, xiao flute, guqin, bowls, wooden fish) that starts at the door and swells inside.

## Debug

**Test switch:** the first of the three icons in the top-right corner (a path with three stops) opens a list of every world and story point (序章: 标题, 开场, 风雪, 台阶, 殿门, 进殿, 殿内, 上香, 对话一, 修庙, 归位, 对话二, 入夜; 第一章: 醒来, 漫步). Picking one reloads the page straight into that point (`?at=talk2`, etc.). Chapters not built yet are listed in grey.

**Deploying:** bump `window.__V` near the top of `index.html` before each push. Every script and model URL carries it (`?v=…`), so browsers load the new version instead of a cached mix of old and new files.

In the browser console, `__game.jump('intro' | 'trudge' | 'stairs' | 'door' | 'inside' | 'walkin' | 'talk1' (incense offered, the first talk begins) | 'errand' (just out of the hall, things glowing) | 'repaired' | 'talk2' | 'night' | 'valley' | 'valleyWalk' | 'altar' | 'ending')` jumps to a state, and `__game.advance(seconds, holding)` fast-forwards the simulation. `__game.put(x, z)` moves the traveler outside, `__game.answer('a1a' | 'a1b' | 'sil')` answers the Buddha, and `__game.quest` is the repair quest.

## Credits

- "Cherry Blossom Trees" by [Jagobo](https://sketchfab.com/Jagobo), [Sketchfab](https://sketchfab.com/3d-models/cherry-blossom-trees-f69be55d2e4f4f73b568ebb185bd8496), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Split into three trees, blossom cards thinned on the small ones, textures resized.
