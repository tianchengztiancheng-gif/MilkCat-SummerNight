/* ============================================================
 * packs/tianqing/pack.js —— 天青角色包（超级奶猫的第一个角色）
 *
 * 素材、开局、世界书、原版提示词都在 data.js（由 tools/build-pack-tianqing.mjs 从 Larimar 生成，别手改）。
 * 这里只写配置，以及超级奶猫新增的两条提示词（多人同台、手机钩子写法补充）。
 * 天青原版的人设、世界观、文风提示词一个字不改；唯一的改写是格式标签前缀 summernight → MilkCat。
 * ============================================================ */
(function () {
  'use strict';
  var D = window.MilkCatPackData && window.MilkCatPackData.tianqing;
  if (!D || !window.MilkCatPacks) return;

  /* 超级奶猫新增的提示词：order 紧跟在原版「APP」(204) 之后 */
  var EXTRA = [
    {
      uid: 'mc_multi_stage', comment: '多人同台（超级奶猫）', constant: true, enabled: true,
      position: 0, depth: 4, order: 205, key: [], keysecondary: [],
      content: [
        '【多人同台】',
        '- 有立绘的角色说话一律写 <角色名|表情|台词>，表情只能从她自己的立绘名单里选；没有立绘的人、旁白、{{user}} 写 <角色名|台词>。',
        '- 同一个画面最多 4 个有立绘的角色。有人走进画面：<登场|角色名:表情>（多人：<登场|角色A:表情|角色B:表情>）；有人离开：<退场|角色名>，全部离开：<退场|全部>。都写在 <MilkCat_maintext> 里，单独一行。',
        '- 换地点（<背景|…>）会自动清台，不用写退场；没写登场就开口的角色也会自动上台。',
        '- 一个标签只写一个人的一句话，不要把两个人的台词写进同一个标签。'
      ].join('\n')
    },
    {
      uid: 'mc_hook_targets', comment: '手机钩子写法补充（超级奶猫）', constant: true, enabled: true,
      position: 0, depth: 4, order: 206, key: [], keysecondary: [],
      content: [
        '【手机钩子 · 写法补充】',
        '<MilkCat_hook> 里的钩子可以写明是谁：',
        '- <line|角色名|简述>：这个角色在 LINE 上私聊{{user}}。只写 <line|简述> 时默认是天青。',
        '- <line_group|群名|成员1,成员2|简述>：几个角色在 LINE 群里聊天。群名自拟，同一个群以后沿用同一个名字。',
        '- <line_call|角色名|简述>：这个角色给{{user}}打电话。',
        '- <twitter|简述>、<twitch|简述>：同原规则。',
        '私聊的对象永远是{{user}}；角色之间互相说话用 line_group。'
      ].join('\n')
    }
  ];

  window.MilkCatPacks.register({
    id: 'tianqing',
    name: '天青',
    version: 1,
    source: D.source,
    main: '天青',                                   // 这个包的主角（虚拟卡的 {{char}}）
    terms: { user: '制作人', crowd: '大家', world: '' },
    /* 标题画面（天青原版的主界面图）和选角色时的卡面 */
    title: {
      bg: 'https://huggingface.co/think-denim-frisk/Larimar/resolve/main/system/' + encodeURIComponent('主页面.png'),
      sub: 'SummerNight Plus'
    },
    tagline: '偶像 · 事务所 · 直播',
    cover: { bg: '事务所办公室', expr: '微笑' },
    characters: {
      '天青': {
        expressions: D.expressions,                  // 75 种表情，扁平一套（演出服 / 婚纱带前缀）
        defaultExpr: '微笑',
        avatar: D.avatars['微笑'] || D.avatars['高兴'],
        avatars: D.avatars,                          // 表情 → 小头像（LINE 里用）
        color: '#8dd4e0',                            // 对话框名字颜色（原版 textTqColor）
        nai: (D.tags && D.tags.fixed) || ''          // 文生图固定外观词
      }
    },
    scenes: D.scenes,                                // { 地点: { 白日 / 黄昏 / 夜晚: url } }
    cg: D.cg,
    stickers: D.stickers,
    openings: D.openings,
    worldbook: D.worldbook,                          // 天青的角色设定（原样）
    prompts: D.prompts.concat(EXTRA),                // 原版系统提示词（换了前缀）+ 新增两条
    phonePrompts: D.phonePrompts,                    // line / call / twitter / twitch / agency
    variables: D.variables,                          // 时间 / 地点 / 名气
    tags: D.tags,
    ui: D.ui,
    /* 天青专属的玩法：直播间、事务所名气面板（机制模块，下一阶段做） */
    mechanics: {
      livestream: { channel: 'Larimar', app: 'twitch', fansVar: '名气.twitter', viewersVar: '名气.同接' },
      'idol-fame': { root: '名气' }
    }
  });
})();
