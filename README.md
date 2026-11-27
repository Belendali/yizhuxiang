# 一炷香 · 序章（雪寺）

A short 3D web prologue: a traveler crosses a snowfield to a mountain temple, finds the things it has lost in the snow, talks with the Buddha, and offers the first stick of incense. Built with Three.js. Most geometry, textures and sound are procedural; the Buddha (a Meshy statue, simplified to about 135k triangles with 2K WebP textures), the traveler, the paper lanterns, the roof-corner bells, the singing bowl, the path's stone lamps, the snowy pines (and a bare winter tree) around the temple, and the cherry trees, rocks, grass and 阿念 of 落花谷 are models in assets/models (each falls back to a procedural stand-in if it fails to load). The snow trees were generated at millions of triangles; they are shipped with their texture colours baked into vertex colours and simplified to about 15k triangles. The cherry trees (assets/models/sakura.glb) are a Sketchfab set of three game-ready trees with alpha-tested blossom cards, kept in one file as nodes `big` / `small` / `small2`; the small ones have some blossom cards and bark detail removed so the instanced forest stays light. The valley's rocks (`rocks.glb`, a Meshy rock pile simplified to about 5k triangles) and grass (`grass.glb`, five grass clumps and two wild-flower clumps cut out of a Sketchfab sample sheet as nodes `grass0`–`grass4`, `flowerY`, `flowerB`) are instanced, one draw per kind. The petals that fall off 阿念's tree are `petals.glb`: three curled petals and one whole flower pulled out of a Sketchfab petal cloud (nodes `p1` `p2` `p3` `flower`, about 1.8k triangles in all), drawn as instanced meshes, about 300 at once. The blossoms lying under her tree are `blossom.glb` (a Meshy cherry flower; `branch.glb`, a Meshy blossom branch, is no longer used); both were scans of about a million triangles, baked to vertex colours and simplified with meshoptimizer's topology-preserving simplifier (Permissive + Prune) to 16k and 5k triangles.

## Run

```bash
cd ~/Desktop/Work/yizhuxiang
python3 -m http.server 8000
```

Then open http://localhost:8000. It needs to be served over http because ES modules don't load from `file://`. Three.js and the fonts load from a CDN.

## Controls

- Desktop: WASD / arrow keys to move, Shift to run, mouse to look. The first click captures the mouse; Esc releases it.
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
6. Bedtime: the traveler rises and the view turns to the left side of the hall, where a daybed (软榻) glows in by the wall under the window, a lotus lamp beside it. A single reply bubble, 谢谢, waits to be tapped (no "……"; after 6 s the traveler says it anyway); then the traveler walks over and lies down on one side, watching the far candlelight on the altar while 一炷香 / 故事开始 appear. The eyes droop, open a little and close; then the view comes up outside: the temple at night in the falling snow, lanterns lit, a slow drift past a stone lamp, and 雪 下了一夜 (the night look is a grade in the post pass, `uNight`: cool tones sink to moonlit blue, warm light and highlights stay); then 落花谷.
6. Night: the view draws back from the altar (一炷香 / 故事开始), fades to black, and in the dark one quiet line, 雪 下了一夜. Then the traveler wakes in 落花谷: the temple is gone and the snow has stopped.
7. 第一章 · 落花谷: the traveler wakes under an old blossom tree, seen through their eyes: a slow blink, the blossom overhead (诶　我怎么会在这里, in the left column), the eyes come down to the valley and look left and right (这是哪), then the view draws back behind them and the chapter title shows. The temple is gone. Moving skips the end of it after 14 s. Free walk (`src/valley.js`). The sky is a shader dome (blue overhead into haze at the horizon, thin moving cloud wisps, a soft sun glow), and three layers of ridge lines fade into the haze behind the valley.
8. 阿念 (`src/anian.js`): far down the path, a girl sits on a mound of stones under a blossom tree in full bloom, her back to the traveler. About 20 m off the traveler notices her (那里好像有个人 / 去看看好了); close up they say hello (小姑娘　你好), she gets up, steps round the stones and turns to them, and the talk begins: 奶奶说 今天回来 / 花 正好开满了 / 可是 起风了 / 帮我留住它 好吗.
9. 留花: a cut to the wide shot, the traveler a step behind her under the tree. The wind rises and petals (3D, curled) come off it, and the traveler thinks aloud on the left: 起风了 / 花 在落 / 要是能让它 停一停, then the hint to hold. Hold (mouse, touch, E or Space) and the world stops: the petals hang in the air, the colour drains a little toward stillness, the wind sound muffles, and the view drifts slowly in under the crown. Every time the world stops the traveler notices something (lines not yet seen first, chained while the hold lasts): 花 停住了 / 阿念 也停住了; once the grandmother is on the path, 奶奶 也停住了 / 这样 奶奶就走不过来了 / 还是 让它落吧, then 松开手. The first time the traveler lets go (or after about 36 s anyway), the petals fall again and the grandmother comes into sight far down the path, limping (阿念: 是奶奶); she walks only while nobody holds.
10. When she is near: the last gust takes the crown; she calls 阿念, who runs to her (奶奶 / 花 都落了), and she answers 赶上了 / 落花的时候 最好看. Then a cut to a close shot over the traveler's shoulder, the grandmother facing them and 阿念 at her side: 多谢你 陪阿念等我 / 花不等人 / 碰上了 就是好时候 / 往前走吧 / 前头 也有花开. 阿念 bows to the traveler; the view fades to petal-white. Spoken lines stand beside whoever says them: 阿念's at her right, her grandmother's at her left (projected from their heads each frame; back to the usual place when the speaker is off screen) with 落花谷 · 第一章 · 完. 阿念 is `assets/models/anian.glb` (Meshy + Mixamo rig): Chair_Sit_Idle_F on her stones, Sit_to_Stand_Transition_M when she is greeted, Idle_9 while she waits, Run_02 when she runs to her grandmother, Formal_Bow at the end. Her stones are the rock-pile model at 0.95 m, placed under her hips as measured in the sitting pose. The grandmother is `assets/models/elder.glb` (Meshy + Mixamo: Injured_Walk, a limping step at about 0.42 m/s, while she comes up the path, Idle_4 once she stops; she turns to 阿念), 1.5 m tall; the turned stand-in figure stays only if the model fails to load.
11. 沙上画 (`src/sand.js`): a little further down the path (z −56) three children play on a patch of pale sand: a boy in bamboo green and a girl in red squat at the far edge drawing with twigs, and a boy sits cross-legged at the side watching. Passing it, the traveler notices (有人在画画); the boy gets up and turns to them, twig in hand (你也来画吗 / 给你), and a bubble 接过 takes it. The traveler kneels on one knee at the near edge and the view goes down to the sand: drag (mouse held, or a finger) to draw anything; each stroke is pressed into the sand as one smooth groove. The boy picks up a spare twig and draws again; each child's hand follows the tip of their own line (a two-bone reach in `_ik`, the twig pointed from the hand to the line). When something is drawn and the twig rests, a bubble 画好了: 还不错, then the wind wears the lines away from the upwind side and lifts their sand off (诶 / 没了); the boy: 没事 / 那就 再画一个吧. The second, smaller one goes too (这次 画小一点 → 风太大了 / 留不下呢); a cut to over the kneeling traveler's shoulder: 你的画 / 随风去旅行了. Then a close shot: they look up after the drifting sand, get up off the knee (the rest of the traveler's Stand_Up3), think 我 也是被风吹来的吧, and say 是啊 / 那就 随它去吧, and walk on; 落花谷 · 第一章 · 完. The children are `kid-bamboo.glb` (CrouchLookAroundBow, Talk_with_Left_Hand_on_Hip, Collect_Object), `kid-red.glb` and `kid-wander.glb` (Sit_Cross_Legged_on_Floor), Meshy + Mixamo, scaled to 0.72 (about 1.2 m); the twig is `twig.glb` (a Meshy branch, 3k triangles, 0.44 m).

While the lost things are being found, a quiet list sits top-left: 匾 灯 铃 香, each with a dot (hollow = missing, ember = carried, filled = home).

Directed shots (the opening, the hall look-around, the door, leaving, the night, waking) ignore the mouse and touch; only the movement keys can cut the opening and the hall look-around short.

Spots and dialogue live in `src/main.js` (`spots`, `TALK_FIRST`, `TALK_AFTER`); the words are in `src/i18n.js`.

## Models

- `assets/models/buddha.glb`: the sculpted Buddha (Meshy, about 250k triangles, 8.6 MB). It replaces the procedural figure once it loads; if it fails to load, the procedural one stays. Fit and colour are set by `STATUE` in `src/interior.js` (`height`, `turn`, `tint`, `roughness`, `env`).

- `assets/models/traveler.glb`: the player character (Meshy + Mixamo rig, about 30k triangles) with its clips. `src/actor.js` blends Idle_4 / Walking / Running by ground speed (shared phase, so no foot sliding) and mixes in Short_Breathe_and_Look_Around after standing still. For 沙上画 it holds Stand_Up3 on one knee (`kneel`, turned back by `KNEEL_YAW` so the body faces where the game turned it) and plays the rest of it to get up (`rise()`). The only procedural layer is a small forward lean for the tired stretch in the snow. Bows and hand-held props were left out on purpose. Clip names are mapped in `CLIPS` at the top of that file. If the model fails to load, the procedural traveler is used.

## Camera

- Opening: after "Set out", an 11 s shot with letterbox bars brings the player in. It comes down out of the storm, passes the traveler to a close look under the hat, then goes over the shoulder to the temple far ahead, and ends exactly on the follow camera. Moving or tapping after 2 s skips it. From then on the camera is the player's; the game never takes it over while they walk.
- Snow: between z ≈ 33 and 26 the traveler is worn out: slower, leaning into the wind, louder wind. The camera stays the player's.
- Stairs: the body follows the feet (`actor.feet`), so neither foot sinks into a tread.
- Entering the hall: about 8 s looking around through the traveler's eyes (pillars and window light, beams, the other side, then the Buddha). Moving or tapping after 2.6 s skips it, and the view then draws back to the follow camera.
- At the altar everything is first person: the stick is held just below the view, lighting leans in to the candle, offering leans in to the burner. At bedtime the gaze turns from the Buddha to the daybed, then (after the thank-you) walks over and lies down, facing the altar.

## Files

- `src/i18n.js`: every on-screen line and prompt in Chinese, English and Japanese.
- `src/main.js`: renderer, post-processing, story state machine, camera, input.
- `src/exterior.js`: snowy valley, temple, roof, rope and tassels, lanterns, rocks, pines.
- `src/repair.js`: the repair quest: the lost things lying in the snow (with a warm light pool and rising motes), carrying them, and their flight home.
- `src/models.js`: loads each model once, then fits and anchors a clone for each place it is used; `propParts` / `instancesFromModel` turn a model into InstancedMeshes for the forests.
- `src/temple-detail.js`: the temple's finer architecture: bracket sets and rafters under the eaves, the painted main beam, the 雪寺 plaque, lacquered pillars on carved bases, timber-framed plaster walls, wind chimes at the roof corners, the finial, and the platform's balustrade and stair borders.
- `src/interior.js`: hall, altar, Buddha, candles, burner, dust and smoke; the golden lotus kneeling seat (`cushion.glb`) on a red rug (`rug.glb`), four lotus floor lamps (`lotus-lamp.glb`), two hanging paper lanterns, and the bedtime daybed (`daybed.glb`, hidden until `showBed`). All four are Meshy models simplified to 9k–80k triangles with 512–1024 WebP textures. The hall is lit warm (hemisphere, a front wash, the lamps) against the cold window light.
- `src/traveler.js`: the traveler, with walking and bowing animation.
- `src/fx.js`: snow and dust particles, incense smoke, footprints, light shafts.
- `src/materials.js`: shader patch that lets snow settle on upward-facing surfaces, plus canvas textures.
- `src/audio.js`: Web Audio wind, footsteps, singing bowl, and a generative temple score (om drone, xiao flute, guqin, bowls, wooden fish) that starts at the door and swells inside.

## Debug

**Test switch:** the first of the three icons in the top-right corner (a path with three stops) opens a list of every world and story point (序章: 标题, 开场, 风雪, 台阶, 殿门, 进殿, 殿内, 上香, 对话一, 修庙, 归位, 对话二, 入夜; 第一章: 醒来, 漫步, 阿念, 找花, 落花祭). Picking one reloads the page straight into that point (`?at=talk2`, etc.). Chapters not built yet are listed in grey.

**Deploying:** bump `window.__V` near the top of `index.html` before each push. Every script and model URL carries it (`?v=…`), so browsers load the new version instead of a cached mix of old and new files.

In the browser console, `__game.jump('intro' | 'trudge' | 'stairs' | 'door' | 'inside' | 'walkin' | 'talk1' (incense offered, the first talk begins) | 'errand' (just out of the hall, things glowing) | 'repaired' | 'talk2' | 'night' | 'valley' | 'valleyWalk' | 'nian' (walking up to 阿念) | 'nianQuest' (留花: the wind up, hold to stop it) | 'nianEnd' (the grandmother near, the last gust) | 'sand' (on the path just before the sand) | 'sandDraw' (drawing) | 'altar' | 'ending' (same as 'night': bedtime) | 'snow' (the night snow view))` jumps to a state, and `__game.advance(seconds, holding)` fast-forwards the simulation. `__game.put(x, z)` moves the traveler outside, `__game.answer('a1a' | 'a1b' | 'sil')` answers the Buddha, and `__game.quest` is the repair quest and `__game.nian` 阿念's. `__game.shot()` renders one frame and returns it as a JPEG data URL (it works while the tab is in the background).

## Credits

- "Cherry Blossom Trees" by [Jagobo](https://sketchfab.com/Jagobo), [Sketchfab](https://sketchfab.com/3d-models/cherry-blossom-trees-f69be55d2e4f4f73b568ebb185bd8496), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Split into three trees, blossom cards thinned on the small ones, textures resized.
- "Cherry Blossoms" by [Nommoc](https://sketchfab.com/kikumi), [Sketchfab](https://sketchfab.com/3d-models/cherry-blossoms-9d1dda78f1524c33b749015f21c0b845), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Three petals and one flower taken out, simplified.
- "Grass" by [Georgeous](https://sketchfab.com/intice184), [Sketchfab](https://sketchfab.com/3d-models/grass-674d42354f6348a7a85fc06a7f004db5), Sketchfab Standard licence. Seven clumps cut out, textures resized.
