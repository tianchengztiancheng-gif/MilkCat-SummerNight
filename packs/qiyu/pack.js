/* ============================================================
 * packs/qiyu/pack.js —— 祈语角色包（超级奶猫的第二个角色）
 *
 * 立绘、世界书、三个开局（卡里的开场白按段转成的剧本，文字照抄）在 data.js
 * （tools/build-pack-qiyu.mjs 从祈语的角色卡 + 立绘清单生成，别手改）。
 * 这里是配置，以及超级奶猫为祈语写的东西（都是新写的，不是卡里的）：
 *   · 她当主角时的系统提示词：剧本格式、立绘名单、背景、变量、手机 App、多人同台
 *   · 她当客串时（主角是天青）的提示词：立绘名单 + 怎么写她
 *   · 手机 App 提示词：LINE 私聊、LINE 通话、Twitter、二级钩子
 *   · 「天青 × 祈语」同台开局（主角天青，祈语客串）
 * 背景图祈语自己没有，借天青包的 22 个地点（同一个项目里的素材，地点都是通用的街区、咖啡馆、公园…）。
 * ============================================================ */
(function () {
  'use strict';
  var D = window.MilkCatPackData && window.MilkCatPackData.qiyu;
  if (!D || !window.MilkCatPacks) return;
  var TQ = window.MilkCatPackData.tianqing || {};
  var SCENES = TQ.scenes || {};
  var LOCS = Object.keys(SCENES);
  var EXPRS = Object.keys(D.expressions);
  var tick = function (a) { return a.map(function (x) { return '`' + x + '`'; }).join(' '); };

  /* ---------------- 她当主角时的系统提示词（order 和天青包一一对应，便于对照） ---------------- */
  var PROMPTS = [
    {
      uid: 'qy_vars', comment: '变量列表', constant: true, enabled: true, position: 0, depth: 4, order: -1000, key: [], keysecondary: [],
      content: [
        '时间.天数：{{stat_data::时间.天数}} #整数',
        '时间.具体时间：{{stat_data::时间.具体时间}} #以[小时,分钟]的形式显示',
        '时间.星期：{{stat_data::时间.星期}} #包含日一二三四五六',
        '地点：{{stat_data::地点}} #参照标准地点，如无则自建地点',
        '奇迹能量：{{stat_data::奇迹能量}} #0~100 的整数，祈语攒下的奇迹能量'
      ].join('\n')
    },
    {
      uid: 'qy_var_rules', comment: '变量更新规则', constant: true, enabled: true, position: 4, depth: 0, order: 200, key: [], keysecondary: [],
      content: [
        '## 变量更新格式（UpdateVariable）',
        '',
        '<UpdateVariable>',
        '        - 这一轮过了多久',
        '        - 每个变量要不要变、为什么（变化条件满足了没有）',
        '        <MilkCat_variables>',
        '        更新变量',
        '        </MilkCat_variables>',
        '</UpdateVariable>',
        '',
        '### 可用命令',
        "- `_.set('路径', 新值)`：设置变量值，例 `_.set('stat_data.地点', '咖啡馆')`",
        "- `_.add('路径', 增量)`：数值增加 / 减少，例 `_.add('stat_data.奇迹能量', 10)`",
        '',
        '### 奇迹能量（0~100）',
        '- 祈语替别人实现一个小小的愿望（帮小孩找回玩具、让迷路的情侣找到路……）：+5~15，越是真心的愿望越多',
        '- 小小的奢侈（让面包房的可颂刚好出炉、让咖啡店留出靠窗的位子）：-1~5',
        '- 攒满 100 才能做大事：一眨眼带{{user}}去另一个城市，或者旅程结束时把{{user}}送回家。用掉就清零',
        '- 不满 100 时祈语不会、也做不到瞬间移动，只能坐车走路'
      ].join('\n')
    },
    {
      uid: 'qy_format', comment: 'GAL格式', constant: true, enabled: true, position: 0, depth: 0, order: 201, key: [], keysecondary: [],
      content: [
        '忽略对话历史里的格式，{{user}}每做一次行动，这一轮都必须严格按下面的格式输出：',
        '<MilkCat>',
        '    <MilkCat_maintext>',
        '        正文',
        '    </MilkCat_maintext>',
        '    <MilkCat_branches>',
        '        分支选项',
        '    </MilkCat_branches>',
        '    <MilkCat_snapshots>',
        '        这一轮的快照',
        '    </MilkCat_snapshots>',
        '    <MilkCat_hook>',
        '        手机 App 的钩子（这一轮手机上有没有谁冒消息）',
        '    </MilkCat_hook>',
        '    <UpdateVariable>',
        '    变量更新思路',
        '        <MilkCat_variables>',
        '        更新变量',
        '        </MilkCat_variables>',
        '    </UpdateVariable>',
        '</MilkCat>',
        '',
        '正文规则（一行一个标签，只能用这几种）：',
        '- 有立绘的角色说话：<祈语|立绘表情|「台词」>；她的心里话写成 <祈语|立绘表情|（心里话）>',
        '- 其他人 / 旁白 / {{user}}：<角色名|内容>，旁白写 <旁白|……>',
        '- 背景：<背景|背景图片ID|背景名称>',
        '- 不要把 LINE、Twitter、大段电话内容写进正文；电话响了就在正文最后简单写一句，再在钩子里写 <line_call|祈语|简述>',
        '',
        '分支选项：<MilkCat_branches>[选项一][选项二][选项三]</MilkCat_branches>，给{{user}} 3 个下一步可以做 / 说的事',
        '快照：<MilkCat_snapshots>这一轮发生了什么（字数不超过正文的 1/10）</MilkCat_snapshots>',
        '',
        '参考：',
        '<MilkCat>',
        '    <MilkCat_maintext>',
        '        <背景|咖啡馆|街角咖啡馆>',
        '        <旁白|雨下了一整个下午。祈语把礼帽搁在桌上，帽檐还在往下滴水。>',
        '        <祈语|委屈|「出门的时候明明是晴天的……奇迹师小姐也会被天气骗的嘛。」>',
        '        <旁白|邻桌的小女孩正盯着窗外发呆，手里的气球绳缠在指头上，气球早就不知道飞到哪里去了。>',
        '        <祈语|思考|（……啊，这个味道。是很想很想再要一个气球的味道。）>',
        '        <祈语|俏皮|「等我一下下哦。」>',
        '        <旁白|她站起来，从皮箱里抖出一条蕾丝边的手帕，在空中一甩——手帕底下吊着一只红色的气球，绳子正好垂到小女孩手边。>',
        '        <祈语|胜利pose|「当当——奇迹送达！」>',
        '    </MilkCat_maintext>',
        '    <MilkCat_branches>',
        '        [「这也算奇迹？」][给她递一张纸巾擦帽子][「下次出门先看天气预报」]',
        '    </MilkCat_branches>',
        '    <MilkCat_snapshots>',
        '        雨天的咖啡馆，祈语给邻桌丢了气球的小女孩变出一只新气球。',
        '    </MilkCat_snapshots>',
        '    <MilkCat_hook></MilkCat_hook>',
        '    <UpdateVariable>',
        '        - 过了大约二十分钟；完成了一个小奇迹',
        '        <MilkCat_variables>',
        "        _.set('stat_data.时间.具体时间', [16, 20])",
        "        _.set('stat_data.地点', '咖啡馆')",
        "        _.add('stat_data.奇迹能量', 8)",
        '        </MilkCat_variables>',
        '    </UpdateVariable>',
        '</MilkCat>'
      ].join('\n')
    },
    {
      uid: 'qy_sprites', comment: '立绘', constant: true, enabled: true, position: 0, depth: 0, order: 202, key: [], keysecondary: [],
      content: '▸ **祈语的立绘**（表情只能从这份名单里原样照抄，写别的前端查不到图）：\n' + tick(EXPRS)
    },
    {
      uid: 'qy_scenes', comment: '背景', constant: true, enabled: true, position: 0, depth: 0, order: 203, key: [], keysecondary: [],
      content: [
        '背景图片只有这些地点：',
        tick(LOCS),
        '',
        '调用方式：<背景|背景图片ID|背景名称>',
        '祈语满世界旅行，城市可以是任何地方，但背景图片ID只能从上面挑意思最接近的：',
        '<背景|小镇|卢布尔雅那的河边小街>　<背景|咖啡馆|巴黎街角的咖啡馆>　<背景|海边小镇|威尼斯的运河边>',
        '地点变量（地点）写背景图片ID；具体是哪个城市写进正文里。'
      ].join('\n')
    },
    {
      uid: 'qy_apps', comment: 'APP', constant: true, enabled: true, position: 0, depth: 4, order: 204, key: [], keysecondary: [],
      content: [
        'APP 只是正文的点缀，不要喧宾夺主，内容要和正文紧紧相关。只写一句简短的概括。',
        '可用的 APP：line（LINE 私聊）、line_call（电话）、twitter（路人发的动态）',
        '例：',
        '① 旅行结束，祈语用奇迹能量把{{user}}送回了家，自己留在那座城市。',
        '<MilkCat_hook>',
        '    <line|祈语|祈语发来一张夜景照片，说是再见不是告别，问{{user}}到家了没有>',
        '</MilkCat_hook>',
        '② 祈语在广场上的魔术被路人拍下来发到网上。',
        '<MilkCat_hook>',
        '    <twitter|有人发了祈语在广场变魔术的视频，评论区在猜那个戴礼帽的金发女孩是谁>',
        '</MilkCat_hook>'
      ].join('\n')
    },
    {
      uid: 'qy_multi_stage', comment: '多人同台（超级奶猫）', constant: true, enabled: true, position: 0, depth: 4, order: 205, key: [], keysecondary: [],
      content: [
        '【多人同台】',
        '- 有立绘的角色说话一律写 <角色名|表情|台词>，表情只能从她自己的立绘名单里选；没有立绘的人、旁白、{{user}} 写 <角色名|台词>。',
        '- 同一个画面最多 4 个有立绘的角色。有人走进画面：<登场|角色名:表情>（多人：<登场|角色A:表情|角色B:表情>）；有人离开：<退场|角色名>，全部离开：<退场|全部>。都写在 <MilkCat_maintext> 里，单独一行。',
        '- 换地点（<背景|…>）会自动清台，不用写退场；没写登场就开口的角色也会自动上台。',
        '- 一个标签只写一个人的一句话，不要把两个人的台词写进同一个标签。'
      ].join('\n')
    },
    {
      uid: 'qy_hook_targets', comment: '手机钩子写法补充（超级奶猫）', constant: true, enabled: true, position: 0, depth: 4, order: 206, key: [], keysecondary: [],
      content: [
        '【手机钩子 · 写法补充】',
        '- <line|角色名|简述>：这个角色在 LINE 上私聊{{user}}。只写 <line|简述> 时默认是祈语。',
        '- <line_group|群名|成员1,成员2|简述>：几个角色在 LINE 群里聊天。群名自拟，同一个群以后沿用同一个名字。',
        '- <line_call|角色名|简述>：这个角色给{{user}}打电话。',
        '私聊的对象永远是{{user}}；角色之间互相说话用 line_group。'
      ].join('\n')
    }
  ];

  /* ---------------- 她当客串时（主角是别人，比如天青） ---------------- */
  var GUEST = [
    {
      uid: 'qy_guest', comment: '祈语（客串）', constant: true, enabled: true, position: 0, depth: 4, order: 207, key: [], keysecondary: [],
      content: [
        '【客串角色 · 祈语】',
        '祈语是满世界旅行的「奇迹师」（设定见世界书「祈语」「奇迹」「奇迹巡游」）。她在场时说话写 <祈语|表情|「台词」>，心里话写 <祈语|表情|（心里话）>。',
        '▸ 祈语的立绘（表情只能从这份名单里原样照抄）：',
        tick(EXPRS),
        '她叫主角的称呼由主角的世界观决定（比如天青的故事里，她跟着叫{{user}}「制作人」，或者直接叫「你」）。',
        "如果变量里有 奇迹能量（0~100）：祈语完成一个小奇迹 _.add('stat_data.奇迹能量', 5~15)，攒满 100 才能瞬间移动。"
      ].join('\n')
    }
  ];

  /* ---------------- 手机 App 提示词 ---------------- */
  var PHONE = {
    line: [
      '[ LINE 私聊回复 ]',
      '你现在是祈语，在 LINE 上回复{{user}}的私聊。祈语是满世界旅行的奇迹师，情绪全写在脸上：高兴就用一串感叹号，委屈就拖长音，讲究仪式感，会大大方方地说喜欢。',
      '她经常人在别的城市，会顺口提到正在哪里、吃了什么甜品、今天帮谁实现了什么小愿望。',
      '',
      '[ 回复格式 ]',
      '  - 一行一条消息，格式统一为：<祈语|消息内容|小时:分钟>',
      '  - 口语化的短信，不要动作 / 旁白 / 括号 / markdown；可以偶尔用颜文字',
      '  - 祈语没有表情包，不要发表情包',
      '  - 每次回复 6 句以内，别在好几个话题之间来回跳',
      '  - 想直接打电话时，单独一行写 <line_calling>',
      '',
      '  example:',
      '    <line_message>',
      '        <祈语|报告！奇迹师小姐已抵达布拉格！|19:02>',
      '        <祈语|天文钟整点的时候小人会出来转圈圈，我录了视频，回去给你看！|19:02>',
      '        <祈语|……然后，那个，你今天有没有好好吃饭呀|19:03>',
      '    </line_message>',
      '',
      '[最近的对话]',
      '{{line_recent_message}}',
      '',
      '直接输出祈语的回复：'
    ].join('\n'),
    call: [
      '[ LINE 语音通话 ]',
      '这是{{user}}和祈语的通话。像真的打电话一样：短句、口语、会抢话，祈语情绪起伏都听得出来。',
      '',
      '[ 输出格式 ]',
      '只输出 <line_call> 包着的对话，不要别的：',
      '  <line_call>',
      '      <祈语|表情|台词>',
      '  </line_call>',
      '',
      '规则：',
      '- 只有祈语说话；表情只能从她的立绘名单里选（' + EXPRS.join(' / ') + '）',
      '- 10 句以内，接着最近的对话说，不要无故换话题',
      '- 不要输出 <line_message>',
      '',
      'example:',
      '  <line_call>',
      '      <祈语|开心|「喂喂？接通啦！」>',
      '      <祈语|俏皮|「猜猜我现在在哪？提示：脚底下是石头路，旁边有一条会唱歌的河。」>',
      '      <祈语|撒娇|「猜不到也没关系！反正下周我就去找你，你要空出一整天哦。」>',
      '  </line_call>',
      '',
      '[最近的对话]',
      '{{line_recent_message}}',
      '',
      '直接输出 <line_call>：'
    ].join('\n'),
    twitter: [
      '[ Twitter / X 动态生成 ]',
      '根据本回合钩子，生成和祈语有关的 Twitter/X 内容。祈语自己不怎么发推，大多是路人拍到她的街头魔术、被她帮过的人发的感谢，风格要像真实的社交平台。',
      '可以有好几个账号发帖，评论只留最精华的几条（每帖不超过 5 条），回复人数要 ≥ 列出的评论条数。',
      '',
      '[ 输出格式 ]',
      '<twitter_message>',
      '    <twitter_account>',
      '        账号名称|账号ID|小时:分钟|查看人数',
      '        <twitter_context>正文</twitter_context>',
      '        <twitter_tag>#tag |转推人数|喜欢人数|回复人数</twitter_tag>',
      '        评论账号|评论账号ID|评论',
      '    </twitter_account>',
      '    <trends>',
      '        <趋势名|趋势贴文>',
      '    </trends>',
      '</twitter_message>',
      '',
      'example:',
      '<twitter_message>',
      '    <twitter_account>',
      '        下班路上的猫|neko_commute|18:40|1203',
      '        <twitter_context>喷泉广场有个戴礼帽的金发小姐姐在变魔术，最后一张牌直接贴在她帽檐上？？？我看了三遍慢放都没看懂</twitter_context>',
      '        <twitter_tag>#街头魔术 #喷泉广场 |34|210|12</twitter_tag>',
      '        路过的面包师|bread_maker|她还送了我一朵纸玫瑰，现在插在店里收银台上',
      '        今天也想放假|want_holiday|这是哪里！我也想当幸运观众',
      '    </twitter_account>',
      '    <trends>',
      '        <#礼帽魔术师|0.03>',
      '    </trends>',
      '</twitter_message>',
      '',
      '[本回合钩子]',
      '{{hook}}',
      '',
      '直接输出 <twitter_message>：'
    ].join('\n'),
    agency: [
      '[ HOOK · 主线钩子 ]',
      '想一想这次手机 App 生成的内容会不会带出别的 App 的动静，慎重权衡后再写，不要重复生成。',
      '',
      '[ 输出格式 ]',
      '<MilkCat_hook>',
      '    <APP名称|本回合该 App 要生成什么的简略描写>',
      '</MilkCat_hook>',
      '',
      '规则：',
      '- 一条钩子一行：<line|…> / <line_call|…> / <twitter|…>',
      '- 本回合不需要手机动静时留空：<MilkCat_hook></MilkCat_hook>',
      '',
      'example:',
      '祈语看到自己的魔术视频上了趋势，激动地给{{user}}发 LINE。',
      '<MilkCat_hook>',
      '    <line|祈语|祈语发来好几个感叹号，让{{user}}快去看那条视频>',
      '</MilkCat_hook>'
    ].join('\n')
  };

  /* ---------------- 「天青 × 祈语」同台开局：主角天青，祈语客串 ----------------
   * 带 packs：天青和祈语的开局列表里都有它；开演前 app 会换成「天青主角 + 祈语客串」。
   * 称呼按天青的世界观：{{user}} 是制作人。天青、祈语的表情都来自各自的立绘名单。 */
  var DUO = {
    id: 'tq-qy-crepe', title: '天青 × 祈语', subtitle: '黄昏 · 商业街的奇迹师',
    coverBgId: '商业街', coverExpr: '星星眼',
    packs: { main: 'tianqing', extra: ['qiyu'] },
    raw: [
      '<MilkCat>',
      '    <MilkCat_maintext>',
      '        <背景|商业街|黄昏的商业街>',
      '        <旁白|排练比预定时间晚结束了四十分钟。商业街的路灯刚亮起第一排，橱窗里的灯光把石砖路切成一格一格暖黄色的方块。>',
      '        <旁白|天青走在你左手边，吉他包斜挎在背上，一边走一边用指尖在空气里敲着刚改好的副歌节拍。>',
      '        <天青|比较高兴|「今天副歌那段终于对上了！你听到没有，最后那个转音，我自己都起鸡皮疙瘩了。」>',
      '        <天青|得意|「所以作为奖励，今天的可丽饼要加双份奶油。这是制作人的义务。」>',
      '        <旁白|她的话还没说完，前面喷泉广场的方向忽然响起一阵掌声，夹着几声孩子的惊呼。>',
      '        <旁白|半圆形的人群中间，支着一只贴满旅行贴纸的旧皮箱。皮箱旁边，一个戴高顶礼帽、穿黑色燕尾礼服的金发女孩把一叠扑克牌抛向空中——五十二张牌像一群白鸽散开，又在她掌心里落成整整齐齐的一摞。>',
      '        <登场|祈语:自信>',
      '        <祈语|自信|「谢谢，谢谢诸位！那么，今天的最后一个奇迹——」>',
      '        <旁白|她的天蓝色眼睛扫过人群，像在找什么东西。扫到你的时候，停住了。>',
      '        <祈语|惊讶|（……咦？这个味道……）>',
      '        <旁白|她的鼻尖轻轻抽动了两下，眉头皱起来又松开，然后整张脸亮了起来，像是有人在她身后点亮了一整排路灯。>',
      '        <祈语|星星眼|「就是你了！那边那位——对，就是你！」>',
      '        <旁白|人群齐刷刷地回过头。天青的脚步顿住了，她看了看那个金发女孩，又看了看你，眨了两下眼睛。>',
      '        <天青|疑问|「……她在叫你？」>',
      '        <旁白|金发女孩已经小跑过来了，礼靴在石砖上敲出清脆的声响。她在你面前站定，仰起脸，凑近了一点，又凑近了一点。>',
      '        <祈语|沉醉|（好香……好香好香。像是刚出炉的面包房，像是有什么很棒很棒的事情马上就要发生——）>',
      '        <祈语|开心|「恭喜你成为今天的幸运观众！我是奇迹师祈语，祈求的祈，语言的语——」>',
      '        <旁白|一只手横插进来，挡在你和她之间。>',
      '        <天青|警觉或察觉|「等一下。」>',
      '        <旁白|天青往前站了半步，把你挡在身后半个肩膀的位置。她仰起下巴，浅蓝色的眼睛和那双天蓝色的眼睛对上了。>',
      '        <天青|自信|「这是我的制作人。」>',
      '        <天青|得意|「不是随便哪个路过的观众哦，是我的。」>',
      '        <祈语|疑惑|「制作人？」>',
      '        <旁白|祈语歪了歪头，礼帽的帽檐跟着斜过去。她的视线在天青和你之间来回转了两圈——然后鼻尖又动了动，这次是朝着天青。>',
      '        <祈语|惊讶|「哇……你身上也有！」>',
      '        <天青|疑问|「有什么？」>',
      '        <祈语|星星眼|「奇迹的味道！不过跟这位不一样——你的是那种很亮很亮的，像是舞台灯第一次打在身上的那一秒！」>',
      '        <旁白|天青愣了一下。她大概准备好了一整套「请不要随便靠近我的制作人」的说辞，却没准备好被一个陌生人这样直白地夸奖。>',
      '        <天青|害羞|「……那、那是当然的。我可是马上就要出道的人。」>',
      '        <天青|吃醋|「但是制作人的味道是我先发现的。这一点要搞清楚。」>',
      '        <祈语|比较开心|「嗯嗯！先来后到嘛，奇迹师小姐很讲规矩的！」>',
      '        <旁白|她一边点头，一边从袖口里抽出一朵纸折的白玫瑰——然后又抽出一朵。一朵递给你，一朵递到天青面前。>',
      '        <祈语|微笑|「那就两位一起当幸运观众！买一送一，今天限定哦。」>',
      '        <旁白|天青盯着那朵纸玫瑰看了三秒，最后还是伸手接了过去，捏在指尖转了转，嘴角有一点压不住。>',
      '        <天青|俏皮|「……折得还挺好看的。」>',
      '        <天青|自信|「喂，奇迹师小姐。你刚才那个扑克牌，能不能再变一次？我想看看到底是怎么弄的。」>',
      '        <祈语|得意|「魔术师是不会说出秘密的～不过！」>',
      '        <祈语|俏皮|「如果你们请我吃那边那家店的可丽饼，我可以考虑多变几个哦？」>',
      '        <旁白|她指的，恰好是天青刚才说要加双份奶油的那一家。>',
      '        <天青|无语|「……这个人，是不是从一开始就闻到可丽饼的味道了。」>',
      '    </MilkCat_maintext>',
      '',
      '    <MilkCat_branches>',
      '        [「好吧，三份可丽饼，都加双份奶油」]',
      '        [「奇迹师……是什么职业？」]',
      '        [看着两个人互相打量的样子，忍不住笑出声]',
      '    </MilkCat_branches>',
      '',
      '    <MilkCat_snapshots>',
      '        黄昏的商业街，排练完的天青和制作人遇到街头奇迹师祈语；祈语说制作人身上有奇迹的味道，天青当场宣布「这是我的制作人」，两人各收到一朵纸玫瑰，祈语顺势要请她吃可丽饼。',
      '    </MilkCat_snapshots>',
      '',
      '    <UpdateVariable>',
      '        <MilkCat_variables>',
      "        _.set('stat_data.时间.天数', 1)",
      "        _.set('stat_data.时间.具体时间', [18, 10])",
      "        _.set('stat_data.时间.星期', '六')",
      "        _.set('stat_data.地点', '商业街')",
      "        _.set('stat_data.奇迹能量', 30)",
      '        </MilkCat_variables>',
      '    </UpdateVariable>',
      '</MilkCat>'
    ].join('\n')
  };

  window.MilkCatPacks.register({
    id: 'qiyu',
    name: '祈语',
    version: 1,
    source: D.source,
    main: '祈语',
    terms: { user: '旅伴', crowd: '大家', world: '' },
    title: { sub: 'Miracle Journey' },          // 没有单独的标题主视觉：用 cover 的背景 + 立绘
    tagline: '奇迹师 · 旅行 · 小小的奇迹',
    cover: { bg: '街区', expr: '胜利pose' },
    characters: {
      '祈语': {
        expressions: D.expressions,               // 36 种表情 / 63 张，扁平一套
        defaultExpr: '微笑',
        avatar: D.avatars['微笑'],
        avatars: D.avatars,
        color: '#ecd28e',                         // 名字颜色：浅金（她的发色）
        nai: '1girl, very long hair, light blonde hair, low bun, side locks, swept bangs, blue eyes, black top hat with blue ribbon, ' +
             'black tailcoat, white frilled shirt, black bow tie, blue gem brooch, white gloves, white pleated miniskirt, white thighhighs, black lace-up boots'
      }
    },
    scenes: SCENES,                               // 借天青包的地点
    cg: {},
    stickers: {},
    openings: (D.openings || []).concat([DUO]),
    worldbook: D.worldbook,                       // 卡里的三条（祈语 / 奇迹 / 奇迹巡游），原样
    prompts: PROMPTS,
    guestPrompts: GUEST,
    phonePrompts: PHONE,
    variables: {
      data: { 时间: { 天数: 1, 具体时间: [17, 0], 星期: '六' }, 地点: '街区', 奇迹能量: 20 },
      meta: {
        '时间.天数': { varName: '时间.天数', comment: '整数' },
        '时间.具体时间': { varName: '时间.具体时间', comment: '以[小时,分钟]的形式显示' },
        '时间.星期': { varName: '时间.星期', comment: '包含日一二三四五六' },
        '地点': { varName: '地点', comment: '参照标准地点，如无则自建地点' },
        '奇迹能量': { varName: '奇迹能量', comment: '0~100，祈语攒下的奇迹能量；攒满才能瞬间移动' }
      }
    },
    mechanics: {}
  });
})();
