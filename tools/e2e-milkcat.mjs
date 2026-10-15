/* ============================================================
 * tools/e2e-milkcat.mjs —— 端到端：超级奶猫（角色包 + <MilkCat> 格式 + 钩子驱动手机）
 *
 *   A. 不导入任何文件：天青角色包自动装上，3 个开局，内置预设
 *   B. 开局「校门口」：变量从包起步、开局变量块生效；天青上台、名字牌用她的颜色；CG 区间铺 CG、出区间收起；最后给选项
 *   C. 一轮：请求里带格式约定 / 变量列表（宏已展开）/ 多人同台 / 钩子补充，没有旧的手机规则；
 *      变量命令 set/add/append 生效；钩子 → LINE 私聊（含表情包）、Twitter 动态 + 评论 + 趋势
 *   D. 重roll：上一版钩子生成的手机内容撤掉，新一版重新生成
 *   E. 手机里私聊天青：用的是 LINE 提示词，回复进聊天
 *   F. 设置 · 手机提示词：改了生效、能恢复默认
 *   G. 导入酒馆角色卡切到卡；「改回角色包」切回来
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

let ver = 0;
const reply = () => { ver++; return `<MilkCat>
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
    if (/LINE 私聊/.test(body) && /刚发来/.test(body)) content = '<line_message>\n<天青|才不告诉你～|19:02>\n<天青|得意|19:02>\n</line_message>';
    else if (/LINE 私聊/.test(body)) content = `<line_message>\n<天青|刚才那段到底好不好听嘛！v${ver}|18:40>\n<天青|生气|18:40>\n</line_message>`;
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
  localStorage.setItem('gal_api_config', JSON.stringify({ protocol: 'openai', baseUrl: 'https://main.api', apiKey: 'k', model: 'm', stream: false })); } });
await p.goto('file://' + ROOT + '/index.html'); await p.waitForTimeout(800);
const E = (f, a) => p.evaluate(f, a);

console.log('\n[A 不导入文件就能玩]');
{
  const s = await E(() => ({ packs: [...document.querySelectorAll('#pack-box .mc-pack')].map(x => x.className + ':' + x.querySelector('b').textContent),
    ops: [...document.querySelectorAll('#opening-sel option')].map(o => o.textContent), preset: !!window.__gal.eng.preset, user: Terms.user,
    pool: window.__gal.eng.pool.map(e => e.comment), start: !document.getElementById('btn-start').disabled, cg: Object.keys(RESOURCE.cg || {}).length }));
  ok('天青角色包自动装上，标成主角', s.packs.length === 1 && /on/.test(s.packs[0]) && /天青/.test(s.packs[0]), JSON.stringify(s.packs));
  ok('三个开局', s.ops.length === 3 && /校门口/.test(s.ops[0]) && /婚纱拍摄/.test(s.ops[2]), s.ops.join());
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
  const card = { spec: 'chara_card_v2', data: { name: '测试卡', first_mes: '『✨ 08:00 · 港区 ✨』|旁白|-|\n「早。」|测试娘|微笑|', extensions: {} } };
  fs.writeFileSync(path.join(OUT, 'mc-card.json'), JSON.stringify(card));
  await E(() => document.querySelector('#boot-steps button[data-step="asset"]').click());
  await p.setInputFiles('#f-card', path.join(OUT, 'mc-card.json')); await p.waitForTimeout(400);
  const s1 = await E(() => ({ warn: document.getElementById('pack-box').innerText, src: localStorage.getItem('mc_source'), ops: [...document.querySelectorAll('#opening-sel option')].map(o => o.textContent) }));
  ok('导入卡：切到卡，提示「改回角色包」', /导入的酒馆角色卡/.test(s1.warn) && /card/.test(s1.src) && s1.ops[0] === '默认开场', JSON.stringify(s1));
  await p.click('#pack-back'); await p.waitForTimeout(300);
  const s2 = await E(() => ({ src: localStorage.getItem('mc_source'), ops: [...document.querySelectorAll('#opening-sel option')].length, pool: window.__gal.eng.pool.some(e => e.comment === 'GAL格式') }));
  ok('改回角色包：开局和世界书都回来', /pack/.test(s2.src) && s2.ops === 3 && s2.pool, JSON.stringify(s2));
}

ok('没有报错', errs.length === 0, errs.join(' | '));
await b.close();
console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' 过 / ' + fail + ' 挂');
console.log('截图在 ' + OUT);
process.exit(fail ? 1 : 0);
