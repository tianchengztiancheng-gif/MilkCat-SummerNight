/* ============================================================
 * core/packs.js —— 角色包（超级奶猫）
 *
 * 一个角色一个包（packs/<id>/）。包只放「内容 + 配置」，不放玩法代码：
 *   立绘、背景、CG、头像、表情包、开局、世界书、提示词、初始变量、手机 App 提示词、
 *   称呼（Terms）、启用哪些机制模块（mechanics）。
 * 引擎读到包以后：
 *   · 立绘 / 背景 / CG 装进 RESOURCE，头像 / 表情包装进 PHONE_RES
 *   · 世界书 + 提示词拼成一张「虚拟角色卡」交给 Engine.loadCard —— 后面的世界书激活、
 *     提示词组装、正则全走原来的路，不用为包另写一套
 *   · 开局、初始变量、手机提示词由 app 按需来取
 *
 * 一次游戏可以启用多个包（主角包 + 客串包）：主角包定开局、称呼和世界观，
 * 其它包只贡献角色（立绘、设定、头像、表情包）。
 * ============================================================ */
(function (global) {
  'use strict';

  var REG = {}, ORDER = [];
  var KEY = 'mc_packs';           // { main: 'tianqing', extra: ['…'] }

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function register(pack) {
    if (!pack || !pack.id) throw new Error('角色包缺 id');
    if (!REG[pack.id]) ORDER.push(pack.id);
    REG[pack.id] = pack;
    return pack;
  }
  function list() { return ORDER.map(function (id) { return REG[id]; }); }
  function get(id) { return REG[id] || null; }

  function choice() {
    var c = null;
    try { c = JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    c = c && typeof c === 'object' ? c : {};
    if (!c.main || !REG[c.main]) c.main = ORDER[0] || null;
    c.extra = (Array.isArray(c.extra) ? c.extra : []).filter(function (id) { return REG[id] && id !== c.main; });
    return c;
  }
  function setChoice(c) {
    try { global.localStorage.setItem(KEY, JSON.stringify({ main: c.main, extra: c.extra || [] })); } catch (e) {}
  }
  function active() { var c = choice(); return c.main ? REG[c.main] : null; }
  function activeAll() {
    var c = choice();
    return (c.main ? [REG[c.main]] : []).concat(c.extra.map(get)).filter(Boolean);
  }

  /* ---------------- 素材 → RESOURCE / PHONE_RES ---------------- */
  /** 一个角色的立绘表 → RESOURCE.characters 的三层结构 { default_outfit, outfits: { 服装: { 表情: [url] } } } */
  function spriteTable(ch) {
    if (ch.outfits) return { default_outfit: ch.defaultOutfit || Object.keys(ch.outfits)[0], outfits: ch.outfits };
    var ex = {};
    Object.keys(ch.expressions || {}).forEach(function (k) {
      var v = ch.expressions[k];
      ex[k] = Array.isArray(v) ? v.slice() : [v];
    });
    return { default_outfit: '常服', outfits: { 常服: ex } };
  }

  function applyResources(packs) {
    var R = global.RESOURCE = global.RESOURCE || {};
    R.characters = R.characters || {}; R.scenes = R.scenes || {}; R.defaults = R.defaults || {};
    R.cg = R.cg || {};
    var Ph = global.PHONE_RES = global.PHONE_RES || {};
    Ph.avatars = Ph.avatars || {}; Ph.stickers = Ph.stickers || {};
    Ph.stickerOwner = Ph.stickerOwner || {};
    Ph.defaultAvatars = Ph.defaultAvatars || [];
    Ph.groupMeta = Ph.groupMeta || {};
    Ph.basePosts = Ph.basePosts || []; Ph.baseTrends = Ph.baseTrends || [];
    packs.forEach(function (pk) {
      Object.keys(pk.characters || {}).forEach(function (name) {
        var ch = pk.characters[name];
        var t = spriteTable(ch);
        R.characters[name] = t;
        var dx = ch.defaultExpr && t.outfits[t.default_outfit] && t.outfits[t.default_outfit][ch.defaultExpr];
        if (dx && dx.length) R.defaults[name] = dx.slice(0, 1);
        if (ch.avatar) Ph.avatars[name] = ch.avatar;
      });
      Object.keys(pk.scenes || {}).forEach(function (loc) {
        R.scenes[loc] = Object.assign({}, R.scenes[loc], pk.scenes[loc]);
      });
      Object.assign(R.cg, pk.cg || {});
      Object.keys(pk.stickers || {}).forEach(function (k) {
        Ph.stickers[k] = pk.stickers[k];
        Ph.stickerOwner[k] = pk.main || pk.id;
      });
      Object.assign(Ph.groupMeta, pk.groups || {});
    });
  }

  /* ---------------- 虚拟角色卡 ---------------- */
  function entry(e, i, prefix) {
    var x = Object.assign({}, e);
    x.uid = prefix + (e.uid != null ? e.uid : i);
    if (x.disable) x.enabled = false;
    return x;
  }
  /**
   * 主角包 + 客串包 → 一张酒馆 V2 格式的卡。
   * 世界书 = 各包的角色设定 + 主角包的系统提示词（格式约定、变量规则、钩子规则…）
   */
  function buildCard(packs) {
    var main = packs[0];
    var entries = [];
    packs.forEach(function (pk, pi) {
      (pk.worldbook || []).forEach(function (e, i) { entries.push(entry(e, i, pk.id + ':wb:')); });
      if (pi === 0) (pk.prompts || []).forEach(function (e, i) { entries.push(entry(e, i, pk.id + ':sys:')); });
      else (pk.guestPrompts || []).forEach(function (e, i) { entries.push(entry(e, i, pk.id + ':guest:')); });
    });
    var ops = openings(main);
    return {
      spec: 'chara_card_v2', spec_version: '2.0',
      data: {
        name: main.main || main.name, description: main.description || '', personality: '', scenario: main.scenario || '',
        first_mes: ops[0] ? ops[0].t : '', alternate_greetings: ops.slice(1).map(function (o) { return o.t; }),
        mes_example: '', creator_notes: '超级奶猫角色包：' + packs.map(function (p) { return p.name; }).join(' + '),
        character_book: { name: main.name, entries: entries },
        extensions: { milkcat: { packs: packs.map(function (p) { return p.id; }) } }
      }
    };
  }

  /**
   * 开局列表（给开场引导用）：[{ n: 标题, t: 原文, sub, id, cover: { bg, expr }, packs }]
   * 自己包里的开局在前；别的包里写了 packs（「这个开局要哪几个包一起上」）并且点名了这个包的同台开局也列进来，
   * 比如祈语包里的「天青 × 祈语」（packs: { main: 'tianqing', extra: ['qiyu'] }）在天青和祈语的列表里都有。
   * 开局带 packs 时，app 开演前会先按它换好主角包和客串包。
   */
  function openings(pk) {
    pk = pk || active();
    if (!pk) return [];
    var own = (pk.openings || []).slice(), seen = {};
    own.forEach(function (o) { if (o.id) seen[o.id] = 1; });
    ORDER.forEach(function (id) {
      if (id === pk.id) return;
      (REG[id].openings || []).forEach(function (o) {
        var ps = o.packs;
        if (!ps || (o.id && seen[o.id])) return;
        if (ps.main === pk.id || (ps.extra || []).indexOf(pk.id) >= 0) { own.push(o); if (o.id) seen[o.id] = 1; }
      });
    });
    return own.filter(function (o) {
      var ps = o.packs; if (!ps) return true;
      return [ps.main].concat(ps.extra || []).every(function (id) { return !!REG[id]; });   // 要的包没装就不列
    }).map(function (o) {
      return { n: o.title, t: o.raw, sub: o.subtitle || '', id: o.id, cover: { bg: o.coverBgId || '', expr: o.coverExpr || '' },
        packs: o.packs ? { main: o.packs.main, extra: (o.packs.extra || []).slice() } : null };
    });
  }
  /** 现在启用的包是不是正好满足这个开局要的 packs（主角一样、要的客串都在） */
  function satisfies(ps) {
    if (!ps) return true;
    var c = choice();
    return c.main === ps.main && (ps.extra || []).every(function (id) { return c.extra.indexOf(id) >= 0; });
  }

  /** 开局变量：主角包的初始变量（深拷贝）+ 客串包追加的 */
  function initialVars(packs) {
    packs = packs || activeAll();
    var v = {};
    packs.forEach(function (pk, i) {
      var d = clone((pk.variables && pk.variables.data) || {});
      if (i === 0) v = d;
      else Object.keys(d).forEach(function (k) { if (v[k] == null) v[k] = d[k]; });
    });
    return v;
  }
  /** 变量的显示名 / 注释（变量编辑器、变量列表提示词用） */
  function varMeta(packs) {
    var m = {};
    (packs || activeAll()).forEach(function (pk) { Object.assign(m, (pk.variables && pk.variables.meta) || {}); });
    return m;
  }

  /** 这个角色属于哪个包（有立绘的角色） */
  function packOf(who) {
    if (!who) return null;
    for (var i = 0; i < ORDER.length; i++) { var pk = REG[ORDER[i]]; if (pk.characters && pk.characters[who]) return pk; }
    return null;
  }
  /**
   * 某个手机 App 的提示词。who = 给谁生成（LINE 私聊、电话是哪个角色）：
   * 她自己的包里有这个 App 的提示词就用她的（祈语客串时，私聊用祈语自己的 LINE 提示词，不是把天青的改个名字），
   * 否则用主角包的。玩家改过的优先 —— 按包分开存（键「包 id:App」）；v0.2 以前存的没带包 id，算天青的。
   * 返回字符串；要知道用的是哪个包，看 phonePromptPack(app, who)。
   */
  var PP_KEY = 'mc_phone_prompts';
  function ownPrompts() {
    var own = null;
    try { own = JSON.parse(global.localStorage.getItem(PP_KEY) || 'null'); } catch (e) {}
    return own && typeof own === 'object' ? own : {};
  }
  function phonePromptPack(app, who) {
    var pk = packOf(who);
    if (pk && pk.phonePrompts && pk.phonePrompts[app]) return pk;
    return active();
  }
  function phonePrompt(app, who) {
    var pk = phonePromptPack(app, who);
    if (!pk) return '';
    var own = ownPrompts();
    if (own[pk.id + ':' + app]) return own[pk.id + ':' + app];
    if (pk.id === 'tianqing' && own[app]) return own[app];
    return (pk.phonePrompts && pk.phonePrompts[app]) || '';
  }
  /** 改 / 恢复某个包的 App 提示词（packId 不给 = 主角包）。text 为 null = 恢复默认 */
  function setPhonePrompt(app, text, packId) {
    var own = ownPrompts(), id = packId || (active() && active().id) || '';
    if (text == null) { delete own[id + ':' + app]; if (id === 'tianqing') delete own[app]; }
    else own[id + ':' + app] = String(text);
    try { global.localStorage.setItem(PP_KEY, JSON.stringify(own)); } catch (e) {}
  }
  function phonePromptEdited(app, packId) {
    var own = ownPrompts(), id = packId || (active() && active().id) || '';
    return own[id + ':' + app] != null || (id === 'tianqing' && own[app] != null);
  }

  /** 所有包的称呼（换主角包时，玩家名字还是上一个包的默认称呼就跟着换） */
  function allTerms() { return ORDER.map(function (id) { return (REG[id].terms || {}).user; }).filter(Boolean); }

  /** 全部有立绘的角色名（多人提示词、钩子默认对象用） */
  function cast(packs) {
    var out = [];
    (packs || activeAll()).forEach(function (pk) { Object.keys(pk.characters || {}).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); });
    return out;
  }

  /** 启用的机制模块：{ 模块名: 参数 }（同名的以主角包为准） */
  function mechanics(packs) {
    var out = {};
    (packs || activeAll()).slice().reverse().forEach(function (pk) { Object.assign(out, pk.mechanics || {}); });
    return out;
  }

  /**
   * 不导入预设也能玩：一份最小的提示词顺序。
   * 世界书（角色设定 + 系统提示词）→ 人设 → 对话历史 → 世界书（后置）。
   * 文风 / 破限由玩家自己导入的预设负责。
   */
  function defaultPreset() {
    var ids = ['main', 'worldInfoBefore', 'personaDescription', 'charDescription', 'scenario', 'worldInfoAfter', 'chatHistory', 'jailbreak'];
    return {
      name: '超级奶猫 · 内置',
      temperature: 1, top_p: 0.95, openai_max_tokens: 8192,
      prompts: [
        { identifier: 'main', name: '主提示', role: 'system',
          content: '你是一个多角色 galgame 的叙事者。严格按世界书里的输出格式写这一轮的剧情，只写一轮。' },
        { identifier: 'worldInfoBefore', name: '世界书（前）', marker: true },
        { identifier: 'personaDescription', name: '人设', marker: true },
        { identifier: 'charDescription', name: '角色描述', marker: true },
        { identifier: 'scenario', name: '场景', marker: true },
        { identifier: 'worldInfoAfter', name: '世界书（后）', marker: true },
        { identifier: 'chatHistory', name: '对话历史', marker: true },
        { identifier: 'jailbreak', name: '后置指令', role: 'system',
          content: '记住：只按约定的格式输出，正文写在 <MilkCat_maintext> 里，最后给选项、快照、手机钩子和变量更新。' }
      ],
      prompt_order: [{ character_id: 100001, order: ids.map(function (id) { return { identifier: id, enabled: true }; }) }]
    };
  }

  /**
   * 装上：称呼 → 素材 → 虚拟卡 → 引擎。
   * @returns {{card, packs}}
   */
  function apply(eng, ids) {
    var c = choice();
    if (ids) { c.main = ids.main || c.main; c.extra = ids.extra || c.extra; setChoice(c); }
    var packs = activeAll();
    if (!packs.length) return null;
    if (global.Terms) global.Terms.set(packs[0].terms || {});
    applyResources(packs);
    var card = buildCard(packs);
    if (eng) {
      eng.cfg.phoneMode = 'hook';
      eng.cfg.userName = (global.Terms && global.Terms.user) || eng.cfg.userName;
      eng.loadCard(card);
      /* loadCard 会合一次卡里的素材（这张虚拟卡没有），再盖一次包的，保证包的立绘在 */
      applyResources(packs);
      if (global.CustomSprites) { global.CustomSprites.forget(); global.CustomSprites.apply(); }
      eng.packs = packs.map(function (p) { return p.id; });
    }
    return { card: card, packs: packs };
  }

  global.MilkCatPacks = {
    register: register, list: list, get: get, active: active, activeAll: activeAll,
    choice: choice, setChoice: setChoice, apply: apply, applyResources: applyResources,
    buildCard: buildCard, openings: openings, satisfies: satisfies, initialVars: initialVars, varMeta: varMeta,
    phonePrompt: phonePrompt, setPhonePrompt: setPhonePrompt, phonePromptPack: phonePromptPack, phonePromptEdited: phonePromptEdited,
    packOf: packOf, allTerms: allTerms, cast: cast, mechanics: mechanics,
    defaultPreset: defaultPreset, spriteTable: spriteTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
