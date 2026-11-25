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
    ch1Title: '落花谷', ch1Sub: '第一章', w1: '寺　不见了', w2: '雪　也停了',
    docTitle: '一炷香 · 序章',
    title: '一炷香', sub: '序章 · 雪寺', subEnd: '序章 · 完',
    loading: '雪 落 中', again: '再上一炷香',
    l1: '风雪里　有一座庙', l2: '我　到了么', l3: '我的旅程　是从这里开始', l4: '还是　到这里结束',
    i1: '庙中简朴　洁净', i2: '却庄严',
    e1: '一炷香', e2: '故事开始',
    tap: '轻触 · {v}', press: '按 E 或点击 · {v}',
    moveM: '按住前行 · 拖动转向', moveD: 'W A S D 移动 · 鼠标转向',
    startM: '轻触 · 启程', startD: '点击或按任意键 · 启程',
    lightM: '长按 · 借烛火点香', lightD: '按住 E 或鼠标 · 借烛火点香',
    door: '推门', take: '取一支香', offer: '敬香', toBuddha: '走到佛前',
    pick_plaque: '拾起匾额', pick_lantern: '拾起灯笼', pick_bell: '拾起铜铃', pick_bowl: '拾起颂钵',
    f_plaque: '雪寺', f_lantern: '灯　还能再亮', f_bell: '铃哑了很久', f_bowl: '钵里盛满了雪',
    d1: '还有东西　落在雪里',
    b1: '你来了', b2: '这座寺　也走了很远的路', b3: '它把几样东西　落在了雪里', b4: '替它找回来吧', b5: '进来吧',
    q1: '你一路走来　在找什么', a1a: '一个去处', a1b: '我不记得了', aSil: '……',
    r1a: '去处　也许不在前面', r1b: '不记得　也无妨', r1s: '不说　也好',
    sutra: '雪　下了一夜',
    lang: '语言', musicOn: '关闭声音', musicOff: '打开声音',
  },
  en: {
    t1: 'Thank you', t2: 'Not many would stop for an old temple',
    n1: 'Sleep well tonight', n2: 'By morning the snow will stop', n3: 'Tomorrow, go on your way again',
    tk: 'Lost things of the temple', tk_plaque: 'Plaque', tk_lantern: 'Lantern', tk_bell: 'Bell', tk_bowl: 'Bowl',
    ch1Title: 'Falling Blossom Valley', ch1Sub: 'Chapter One', w1: 'The temple is gone', w2: 'And the snow has stopped',
    docTitle: 'A Stick of Incense · Prologue',
    title: 'A Stick of Incense', sub: 'Prologue · The Snow Temple', subEnd: 'Prologue · End',
    loading: 'snow is falling', again: 'Offer another stick',
    l1: 'In the snowstorm, a temple', l2: 'Have I arrived?', l3: 'Does my journey begin here', l4: 'or does it end here?',
    i1: 'Inside, simple and clean', i2: 'yet solemn',
    e1: 'A stick of incense', e2: 'and the story begins',
    tap: 'Tap · {v}', press: 'E or click · {v}',
    moveM: 'Hold to walk · drag to turn', moveD: 'WASD to move · mouse to look',
    startM: 'Tap · Set out', startD: 'Click or press any key · Set out',
    lightM: 'Hold · light it from the candle', lightD: 'Hold E or mouse · light it from the candle',
    door: 'Push the door', take: 'Take a stick of incense', offer: 'Offer the incense', toBuddha: 'Walk to the Buddha',
    pick_plaque: 'Pick up the plaque', pick_lantern: 'Pick up the lantern', pick_bell: 'Pick up the bronze bell', pick_bowl: 'Pick up the singing bowl',
    f_plaque: 'Snow Temple', f_lantern: 'It could still be lit', f_bell: 'This bell has been silent a long time', f_bowl: 'The bowl is full of snow',
    d1: 'Some things are still out in the snow',
    b1: 'You have come', b2: 'This temple has travelled far too', b3: 'It dropped a few things in the snow', b4: 'Bring them back for it', b5: 'Come in',
    q1: 'You have walked so far. What are you looking for?', a1a: 'Somewhere to go', a1b: 'I don\'t remember', aSil: '…',
    r1a: 'Perhaps it is not ahead of you', r1b: 'That is all right', r1s: 'Saying nothing is fine too',
    sutra: 'The snow fell all night',
    lang: 'Language', musicOn: 'Sound off', musicOff: 'Sound on',
  },
  ja: {
    t1: 'ありがとう', t2: '古い寺のために　足を止める者は少ない',
    n1: '今夜は　ゆっくりお休み', n2: '朝には　雪もやむ', n3: '明日　また旅を続けなさい',
    tk: '寺の落としもの', tk_plaque: '額', tk_lantern: '灯', tk_bell: '鈴', tk_bowl: '鉢',
    ch1Title: '落花の谷', ch1Sub: '第一章', w1: '寺が　消えた', w2: '雪も　やんだ',
    docTitle: '一炷香 · 序章',
    title: '一炷香', sub: '序章 · 雪の寺', subEnd: '序章 · 終',
    loading: '雪 降 る', again: 'もう一本　香を',
    l1: '吹雪の中に　寺がひとつ', l2: '着いたのか', l3: '私の旅は　ここから始まるのか', l4: 'それとも　ここで終わるのか',
    i1: '堂の中は　質素で清らか', i2: 'けれど厳か',
    e1: '一炷の香', e2: '物語が始まる',
    tap: 'タップ · {v}', press: 'E またはクリック · {v}',
    moveM: '長押しで進む · ドラッグで向きを変える', moveD: 'WASD で移動 · マウスで視点',
    startM: 'タップ · 旅立つ', startD: 'クリックまたは任意のキー · 旅立つ',
    lightM: '長押し · ろうそくで火を灯す', lightD: 'E またはマウスを長押し · ろうそくで火を灯す',
    door: '扉を押す', take: '線香を一本取る', offer: '香を供える', toBuddha: '仏前へ進む',
    pick_plaque: '扁額を拾う', pick_lantern: '提灯を拾う', pick_bell: '銅の鈴を拾う', pick_bowl: 'おりんを拾う',
    f_plaque: '雪寺', f_lantern: '灯は　まだともせる', f_bell: '鈴は長いこと鳴っていない', f_bowl: '鉢に雪が満ちている',
    d1: 'まだ　雪の中に落としものがある',
    b1: 'よく来た', b2: 'この寺も　遠い道を来た', b3: '雪の中に　いくつか落としものをした', b4: '拾ってきておくれ', b5: 'お入り',
    q1: 'ここまで歩いて　何を探している', a1a: '行き先を', a1b: '覚えていない', aSil: '……',
    r1a: '行き先は　前にあるとは限らない', r1b: '覚えていなくとも　よい', r1s: '言わずとも　よい',
    sutra: '雪は　一晩じゅう降った',
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
  if (key === 'start') return isMobile ? s.startM : s.startD;
  if (key === 'light') return isMobile ? s.lightM : s.lightD;
  if (key.startsWith('act:')) return (isMobile ? s.tap : s.press).replace('{v}', s[key.slice(4)]);
  return s[key] ?? key;
}
