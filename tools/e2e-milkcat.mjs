/* ============================================================
 * tools/e2e-milkcat.mjs —— 端到端：超级奶猫（角色包 + <MilkCat> 格式 + 钩子驱动手机）
 *
 *   A. 不导入任何文件：天青角色包自动装上（祈语包在列表里），天青 3 个开局 + 天青 × 祈语，内置预设
 *   B. 开局「校门口」：变量从包起步、开局变量块生效；天青上台、名字牌用她的颜色；CG 区间铺 CG、出区间收起；最后给选项
 *   C. 一轮：请求里带格式约定 / 变量列表（宏已展开）/ 多人同台 / 钩子补充，没有旧的手机规则；
 *      变量命令 set/add/append 生效；钩子 → LINE 私聊（含表情包）、Twitter 动态 + 评论 + 趋势
 *   D. 重roll：上一版钩子生成的手机内容撤掉，新一版重新生成
 *   E. 手机里私聊天青：用的是 LINE 提示词，回复进聊天
 *   F. 设置 · 手机提示词：改了生效、能恢复默认
 *   G. 导入酒馆角色卡切到卡；「改回角色包」切回来
 *   H. 标题画面（天青原版版式）：开始新游戏 → 开局轮播 → 开演；继续 / 存档 / 设置；自定义开场；两个角色时先选角色
 *   I. 和同一网站下的 juus 版隔开：localStorage 前缀、IndexedDB 库名、「沿用 juus 版的接口设置」
 *   J. 祈语（第二个角色，v0.3）：选她 → 她的开局（卡里的开场白）、称呼「旅伴」、她自己的格式 / 立绘 / 变量；
 *      一轮里私聊用她自己的 LINE 提示词；「天青 × 祈语」同台开局自动换成天青主角 + 祈语客串，两人同台，客串的祈语私聊也用她的提示词
 *   K. 设置界面的角色卡片：点卡片 = 换她当主角（单玩祈语，天青下场）；「＋ 客串」只加 / 去掉客串；标题画面选角色 = 只玩她
 *
 * 用法：node tools/e2e-milkcat.mjs [要测的目录] [截图输出目录]
 * ============================================================ */
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';

const ROOT = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(process.argv[3] || './shots');
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (x ? '\n      → ' + x : '')));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let ver = 0, MODE = 'tq';
/* 祈语当主角时的一轮：她自己私聊 */
const replyQY = () => `<MilkCat>
<MilkCat_maintext>
<背景|咖啡馆|街角咖啡馆>
<祈语|开心|「旅伴旅伴，这家的可颂是刚出炉的哦！」>
</MilkCat_maintext>
<MilkCat_branches>[尝一口][问她今天帮了谁]</MilkCat_branches>
<MilkCat_snapshots>街角咖啡馆，祈语请旅伴吃刚出炉的可颂。</MilkCat_snapshots>
<MilkCat_hook>
<line|祈语|回到旅馆后发消息说今天又攒了一点奇迹能量>
</MilkCat_hook>
<UpdateVariable>
<MilkCat_variables>
_.set('stat_data.地点', '咖啡馆')
_.add('stat_data.奇迹能量', 10)
</MilkCat_variables>
</UpdateVariable>
</MilkCat>`;
/* 天青主角、祈语客串的一轮：钩子让客串的祈语私聊 */
const replyDuo = () => `<MilkCat>
<MilkCat_maintext>
<天青|得意|「可丽饼是我先说要吃的！」>
<祈语|俏皮|「那我吃第二个～」>
</MilkCat_maintext>
<MilkCat_branches>[付钱][看她们吵]</MilkCat_branches>
<MilkCat_snapshots>天青和祈语抢可丽饼。</MilkCat_snapshots>
<MilkCat_hook>
<line|祈语|祈语加了制作人的 LINE，发来可丽饼的照片道谢>
</MilkCat_hook>
<UpdateVariable>
<MilkCat_variables>
_.add('stat_data.奇迹能量', 5)
</MilkCat_variables>
</UpdateVariable>
</MilkCat>`;
const reply = () => { if (MODE === 'qy') return replyQY(); if (MODE === 'duo') return replyDuo(); ver++; return `<MilkCat>
<MilkCat_maintext>
<背景|公园|傍晚的公园>
<旁白|风吹过长椅。>
<天青|得意|制作人！你看我新学的和弦！（第${ver}版）>
<CG|公园吉他或唱歌>
<天青|微笑|好听吗？>
</CG>
<制作人|……还不错。>
</MilkCat_maintext>
<MilkCat_branches>[夸她][让她再弹一遍]</MilkCat_branches>
<MilkCat_snapshots>傍晚公园，天青弹新和弦给制作人听（第${ver}版）。</MilkCat_snapshots>
<MilkCat_hook>
<line|天青|回家后追问制作人刚才的和弦到底好不好听>
<twitter|路人拍到公园弹吉他的少女>
</MilkCat_hook>
<UpdateVariable>
- 过了一个半小时
<MilkCat_variables>
_.set('stat_data.时间.具体时间', [17, 30])
_.add('stat_data.名气.twitter', 30)
_.append('stat_data.名气.Live', ['公园', 12])
</MilkCat_variables>
</UpdateVariable>
</MilkCat>`; };

const exe = ['/opt/pw-browsers/chromium'].find(f => fs.existsSync(f));
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const log = [];
await ctx.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
  if (u.startsWith('https://main.api/')) {
    const body = route.request().postData() || '';
    log.push(body);
    let content;
    if (/你现在是祈语/.test(body) && /独立任务 · LINE 私聊/.test(body)) content = '<line_message>\n<祈语|报告！今天又攒了一点奇迹能量～|21:10>\n</line_message>';
    else if (/独立任务 · LINE 私聊/.test(body) && /刚发来/.test(body)) content = '<line_message>\n<天青|才不告诉你～|19:02>\n<天青|得意|19:02>\n</line_message>';
    else if (/独立任务 · LINE 私聊/.test(body)) content = `<line_message>\n<天青|刚才那段到底好不好听嘛！v${ver}|18:40>\n<天青|生气|18:40>\n</line_message>`;
    else if (/Twitter 动态/.test(body)) content = '<twitter_message>\n<twitter_account>\n路人甲|passerby|17:40|900\n<twitter_context>公园里有个女孩在弹吉他，好好听</twitter_context>\n<twitter_tag>#公园 |3|20|2</twitter_tag>\n小夏|natsu|是天青！\n</twitter_account>\n<trends>\n<#公园吉他少女|0.3>\n</trends>\n</twitter_message>';
    else content = reply();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) });
  }
  if (/huggingface\.co|catbox|wsrv\.nl/.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  return route.abort();
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);
  localStorage.setItem('mc:gal_api_config', JSON.stringify({ protocol: 'openai', baseUrl: 'https://main.api', apiKey: 'k', model: 'm', stream: false })); } });
await p.goto('file://' + ROOT + '/index.html'); await p.waitForTimeout(800);
const E = (f, a) => p.evaluate(f, a);

console.log('\n[A 不导入文件就能玩]');
{
  const s = await E(() => ({ packs: [...document.querySelectorAll('#pack-box .mc-pack')].map(x => x.className + ':' + x.querySelector('b').textContent),
    ops: [...document.querySelectorAll('#opening-sel option')].map(o => o.textContent), preset: !!window.__gal.eng.preset, user: Terms.user,
    pool: window.__gal.eng.pool.map(e => e.comment), start: !document.getElementById('btn-start').disabled, cg: Object.keys(RESOURCE.cg || {}).length }));
  ok('天青角色包自动装上，标成主角；祈语包也在（没启用）', s.packs.length === 2 && /on/.test(s.packs[0]) && /天青/.test(s.packs[0]) &&
     /祈语/.test(s.packs[1]) && !/on|guest/.test(s.packs[1].split(':')[0].replace('mc-pack', '')), JSON.stringify(s.packs));
  ok('天青的三个开局 + 「天青 × 祈语」同台开局', s.ops.length === 4 && /校门口/.test(s.ops[0]) && /婚纱拍摄/.test(s.ops[2]) && /天青 × 祈语/.test(s.ops[3]), s.ops.join());
  ok('没导预设也有内置预设，开始键可点', s.preset && s.start);
  ok('称呼是「制作人」', s.user === '制作人');
  ok('世界书 = 天青设定 + 原版系统提示词 + 新增两条', s.pool.includes('天青') && s.pool.includes('GAL格式') && s.pool.includes('变量列表') &&
     s.pool.includes('多人同台（超级奶猫）') && s.pool.includes('手机钩子写法补充（超级奶猫）') && !s.pool.includes('【引擎】手机内容输出规则'), s.pool.join(' / '));
  ok('20 张 CG 装上了', s.cg === 20);
  await E(() => document.querySelector('#boot-steps button[data-step="go"]').click());
  ok('「齐没齐」清单写着角色包和内置预设', /角色包：天青/.test(await p.textContent('#boot-ready')) && /内置的最小预设/.test(await p.textContent('#boot-ready')));
  await p.screenshot({ path: `${OUT}/mc-boot.png` });
}

console.log('\n[B 开局：校门口]');
{
  await E(() => document.getElementById('btn-start').click()); await p.waitForTimeout(1500);
  const v = await E(() => window.__gal.eng.vars);
  ok('变量从包起步，开局的变量块生效', v.地点 === '校园' && JSON.stringify(v.时间.具体时间) === '[16,0]' && v.名气 && v.名气.twitter === 1000, JSON.stringify(v));
  const n = await E(() => window.__gal.eng.log.length);
  const idx = await E(() => window.__gal.eng.log.findIndex(m => m.who === '天青'));
  await E(i => window.__gal.goTo(i), idx); await p.waitForTimeout(700);
  const st = await E(() => ({ chars: [...document.querySelectorAll('#sprites .char:not(.leaving)')].map(c => c.dataset.name || c.getAttribute('data-n') || 'x').length,
    bg: [...document.querySelectorAll('.bglayer.show')].length, spk: document.getElementById('speaker').textContent, col: document.getElementById('speaker').style.background }));
  ok('天青上台，背景铺上', st.chars === 1 && st.bg >= 1, JSON.stringify(st));
  ok('名字牌用天青的颜色', st.spk === '天青' && /141, 212, 224|8dd4e0/i.test(st.col), st.col);
  const cgi = await E(() => window.__gal.eng.log.findIndex(m => m.pcg));
  await E(i => window.__gal.goTo(i), cgi); await p.waitForTimeout(700);
  ok('CG 区间里铺 CG（璀璨笑容）', await E(() => !document.getElementById('cg').hidden && document.getElementById('cg').classList.contains('show')) &&
     (await E(i => window.__gal.eng.log[i].pcg, cgi)) === '璀璨笑容');
  await p.screenshot({ path: `${OUT}/mc-cg.png` });
  await E(i => window.__gal.goTo(i), cgi - 1); await p.waitForTimeout(900);
  ok('翻回 CG 区间之前的句子：CG 收起', await E(() => !document.getElementById('cg').classList.contains('show')));
  await E(() => window.__gal.goTo(window.__gal.eng.log.length - 1)); await p.waitForTimeout(900);
  ok('停在最后一句给 3 个选项', (await p.$$('#choices button')).length === 3, String((await p.$$('#choices button')).length));
  ok('开局整段 ' + n + ' 句', n > 30);
}

console.log('\n[C 一轮：请求、变量、钩子 → 手机]');
{
  const n0 = log.length;
  await E(() => window.__gal.submit('去公园走走'));
  await p.waitForFunction(() => window.__gal.eng.history.filter(m => m.hookTurn != null).length >= 2, null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  const main = log.slice(n0).find(x => /去公园走走/.test(x) && !/独立任务/.test(x)) || '';
  ok('正文请求带格式约定（MilkCat）和变量列表（宏已展开成数值）', /MilkCat_maintext/.test(main) && /名气\.twitter：1000/.test(main) && !/stat_data::/.test(main), main.slice(0, 120));
  ok('正文请求带新增的多人同台 / 钩子补充，没有旧的 [短信|…] 手机规则', /多人同台/.test(main) && /line_group/.test(main) && !/手机内容输出规则/.test(main));
  const v = await E(() => window.__gal.eng.vars);
  ok('变量命令：set / add / append 都生效', JSON.stringify(v.时间.具体时间) === '[17,30]' && v.名气.twitter === 1030 && JSON.stringify(v.名气.Live) === '[["公园",12]]', JSON.stringify(v));
  ok('背景按变量里的钟点取时段（17:30 → 黄昏）', await E(() => { const m = window.__gal.eng.log[window.__gal.eng.log.length - 1]; return m.bg.loc === '公园' && m.bg.period === '黄昏'; }));
  const lineReq = log.slice(n0).find(x => /LINE 私聊/.test(x)) || '';
  ok('钩子 → LINE：用天青的 LINE 提示词，带上钩子和这一轮的快照', /回家后追问/.test(lineReq) && /天青弹新和弦/.test(lineReq) && /\{\{line_recent_message\}\}/.test(lineReq) === false, lineReq.slice(0, 200));
  const ph = await E(() => { const d = Phone.scan(window.__gal.eng.history, window.__gal.eng.phoneSent, {});
    return { chat: (d.chats['天青'] || []).map(m => m.type + ':' + String(m.v).slice(0, 40)), posts: d.posts.map(x => x.author + '|' + x.title + '|' + x.cmts.length), trends: d.trends.map(t => t.cat + '|' + t.text) }; });
  ok('私聊里有天青的消息和表情包', ph.chat.some(x => /刚才那段到底好不好听嘛！v1/.test(x)) && ph.chat.some(x => /^sticker:https/.test(x)), JSON.stringify(ph.chat));
  ok('Twitter 动态 + 评论 + 趋势', ph.posts.some(x => /路人甲/.test(x) && /\|1$/.test(x)) && ph.trends.some(x => /Twitter\|#公园吉他少女/.test(x)), JSON.stringify(ph));
  ok('主线历史不把手机内容当对话发回去', await E(() => window.__gal.eng.dryRun('x').messages.every(m => !/刚才那段到底好不好听嘛/.test(m.content) || /私聊/.test(m.content))));
  await p.click('#btn-phone'); await p.waitForTimeout(400);
  await E(() => document.querySelector('#jup-root .ph-app[data-app="juus"]').click()); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/mc-line-list.png` });
  await E(() => { const c = document.querySelector('#jup-root .ct[data-c="天青"]'); c && c.click(); }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/mc-line-chat.png` });
}

console.log('\n[D 重roll：钩子内容跟着这一轮走]');
{
  await E(() => window.__gal.phoneBack && window.__gal.phoneBack());
  await E(() => { const x = document.getElementById('ph-m-close') || document.querySelector('#phone-overlay .x'); if (x) x.click(); });
  await E(() => window.__gal.rerollLast()); await p.waitForTimeout(400);
  await p.waitForFunction(() => window.__gal.eng.history.some(m => m.hookTurn != null && /v2/.test(m.content)), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  const h = await E(() => window.__gal.eng.history.filter(m => m.hookTurn != null).map(m => m.hook + ':' + m.content.slice(0, 40)));
  ok('上一版的手机内容撤掉了，只剩新一版的', h.length === 2 && h.some(x => /v2/.test(x)) && !h.some(x => /v1/.test(x)), JSON.stringify(h));
}

console.log('\n[E 手机里私聊天青]');
{
  await p.click('#btn-phone'); await p.waitForTimeout(400);
  await E(() => document.querySelector('#jup-root .ph-app[data-app="juus"]').click()); await p.waitForTimeout(300);
  await E(() => document.querySelector('#jup-root .ct[data-c="天青"]').click()); await p.waitForTimeout(300);
  const n0 = log.length;
  await p.fill('#jup-root .cin', '晚饭吃什么'); await p.click('#jup-root .snd'); await p.waitForTimeout(1200);
  const req = log.slice(n0).find(x => /晚饭吃什么/.test(x)) || '';
  ok('用的是 LINE 提示词', /LINE 私聊/.test(req) && /制作人刚发来/.test(req), req.slice(0, 160));
  ok('回复（文字 + 表情包）出现在聊天里', /才不告诉你/.test(await p.textContent('#jup-root .ms')) && (await p.$$('#jup-root .ms img')).length >= 1);
}

console.log('\n[F 设置 · 手机提示词]');
{
  await E(() => document.querySelector('#jup-root .ph-app[data-app="cfg"]') ? document.querySelector('#jup-root .ph-app[data-app="cfg"]').click() : (window.__gal.phoneBack(), 0));
  await E(() => window.__gal.phoneBack && window.__gal.phoneBack()); await p.waitForTimeout(200);
  await E(() => document.querySelector('#jup-root .ph-app[data-app="cfg"]').click()); await p.waitForTimeout(300);
  await E(() => document.querySelector('#jup-root .kt-nav button[data-sec="apps"]').click()); await p.waitForTimeout(300);
  ok('有 LINE / 通话 / Twitter / 直播 / 二级钩子 五份', (await p.$$('#apps-host [data-app-p]')).length === 5 && /LINE 私聊回复/.test(await p.inputValue('#apps-ta')));
  await p.fill('#apps-ta', '自定义的 LINE 提示词 {{user}}'); await p.click('#apps-save');
  ok('改了生效', await E(() => MilkCatPacks.phonePrompt('line')) === '自定义的 LINE 提示词 {{user}}');
  p.once('dialog', d => d.accept()); await p.click('#apps-reset'); await p.waitForTimeout(200);
  ok('恢复默认', /LINE 私聊回复/.test(await E(() => MilkCatPacks.phonePrompt('line'))));
  await p.screenshot({ path: `${OUT}/mc-apps.png` });
}

console.log('\n[G 酒馆角色卡 ↔ 角色包]');
{
  await E(() => window.__gal.leaveGame()); await p.waitForTimeout(500);
  ok('退出游戏回到标题画面', await E(() => document.getElementById('mc-title').classList.contains('open')));
  await p.click('#mc-title-settings'); await p.waitForTimeout(400);
  ok('标题 → 设置界面：四步引导露出来，左栏有「返回标题画面」', await E(() => !document.getElementById('mc-title').classList.contains('open') &&
     !document.getElementById('boot-totitle').hidden));
  const card = { spec: 'chara_card_v2', data: { name: '测试卡', first_mes: '『✨ 08:00 · 港区 ✨』|旁白|-|\n「早。」|测试娘|微笑|', extensions: {} } };
  fs.writeFileSync(path.join(OUT, 'mc-card.json'), JSON.stringify(card));
  await E(() => document.querySelector('#boot-steps button[data-step="asset"]').click());
  await p.setInputFiles('#f-card', path.join(OUT, 'mc-card.json')); await p.waitForTimeout(400);
  const s1 = await E(() => ({ warn: document.getElementById('pack-box').innerText, src: localStorage.getItem('mc_source'), ops: [...document.querySelectorAll('#opening-sel option')].map(o => o.textContent) }));
  ok('导入卡：切到卡，提示「改回角色包」', /导入的酒馆角色卡/.test(s1.warn) && /card/.test(s1.src) && s1.ops[0] === '默认开场', JSON.stringify(s1));
  await p.click('#pack-back'); await p.waitForTimeout(300);
  const s2 = await E(() => ({ src: localStorage.getItem('mc_source'), ops: [...document.querySelectorAll('#opening-sel option')].length, pool: window.__gal.eng.pool.some(e => e.comment === 'GAL格式') }));
  ok('改回角色包：开局和世界书都回来', /pack/.test(s2.src) && s2.ops === 4 && s2.pool, JSON.stringify(s2));
}

console.log('\n[H 标题画面 + 开局轮播（天青原版版式）]');
{
  await p.reload(); await p.waitForTimeout(1200);
  const t0 = await E(() => ({ open: document.getElementById('mc-title').classList.contains('open'),
    menu: [...document.querySelectorAll('#mc-title .title-menu-btn')].map(b => b.textContent.trim()),
    bg: getComputedStyle(document.getElementById('mc-title')).getPropertyValue('--mc-title-bg'),
    cont: document.getElementById('mc-title-continue').disabled }));
  ok('一打开就是标题画面：开始新游戏 / 继续游戏 / 存档界面 / 设置界面', t0.open && t0.menu.join() === '开始新游戏,继续游戏,存档界面,设置界面', JSON.stringify(t0.menu));
  ok('主视觉用天青原版的主页面图', /%E4%B8%BB%E9%A1%B5%E9%9D%A2|主页面/.test(decodeURIComponent(t0.bg)) || /huggingface|wsrv|catbox/.test(t0.bg), t0.bg);
  ok('有存档时「继续游戏」可点', t0.cont === false);
  await p.screenshot({ path: `${OUT}/mc-title.png` });

  await p.click('#mc-title-new'); await p.waitForTimeout(900);
  const c1 = await E(() => ({ open: document.getElementById('mc-open').classList.contains('open'), st: MCTitle._state(),
    cards: document.querySelectorAll('#mc-open .opening-card').length, dots: document.querySelectorAll('#mc-open .opening-dot').length,
    cap: document.getElementById('mc-open-caption').textContent, ok: document.getElementById('mc-open-confirm').textContent,
    roman: [...document.querySelectorAll('#mc-open .opening-card-roman')].map(r => r.textContent),
    sprite: !!document.querySelector('#mc-open .opening-card.is-selected .opening-card-sprite'),
    back: document.getElementById('mc-open-back').hidden }));
  ok('两个角色（天青 / 祈语）：先选角色', c1.open && c1.st.mode === 'chars' && c1.st.items.join() === '天青,祈语' && /选 她/.test(c1.ok), JSON.stringify(c1.st));
  await p.screenshot({ path: `${OUT}/mc-chars-real.png` });
  await p.click('#mc-open-confirm'); await p.waitForTimeout(700);
  const c2 = await E(() => ({ st: MCTitle._state(), cards: document.querySelectorAll('#mc-open .opening-card').length,
    cap: document.getElementById('mc-open-caption').textContent,
    roman: [...document.querySelectorAll('#mc-open .opening-card-roman')].map(r => r.textContent),
    sprite: !!document.querySelector('#mc-open .opening-card.is-selected .opening-card-sprite'), back: document.getElementById('mc-open-back').hidden }));
  ok('选天青：她的三个开局 + 「天青 × 祈语」+ 自定义开场', c2.st.mode === 'openings' && c2.cards === 5 &&
     c2.st.items.join() === '校门口,MV企划,婚纱拍摄,天青 × 祈语,自定义开场', JSON.stringify(c2.st));
  ok('卡片：罗马数字、背景 + 立绘、底下副标题', c2.roman.join() === 'I,II,III,IV,+' && c2.sprite && c2.cap === '三月末 · 接天青放学', JSON.stringify(c2));
  ok('有「换角色」', c2.back === false);
  await p.screenshot({ path: `${OUT}/mc-openings.png` });
  await p.click('#mc-open-next'); await p.waitForTimeout(600);
  ok('› 切到下一个开局', await E(() => MCTitle._state().sel) === 1 && /七月午后/.test(await p.textContent('#mc-open-caption')));
  /* 拖拽：往左拖一张多 → 再下一个 */
  const box = await p.locator('#mc-open-viewport').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(700);
  ok('左滑切到「婚纱拍摄」', await E(() => MCTitle._state().sel) === 2 && /教堂/.test(await p.textContent('#mc-open-caption')));
  await p.click('#mc-open-confirm'); await p.waitForTimeout(1500);
  const g = await E(() => ({ title: document.getElementById('mc-title').classList.contains('open'), open: document.getElementById('mc-open').classList.contains('open'),
    boot: document.getElementById('boot').classList.contains('gone'), op: window.__gal.eng.history[0] && window.__gal.eng.history[0].content.slice(0, 400) }));
  ok('开始开局：标题和轮播收起，直接进游戏', !g.title && !g.open && g.boot, JSON.stringify(g).slice(0, 200));
  ok('演的是「婚纱拍摄」的开场白', /教堂|婚纱/.test(g.op || ''), (g.op || '').slice(0, 80));

  await E(() => window.__gal.leaveGame()); await p.waitForTimeout(600);
  await p.click('#mc-title-saves'); await p.waitForTimeout(500);
  ok('存档界面盖在标题上面', await E(() => { const m = document.getElementById('save-modal'); const r = m.getBoundingClientRect();
    return !m.hidden && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) && m.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }));
  await E(() => document.getElementById('sv-close').click());
  await p.click('#mc-title-continue'); await p.waitForTimeout(1200);
  ok('继续游戏：读最近的进度', await E(() => document.getElementById('boot').classList.contains('gone') && !document.getElementById('mc-title').classList.contains('open') &&
     /婚纱/.test(String(window.__gal.eng.history[0] && window.__gal.eng.history[0].content))));
  await E(() => window.__gal.leaveGame()); await p.waitForTimeout(500);

  /* 自定义开场：去开场那一步，自定义模式 */
  await p.click('#mc-title-new'); await p.waitForTimeout(800);
  await p.click('#mc-open-confirm'); await p.waitForTimeout(600);      // 两个角色：先「选她」（天青）
  await E(() => document.querySelector('#mc-open .opening-dot[data-index="4"]').click()); await p.waitForTimeout(600);
  ok('最后一张「自定义开场」按钮写「去设定」', /去 设 定/.test(await p.textContent('#mc-open-confirm')));
  await p.click('#mc-open-confirm'); await p.waitForTimeout(500);
  ok('自定义开场 → 引导的开场一步，自定义模式', await E(() => !document.getElementById('mc-title').classList.contains('open') &&
     document.querySelector('#boot .boot-pane[data-pane="go"]').classList.contains('on') && !document.getElementById('op-custom').hidden));
  await p.click('#boot-totitle'); await p.waitForTimeout(400);
  ok('「返回标题画面」', await E(() => document.getElementById('mc-title').classList.contains('open')));

  /* 第二个角色（测试用的假包）：先选角色，再选她的开局 */
  await E(() => {
    const T = MilkCatPacks.get('tianqing');
    MilkCatPacks.register({ id: 'test2', name: '测试娘', main: '测试娘', terms: { user: '前辈' }, tagline: '测试用',
      characters: { '测试娘': { expressions: { 微笑: T.characters['天青'].expressions['微笑'] }, defaultExpr: '微笑', color: '#f9a' } },
      scenes: { 街区: T.scenes['街区'] }, cg: {}, stickers: {}, worldbook: [], prompts: [], phonePrompts: {}, variables: { data: {}, meta: {} },
      openings: [{ id: 'a', title: '放学路上', subtitle: '傍晚 · 街角', coverBgId: '街区', coverExpr: '微笑', raw: '<MilkCat><MilkCat_maintext><背景|街区|街角><测试娘|微笑|前辈！></MilkCat_maintext></MilkCat>' }] });
  });
  await p.click('#mc-title-new'); await p.waitForTimeout(800);
  const k = await E(() => ({ st: MCTitle._state(), ok: document.getElementById('mc-open-confirm').textContent, kick: document.getElementById('mc-open-kicker').textContent }));
  ok('三个角色：先选角色（天青 / 祈语 / 测试娘）', k.st.mode === 'chars' && k.st.items.join() === '天青,祈语,测试娘' && /选 她/.test(k.ok) && /角色/.test(k.kick), JSON.stringify(k));
  await p.screenshot({ path: `${OUT}/mc-chars.png` });
  await p.click('#mc-open-next'); await p.waitForTimeout(500);
  await p.click('#mc-open-next'); await p.waitForTimeout(500);
  await p.click('#mc-open-confirm'); await p.waitForTimeout(700);
  const k2 = await E(() => ({ st: MCTitle._state(), back: document.getElementById('mc-open-back').hidden, main: MilkCatPacks.choice().main, user: Terms.user }));
  ok('选了测试娘：换成她的包，轮播里是她的开局 + 自定义开场', k2.st.mode === 'openings' && k2.st.pack === 'test2' && k2.st.items.join() === '放学路上,自定义开场' &&
     k2.main === 'test2' && k2.user === '前辈', JSON.stringify(k2));
  ok('有「换角色」', k2.back === false);
  await p.click('#mc-open-back'); await p.waitForTimeout(500);
  await E(() => document.querySelector('#mc-open .opening-dot[data-index="0"]').click()); await p.waitForTimeout(400);
  await p.click('#mc-open-confirm'); await p.waitForTimeout(600);
  ok('换回天青', await E(() => MilkCatPacks.choice().main === 'tianqing' && MCTitle._state().items.length === 5 && Terms.user === '制作人'));
  await E(() => MCTitle.closeCarousel());

  /* 接口没填：开始新游戏 → 去设置的接口那一步 */
  await E(() => { localStorage.removeItem('gal_api_config'); });
  await p.click('#mc-title-new'); await p.waitForTimeout(500);
  ok('接口没填：不开轮播，去设置的「接口」一步', await E(() => !document.getElementById('mc-open').classList.contains('open') &&
     !document.getElementById('mc-title').classList.contains('open') && document.querySelector('#boot .boot-pane[data-pane="api"]').classList.contains('on')));
}

console.log('\n[I 和同一网站下的 juus 版隔开]');
{
  const r = await E(() => {
    const raw = MCStore.raw;
    raw.setItem('gal_api_config', JSON.stringify({ protocol: 'openai', baseUrl: 'https://juus.api', apiKey: 'jk', model: 'jm' }));
    raw.setItem('gal_persona', JSON.stringify({ name: 'juus 的人设' }));
    return { iso: MCStore.isolated, own: localStorage.getItem('gal_api_config'), persona: localStorage.getItem('gal_persona'),
      keys: Object.keys(raw).filter(k => /^mc:/.test(k)).length, plain: localStorage.length };
  });
  ok('localStorage 带 mc: 前缀，看不见 juus 的键', r.iso && r.own === null && !/juus/.test(r.persona || '') && r.keys > 3 && r.plain === r.keys, JSON.stringify(r));
  await p.reload(); await p.waitForTimeout(1000);
  await E(() => MCTitle.hide());
  await E(() => document.querySelector('#boot-steps button[data-step="api"]').click());
  ok('接口没填、juus 版有：显示「沿用 juus 版的接口设置」', await E(() => !document.getElementById('juus-import').hidden));
  await p.click('#btn-juus-import'); await p.waitForTimeout(300);
  ok('点了才复制过来', await E(() => document.getElementById('cfg-base').value === 'https://juus.api' && JSON.parse(localStorage.getItem('gal_api_config')).model === 'jm' &&
     document.getElementById('juus-import').hidden));
  ok('IndexedDB 用自己的库 milkcat', await E(async () => (await indexedDB.databases()).map(d => d.name).includes('milkcat')));
  await E(() => { MCStore.raw.removeItem('gal_api_config'); MCStore.raw.removeItem('gal_persona'); });
}

console.log('\n[J 祈语：第二个角色（主角 / 客串 / 同台开局）]');
{
  await E(() => localStorage.setItem('gal_api_config', JSON.stringify({ protocol: 'openai', baseUrl: 'https://main.api', apiKey: 'k', model: 'm', stream: false })));
  await p.reload(); await p.waitForTimeout(1200);
  const QY = await E(() => Object.values(MilkCatPackData.qiyu.expressions).flat());
  const TQ = await E(() => Object.values(MilkCatPackData.tianqing.expressions).flat());
  const spritesOnStage = () => E(() => [...document.querySelectorAll('#sprites .char:not(.leaving) img')]
    .map(i => decodeURIComponent(i.getAttribute('src') || '')).filter(Boolean));
  const own = (srcs, list) => srcs.filter(u => list.some(x => u.indexOf(decodeURIComponent(x)) >= 0)).length;

  /* 选祈语 → 她的开局 */
  await p.click('#mc-title-new'); await p.waitForTimeout(800);
  await E(() => document.querySelector('#mc-open .opening-dot[data-index="1"]').click()); await p.waitForTimeout(500);
  await p.click('#mc-open-confirm'); await p.waitForTimeout(800);
  const q0 = await E(() => ({ st: MCTitle._state(), main: MilkCatPacks.choice().main, user: Terms.user, per: Editors.loadPersona().name,
    pool: window.__gal.eng.pool.map(e => e.comment), cap: document.getElementById('mc-open-caption').textContent }));
  ok('选祈语：她的三个开局（卡里的开场白）+「天青 × 祈语」+ 自定义开场', q0.st.mode === 'openings' && q0.st.pack === 'qiyu' &&
     q0.st.items.join() === '幸运观众,说走就走,草莓千层,天青 × 祈语,自定义开场', JSON.stringify(q0.st));
  ok('称呼换成「旅伴」（玩家名字还是天青的默认「制作人」，跟着换）', q0.user === '旅伴' && q0.per === '旅伴', q0.user + ' / ' + q0.per);
  ok('世界书 = 祈语卡里的三条 + 她自己的格式 / 立绘 / 背景 / 变量提示词，没有天青的', ['祈语', '奇迹', '奇迹巡游', 'GAL格式', '立绘', '背景', '变量列表', '多人同台（超级奶猫）'].every(n => q0.pool.includes(n)) &&
     !q0.pool.includes('天青') && !q0.pool.includes('婚纱'), q0.pool.join(' / '));
  await p.screenshot({ path: `${OUT}/mc-qy-openings.png` });
  await p.click('#mc-open-confirm'); await p.waitForTimeout(1800);
  const q1 = await E(() => ({ op: window.__gal.eng.history[0].content, v: window.__gal.eng.vars, n: window.__gal.eng.log.length,
    idx: window.__gal.eng.log.findIndex(m => m.who === '祈语'), bg: (window.__gal.eng.log[0] || {}).bg }));
  ok('「幸运观众」开演：卡里的开场白原文（街头魔术），变量是祈语包的（奇迹能量 20、地点 街区）',
     /石砖缝隙里挤出的野草/.test(q1.op) && /恭喜你成为今天的幸运观众/.test(q1.op) && q1.v.奇迹能量 === 20 && q1.v.地点 === '街区' && !q1.v.名气, JSON.stringify(q1.v));
  ok('剧本切成一句一句（旁白 + 祈语 15 句）', q1.n > 30 && q1.idx >= 0 && q1.bg && q1.bg.loc === '街区', q1.n + ' 句，第一句背景 ' + JSON.stringify(q1.bg));
  await E(i => window.__gal.goTo(i), q1.idx); await p.waitForTimeout(900);
  const s1 = await spritesOnStage();
  ok('祈语上台，用的是她的立绘', own(s1, QY) >= 1 && own(s1, TQ) === 0, JSON.stringify(s1).slice(0, 200));
  const nm = await E(() => ({ t: document.getElementById('speaker').textContent, bg: document.getElementById('speaker').style.background }));
  ok('名字牌是祈语的浅金色', nm.t === '祈语' && /236, 210, 142|ecd28e/i.test(nm.bg), JSON.stringify(nm));
  await p.screenshot({ path: `${OUT}/mc-qy-stage.png` });

  /* 祈语主角的一轮：格式、变量、私聊用她自己的 LINE 提示词 */
  MODE = 'qy';
  const n0 = log.length;
  await E(() => window.__gal.submit('告诉她自己的名字'));
  await p.waitForFunction(() => window.__gal.eng.history.some(m => m.hookTurn != null && /奇迹能量/.test(m.content)), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  const mainReq = log.slice(n0).find(x => /告诉她自己的名字/.test(x) && !/独立任务/.test(x)) || '';
  ok('正文请求：祈语的格式约定、立绘名单、变量（奇迹能量：20）', /<祈语\|立绘表情/.test(mainReq) && /胜利pose/.test(mainReq) && /奇迹能量：20/.test(mainReq) && !/名气\.twitter/.test(mainReq), mainReq.slice(0, 160));
  ok('变量：奇迹能量 +10、地点 咖啡馆', await E(() => window.__gal.eng.vars.奇迹能量 === 30 && window.__gal.eng.vars.地点 === '咖啡馆'));
  const lq = log.slice(n0).find(x => /独立任务 · LINE 私聊/.test(x)) || '';
  ok('钩子 → LINE：用祈语自己的 LINE 提示词（不是天青的改名）', /你现在是祈语/.test(lq) && !/透明直球/.test(lq) && /旅伴/.test(lq), lq.slice(0, 200));
  ok('私聊里有祈语的消息', await E(() => (Phone.scan(window.__gal.eng.history, window.__gal.eng.phoneSent, {}).chats['祈语'] || []).some(m => /奇迹能量/.test(m.v))));
  MODE = 'tq';
  await E(() => window.__gal.leaveGame()); await p.waitForTimeout(600);

  /* 同台开局：从祈语的列表里点「天青 × 祈语」→ 自动换成天青主角 + 祈语客串 */
  await p.click('#mc-title-new'); await p.waitForTimeout(800);
  const st0 = await E(() => MCTitle._state());
  if (st0.mode === 'chars') { await E(() => document.querySelector('#mc-open .opening-dot[data-index="1"]').click()); await p.waitForTimeout(400); await p.click('#mc-open-confirm'); await p.waitForTimeout(700); }
  await E(() => document.querySelector('#mc-open .opening-dot[data-index="3"]').click()); await p.waitForTimeout(500);
  ok('同台开局卡片在祈语的列表里', /黄昏 · 商业街的奇迹师/.test(await p.textContent('#mc-open-caption')));
  await p.screenshot({ path: `${OUT}/mc-duo-card.png` });
  await p.click('#mc-open-confirm'); await p.waitForTimeout(1800);
  const d0 = await E(() => ({ c: MilkCatPacks.choice(), user: Terms.user, per: Editors.loadPersona().name, pool: window.__gal.eng.pool.map(e => e.comment),
    v: window.__gal.eng.vars, op: window.__gal.eng.history[0].content.slice(0, 300), sel: $ => 0 }));
  ok('开演前自动换成：天青主角 + 祈语客串，称呼回到「制作人」', d0.c.main === 'tianqing' && d0.c.extra.includes('qiyu') && d0.user === '制作人' && d0.per === '制作人', JSON.stringify(d0.c) + ' ' + d0.user);
  ok('世界书：天青设定 + 天青的系统提示词 + 祈语设定 + 祈语客串提示词（GAL格式只有天青那一份）', ['天青', '祈语', '奇迹', '奇迹巡游', '祈语（客串）', 'GAL格式'].every(n => d0.pool.includes(n)) &&
     d0.pool.filter(n => n === 'GAL格式').length === 1 && !d0.pool.includes('天青（客串）'), d0.pool.join(' / '));
  ok('变量：天青的名气 + 祈语的奇迹能量（30）+ 地点 商业街', d0.v.名气 && d0.v.名气.twitter === 1000 && d0.v.奇迹能量 === 30 && d0.v.地点 === '商业街', JSON.stringify(d0.v));
  ok('演的是同台开局', /排练比预定时间晚结束/.test(d0.op));
  const di = await E(() => { const L = window.__gal.eng.log; let seenTQ = false;
    for (let i = 0; i < L.length; i++) { if (L[i].who === '天青') seenTQ = true; if (seenTQ && L[i].who === '祈语' && /你身上也有/.test(L[i].text || '')) return i; } return -1; });
  ok('剧本里天青说过话之后祈语也开口', di > 0, di);
  await E(i => window.__gal.goTo(i), di); await p.waitForTimeout(1000);
  const s2 = await spritesOnStage();
  ok('同台：天青和祈语都在台上', own(s2, QY) >= 1 && own(s2, TQ) >= 1, JSON.stringify(s2).slice(0, 300));
  await p.screenshot({ path: `${OUT}/mc-duo-stage.png` });

  /* 客串的祈语私聊：用她自己的 LINE 提示词 */
  MODE = 'duo';
  const n1 = log.length;
  await E(() => window.__gal.submit('付钱'));
  await p.waitForFunction(() => window.__gal.eng.history.some(m => m.hookTurn != null && /奇迹能量/.test(m.content) && /祈语/.test(m.content)), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  const lq2 = log.slice(n1).find(x => /独立任务 · LINE 私聊/.test(x)) || '';
  ok('天青主角时，钩子让客串的祈语私聊：用祈语的 LINE 提示词，称呼是「制作人」', /你现在是祈语/.test(lq2) && /制作人/.test(lq2) && !/透明直球/.test(lq2), lq2.slice(0, 200));
  MODE = 'tq';
  /* 手机提示词设置：主角包 + 客串包可以切着看 */
  await E(() => window.__gal.leaveGame && window.__gal.leaveGame()); await p.waitForTimeout(500);
}

console.log('\n[K 设置界面的角色卡片：单玩祈语 / 加客串]');
{
  await p.reload(); await p.waitForTimeout(1200);
  await E(() => MCTitle.hide());
  await E(() => document.querySelector('#boot-steps button[data-step="asset"]').click()); await p.waitForTimeout(300);
  const st = () => E(() => ({ c: MilkCatPacks.choice(), ops: [...document.querySelectorAll('#opening-sel option')].map(o => o.textContent.split(' · ')[0]),
    user: Terms.user, cards: [...document.querySelectorAll('#pack-box .mc-pack')].map(x => x.querySelector('b').textContent + ':' + x.querySelector('i').textContent +
      ':' + ((x.querySelector('.mc-guest') || {}).textContent || '')), pool: window.__gal.eng.pool.map(e => e.comment) }));
  /* 先回到天青单人（J 里同台开局把祈语加成了客串：点她的「✓ 客串中」去掉） */
  await E(() => document.querySelector('#pack-box .mc-pack[data-pack="tianqing"]').click()); await p.waitForTimeout(300);
  await E(() => { const g = document.querySelector('#pack-box .mc-pack[data-pack="qiyu"] .mc-guest.on'); if (g) g.click(); }); await p.waitForTimeout(300);
  const s0 = await st();
  ok('天青当主角时：祈语卡片上有「＋ 客串」，写着「点一下换她当主角」', s0.c.main === 'tianqing' && s0.cards.some(x => /^祈语:点一下换她当主角:＋ 客串$/.test(x)), JSON.stringify(s0.cards));
  await E(() => document.querySelector('#pack-box .mc-pack[data-pack="qiyu"]').click()); await p.waitForTimeout(400);
  const s1 = await st();
  ok('点祈语的卡片：她当主角、天青下场（不变客串），开场白换成祈语的', s1.c.main === 'qiyu' && s1.c.extra.length === 0 &&
     s1.ops.join() === '幸运观众,说走就走,草莓千层,天青 × 祈语' && s1.user === '旅伴' && !s1.pool.includes('天青'), JSON.stringify({ c: s1.c, ops: s1.ops, user: s1.user }));
  await p.screenshot({ path: `${OUT}/mc-k-qiyu-main.png` });
  await E(() => document.querySelector('#pack-box .mc-pack[data-pack="tianqing"] .mc-guest').click()); await p.waitForTimeout(400);
  const s2 = await st();
  ok('点天青的「＋ 客串」：祈语还是主角，天青客串（她的设定和客串提示词进来）', s2.c.main === 'qiyu' && s2.c.extra.join() === 'tianqing' &&
     s2.ops[0] === '幸运观众' && s2.pool.includes('天青') && s2.pool.includes('天青（客串）') && s2.cards.some(x => /^天青:.*:✓ 客串中$/.test(x)), JSON.stringify({ c: s2.c, cards: s2.cards }));
  await E(() => document.querySelector('#pack-box .mc-pack[data-pack="tianqing"] .mc-guest').click()); await p.waitForTimeout(400);
  const s3 = await st();
  ok('再点「✓ 客串中」：去掉客串', s3.c.main === 'qiyu' && s3.c.extra.length === 0 && !s3.pool.includes('天青'), JSON.stringify(s3.c));
  /* 选祈语单人的开局、开演，天青不在 */
  await E(() => { const s = document.getElementById('opening-sel'); s.value = '2'; s.dispatchEvent(new Event('change')); });
  await E(() => document.querySelector('#boot-steps button[data-step="go"]').click()); await p.waitForTimeout(200);
  await E(() => document.getElementById('btn-start').click()); await p.waitForTimeout(1500);
  const g = await E(() => ({ c: MilkCatPacks.choice(), op: window.__gal.eng.history[0] && window.__gal.eng.history[0].content.slice(0, 200) }));
  ok('单玩祈语：开「草莓千层」，天青不在故事里', g.c.main === 'qiyu' && g.c.extra.length === 0 && /草莓|牙印/.test(g.op || ''), JSON.stringify(g).slice(0, 200));
  await E(() => window.__gal.leaveGame()); await p.waitForTimeout(500);
  /* 标题画面选角色 = 只玩她：客串清空 */
  await E(() => MilkCatPacks.setChoice({ main: 'qiyu', extra: ['tianqing'] }));
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#mc-title-new'); await p.waitForTimeout(800);
  await E(() => document.querySelector('#mc-open .opening-dot[data-index="1"]').click()); await p.waitForTimeout(400);
  await p.click('#mc-open-confirm'); await p.waitForTimeout(700);
  ok('标题画面选祈语：只玩她（之前加的天青客串清掉）', await E(() => { const c = MilkCatPacks.choice(); return c.main === 'qiyu' && c.extra.length === 0; }));
  await E(() => MCTitle.closeCarousel());
}

ok('没有报错', errs.length === 0, errs.join(' | '));
await b.close();
console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' 过 / ' + fail + ' 挂');
console.log('截图在 ' + OUT);
process.exit(fail ? 1 : 0);
