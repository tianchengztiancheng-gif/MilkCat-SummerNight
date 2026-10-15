/* ============================================================
 * core/milkcat.js —— <MilkCat> 剧本格式（超级奶猫）
 *
 * 模型每一轮按这个格式写回复，前端照着演：
 *
 *   <MilkCat>
 *     <MilkCat_maintext>
 *       <背景|图片ID|名称>              换背景（图片ID = 场景表里的地点）
 *       <登场|角色A:表情|角色B>          有人走上台（最多 4 人同台）
 *       <退场|角色A>  <退场|全部>         有人离开
 *       <角色名|表情|台词>               有立绘的角色说话
 *       <角色名|台词>  <旁白|叙述>        没立绘的人、玩家、旁白
 *       <CG|名字> … </CG>                包住的几句都铺这张 CG
 *     </MilkCat_maintext>
 *     <MilkCat_branches>[选项一][选项二]</MilkCat_branches>
 *     <MilkCat_snapshots>一句话总结这一轮</MilkCat_snapshots>
 *     <MilkCat_hook>
 *       <line|角色名|简述>  <line_group|群名|成员1,成员2|简述>  <line_call|角色名|简述>
 *       <twitter|简述>  <twitch|简述> …（机制模块还可以注册别的）
 *     </MilkCat_hook>
 *     <UpdateVariable>…<MilkCat_variables>_.set('stat_data.路径', 值)</MilkCat_variables></UpdateVariable>
 *   </MilkCat>
 *
 * 天青原来的 <summernight> 是同一套写法，只是前缀不同，这里一并认。
 * 只做纯解析（好测）；演出、手机、变量落地在 engine.js / app.js。
 * ============================================================ */
(function (global) {
  'use strict';

  var PFX = '(?:MilkCat|summernight)';
  var RE_ANY = new RegExp('<' + PFX + '(?:_\\w+)?\\b', 'i');

  function detect(text) { return RE_ANY.test(String(text || '')); }

  function blockOf(text, name) {
    var re = new RegExp('<' + PFX + '_' + name + '\\b[^>]*>([\\s\\S]*?)<\\/' + PFX + '_' + name + '\\s*>', 'i');
    var m = re.exec(text);
    return m ? m[1] : null;
  }
  /** 没闭合也要尽量拿到（流式中途、模型漏写结束标签） */
  function openBlockOf(text, name) {
    var re = new RegExp('<' + PFX + '_' + name + '\\b[^>]*>', 'i');
    var m = re.exec(text);
    if (!m) return null;
    var rest = text.slice(m.index + m[0].length);
    var end = rest.search(new RegExp('<\\/?' + PFX + '(?:_\\w+)?\\b|<UpdateVariable\\b', 'i'));
    return end >= 0 ? rest.slice(0, end) : rest;
  }

  /** 正文区：优先 <MilkCat_maintext>，没有就取 <MilkCat> 里、其它块之前的部分 */
  function maintextOf(text) {
    var b = blockOf(text, 'maintext');
    if (b != null) return { zone: b, closed: true };
    var o = openBlockOf(text, 'maintext');
    if (o != null) return { zone: o, closed: false };
    var root = new RegExp('<' + PFX + '\\b[^>]*>', 'i').exec(text);
    if (!root) return { zone: '', closed: false };
    var rest = text.slice(root.index + root[0].length);
    var end = rest.search(new RegExp('<\\/?' + PFX + '(?:_\\w+)?\\b|<UpdateVariable\\b', 'i'));
    return { zone: end >= 0 ? rest.slice(0, end) : rest, closed: end >= 0 };
  }

  function branchesOf(text) {
    var b = blockOf(text, 'branches');
    if (b == null) b = openBlockOf(text, 'branches');
    var out = [];
    String(b || '').replace(/\[([^\[\]]*)\]/g, function (_, c) {
      c = String(c || '').trim();
      if (c) out.push(c);
      return '';
    });
    return out;
  }

  function snapshotOf(text) {
    var b = blockOf(text, 'snapshots');
    if (b == null) b = blockOf(text, 'snapshot');
    return b == null ? '' : b.replace(/\s+/g, ' ').trim();
  }

  /** 钩子：<app|参数|参数…>，一行一条 */
  function hooksOf(text) {
    var b = blockOf(text, 'hook');
    if (b == null) b = openBlockOf(text, 'hook');
    var out = [];
    var re = /<([^<>]+)>/g, m;
    while ((m = re.exec(String(b || '')))) {
      var parts = m[1].split('|').map(function (x) { return x.trim(); });
      var app = String(parts[0] || '').toLowerCase();
      if (!app || /^\//.test(app) || new RegExp('^' + PFX, 'i').test(app)) continue;
      out.push({ app: app, args: parts.slice(1), raw: m[0] });
    }
    return out;
  }

  /* ---------------- 正文 → 剧本事件（和 ScriptParser.parse 的输出同形） ---------------- */
  var NARRATORS = { '旁白': 1, '旁白。': 1, 'narrator': 1, 'Narrator': 1 };
  function isContainer(inner) {
    var low = inner.toLowerCase();
    return new RegExp('^\\/?' + PFX + '(?:_\\w+)?$', 'i').test(inner) ||
      low === 'updatevariable' || low === '/updatevariable';
  }

  /**
   * @param {string} zone 正文区
   * @param {object} [opt] { period: 背景用的时段 }
   * @returns {{events: Array, order: string}}
   */
  function toEvents(zone, opt) {
    opt = opt || {};
    var events = [];
    var cg = null;
    var s = String(zone || '');
    /* 末尾写到一半的标签（流式中途、被截断）先丢掉，别当成散字演出来 */
    var lt = s.lastIndexOf('<');
    if (lt >= 0 && s.indexOf('>', lt) < 0) s = s.slice(0, lt);
    var re = /<([^<>]+)>|([^<>]+)/g, m;
    while ((m = re.exec(s))) {
      if (m[2] != null) {
        /* 标签外的散字：模型偶尔不包标签直接写一句，当旁白演，别丢 */
        m[2].split(/\n+/).forEach(function (ln) {
          ln = ln.trim();
          if (ln && !/^[-—–=*#\s]+$/.test(ln)) events.push({ type: 'say', who: '旁白', expr: '-', text: ln, narration: true, cg: cg });
        });
        continue;
      }
      var inner = m[1].trim();
      if (!inner || isContainer(inner)) continue;
      if (/^\/\s*cg$/i.test(inner)) { cg = null; continue; }
      var cgOpen = inner.match(/^cg\s*[|=]\s*(.+)$/i);
      if (cgOpen) { cg = cgOpen[1].split('|')[0].trim() || null; continue; }
      var parts = inner.split('|').map(function (x) { return x.trim(); });
      var head = parts[0];
      if (head === '背景' || head === '/背景') {
        if (parts[1]) events.push({ type: 'bg', loc: parts[1], name: parts[2] || parts[1], period: opt.period || '' });
        continue;
      }
      if (/^(登场|入场|上场)$/.test(head)) {
        events.push({ type: 'enter', cast: parts.slice(1).filter(Boolean).map(function (seg) {
          var kv = seg.split(/[:：]/);
          return { name: kv[0].trim(), expr: (kv[1] || '').trim() };
        }) });
        continue;
      }
      if (/^(退场|离场|下场)$/.test(head)) {
        events.push({ type: 'exit', cast: parts.slice(1).filter(Boolean) });
        continue;
      }
      var who, expr, text;
      if (parts.length >= 3) { who = head; expr = parts[1] || '-'; text = parts.slice(2).join('|'); }
      else if (parts.length === 2) { who = head; expr = '-'; text = parts[1]; }
      else { who = '旁白'; expr = '-'; text = head; }
      text = String(text || '').trim();
      if (!text) continue;
      who = who || '旁白';
      var narration = !!NARRATORS[who];
      events.push({ type: 'say', who: narration ? '旁白' : who, expr: expr === '' ? '-' : expr,
        text: text, narration: narration, cg: cg });
    }
    return { events: events, order: 'milkcat' };
  }

  /* ---------------- 变量命令：_.set / _.add / _.append ---------------- */
  function splitTop(raw) {
    var out = [], cur = '', depth = 0, q = '';
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (q) { cur += ch; if (ch === q && raw[i - 1] !== '\\') q = ''; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function parseValue(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) {}
    var a = raw.charAt(0), z = raw.charAt(raw.length - 1);
    if ((a === "'" && z === "'") || (a === '"' && z === '"')) return raw.slice(1, -1);
    if (a === '[' && z === ']') {
      /* 单引号数组：['名称', 3000] */
      try { return JSON.parse(raw.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, function (_, x) { return JSON.stringify(x); })); } catch (e2) {}
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw;
  }
  /** 从一段文字里找出所有 _.set / _.add / _.append 调用（括号配对，跨行也行） */
  function parseCommands(text) {
    var s = String(text || ''), out = [];
    var re = /_\.(set|add|append)\s*\(/g, m;
    while ((m = re.exec(s))) {
      var i = re.lastIndex, depth = 1, q = '';
      for (; i < s.length && depth > 0; i++) {
        var ch = s[i];
        if (q) { if (ch === q && s[i - 1] !== '\\') q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
      }
      var body = s.slice(re.lastIndex, depth === 0 ? i - 1 : i);
      re.lastIndex = i;
      var args = splitTop(body);
      if (args.length < 2) continue;
      var path = parseValue(args[0]);
      if (typeof path !== 'string' || !path.trim()) continue;
      /* MVU 的 _.set 有时写成 (路径, 旧值, 新值)，取最后一个 */
      var val = parseValue(args[args.length - 1]);
      out.push({ cmd: m[1], path: normPath(path), value: val });
    }
    return out;
  }
  function normPath(p) {
    p = String(p || '').trim().replace(/^stat_data\./, '');
    return p;
  }
  function dig(root, parts, make) {
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object' || Array.isArray(cur[k])) {
        if (!make) return null;
        cur[k] = {};
      }
      cur = cur[k];
    }
    return cur;
  }
  /** @returns {string[]} 改动说明，形如「名气.twitter = 1200」 */
  function applyCommands(vars, cmds) {
    var notes = [];
    (cmds || []).forEach(function (c) {
      var parts = c.path.split('.').filter(Boolean);
      if (!parts.length) return;
      var host = dig(vars, parts, true), key = parts[parts.length - 1];
      var v;
      if (c.cmd === 'set') v = c.value;
      else if (c.cmd === 'add') {
        var n = parseFloat(host[key]), d = parseFloat(c.value);
        if (isNaN(d)) return;
        v = (isNaN(n) ? 0 : n) + d;
      } else {
        v = Array.isArray(host[key]) ? host[key].slice() : [];
        v.push(c.value);
      }
      host[key] = v;
      notes.push(c.path + ' = ' + JSON.stringify(v));
    });
    return notes;
  }

  /** 变量块：<UpdateVariable> 里（或 <MilkCat_variables> 里）的命令 */
  function commandsOf(text) {
    var s = String(text || ''), cmds = [];
    s.replace(/<UpdateVariable>([\s\S]*?)(?:<\/UpdateVariable>|$)/gi, function (_, b) { cmds = cmds.concat(parseCommands(b)); return ''; });
    if (!cmds.length) {
      var vb = blockOf(s, 'variables') || openBlockOf(s, 'variables');
      if (vb) cmds = parseCommands(vb);
    }
    return cmds;
  }

  /* ---------------- 时段 ---------------- */
  /** 钟点 → 背景用的时段（和天青的背景表一致：白日 / 黄昏 / 夜晚） */
  function bandOf(hour) {
    hour = Number(hour);
    if (!isFinite(hour)) return '';
    if (hour >= 5 && hour < 16) return '白日';
    if (hour >= 16 && hour < 19) return '黄昏';
    return '夜晚';
  }
  var BAND_WORDS = { 清晨: '白日', 早上: '白日', 上午: '白日', 朝: '白日', 白日: '白日', 中午: '白日', 午: '白日', 午后: '白日', 下午: '白日',
    傍晚: '黄昏', 黄昏: '黄昏', 暮: '黄昏', 夜: '夜晚', 夜晚: '夜晚', 晚上: '夜晚', 深夜: '夜晚', 凌晨: '夜晚' };
  /** 从变量里推当前时段：先看 时间.具体时间 [时, 分]，再看 时间.时段 */
  function periodOf(vars) {
    var t = vars && vars.时间;
    if (!t) return '';
    var hm = t.具体时间;
    if (Array.isArray(hm) && hm.length) return bandOf(hm[0]);
    if (typeof hm === 'string' && /^\d{1,2}[:：]/.test(hm)) return bandOf(parseInt(hm, 10));
    if (t.时段) return BAND_WORDS[t.时段] || t.时段;
    return '';
  }
  function clockOf(vars) {
    var hm = vars && vars.时间 && vars.时间.具体时间;
    if (Array.isArray(hm) && hm.length) return String(hm[0]).padStart(2, '0') + ':' + String(hm[1] || 0).padStart(2, '0');
    return '';
  }

  /** 从原文里摘掉整个 MilkCat 外壳之外的东西用不着；这里只摘手机钩子块（防止被当台词） */
  function stripNonStory(text) {
    return String(text || '')
      .replace(new RegExp('<' + PFX + '_hook\\b[\\s\\S]*?(?:<\\/' + PFX + '_hook\\s*>|$)', 'gi'), '')
      .replace(new RegExp('<' + PFX + '_branches\\b[\\s\\S]*?(?:<\\/' + PFX + '_branches\\s*>|$)', 'gi'), '')
      .replace(new RegExp('<' + PFX + '_snapshots?\\b[\\s\\S]*?(?:<\\/' + PFX + '_snapshots?\\s*>|$)', 'gi'), '');
  }

  /** 一次拿全 */
  function split(text) {
    var s = String(text || '');
    var mt = maintextOf(s);
    return {
      maintext: mt.zone, closed: mt.closed,
      branches: branchesOf(s), snapshot: snapshotOf(s), hooks: hooksOf(s),
      commands: commandsOf(s),
      complete: new RegExp('<\\/' + PFX + '\\s*>', 'i').test(s) || new RegExp('<\\/' + PFX + '_maintext\\s*>', 'i').test(s)
    };
  }

  /** summernight → MilkCat（给天青原来的提示词、开局换前缀用） */
  function rename(text) {
    return String(text || '').replace(/(<\/?)summernight/g, '$1MilkCat').replace(/\bsummernight_/g, 'MilkCat_');
  }

  global.MilkCat = {
    detect: detect, split: split, toEvents: toEvents, hooksOf: hooksOf, branchesOf: branchesOf,
    snapshotOf: snapshotOf, maintextOf: maintextOf, parseCommands: parseCommands, commandsOf: commandsOf,
    applyCommands: applyCommands, parseValue: parseValue, bandOf: bandOf, periodOf: periodOf, clockOf: clockOf,
    stripNonStory: stripNonStory, rename: rename, normPath: normPath
  };
})(typeof window !== 'undefined' ? window : globalThis);
