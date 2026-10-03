// tools/gen_gloss.js — 逐字歌词：每句英文按词拆开并给出中文词义 → 逐字歌词.md
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'data', 'zh.js'), 'utf8'));
const ZH = global.window.ZH;

const W = {
';':'（分号）','A.D':'公元纪年','AC':'交流电','AM':'上午','ANTIOXIDANTS':'抗氧化物',
'ARGUMENTS':'论证（参数双关）','And':'然后 / 和','B.C':'公元前','CIRCUMFERENCE':'周长',
'COMPLETION':'完整','CREATION':'创建','Challenging':'挑战','DC':'直流电','DIMENSION':'维度',
'DISHEARTENED':'心灰意冷','DOS':'西语·二','EIN':'德语·一','ENJOYMENT':'欢愉','EXECUTION':'执行',
'EXISTENCE':'存在','F':'女性','FEM':'丹麦语·五','FRAGMENTS':'碎片','Fill':'填入','From':'从',
'I':"我","I'm":'我是',"I've":'我已经',ILLEGAL:'非法的',INITIALIZATION:'初始化',ISOLATION:'孤立',
'If':'如果','In':'在…里',LIMITATIONS:'约束',LIU:'中文·六','LO-O-OVE':'爱（拉长音）',Lay:'放下',
'M':'男性','NE':'瑞典语·四',NUTRIENTS:'营养',OBJECT:'对象','Oh':'哦','PM':'下午',PROTECTION:'防护',
'Question':'提问',Remember:'记得',S:'支配',SATISFACTION:'满足',SIMULATION:'模拟',
'STIMULATIONS':'刺激','Set':'建立','So':'如此 / 于是',Switch:'切换',TANGENTS:'切线',
'TROIS':'法语·三','The':'这 / 这个',Then:'那么 / 那就',Though:'尽管','To':'到 · 向',Trapped:'被困',
VIBRATIONS:'震动','We':'我们','You':'你',a:'一个','ah':'啊',algebraic:'代数的',all:'所有的',am:'是',
an:'一个',answer:'回答',approach:'趋近',are:'是',back:'回来',be:'成为',begin:'开始',blind:'蒙住',
can:'能',cat:'猫',circle:'圆',current:'电流',data:'数据',deeply:'深深地',dizzy:'晕眩',do:'做',
down:'下',eggplant:'茄子',enter:'进入',erase:'抹去',expression:'表达式',feel:'感受',finally:'终于',
for:'为了',free:'自由的',gender:'性别',give:'给',god:'神',happy:'快乐',have:'有',how:'如何',in:'在',
infinity:'无穷',know:'知道',leave:'离开',left:'离开（完成时）',"let's":'让我们',line:'线',
made:'制造',make:'让',maybe:'也许',me:'我',my:'我的',new:'新的',of:'的',on:'在…上',only:'唯一的',
our:'我们的',parameters:'参数',pieces:'棋子',pointless:'无意义的',points:'点',power:'电力',
proof:'证明',properly:'妥善地',purr:'打呼噜',put:'穿上 / 放',role:'角色',run:'运行',set:'设置',
sine:'正弦',sit:'坐',so:'如此 / 就',some:'一些',strange:'古怪',studied:'研究过',switch:'切换',
tabby:'虎斑的',the:'这 / 这个',them:'它们',then:'然后',this:'这个',to:'到 · 向',tomato:'番茄',
trance:'恍惚',trapped:'被困',travel:'穿越',unite:'结合',up:'起',vision:'视线',wave:'波',we:'我们',
whatever:'无论什么',will:'将',"won't":'不会','world':'世界','world.execute(me);':'world 执行我','world.execute':'world 执行（函数名）','me':'我',
'you':'你',"you're":'你是','your':'你的',
};
// 多义词按整句覆盖
const OV = {
  "If I'm a set of points": { set: '集合（数学）' },
};

const lrc = fs.readFileSync(path.join(ROOT, 'song.lrc'), 'utf8');
const out = [];
out.push('# world.execute(me); 逐字歌词 · 词义对照');
out.push('');
out.push('> 按 LRC 时间轴逐句拆词；整句翻译见 `data/zh.js`（MV 内 `//` 行显示）。');
out.push('> 专有名词与多语言计数（EIN/DOS/TROIS/NE/FEM/LIU）标注语言来源。');
out.push('');
let missing = [];
for (const raw of lrc.split(/\n/)) {
  const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
  if (!m) continue;
  const text = m[3].trim();
  if (!text) continue;
  const ts = `${m[1].padStart(2, '0')}:${m[2].padStart(5, '0')}`;
  if (/^[\u4e00-\u9fa5]/.test(text) && /[:：]/.test(text)) {
    out.push(`- \`${ts}\` ${text}（原曲信息）`);
    continue;
  }
  const zh = ZH[text] || '';
  out.push('');
  out.push(`### \`${ts}\` ${text}`);
  out.push(`// ${zh}`);
  out.push('');
  const ov = OV[text] || {};
  const words = text.split(/[^\w'.\/;:-]+/).filter(Boolean);
  const gloss = words.map((w) => {
    const g = ov[w] || W[w] || W[w.toLowerCase()];
    if (!g) { missing.push(text + ' :: ' + w); return `${w}（?）`; }
    return `${w}（${g}）`;
  });
  out.push(gloss.join(' '));
}
out.push('');
fs.writeFileSync(path.join(ROOT, '逐字歌词.md'), out.join('\n'));
console.log('逐字歌词.md written | missing glosses:', missing.length ? [...new Set(missing)] : 'NONE');
