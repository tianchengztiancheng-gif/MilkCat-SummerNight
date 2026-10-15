/* ============================================================
 * core/ns.js —— 超级奶猫自己的存储命名空间（必须是页面上第一个脚本）
 *
 * 为什么要有：GitHub Pages 上，同一个账号下的所有仓库共用一个「源」
 * （tianchengztiancheng-gif.github.io），浏览器按源分配 localStorage 和 IndexedDB。
 * 超级奶猫的引擎底子来自 juus 版 gal 引擎，键名一模一样（gal_api_config、gal_persona、存档库 gal_engine……），
 * 不隔开的话两边会读到对方的接口设置、存档、预设、正则。
 *
 * 做法：
 *   1. 把 window.localStorage 换成一个带前缀的包装（键前面自动加 "mc:"）。
 *      引擎、界面里所有 localStorage.getItem / setItem / key / length / clear 都不用改，自动只看见自己的键。
 *   2. IndexedDB 的库名在 core/storage.js 里换成 milkcat（不是 gal_engine）。
 *   3. MCStore.raw 留着原生的 localStorage，只给「从 juus 版沿用接口设置」这种玩家主动点的按钮用。
 *
 * 换不掉（极少数浏览器 localStorage 不可配置）时退回：包装照样挂在 MCStore.ls 上，
 * 引擎读写仍走原生 —— 和以前一样能玩，只是没隔开。
 * ============================================================ */
(function (global) {
  'use strict';
  var PREFIX = 'mc:';
  var raw = null;
  try { raw = global.localStorage; } catch (e) { raw = null; }

  /* 老版本（v0.1）没加前缀时写下的超级奶猫专属键：搬进命名空间一次 */
  var LEGACY = ['mc_source', 'mc_packs', 'mc_phone_prompts'];

  var mem = {};                       // 原生不可用（隐私模式 / file:// 某些浏览器）时的兜底
  function rGet(k) { try { return raw ? raw.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } }
  function rSet(k, v) { try { if (raw) raw.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; throw e; } }
  function rDel(k) { try { if (raw) raw.removeItem(k); } catch (e) {} delete mem[k]; }
  function rKeys() {
    var out = [];
    try { if (raw) for (var i = 0; i < raw.length; i++) out.push(raw.key(i)); } catch (e) {}
    Object.keys(mem).forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function own() {
    return rKeys().filter(function (k) { return k && k.indexOf(PREFIX) === 0; })
      .map(function (k) { return k.slice(PREFIX.length); });
  }

  var ls = {
    getItem: function (k) { return rGet(PREFIX + k); },
    setItem: function (k, v) { rSet(PREFIX + k, String(v)); },
    removeItem: function (k) { rDel(PREFIX + k); },
    key: function (i) { var a = own(); return i >= 0 && i < a.length ? a[i] : null; },
    clear: function () { own().forEach(function (k) { rDel(PREFIX + k); }); },
    get length() { return own().length; }
  };

  try {
    LEGACY.forEach(function (k) {
      var v = rGet(k);
      if (v != null && rGet(PREFIX + k) == null) rSet(PREFIX + k, v);
      if (v != null) rDel(k);
    });
  } catch (e) {}

  var installed = false;
  try {
    Object.defineProperty(global, 'localStorage', { configurable: true, enumerable: true, get: function () { return ls; } });
    installed = global.localStorage === ls;
  } catch (e) { installed = false; }

  /* juus 版（gal 引擎）在同一个源下留的接口设置：只在玩家点「沿用」时读 */
  var JUUS_KEYS = ['gal_api_config', 'gal_api2_config', 'gal_imagegen', 'gal_imgnet'];

  global.MCStore = {
    prefix: PREFIX,
    isolated: installed,
    ls: ls,
    raw: raw,
    DB: 'milkcat',                      // IndexedDB 库名（core/storage.js、core/crash.js 用）
    juusKeys: JUUS_KEYS,
    /* 同一个源下有没有 juus 版的接口设置（不含密钥内容，只说有没有） */
    juusFound: function () {
      return JUUS_KEYS.filter(function (k) { return rGet(k) != null; });
    },
    /* 玩家点了「沿用 juus 版的接口设置」：把原生键复制进自己的命名空间，返回复制了哪些 */
    importJuus: function () {
      var done = [];
      JUUS_KEYS.forEach(function (k) {
        var v = rGet(k);
        if (v != null) { rSet(PREFIX + k, v); done.push(k); }
      });
      return done;
    }
  };
})(window);
