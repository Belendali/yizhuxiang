// All on-screen words, in Chinese, English and Japanese.
// Vertical CJK lines carry no punctuation; a full-width space marks a pause.

export const LANGS = [
  { id: 'zh', label: '中文', html: 'zh-CN' },
  { id: 'en', label: 'English', html: 'en' },
  { id: 'ja', label: '日本語', html: 'ja' },
];

const S = {
  zh: {
    t1: '多谢你', t2: '肯为一座旧庙停下的人　不多',
    n1: '今夜　安心睡吧', n2: '明早　雪会停', n3: '明天　再继续上路吧',
    tk: '寺中失物', tk_plaque: '匾', tk_lantern: '灯', tk_bell: '铃', tk_bowl: '钵',
    ch1Title: '落花谷', ch1Sub: '第一章', w1: '诶　我怎么会在这里', w2: '这是哪', s1: '那里好像有个人', s2: '去看看好了', hi: '小姑娘　你好',
    docTitle: '一炷香 · 序章',
    title: '一炷香', sub: '序章 · 雪寺', subEnd: '序章 · 完',
    loading: '雪 落 中', again: '再上一炷香',
    l1: '风雪里　有一座庙', l2: '我　到了么', l3: '我的旅程　是从这里开始', l4: '还是　到这里结束',
    i1: '庙中简朴　洁净', i2: '却庄严',
    e1: '一炷香', e2: '故事开始',
    tap: '轻触 · {v}', press: '按 E 或点击 · {v}',
    moveM: '按住前行 · 拖动转向', moveD: 'W A S D 移动 · Shift 奔跑 · 鼠标转向',
    startM: '轻触 · 启程', startD: '点击或按任意键 · 启程',
    lightM: '长按 · 借烛火点香', lightD: '按住 E 或鼠标 · 借烛火点香',
    door: '推门', take: '取一支香', offer: '敬香', toBuddha: '走到佛前', thx: '谢谢',
    pick_plaque: '拾起匾额', pick_lantern: '拾起灯笼', pick_bell: '拾起铜铃', pick_bowl: '拾起颂钵',
    f_plaque: '雪寺', f_lantern: '灯　还能再亮', f_bell: '铃哑了很久', f_bowl: '钵里盛满了雪',
    d1: '还有东西　落在雪里',
    b1: '你来了', b2: '这座寺　也走了很远的路', b3: '它把几样东西　落在了雪里', b4: '替它找回来吧', b5: '进来吧',
    q1: '你一路走来　在找什么', a1a: '一个去处', a1b: '我不记得了', aSil: '……',
    r1a: '去处　也许不在前面', r1b: '不记得　也无妨', r1s: '不说　也好',
    sutra: '雪　下了一夜',
    tk2: '落花', keepM: '长按 · 留住花', keepD: '按住 E 或鼠标 · 留住花', nLet: '松开手', sd1: '有人在画画', sd2: '画点什么呢', sw1: '风太大了', sw2: '留不下呢', k1: '你也来画吗', k2: '给你', k3: '你的画', k4: '随风去旅游了', t1: '是啊', t2: '随它去吧', take: '接过', done: '画好了', drawM: '手指拖动 · 在沙上画', drawD: '按住鼠标拖动 · 在沙上画', m1: '起风了', m2: '花　在落', m3: '要是能让它　停一停', h1: '花　停住了', h2: '阿念　也停住了', h3: '这样　奶奶就走不过来了', h4: '奶奶　也停住了', r1: '还是　让它落吧', ch1End: '第一章 · 完',
    g1: '奶奶说　今天回来', g2: '花　正好开满了', g3: '可是　起风了', g4: '帮我留住它　好吗',
    g6: '奶奶一定会喜欢', g7: '奶奶', g8: '花　都落了',
    o1: '阿念', o2: '赶上了', o3: '落花的时候　最好看', o4: '多谢你　陪阿念等我', o5: '花不等人', o6: '碰上了　就是好时候', o7: '往前走吧', o8: '前头　也有花开', g9: '是奶奶',
    lang: '语言', musicOn: '关闭声音', musicOff: '打开声音',
  },
  en: {
    t1: 'Thank you', t2: 'Not many would stop for an old temple',
    n1: 'Sleep well tonight', n2: 'By morning the snow will stop', n3: 'Tomorrow, go on your way again',
    tk: 'Lost things of the temple', tk_plaque: 'Plaque', tk_lantern: 'Lantern', tk_bell: 'Bell', tk_bowl: 'Bowl',
    ch1Title: 'Falling Blossom Valley', ch1Sub: 'Chapter One', w1: 'Huh, how did I get here?', w2: 'Where is this?', s1: 'Is someone over there?', s2: "I'll go and see", hi: 'Hello there, little one',
    docTitle: 'A Stick of Incense · Prologue',
    title: 'A Stick of Incense', sub: 'Prologue · The Snow Temple', subEnd: 'Prologue · End',
    loading: 'snow is falling', again: 'Offer another stick',
    l1: 'In the snowstorm, a temple', l2: 'Have I arrived?', l3: 'Does my journey begin here', l4: 'or does it end here?',
    i1: 'Inside, simple and clean', i2: 'yet solemn',
    e1: 'A stick of incense', e2: 'and the story begins',
    tap: 'Tap · {v}', press: 'E or click · {v}',
    moveM: 'Hold to walk · drag to turn', moveD: 'WASD to move · Shift to run · mouse to look',
    startM: 'Tap · Set out', startD: 'Click or press any key · Set out',
    lightM: 'Hold · light it from the candle', lightD: 'Hold E or mouse · light it from the candle',
    door: 'Push the door', take: 'Take a stick of incense', offer: 'Offer the incense', toBuddha: 'Walk to the Buddha', thx: 'Thank you',
    pick_plaque: 'Pick up the plaque', pick_lantern: 'Pick up the lantern', pick_bell: 'Pick up the bronze bell', pick_bowl: 'Pick up the singing bowl',
    f_plaque: 'Snow Temple', f_lantern: 'It could still be lit', f_bell: 'This bell has been silent a long time', f_bowl: 'The bowl is full of snow',
    d1: 'Some things are still out in the snow',
    b1: 'You have come', b2: 'This temple has travelled far too', b3: 'It dropped a few things in the snow', b4: 'Bring them back for it', b5: 'Come in',
    q1: 'You have walked so far. What are you looking for?', a1a: 'Somewhere to go', a1b: 'I don\'t remember', aSil: '…',
    r1a: 'Perhaps it is not ahead of you', r1b: 'That is all right', r1s: 'Saying nothing is fine too',
    sutra: 'The snow fell all night',
    tk2: 'Fallen blossom', keepM: 'Hold · keep the blossom', keepD: 'Hold E or mouse · keep the blossom', nLet: 'Let go', sd1: 'Someone is drawing', sd2: 'What shall I draw', sw1: 'The wind is too strong', sw2: 'It won\'t stay', k1: 'Do you want to draw too?', k2: 'Here', k3: 'Your picture', k4: 'went travelling with the wind', t1: 'Yes', t2: 'Let it go', take: 'Take it', done: 'Done', drawM: 'Drag a finger · draw in the sand', drawD: 'Hold the mouse and drag · draw in the sand', m1: 'The wind is rising', m2: 'The petals are falling', m3: 'If only it would stop a while', h1: 'The petals stopped', h2: 'Anian stopped too', h3: 'Then Grandma can never reach her', h4: 'Grandma stopped too', r1: 'Let it fall, then', ch1End: 'End of Chapter One',
    g1: "Grandma said she'd be back today", g2: 'And the blossom is just full', g3: 'But the wind is rising', g4: 'Will you help me keep it?',
    g6: 'Grandma will love it', g7: 'Grandma!', g8: 'The blossom all fell',
    o1: 'Anian', o2: 'I made it in time', o3: "It's loveliest when it falls", o4: 'Thank you for waiting with Anian', o5: "Blossoms don't wait for anyone", o6: "To be here when they fall is the good time", o7: 'Go on ahead', o8: 'There are flowers further on, too', g9: "It's Grandma!",
    lang: 'Language', musicOn: 'Sound off', musicOff: 'Sound on',
  },
  ja: {
    t1: 'ありがとう', t2: '古い寺のために　足を止める者は少ない',
    n1: '今夜は　ゆっくりお休み', n2: '朝には　雪もやむ', n3: '明日　また旅を続けなさい',
    tk: '寺の落としもの', tk_plaque: '額', tk_lantern: '灯', tk_bell: '鈴', tk_bowl: '鉢',
    ch1Title: '落花の谷', ch1Sub: '第一章', w1: 'あれ　どうしてここに', w2: 'ここは　どこだ', s1: 'あそこに　誰かいる', s2: '行ってみよう', hi: 'やあ　こんにちは',
    docTitle: '一炷香 · 序章',
    title: '一炷香', sub: '序章 · 雪の寺', subEnd: '序章 · 終',
    loading: '雪 降 る', again: 'もう一本　香を',
    l1: '吹雪の中に　寺がひとつ', l2: '着いたのか', l3: '私の旅は　ここから始まるのか', l4: 'それとも　ここで終わるのか',
    i1: '堂の中は　質素で清らか', i2: 'けれど厳か',
    e1: '一炷の香', e2: '物語が始まる',
    tap: 'タップ · {v}', press: 'E またはクリック · {v}',
    moveM: '長押しで進む · ドラッグで向きを変える', moveD: 'WASD で移動 · Shift で走る · マウスで視点',
    startM: 'タップ · 旅立つ', startD: 'クリックまたは任意のキー · 旅立つ',
    lightM: '長押し · ろうそくで火を灯す', lightD: 'E またはマウスを長押し · ろうそくで火を灯す',
    door: '扉を押す', take: '線香を一本取る', offer: '香を供える', toBuddha: '仏前へ進む', thx: 'ありがとうございます',
    pick_plaque: '扁額を拾う', pick_lantern: '提灯を拾う', pick_bell: '銅の鈴を拾う', pick_bowl: 'おりんを拾う',
    f_plaque: '雪寺', f_lantern: '灯は　まだともせる', f_bell: '鈴は長いこと鳴っていない', f_bowl: '鉢に雪が満ちている',
    d1: 'まだ　雪の中に落としものがある',
    b1: 'よく来た', b2: 'この寺も　遠い道を来た', b3: '雪の中に　いくつか落としものをした', b4: '拾ってきておくれ', b5: 'お入り',
    q1: 'ここまで歩いて　何を探している', a1a: '行き先を', a1b: '覚えていない', aSil: '……',
    r1a: '行き先は　前にあるとは限らない', r1b: '覚えていなくとも　よい', r1s: '言わずとも　よい',
    sutra: '雪は　一晩じゅう降った',
    tk2: '落花', keepM: '長押し · 花をとめる', keepD: 'E またはマウスを長押し · 花をとめる', nLet: '手を離す', sd1: '誰か　絵を描いている', sd2: '何を描こうかな', sw1: '風が強すぎる', sw2: '残らないな', k1: 'いっしょに描く？', k2: 'はい', k3: 'きみの絵', k4: '風と旅に出たよ', t1: 'そうだね', t2: '行かせてあげよう', take: '受け取る', done: '描けた', drawM: '指でなぞって · 砂に描く', drawD: 'マウスを押したままドラッグ · 砂に描く', m1: '風が出てきた', m2: '花が　散っていく', m3: '少しだけ　止められたら', h1: '花が　止まった', h2: '念ちゃんも　止まった', h3: 'これじゃ　おばあちゃんが来られない', h4: 'おばあちゃんも　止まった', r1: 'やっぱり　散らせてあげよう', ch1End: '第一章 · 完',
    g1: 'おばあちゃん　今日帰ってくるって', g2: '花も　ちょうど満開', g3: 'でも　風が出てきた', g4: 'お花　とめておいて',
    g6: 'おばあちゃん　きっと喜ぶ', g7: 'おばあちゃん', g8: '花　みんな散っちゃった',
    o1: '念ちゃん', o2: '間に合った', o3: '散るときが　いちばんきれい', o4: '念ちゃんと待っていてくれて　ありがとう', o5: '花は　待ってくれない', o6: '出会えたときが　いい時なのよ', o7: 'さあ　先へお行き', o8: 'この先にも　花は咲いているから', g9: 'おばあちゃんだ',
    lang: '言語', musicOn: '音を消す', musicOff: '音を出す',
  },
};

const KEY = 'yizhuxiang.lang';
function initial() {
  try { const saved = localStorage.getItem(KEY); if (S[saved]) return saved; } catch (_) { /* storage blocked */ }
  // Chinese is the original; a Japanese browser starts in Japanese.
  return (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'zh';
}

let lang = initial();
const listeners = new Set();

export const getLang = () => lang;
export function setLang(id) {
  if (!S[id] || id === lang) return;
  lang = id;
  try { localStorage.setItem(KEY, id); } catch (_) { /* storage blocked */ }
  for (const fn of listeners) fn(lang);
}
export const onLang = (fn) => listeners.add(fn);

/**
 * Text for a key. Device-dependent keys ('move', 'start', 'light') pick the
 * phone or desktop wording; 'act:<verb>' wraps a verb in the tap/press prompt.
 */
export function t(key, isMobile = false) {
  const s = S[lang];
  if (key === 'move') return isMobile ? s.moveM : s.moveD;
  if (key === 'draw') return isMobile ? s.drawM : s.drawD;
  if (key === 'start') return isMobile ? s.startM : s.startD;
  if (key === 'light') return isMobile ? s.lightM : s.lightD;
  if (key === 'keep') return isMobile ? s.keepM : s.keepD;
  if (key.startsWith('act:')) return (isMobile ? s.tap : s.press).replace('{v}', s[key.slice(4)]);
  return s[key] ?? key;
}
