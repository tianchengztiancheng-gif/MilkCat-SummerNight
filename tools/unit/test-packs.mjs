/* 两个角色包（天青 + 祈语）：同台开局跨包列出、开局要求的包、按角色取手机提示词、玩家改过的提示词按包分开存、客串提示词 */
import fs from 'fs'; import vm from 'vm';
import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const P = (...a) => path.join(ROOT, ...a);

const store = {};
const sb = { console, setTimeout, clearTimeout, Date, Math, JSON,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
sb.window = sb;
vm.createContext(sb);
for (const f of ['core/terms', 'core/milkcat', 'core/packs', 'packs/tianqing/data', 'packs/tianqing/pack', 'packs/qiyu/data', 'packs/qiyu/pack'])
  vm.runInContext(fs.readFileSync(P(f + '.js'), 'utf8'), sb, { filename: f });
const { MilkCatPacks: PK, MilkCat: MC, MilkCatPackData: DATA } = sb;

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (x ? '\n      → ' + x : '')));
const J = x => JSON.stringify(x);

console.log('\n[角色包：天青 + 祈语]');
ok('两个包，天青在前（第一个角色），祈语第二', PK.list().map(p => p.id).join() === 'tianqing,qiyu');
const Q = PK.get('qiyu'), TQ = PK.get('tianqing');
ok('祈语：36 种表情 / 63 张，名字颜色、文生图外观词、头像都有', Object.keys(Q.characters['祈语'].expressions).length === 36 &&
   Object.values(Q.characters['祈语'].expressions).reduce((n, a) => n + a.length, 0) === 63 && /blonde/.test(Q.characters['祈语'].nai) &&
   /^https:\/\/files\.catbox\.moe\//.test(Q.characters['祈语'].avatar));
ok('立绘清单里重复的「红温」合成一个表情、两张（重复的地址只留一份）', J(Q.characters['祈语'].expressions['红温']) === J(['https://files.catbox.moe/wzncey.png', 'https://files.catbox.moe/ui3h2f.png']));
ok('世界书：卡里的三条原样（祈语 / 奇迹 / 奇迹巡游），都是常驻', Q.worldbook.map(e => e.comment).join() === '祈语,奇迹,奇迹巡游' && Q.worldbook.every(e => e.constant && e.enabled) &&
   /欧菈休·凯瑟祈/.test(Q.worldbook[0].content));
ok('祈语借天青的 22 个地点当背景', Object.keys(Q.scenes).length === 22 && Q.scenes['商业街'] === TQ.scenes['商业街']);

console.log('\n[开局]');
const qo = PK.openings(Q), to = PK.openings(TQ);
ok('祈语：卡里的三个开场白 + 天青 × 祈语', qo.map(o => o.n).join() === '幸运观众,说走就走,草莓千层,天青 × 祈语', qo.map(o => o.n).join());
ok('天青：她自己的三个 + 天青 × 祈语（从祈语包里跨过来）', to.map(o => o.n).join() === '校门口,MV企划,婚纱拍摄,天青 × 祈语', to.map(o => o.n).join());
ok('同台开局带着要的包：天青主角 + 祈语客串', J(qo[3].packs) === J({ main: 'tianqing', extra: ['qiyu'] }) && J(to[3].packs) === J(qo[3].packs));
ok('自己的开局不带 packs（用当前的包）', qo[0].packs === null && to[0].packs === null);
/* 开场白文字照抄：卡里的原文每一段都还在剧本里 */
const G = DATA.qiyu.greetings;
const paras = g => g.split(/\n+/).map(x => x.trim()).filter(x => x && !/^-{3,}$/.test(x)).map(x => x.replace(/^["“`]|["”`]$/g, ''));
const allIn = [0, 1, 2].every(i => paras(G[i]).every(p => qo[i].t.indexOf(p) >= 0));
ok('三个开局：卡里开场白的每一段都原样在剧本里（只套了「」/（）和标签）', allIn);
const exprs = Object.keys(Q.characters['祈语'].expressions), tqx = Object.keys(TQ.characters['天青'].expressions);
const used = (t, who) => [...t.matchAll(new RegExp('<' + who + '\\|([^|>]+)\\|', 'g'))].map(m => m[1]);
const badQ = qo.flatMap(o => used(o.t, '祈语').filter(e => !exprs.includes(e)));
const badT = qo.flatMap(o => used(o.t, '天青').filter(e => !tqx.includes(e)));
ok('开局里祈语、天青用的表情都在各自的立绘名单里', badQ.length === 0 && badT.length === 0, J({ badQ, badT }));
const ev = MC.toEvents(MC.split(qo[3].t).maintext).events;
ok('同台开局能解析：天青、祈语都说话，有登场、有背景', ev.some(e => e.who === '天青') && ev.some(e => e.who === '祈语') && /<登场\|祈语/.test(qo[3].t) && /<背景\|商业街/.test(qo[3].t));
const vars = {}; MC.applyCommands(vars, MC.commandsOf(qo[0].t));
ok('开局变量：地点、时间、奇迹能量', vars.地点 === '街区' && vars.奇迹能量 === 20 && J(vars.时间.具体时间) === '[17,40]', J(vars));

console.log('\n[开局要求的包]');
PK.setChoice({ main: 'qiyu', extra: [] });
ok('现在是祈语主角：不满足同台开局', PK.satisfies(qo[3].packs) === false && PK.satisfies(null) === true);
PK.setChoice({ main: 'tianqing', extra: ['qiyu'] });
ok('天青主角 + 祈语客串：满足', PK.satisfies(qo[3].packs) === true);
const iv = PK.initialVars();
ok('同台的初始变量：天青的名气 + 祈语的奇迹能量', iv.名气 && iv.名气.twitter === 1000 && iv.奇迹能量 === 20 && iv.地点 === '校园', J(iv));
const card = PK.buildCard(PK.activeAll());
const names = card.data.character_book.entries.map(e => e.comment);
ok('虚拟卡：天青的系统提示词 + 祈语的世界书和客串提示词；祈语自己的格式提示词不进来', names.includes('GAL格式') && names.filter(n => n === 'GAL格式').length === 1 &&
   names.includes('祈语') && names.includes('祈语（客串）') && !names.includes('天青（客串）'), names.join(' / '));
PK.setChoice({ main: 'qiyu', extra: ['tianqing'] });
const card2 = PK.buildCard(PK.activeAll()), n2 = card2.data.character_book.entries.map(e => e.comment);
ok('反过来（祈语主角、天青客串）：天青的立绘名单作为客串提示词进来', n2.includes('天青（客串）') && n2.includes('天青') && /完全胜利/.test(card2.data.character_book.entries.find(e => e.comment === '天青（客串）').content) &&
   n2.filter(n => n === 'GAL格式').length === 1, n2.join(' / '));
ok('称呼表：天青「制作人」、祈语「旅伴」', PK.allTerms().join() === '制作人,旅伴');

console.log('\n[手机提示词按角色]');
PK.setChoice({ main: 'tianqing', extra: ['qiyu'] });
ok('天青主角时：天青私聊用天青的 LINE 提示词', /你现在是天青/.test(PK.phonePrompt('line', '天青')) && PK.phonePromptPack('line', '天青').id === 'tianqing');
ok('天青主角时：客串的祈语私聊用祈语自己的 LINE 提示词', /你现在是祈语/.test(PK.phonePrompt('line', '祈语')) && PK.phonePromptPack('line', '祈语').id === 'qiyu');
ok('没有立绘的人 / 没给 who：用主角包的', /你现在是天青/.test(PK.phonePrompt('line', '路人')) && /你现在是天青/.test(PK.phonePrompt('line')));
ok('祈语没有 twitch：要 twitch 的话退回主角包的', /Larimar/.test(PK.phonePrompt('twitch', '祈语')));
/* 玩家改过的：按包分开存；v0.2 存的（没带包 id）算天青的 */
store['mc_phone_prompts'] = JSON.stringify({ line: '老版本改过的天青 LINE' });
ok('v0.2 存的「line」算天青的', PK.phonePrompt('line', '天青') === '老版本改过的天青 LINE' && /你现在是祈语/.test(PK.phonePrompt('line', '祈语')) && PK.phonePromptEdited('line', 'tianqing'));
PK.setPhonePrompt('line', '我改的祈语 LINE', 'qiyu');
ok('改祈语的：存成「qiyu:line」，天青的不受影响', PK.phonePrompt('line', '祈语') === '我改的祈语 LINE' && PK.phonePrompt('line', '天青') === '老版本改过的天青 LINE' &&
   JSON.parse(store['mc_phone_prompts'])['qiyu:line'] === '我改的祈语 LINE');
PK.setPhonePrompt('line', null, 'tianqing');
ok('恢复天青的默认：老键一起删掉', /你现在是天青/.test(PK.phonePrompt('line', '天青')) && !('line' in JSON.parse(store['mc_phone_prompts'])) && !PK.phonePromptEdited('line', 'tianqing'));
PK.setChoice({ main: 'qiyu', extra: [] });
ok('祈语主角时，没给 who 也是祈语的', PK.phonePrompt('line') === '我改的祈语 LINE' && /和祈语有关/.test(PK.phonePrompt('twitter')));

console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' 过 / ' + fail + ' 挂');
process.exit(fail ? 1 : 0);
