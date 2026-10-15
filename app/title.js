/* ============================================================
 * app/title.js —— 标题画面 + 选角色 / 选开局轮播（超级奶猫）
 *
 * 版式照搬天青（Larimar · SummerNight Plus）的开始界面和开局轮播：
 *   标题：满幅主视觉 + 天青色装饰框 + 右侧黑色渐变栏（品牌名 + 四个菜单）
 *   轮播：全屏模糊底，六边形米色卡片（罗马数字、背景 + 立绘、标题），环状、左右各露两张，
 *         越往外越小越透明；拖拽 / 轻扫 / ‹ › / 圆点都能切；底下一行副标题 + 「开始开局」
 * 超级奶猫加的：
 *   - 轮播有两层：先选角色（角色包），再选这个角色的开局。只有一个角色时直接跳到开局
 *   - 开局最后一张是「自定义开场」
 *   - 单位全用容器单位（cqw / cqh），手机手动转屏（整页转 90°）时也对
 *
 * 这个文件只管界面。玩法相关的事（开局、继续、存档、设置）由 app.js 通过 MCTitle.init(hooks) 接进来：
 *   hooks.characters()        → [{ id, name, sub, cover, sprite }]
 *   hooks.openings(packId)    → [{ key, title, sub, cover, sprite, custom? }]
 *   hooks.pickCharacter(id)   选定主角（app.js 去装角色包）
 *   hooks.start(key)          开局（key = 开局序号，或 'custom'）
 *   hooks.canStart()          → true | '原因'（接口没填好时给原因，标题会提示并去设置）
 *   hooks.hasProgress()       → Promise<bool>  有没有能继续的存档
 *   hooks.continue() / saves() / settings()
 * ============================================================ */
(function (global) {
  'use strict';
  var doc = global.document;
  function $(id) { return doc.getElementById(id); }
  var H = {};
  var SIDE = 2, GAP_DECAY = 0.62;

  /* ---------------- 标题 ---------------- */
  function isOpen() { var el = $('mc-title'); return !!(el && el.classList.contains('open')); }

  function show() {
    var el = $('mc-title'); if (!el) return;
    doc.documentElement.classList.add('mc-at-title');
    el.classList.add('open'); el.removeAttribute('inert'); el.setAttribute('aria-hidden', 'false');
    refresh();
  }
  function hide() {
    var el = $('mc-title'); if (!el) return;
    var ae = doc.activeElement;
    if (ae && el.contains(ae) && ae.blur) ae.blur();
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', '');
    doc.documentElement.classList.remove('mc-at-title');
    closeCarousel();
  }

  /** 主视觉、品牌名、继续按钮 */
  function refresh() {
    var t = (H.look && H.look()) || {};
    var el = $('mc-title'); if (!el) return;
    el.style.setProperty('--mc-title-bg', t.bg ? 'url("' + String(t.bg).replace(/"/g, '%22') + '")' : 'none');
    if ($('mc-title-name')) $('mc-title-name').textContent = t.name || '超级奶猫';
    if ($('mc-title-sub')) $('mc-title-sub').textContent = t.sub || '';
    var c = $('mc-title-continue');
    if (c && H.hasProgress) {
      c.disabled = true;
      Promise.resolve(H.hasProgress()).then(function (ok) {
        c.disabled = !ok; c.title = ok ? '读取最近进度' : '暂无进度可继续';
      });
    }
  }

  function newGame() {
    var ok = H.canStart ? H.canStart() : true;
    if (ok !== true) { if (H.notReady) H.notReady(ok); return; }
    var chars = H.characters ? H.characters() : [];
    if (chars.length > 1) openCarousel('chars');
    else openCarousel('openings', chars[0] && chars[0].id);
  }

  /* ---------------- 轮播 ---------------- */
  var C = { mode: '', pack: null, items: [], sel: 0, off: 0, drag: null, raf: 0, suppress: 0 };

  function mod(i, n) { return n <= 0 ? 0 : ((i % n) + n) % n; }
  function roman(n) {
    var v = Math.max(1, Math.floor(+n || 1)), out = '';
    [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
     [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].forEach(function (r) { while (v >= r[0]) { out += r[1]; v -= r[0]; } });
    return out;
  }
  function stepPx() {
    var panel = $('mc-open'), track = $('mc-open-track');
    var gap = panel ? parseFloat(global.getComputedStyle(panel).getPropertyValue('--opening-gap')) || 28 : 28;
    var first = track && track.querySelector('.opening-card-wrap');
    return ((first && first.offsetWidth) || 300) + gap;
  }
  function floatDelta(i, center, n) {
    if (n <= 0) return 0;
    var d = i - mod(center, n);
    while (d > n / 2) d -= n;
    while (d < -n / 2) d += n;
    return d;
  }
  function compressedX(d, step) {
    var sign = d < 0 ? -1 : d > 0 ? 1 : 0; if (!sign) return 0;
    var ad = Math.abs(d), x = 0, slot = 0;
    while (slot + 1 <= ad) { slot++; x += step * Math.pow(GAP_DECAY, slot - 1); }
    var rem = ad - slot;
    if (rem > 0) x += step * Math.pow(GAP_DECAY, slot) * rem;
    return sign * x;
  }
  function cardScale(ad) { return ad < 0.12 ? 1 : Math.max(0.52, 1 - ad * 0.22); }
  function center() { return C.sel + C.off; }
  function nearest() { return mod(Math.round(center()), C.items.length); }

  function layout(animate) {
    var track = $('mc-open-track'); if (!track) return;
    var n = C.items.length, step = stepPx(), c = center(), dragging = !!C.drag;
    track.querySelectorAll('.opening-card-wrap').forEach(function (wrap) {
      var i = +wrap.dataset.index, card = wrap.firstChild;
      var d = floatDelta(i, c, n), ad = Math.abs(d);
      var x = compressedX(d, step), sc = cardScale(ad);
      wrap.style.transition = (!animate || dragging) ? 'none' : '';
      wrap.style.transform = 'translate(-50%, -50%) translateX(' + x + 'px) scale(' + sc + ')';
      if (ad > SIDE + 0.55) {
        wrap.style.opacity = '0'; wrap.style.pointerEvents = 'none'; wrap.style.zIndex = '0';
        card.classList.remove('is-selected'); card.setAttribute('aria-selected', 'false');
        return;
      }
      wrap.style.opacity = String(Math.max(0.16, 1 - ad * 0.36));
      wrap.style.pointerEvents = ad < 0.55 ? 'auto' : 'none';
      wrap.style.zIndex = String(Math.round(20 - ad * 4));
      var on = ad < 0.35;
      card.classList.toggle('is-selected', on); card.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function schedule(animate) {
    if (C.raf) cancelAnimationFrame(C.raf);
    C.raf = requestAnimationFrame(function () { C.raf = 0; layout(animate !== false); });
  }

  function chrome() {
    var idx = C.drag ? nearest() : C.sel, it = C.items[idx];
    $('mc-open-caption').textContent = it ? (it.sub || '') : '这个角色还没有开局';
    var dots = $('mc-open-dots');
    if (dots.children.length !== C.items.length) {
      dots.innerHTML = C.items.map(function (_, i) {
        return '<button type="button" class="opening-dot" data-index="' + i + '" aria-label="第 ' + (i + 1) + ' 个"></button>';
      }).join('');
    }
    Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('is-on', i === idx); });
    var multi = C.items.length > 1;
    ['mc-open-prev', 'mc-open-next'].forEach(function (id) { $(id).hidden = !multi; $(id).disabled = !multi; });
    var ok = $('mc-open-confirm');
    ok.textContent = C.mode === 'chars' ? '选 她' : (it && it.custom ? '去 设 定' : '开 始 开 局');
    ok.disabled = !it;
    $('mc-open-kicker').textContent = C.mode === 'chars' ? 'SELECT · 角色' : 'OPENING · ' + (C.packName || '开局');
    $('mc-open-back').hidden = !(C.mode === 'openings' && C.canBack);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build() {
    var track = $('mc-open-track');
    track.innerHTML = C.items.map(function (it, i) {
      return '<div class="opening-card-wrap" data-index="' + i + '" role="option">' +
        '<button type="button" class="opening-card' + (it.custom ? ' is-custom' : '') + '" data-index="' + i + '" aria-label="' +
          esc((it.title || '') + (it.sub ? '，' + it.sub : '')) + '">' +
        '<div class="opening-card-frame" aria-hidden="true">' +
          '<div class="opening-card-roman">' + (it.custom ? '+' : roman(i + 1)) + '</div>' +
          '<div class="opening-card-window">' +
            '<div class="opening-card-face"' + (it.cover ? ' style="background-image:url(&quot;' + esc(it.cover) + '&quot;)"' : '') + '>' +
              (it.sprite ? '<img class="opening-card-sprite" alt="" draggable="false" src="' + esc(it.sprite) + '">' : '') +
              (it.custom ? '<span class="opening-card-plus">✎</span>' : '') +
            '</div>' +
            '<div class="opening-card-label">' + esc(it.title || '') + '</div>' +
          '</div></div></button></div>';
    }).join('');
    chrome(); layout(false);
  }

  function openCarousel(mode, packId) {
    var panel = $('mc-open'); if (!panel) return;
    C.mode = mode; C.sel = 0; C.off = 0; C.drag = null;
    var chars = H.characters ? H.characters() : [];
    C.canBack = chars.length > 1;
    if (mode === 'chars') {
      C.items = chars.map(function (c) { return { key: c.id, title: c.name, sub: c.sub, cover: c.cover, sprite: c.sprite }; });
      var cur = H.currentPack ? H.currentPack() : null;
      chars.forEach(function (c, i) { if (c.id === cur) C.sel = i; });
    } else {
      C.pack = packId || (chars[0] && chars[0].id) || null;
      var ch = chars.filter(function (c) { return c.id === C.pack; })[0];
      C.packName = ch ? ch.name : '';
      C.items = H.openings ? H.openings(C.pack) : [];
    }
    panel.classList.remove('open');
    build();
    panel.removeAttribute('inert'); panel.setAttribute('aria-hidden', 'false');
    panel.dataset.mode = mode;
    if ($('mc-title')) $('mc-title').classList.add('under-open');   // 菜单淡掉（转屏时模糊底不一定生效）
    requestAnimationFrame(function () { layout(false); panel.classList.add('open'); });
  }
  function closeCarousel() {
    var panel = $('mc-open'); if (!panel) return;
    var ae = doc.activeElement;
    if (ae && panel.contains(ae) && ae.blur) ae.blur();
    C.drag = null; C.off = 0;
    if ($('mc-title')) $('mc-title').classList.remove('under-open');
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); panel.setAttribute('inert', '');
  }
  function carouselOpen() { var p = $('mc-open'); return !!(p && p.classList.contains('open')); }

  function select(i, instant) { C.sel = mod(i, C.items.length); C.off = 0; chrome(); layout(!instant); }
  function settle(target) {
    var c = center();
    C.sel = mod(target, C.items.length); C.off = c - C.sel;
    layout(false); chrome();
    requestAnimationFrame(function () { requestAnimationFrame(function () { C.off = 0; layout(true); }); });
  }

  function confirm() {
    var it = C.items[C.sel]; if (!it) return;
    if (C.mode === 'chars') {
      if (H.pickCharacter) H.pickCharacter(it.key);
      openCarousel('openings', it.key);
      return;
    }
    closeCarousel();
    if (H.start) H.start(it.custom ? 'custom' : it.key);
  }

  /* ---------------- 绑定 ---------------- */
  function bind() {
    var t = $('mc-title');
    if (t) t.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-title-act]');
      if (!b || b.disabled) return;
      var act = b.getAttribute('data-title-act');
      if (act === 'new') newGame();
      else if (act === 'continue' && H.continue) H.continue();
      else if (act === 'saves' && H.saves) H.saves();
      else if (act === 'settings' && H.settings) H.settings();
    });
    $('mc-open-prev').onclick = function () { select(C.sel - 1); };
    $('mc-open-next').onclick = function () { select(C.sel + 1); };
    $('mc-open-confirm').onclick = confirm;
    $('mc-open-close').onclick = closeCarousel;
    $('mc-open-back').onclick = function () { openCarousel('chars'); };
    $('mc-open-track').addEventListener('click', function (e) {
      if (Date.now() < C.suppress) { e.preventDefault(); e.stopPropagation(); return; }
      var card = e.target.closest && e.target.closest('.opening-card');
      if (!card) return;
      var i = +card.dataset.index;
      if (i === C.sel) confirm(); else select(i);      // 点中间那张 = 确定；点旁边的 = 转过来
    });
    $('mc-open-dots').addEventListener('click', function (e) {
      var d = e.target.closest && e.target.closest('.opening-dot');
      if (d) select(+d.dataset.index);
    });
    doc.addEventListener('keydown', function (e) {
      if (!carouselOpen()) return;
      if (e.key === 'ArrowLeft') { select(C.sel - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { select(C.sel + 1); e.preventDefault(); }
      else if (e.key === 'Enter') { confirm(); e.preventDefault(); }
      else if (e.key === 'Escape') { closeCarousel(); e.preventDefault(); }
    });

    var vp = $('mc-open-viewport');
    /* 手机手动转屏时整页转了 90°：屏幕上的「左右」是页面里的「上下」，拖拽要换轴 */
    function axis(e) {
      var h = doc.documentElement;
      if (h.classList.contains('m-rot-cw')) return e.clientY;
      if (h.classList.contains('m-rot-ccw')) return -e.clientY;
      return e.clientX;
    }
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (C.raf) { cancelAnimationFrame(C.raf); C.raf = 0; }
      var x = axis(e);
      C.drag = { id: e.pointerId, x: x, start: C.sel, moved: false, lastX: x, lastT: performance.now(), vx: 0, near: C.sel };
      C.off = 0; layout(false);
      try { vp.setPointerCapture(e.pointerId); } catch (err) {}
    }, { passive: true });
    vp.addEventListener('pointermove', function (e) {
      var d = C.drag; if (!d || d.id !== e.pointerId) return;
      var x = axis(e), now = performance.now();
      d.vx = (x - d.lastX) / Math.max(1, now - d.lastT); d.lastX = x; d.lastT = now;
      var dx = x - d.x;
      if (Math.abs(dx) > 6) d.moved = true;
      C.off = -dx / stepPx();
      var nn = nearest(); if (nn !== d.near) { d.near = nn; chrome(); }
      schedule(false);
    }, { passive: true });
    function end(e) {
      var d = C.drag; if (!d || (e && d.id !== e.pointerId)) return;
      var target = nearest();
      if (d.moved && target === d.start) {                  // 轻扫：没过半也切一张
        if (C.off > 0.18 || -d.vx > 0.45) target = d.start + 1;
        else if (C.off < -0.18 || d.vx > 0.45) target = d.start - 1;
      }
      C.drag = null;
      if (!d.moved) { C.off = 0; chrome(); layout(true); return; }
      C.suppress = Date.now() + 450;
      settle(target);
    }
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    global.addEventListener('resize', function () { if (carouselOpen()) layout(false); });
  }

  function init(hooks) {
    H = hooks || {};
    bind();
  }

  global.MCTitle = {
    init: init, show: show, hide: hide, isOpen: isOpen, refresh: refresh,
    newGame: newGame, openCarousel: openCarousel, closeCarousel: closeCarousel, carouselOpen: carouselOpen,
    _state: function () { return { mode: C.mode, pack: C.pack, sel: C.sel, items: C.items.map(function (i) { return i.title; }) }; }
  };
})(window);
