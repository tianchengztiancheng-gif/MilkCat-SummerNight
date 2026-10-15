/* ============================================================
 * core/terms.js —— 称呼表（超级奶猫）
 *
 * 引擎里所有「发给模型的话」和界面上的称呼都从这里取，不写死。
 * 角色包载入时按自己的世界观改：天青叫玩家「制作人」，别的角色可能叫「前辈」「老师」。
 *   Terms.user   —— 角色们怎么称呼玩家
 *   Terms.crowd  —— 泛指「其他角色们」
 *   Terms.world  —— 故事发生的地方（给手机群名、提示词用）
 * ============================================================ */
(function (global) {
  'use strict';
  var DEFAULTS = { user: '制作人', crowd: '大家', world: '这里' };
  var T = global.Terms = global.Terms || {};
  Object.keys(DEFAULTS).forEach(function (k) { if (T[k] == null) T[k] = DEFAULTS[k]; });
  T.DEFAULTS = DEFAULTS;
  T.set = function (o) {
    Object.keys(DEFAULTS).forEach(function (k) {
      T[k] = (o && o[k] != null && String(o[k]).trim()) ? String(o[k]).trim() : DEFAULTS[k];
    });
    return T;
  };
})(typeof window !== 'undefined' ? window : globalThis);
