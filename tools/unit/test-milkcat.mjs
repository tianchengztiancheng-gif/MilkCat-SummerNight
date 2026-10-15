/* <MilkCat> 格式解析、变量命令、角色包、快照记忆、{{stat_data::}} 宏（超级奶猫） */
import fs from 'fs'; import vm from 'vm';
import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const P = (...a) => path.join(ROOT, ...a);

const store = {};
const sb = { console, setTimeout, clearTimeout, AbortController, TextDecoder, TextEncoder, Date, Math, JSON, Uint32Array,
  crypto: globalThis.crypto,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
sb.window = sb;
vm.createContext(sb);
for (const f of ['core/terms', 'core/regex', 'core/worldbook', 'core/prompt', 'core/script', 'core/resolver', 'core/phone', 'core/memory',
  'core/milkcat', 'core/engine', 'core/editors', 'core/packs', 'packs/tianqing/data', 'packs/tianqing/pack'])
  vm.runInContext(fs.readFileSync(P(f + '.js'), 'utf8'), sb, { filename: f });
const { MilkCat: MC, MilkCatPacks: PK, Engine, Memory: M, Terms } = sb;

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (x ? '\n      → ' + x : '')));
const J = x => JSON.stringify(x);

const T = `<MilkCat>
<MilkCat_maintext>
<背景|校园|校门口>
<旁白|风很凉。>
<天青|得意|看到没！那个是我的制作人！>
<CG|璀璨笑容>
<天青|微笑|让你久等了。>
</CG>
<同学|每次都这样……>
<登场|角色B:微笑|角色C>
<角色B|微笑|你好。>
<退场|角色B>
有一句没包标签的话。
</MilkCat_maintext>
<MilkCat_branches>
[「行了行了」]
[摸摸她的头]
</MilkCat_branches>
<MilkCat_snapshots> 校门口接天青放学。 </MilkCat_snapshots>
<MilkCat_hook>
<line|天青|到家报备>
<line|只写简述的一条>
<line_group|事务所群|天青,角色B|讨论排练>
<twitter|有人拍到>
</MilkCat_hook>
<UpdateVariable>
- 分析：过了半小时
<MilkCat_variables>
<MilkCat_variables>
_.set('stat_data.时间.具体时间', [16, 30])
_.set('stat_data.时间.星期', '一')
_.add('stat_data.名气.twitter', 50)
_.append('stat_data.名气.专辑', ['新专辑', 3000])
_.set('stat_data.地点', '校园', '公园')
</MilkCat_variables>
</MilkCat_variables>
</UpdateVariable>
</MilkCat>`;

console.log('\n[1] 拆块');
{
  const s = MC.split(T);
  ok('认得出 MilkCat，也认 summernight', MC.detect(T) && MC.detect('<summernight><summernight_maintext>') && !MC.detect('<Gal>x</Gal>'));
  ok('选项', J(s.branches) === J(['「行了行了」', '摸摸她的头']));
  ok('快照（去掉首尾空白）', s.snapshot === '校门口接天青放学。');
  ok('钩子：app + 参数', s.hooks.length === 4 && s.hooks[0].app === 'line' && J(s.hooks[0].args) === J(['天青', '到家报备']) &&
     J(s.hooks[1].args) === J(['只写简述的一条']) && s.hooks[2].app === 'line_group' && s.hooks[2].args[1] === '天青,角色B', J(s.hooks));
  ok('正文区没混进选项、钩子', !/摸摸她的头|到家报备|_\.set/.test(s.maintext));
  ok('结尾闭合', s.complete);
  const half = MC.split('<MilkCat>\n<MilkCat_maintext>\n<天青|微笑|写到一半');
  ok('没闭合（流式中途）也拿得到正文，写到一半的那句先不演', /写到一半/.test(half.maintext) && half.complete === false &&
     MC.toEvents(half.maintext).events.length === 0, half.maintext);
  const half2 = MC.split('<MilkCat>\n<MilkCat_maintext>\n<天青|微笑|写完一句>\n<旁白|又一句>');
  ok('没闭合时已经写完的句子都在', MC.toEvents(half2.maintext).events.filter(e => e.type === 'say').length === 2);
  ok('summernight 前缀一样拆', MC.split(T.replace(/MilkCat/g, 'summernight')).hooks.length === 4);
}

console.log('\n[2] 正文 → 剧本事件');
{
  const ev = MC.toEvents(MC.split(T).maintext, { period: '黄昏' }).events;
  const say = ev.filter(e => e.type === 'say');
  ok('背景：图片ID + 名称 + 时段', ev[0].type === 'bg' && ev[0].loc === '校园' && ev[0].name === '校门口' && ev[0].period === '黄昏', J(ev[0]));
  ok('三段式台词：谁 / 表情 / 内容', say[1].who === '天青' && say[1].expr === '得意' && say[1].text === '看到没！那个是我的制作人！');
  ok('旁白、两段式（没立绘的人）', say[0].narration && say[3].who === '同学' && say[3].expr === '-' && !say[3].narration);
  ok('CG 区间只包住中间那句', say[1].cg === null && say[2].cg === '璀璨笑容' && say[3].cg === null);
  ok('登场 / 退场', ev.some(e => e.type === 'enter' && J(e.cast) === J([{ name: '角色B', expr: '微笑' }, { name: '角色C', expr: '' }])) &&
     ev.some(e => e.type === 'exit' && J(e.cast) === J(['角色B'])));
  ok('没包标签的散字当旁白，不丢', say.some(e => e.narration && e.text === '有一句没包标签的话。'));
  ok('台词里有竖线也不切坏', MC.toEvents('<天青|微笑|a|b>').events[0].text === 'a|b');
}

console.log('\n[3] 变量命令');
{
  const cmds = MC.commandsOf(T);
  ok('五条命令，路径去掉 stat_data.', cmds.length === 5 && cmds[0].path === '时间.具体时间' && cmds[2].cmd === 'add' && cmds[3].cmd === 'append', J(cmds));
  ok('三个参数的 _.set 取最后一个', cmds[4].value === '公园');
  const v = { 时间: { 具体时间: [16, 0] }, 名气: { twitter: 1000, 专辑: [] } };
  const notes = MC.applyCommands(v, cmds);
  ok('set / add / append 落地', J(v.时间.具体时间) === '[16,30]' && v.名气.twitter === 1050 && J(v.名气.专辑) === '[["新专辑",3000]]' && v.地点 === '公园', J(v));
  ok('改动说明能被「地点改过」识别', notes.some(n => /(^|\.)地点\s*=/.test(n)));
  ok('单引号数组也认', J(MC.parseValue("['a', 2]")) === '["a",2]');
  ok('add 到不存在的路径从 0 起', (() => { const x = {}; MC.applyCommands(x, MC.parseCommands("_.add('stat_data.a.b', 5)")); return x.a.b === 5; })());
  ok('钟点 → 时段', MC.bandOf(9) === '白日' && MC.bandOf(17) === '黄昏' && MC.bandOf(22) === '夜晚' && MC.bandOf(3) === '夜晚');
  ok('从变量推时段：具体时间优先', MC.periodOf({ 时间: { 具体时间: [17, 30], 时段: '朝' } }) === '黄昏' && MC.periodOf({ 时间: { 时段: '深夜' } }) === '夜晚');
}

console.log('\n[4] 引擎：一轮 MilkCat 输出');
{
  const e = new Engine();
  sb.RESOURCE = sb.RESOURCE || {};
  sb.RESOURCE.characters = { 天青: { default_outfit: '常服', outfits: { 常服: { 得意: ['u1'], 微笑: ['u2'] } } } };
  sb.RESOURCE.scenes = { 校园: { 白日: 'bg1', 黄昏: 'bg2' } };
  e.vars = { 时间: { 天数: 1, 具体时间: [16, 0], 星期: '一' }, 地点: '校园', 名气: { twitter: 1000, 专辑: [] } };
  const r = e.processOutput(T);
  ok('格式标成 milkcat，带快照和钩子', r.format === 'milkcat' && r.snapshot === '校门口接天青放学。' && r.hooks.length === 4);
  ok('变量已更新', e.vars.名气.twitter === 1050 && J(e.vars.时间.具体时间) === '[16,30]');
  const says = r.modules;
  ok('台词模块：天青自动上台，最后一句带选项', says.length === 6 && says[1].stage.some(c => c.name === '天青') && J(says[says.length - 1].choices) === J(['「行了行了」', '摸摸她的头']), says.length);
  ok('CG 跟着句子走（pcg）', says[2].pcg === '璀璨笑容' && !says[1].pcg);
  ok('背景按变量钟点取时段：16:30 → 黄昏图', says[0].scene && says[0].scene.url === 'bg2', J(says[0].scene));
  ok('不把 MilkCat 外壳标签当台词', says.every(m => !/MilkCat|UpdateVariable/.test(m.text)));
  const g = e.processOutput('<Gal>\n「早。」|天青|微笑|\n</Gal>');
  ok('旧 <Gal> 照样能演', g.format === 'gal' && g.modules.length === 1);
}

console.log('\n[5] 角色包：天青');
{
  const pk = PK.get('tianqing');
  ok('注册了天青', pk && pk.name === '天青' && PK.list().length === 1);
  ok('75 种表情 / 22 个地点 / 20 张 CG / 15 个表情包 / 3 个开局', Object.keys(pk.characters.天青.expressions).length === 75 &&
     Object.keys(pk.scenes).length === 22 && Object.keys(pk.cg).length === 20 && Object.keys(pk.stickers).length === 15 && pk.openings.length === 3);
  ok('开局和提示词里的格式前缀都换成了 MilkCat', pk.openings.every(o => /<MilkCat_maintext>/.test(o.raw) && !/summernight/.test(o.raw)) &&
     pk.prompts.every(p => !/summernight/.test(p.content)) && Object.values(pk.phonePrompts).every(t => !/summernight/.test(t)));
  ok('天青的人设原样（世界书 7 条，第一条 1.2 万字）', pk.worldbook.length === 7 && pk.worldbook[0].comment === '天青' && pk.worldbook[0].content.length > 10000);
  const e = new Engine();
  const r = PK.apply(e);
  ok('装上：称呼变成制作人，手机走钩子模式', Terms.user === '制作人' && e.cfg.phoneMode === 'hook' && e.cfg.userName === '制作人');
  ok('立绘、背景、CG 进 RESOURCE，头像和表情包进 PHONE_RES', sb.RESOURCE.characters.天青.outfits.常服.得意.length === 1 && sb.RESOURCE.scenes.校园.白日 &&
     Object.keys(sb.RESOURCE.cg).length === 20 && sb.PHONE_RES.avatars.天青 && Object.keys(sb.PHONE_RES.stickers).length >= 15);
  ok('虚拟卡：主角天青，开局 1 + 2', r.card.data.name === '天青' && /<MilkCat>/.test(r.card.data.first_mes) && r.card.data.alternate_greetings.length === 2);
  ok('世界书 = 设定 7 + 系统提示词 6 + 新增 2，没有旧手机规则', e.pool.length === 15 && !e.pool.some(x => x.uid === sb.Editors.PHONE_RULE_ID), e.pool.length);
  ok('变量列表条目是锁定那条，带 {{stat_data::}} 宏', e.pool.some(x => x.comment === '变量列表' && /\{\{stat_data::名气\.twitter\}\}/.test(x.content)));
  const iv = PK.initialVars();
  ok('初始变量（深拷贝）', iv.地点 === '校园' && iv.名气.twitter === 1000 && iv !== PK.initialVars());
  ok('变量注释表', /粉丝数/.test(PK.varMeta()['名气.twitter'].comment));
  ok('内置预设：有对话历史和世界书占位', PK.defaultPreset().prompt_order[0].order.some(o => o.identifier === 'chatHistory'));
  e.loadPreset(PK.defaultPreset());
  e.vars = iv;
  const msgs = e.dryRun('你好').messages.map(m => m.content).join('\n');
  ok('组装出来：变量宏展开、格式约定、新增两条都在', /名气\.twitter：1000/.test(msgs) && /<MilkCat_maintext>/.test(msgs) && /多人同台/.test(msgs) && /line_group/.test(msgs) && !/stat_data::/.test(msgs));
  ok('{{producer}} 等同 {{user}}', sb.PromptBuilder.build({ preset: PK.defaultPreset(), history: [], userText: '{{producer}}', userTextMacro: true, userName: '制作人' }).messages.some(m => /制作人/.test(m.content)));
  ok('手机提示词：包默认 → 玩家改了用玩家的 → 恢复', /LINE 私聊回复/.test(PK.phonePrompt('line')) &&
     (PK.setPhonePrompt('line', 'X'), PK.phonePrompt('line') === 'X') && (PK.setPhonePrompt('line', null), /LINE 私聊回复/.test(PK.phonePrompt('line'))));
  ok('机制模块配置：直播间、名气', PK.mechanics().livestream && PK.mechanics()['idol-fame'].root === '名气');
}

console.log('\n[6] 记忆：每轮都有快照就不用请求');
{
  const hist = [{ role: 'assistant', content: '<MilkCat_snapshots>开局：校门口。</MilkCat_snapshots>' }];
  for (let i = 1; i <= 6; i++) hist.push({ role: 'user', content: 'u' + i }, { role: 'assistant', content: '<MilkCat><MilkCat_maintext><旁白|x></MilkCat_maintext><MilkCat_snapshots>第' + i + '轮的事。</MilkCat_snapshots></MilkCat>' });
  const t = M.snapshotText(hist, { from: 0, to: 7 });
  ok('拼成要点，一轮一行', t && t.split('\n').length === 4 && /第 1 轮：开局：校门口。/.test(t) && /第 3 轮：第3轮的事。/.test(t), t);
  const h2 = hist.slice(); h2[4] = { role: 'assistant', content: '没有快照的一轮' };
  ok('有一轮缺快照就不拼（交给整理请求）', M.snapshotText(h2, { from: 0, to: 7 }) === null);
  const e = new Engine(); e.memCfg = { enabled: true, keepTurns: 2, chunkTurns: 2 }; e.history = hist;
  let asked = 0;
  await e.memoryTick({ send: async () => { asked++; return '- x'; } });
  ok('整理时没发请求，记忆块来自快照', asked === 0 && e.memory.chunks.length >= 1 && /第1轮的事/.test(e.memory.chunks[0].text), J(e.memory.chunks));
}

console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' 过 / ' + fail + ' 挂');
process.exit(fail ? 1 : 0);
