/* ============================================================
 * tools/build-pack-qiyu.mjs —— 从祈语的酒馆角色卡 + 立绘清单生成祈语角色包的数据文件
 *
 * 用法：node tools/build-pack-qiyu.mjs <祈语角色卡.png|.json> <立绘清单.txt>
 * 输出：packs/qiyu/data.js（自动生成，别手改；配置和「天青 × 祈语」同台开局在 packs/qiyu/pack.js）
 *
 * 读的东西：
 *   角色卡（V2 / V3，PNG 里的 tEXt chara / ccv3）—— 世界书三条、三个开场白（原文留底）
 *   立绘清单 —— 一行一张：「表情：地址」开一个新表情，只有地址的行是上一个表情的另一张差分；
 *               同一个表情名出现两次就接着往后加，重复的地址只留一份
 * 世界书原样照搬（{{user}} 宏留着，引擎会换成玩家的称呼）。
 * 开场白是散文，演不了 —— 这里按段转成 <MilkCat> 剧本（文字照抄原文，表情 / 背景 / 选项见下面的 SPEC）。
 * ============================================================ */
import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , CARD, LIST] = process.argv;
if (!CARD || !LIST) { console.error('用法：node tools/build-pack-qiyu.mjs <祈语角色卡.png|.json> <立绘清单.txt>'); process.exit(2); }

/* ---------- 卡 ---------- */
function readCard(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const text = {};
    for (let i = 8; i < buf.length;) {
      const n = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8), d = buf.subarray(i + 8, i + 8 + n);
      if (type === 'tEXt') { const z = d.indexOf(0); text[d.toString('latin1', 0, z)] = d.subarray(z + 1).toString('latin1'); }
      i += 12 + n;
    }
    const b64 = text.ccv3 || text.chara;
    if (!b64) throw new Error('这张 PNG 里没有角色卡数据（tEXt chara / ccv3）');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  return JSON.parse(buf.toString('utf8'));
}
const card = readCard(CARD);
const D = card.data || card;
if (D.name !== '祈语') console.warn('⚠ 卡名是「' + D.name + '」，不是祈语——确认一下传对了卡');

const crlf = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n');
const worldbook = ((D.character_book && D.character_book.entries) || []).map((e, i) => {
  const x = e.extensions || {};
  return {
    uid: 'qy' + (e.id != null ? e.id : i),
    key: e.keys || [], keysecondary: e.secondary_keys || [],
    comment: e.comment || e.name || '',
    content: crlf(e.content),
    constant: !!e.constant, enabled: e.enabled !== false,
    order: e.insertion_order != null ? e.insertion_order : 100,
    position: x.position != null ? x.position : (e.position === 'after_char' ? 1 : 0),
    depth: x.depth != null ? x.depth : 4, role: x.role || 0,
    probability: x.probability != null ? x.probability : 100, selectiveLogic: x.selectiveLogic || 0
  };
});
const greetings = [D.first_mes].concat(D.alternate_greetings || []).map(crlf);

/* ---------- 立绘清单 ---------- */
const expressions = {};
let cur = null;
for (const raw of fs.readFileSync(LIST, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  const m = /^(.+?)[：:]\s*(https?:\/\/\S+)$/.exec(line);
  const url = m ? m[2] : (/^https?:\/\/\S+$/.test(line) ? line : null);
  if (!url) { console.warn('⚠ 看不懂这一行，跳过：' + line); continue; }
  if (m) cur = m[1].trim();
  if (!cur) { console.warn('⚠ 第一张图前面没有表情名，跳过：' + line); continue; }
  const arr = expressions[cur] = expressions[cur] || [];
  if (arr.indexOf(url) < 0) arr.push(url);
}
const avatars = Object.fromEntries(Object.entries(expressions).map(([k, v]) => [k, v[0]]));

/* ---------- 开场白 → <MilkCat> 剧本 ----------
 * 卡里的开场白是散文：一段一行。整段被引号包着的是祈语说的话，整段被反引号包着的是她的心里话，其余是旁白。
 * 文字一个字不改，只做三件事：说的话套上「」、心里话套上（），按顺序给每句话配一个立绘表情（下面的 expr，
 * 个数必须和这一个开场白里「说的话 + 心里话」的段数一样，不一样就报错）；
 * 再补上背景、登场、选项、快照和开局变量（卡里没有，是我们加的）。 */
const SPEC = [
  { id: 'lucky-audience', title: '幸运观众', subtitle: '黄昏 · 街角的魔术表演', coverBgId: '街区', coverExpr: '胜利pose',
    bg: ['街区', '喷泉旁的街角'], enterAfter: 1, enterExpr: '自信',
    expr: ['自信', '俏皮', '自信', '得意', '惊讶', '开心', '俏皮', '胜利pose', '沉醉', '窘迫', '微笑', '比心', '思考', '星星眼', '卖萌'],
    branches: ['告诉她自己的名字', '「你闻得到……味道？」', '把纸玫瑰别在胸前，学她的样子鞠躬回礼'],
    snapshot: '黄昏的街角，旅行奇迹师祈语表演完街头魔术，把你选为幸运观众，送了一朵纸折白玫瑰，说你身上有很好闻的「奇迹的味道」，问你的名字。',
    vars: { 天数: 1, 具体时间: [17, 40], 星期: '六', 地点: '街区', 奇迹能量: 20 } },
  { id: 'doorbell-trip', title: '说走就走', subtitle: '午后 · 门铃响了三下', coverBgId: '宿舍', coverExpr: '比耶',
    bg: ['宿舍', '你家客厅'], enterAfter: 1, enterExpr: '比较开心',
    expr: ['沉醉', '自信', '比较开心', '惊讶', '羞涩', '开心', '比耶', '星星眼', '开心', '撒娇', '得意', '俏皮', '微笑'],
    branches: ['「卢布尔雅那……你确定不是随手指的？」', '起身去拿书架上那条灰蓝色的围巾', '「先说好，这次不许再摔坏面具了」'],
    snapshot: '午后祈语按响你家的门铃，发现旅行纪念品都被好好留着，掏出一张卢布尔雅那的明信片，说奇迹能量已经攒够，邀你来一场说走就走的旅行。',
    vars: { 天数: 1, 具体时间: [14, 10], 星期: '日', 地点: '宿舍', 奇迹能量: 100 } },
  { id: 'strawberry', title: '草莓千层', subtitle: '下午 · 公园长椅', coverBgId: '公园', coverExpr: '委屈',
    bg: ['公园', '公园长椅'], enterAfter: -1, enterExpr: '委屈',
    expr: ['委屈', '流泪', '委屈', '流泪', '假装很生气', '红温', '不满', '委屈', '撒娇', '流泪'],
    branches: ['「好好好，三块，挑草莓最多的那块」', '掏出纸巾，给她擦眼泪', '「其实……我还买了一块，藏在包里」'],
    snapshot: '你把买给祈语的草莓千层吃光了，祈语在公园长椅上委屈得直哭，咬了你的手指、用小拳头锤人，要你赔三块。',
    vars: { 天数: 1, 具体时间: [15, 30], 星期: '三', 地点: '公园', 奇迹能量: 45 } }
];
function toScript(text, sp) {
  const paras = text.split(/\n+/).map(x => x.trim()).filter(x => x && !/^-{3,}$/.test(x));
  const lines = [], ex = sp.expr.slice();
  let said = 0;
  const bad = /[|<>]/;
  if (sp.enterAfter < 0) lines.push('<登场|祈语:' + sp.enterExpr + '>');
  paras.forEach((p, i) => {
    if (bad.test(p)) throw new Error('开场白「' + sp.title + '」里有 | < > 这类会切坏剧本的字符：' + p.slice(0, 30));
    const say = /^["“](.*)["”]$/.exec(p), think = /^`(.*)`$/.exec(p);
    if (say || think) {
      const e = ex.shift();
      if (!e) throw new Error('开场白「' + sp.title + '」的表情不够（第 ' + (said + 1) + ' 句）');
      if (!expressions[e]) throw new Error('开场白「' + sp.title + '」用了立绘里没有的表情：' + e);
      lines.push(say ? '<祈语|' + e + '|「' + say[1] + '」>' : '<祈语|' + e + '|（' + think[1] + '）>');
      said++;
    } else lines.push('<旁白|' + p + '>');
    if (i === sp.enterAfter) lines.push('<登场|祈语:' + sp.enterExpr + '>');
  });
  if (ex.length) throw new Error('开场白「' + sp.title + '」的表情多了 ' + ex.length + ' 个（说的话 + 心里话只有 ' + said + ' 句）');
  const v = sp.vars, I = '        ';
  return '<MilkCat>\n    <MilkCat_maintext>\n' + I + '<背景|' + sp.bg[0] + '|' + sp.bg[1] + '>\n' +
    lines.map(l => I + l).join('\n') + '\n    </MilkCat_maintext>\n\n' +
    '    <MilkCat_branches>\n' + sp.branches.map(b => I + '[' + b + ']').join('\n') + '\n    </MilkCat_branches>\n\n' +
    '    <MilkCat_snapshots>\n' + I + sp.snapshot + '\n    </MilkCat_snapshots>\n\n' +
    '    <UpdateVariable>\n        <MilkCat_variables>\n' +
    I + "_.set('stat_data.时间.天数', " + v.天数 + ')\n' +
    I + "_.set('stat_data.时间.具体时间', [" + v.具体时间.join(', ') + '])\n' +
    I + "_.set('stat_data.时间.星期', '" + v.星期 + "')\n" +
    I + "_.set('stat_data.地点', '" + v.地点 + "')\n" +
    I + "_.set('stat_data.奇迹能量', " + v.奇迹能量 + ')\n' +
    '        </MilkCat_variables>\n    </UpdateVariable>\n</MilkCat>';
}
if (D.alternate_greetings && D.alternate_greetings.length + 1 !== SPEC.length)
  console.warn('⚠ 卡里有 ' + (D.alternate_greetings.length + 1) + ' 个开场白，SPEC 写了 ' + SPEC.length + ' 个（多出来的不转）');

const data = {
  source: '酒馆角色卡「祈语」1.0（作者：' + (D.creator || '未署名') + '）',
  creator: D.creator || '', version: D.character_version || '',
  expressions, avatars, worldbook, greetings,
  openings: SPEC.slice(0, greetings.length).map((sp, i) => ({
    id: sp.id, title: sp.title, subtitle: sp.subtitle, coverBgId: sp.coverBgId, coverExpr: sp.coverExpr,
    raw: toScript(greetings[i], sp)
  }))
};
const out = path.join(ROOT, 'packs', 'qiyu', 'data.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out,
  '/* 自动生成 · 请勿手改 · node tools/build-pack-qiyu.mjs <祈语角色卡> <立绘清单.txt>\n' +
  ' * 来源：' + data.source + '。祈语的配置和同台开局在 pack.js。\n' +
  ' * greetings 是卡里开场白的原文（散文，留底对照）；openings 是按段转成的 <MilkCat> 剧本（文字照抄，表情见 build 脚本的 SPEC）。 */\n' +
  'window.MilkCatPackData = window.MilkCatPackData || {};\n' +
  'window.MilkCatPackData.qiyu = ' + JSON.stringify(data, null, 1) + ';\n');
const nPic = Object.values(expressions).reduce((n, a) => n + a.length, 0);
console.log('写到 ' + path.relative(ROOT, out) + '：' + Object.keys(expressions).length + ' 种表情 / ' + nPic + ' 张，世界书 ' +
  worldbook.length + ' 条，开场白原文 ' + greetings.length + ' 个');
