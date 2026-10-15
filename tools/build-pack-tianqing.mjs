/* ============================================================
 * tools/build-pack-tianqing.mjs —— 从 Larimar（天青原版）生成天青角色包的数据文件
 *
 * 用法：node tools/build-pack-tianqing.mjs <Larimar 仓库目录>
 * 输出：packs/tianqing/data.js（自动生成，别手改；要改天青的配置去 packs/tianqing/pack.js）
 *
 * 读的东西（都是 Larimar 仓库里的）：
 *   resource/expressions.js backgrounds.js cg.js avatars.js stickers.js tags.js opening.js
 *   resource/seed.json                         —— 角色世界书、系统提示词、默认变量、界面默认值
 *   interface/settings-phone-sys.js            —— 各手机 App 的默认提示词（DEFAULT_PROMPTS，比 seed 里的新）
 *
 * 只做一件「改写」：把格式标签的前缀 summernight 换成 MilkCat（开局、提示词里都换）。
 * 其余文字原样照搬，不润色。
 * ============================================================ */
import fs from 'fs'; import path from 'path'; import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC) { console.error('用法：node tools/build-pack-tianqing.mjs <Larimar 仓库目录>'); process.exit(2); }
const P = (...a) => path.join(SRC, ...a);

const store = {};
const sb = { console, String, JSON, Date, Math, Object, Array,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
sb.window = sb;
vm.createContext(sb);
for (const f of ['expressions', 'backgrounds', 'cg', 'avatars', 'stickers', 'tags', 'opening'])
  vm.runInContext(fs.readFileSync(P('resource', f + '.js'), 'utf8'), sb, { filename: f + '.js' });

const rename = s => String(s == null ? '' : s).replace(/summernight/g, 'MilkCat');

/* 背景：「地点·白日」→ { 地点: { 白日: url } } */
const scenes = {};
for (const [k, url] of Object.entries(sb.天青_backgrounds)) {
  const [loc, band] = k.split('·');
  (scenes[loc] = scenes[loc] || {})[band || '白日'] = url;
}

/* 开局 */
const ops = (sb.天青_openings_defaults || sb.天青_openings || []).filter(o => !o.placeholder && o.raw).map(o => ({
  id: o.id, title: o.title, subtitle: o.subtitle || '', coverBgId: o.coverBgId || '', coverExpr: o.coverExpr || '',
  raw: rename(o.raw)
}));

/* seed */
const seed = JSON.parse(fs.readFileSync(P('resource', 'seed.json'), 'utf8'));
const entriesOf = b => Object.values((b && (b.entries || (b.worldbook && b.worldbook.entries))) || {});
const book = Object.values(seed.characterWorldbooks || {}).flatMap(b => entriesOf(b.worldbook || b));
const prompts = entriesOf(seed.promptWorldbook).map(e => Object.assign({}, e, { content: rename(e.content) }));
const variables = { data: seed.variables && seed.variables.data || seed.defaultVariables || {},
  meta: Object.fromEntries(Object.entries((seed.variables && seed.variables.meta) || {}).map(([k, v]) => [k.split('\u0000').join('.'), v])) };

/* 手机 App 提示词：settings-phone-sys.js 里的 DEFAULT_PROMPTS（对象字面量，单独抠出来求值） */
const sys = fs.readFileSync(P('interface', 'settings-phone-sys.js'), 'utf8');
const at = sys.indexOf('var DEFAULT_PROMPTS = ');
let depth = 0, i = sys.indexOf('{', at), start = i, q = '';
for (; i < sys.length; i++) {
  const ch = sys[i];
  if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = ''; continue; }
  if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) break; }
}
const phonePrompts = Object.fromEntries(Object.entries(vm.runInNewContext('(' + sys.slice(start, i + 1) + ')'))
  .map(([k, v]) => [k, rename(v)]));

const data = {
  source: 'Larimar（SummerNight Plus）· 经作者授权',
  expressions: sb.天青_expressions, avatars: sb.天青_avatars, scenes, cg: sb.天青_cg, stickers: sb.天青_stickers,
  tags: { fixed: sb.天青_FIXED_TAG || '', timeBand: sb.天青_TIME_BAND || {}, loc: sb.天青_LOC_TAG || {},
          time: sb.天青_TIME_TAG || {}, expr: sb.天青_EXPR_TAG || {}, fx: sb.天青_FX || {} },
  openings: ops, worldbook: book, prompts, phonePrompts, variables, ui: seed.ui || {}
};

const out = path.join(ROOT, 'packs', 'tianqing', 'data.js');
fs.writeFileSync(out,
  '/* 自动生成 · 请勿手改 · node tools/build-pack-tianqing.mjs <Larimar 仓库目录>\n' +
  ' * 来源：Larimar（天青原版），经作者授权使用。天青的配置与新增提示词在 pack.js。 */\n' +
  'window.MilkCatPackData = window.MilkCatPackData || {};\n' +
  'window.MilkCatPackData.tianqing = ' + JSON.stringify(data, null, 1) + ';\n');
console.log('写到 ' + path.relative(ROOT, out) + '：' +
  Object.keys(data.expressions).length + ' 种表情，' + Object.keys(scenes).length + ' 个地点 / ' +
  Object.keys(sb.天青_backgrounds).length + ' 张背景，' + Object.keys(data.cg).length + ' 张 CG，' +
  Object.keys(data.stickers).length + ' 个表情包，' + ops.length + ' 个开局，世界书 ' + book.length + ' 条，系统提示词 ' +
  prompts.length + ' 条，手机提示词 ' + Object.keys(phonePrompts).join('/'));
