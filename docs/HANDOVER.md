# 超级奶猫 · 交接文档

> 新对话接手先读 `docs/新会话交接.md`（项目背景、已定的事、协作约定、进度、下一步）。

引擎底子来自 gal 引擎（juus 独立前端）。引擎内部（提示词组装、世界书、正则、存档树、记忆、文生图、图片网络、手机端）
的来龙去脉都在 `docs/gal引擎交接（底子）.md`，这里只写超级奶猫新加和改动的部分。

## 一、整体

```
角色包（packs/<id>/data.js + pack.js）
   │  MilkCatPacks.apply(eng)
   ├─ Terms.set(称呼)                       core/terms.js
   ├─ 素材 → RESOURCE（立绘 / 背景 / CG）、PHONE_RES（头像 / 表情包）
   └─ 世界书 + 系统提示词 → 虚拟角色卡 → eng.loadCard()   （后面全走 gal 引擎原来的路）
模型输出 <MilkCat>
   │  engine.processOutput → MilkCat.split / toEvents → ScriptParser.toModules（autoJoin）
   ├─ 正文 → 舞台模块（pcg = 角色包 CG 名）
   ├─ 选项 → 最后一句的 choices
   ├─ 快照 → res.snapshot（长期记忆优先拿它拼记忆块，不发请求）
   ├─ 钩子 → res.hooks → app.js runHooks() → HOOK_APPS[app]() → 手机标记进历史（phoneOnly + hookTurn）
   └─ 变量 → MilkCat.commandsOf / applyCommands（stat_data. 前缀去掉）
```

## 二、文件

| 文件 | 干什么 |
| --- | --- |
| `core/milkcat.js` | 纯解析：`detect / split / toEvents / hooksOf / commandsOf / applyCommands / bandOf / periodOf / clockOf / rename`。`summernight_` 前缀一并认 |
| `core/packs.js` | `MilkCatPacks`：`register / list / choice / apply / buildCard / openings / initialVars / varMeta / phonePrompt / setPhonePrompt / mechanics / defaultPreset` |
| `core/terms.js` | `Terms.user / crowd / world`。引擎里所有「发给模型的称呼」都从这里取 |
| `packs/tianqing/data.js` | 生成的，别手改。`tools/build-pack-tianqing.mjs <Larimar 目录>` |
| `packs/tianqing/pack.js` | 天青配置 + 新增两条提示词（多人同台、钩子写法补充，order 205/206）+ 客串提示词（v0.3） |
| `packs/qiyu/data.js` | 生成的，别手改。`tools/build-pack-qiyu.mjs <祈语角色卡.png> <立绘清单.txt>` |
| `packs/qiyu/pack.js` | 祈语配置、她的全部提示词（主角 / 客串 / 手机）、「天青 × 祈语」同台开局 |
| `tools/unit/test-packs.mjs` | 两个包一起的单测（27 项）：跨包开局、开局要求的包、按角色取手机提示词、提示词按包存 |
| `core/ns.js` | **页面第一个脚本**。把 `window.localStorage` 换成带 `mc:` 前缀的包装（见下面「存储」） |
| `app/title.js` | 标题画面 + 选角色 / 选开局轮播的界面（`MCTitle`），玩法由 app.js「标题画面」一节通过 `MCTitle.init(hooks)` 接进来 |
| `app/title.css` | 从 Larimar `interface/stage.css` 的 `#title-screen` / `#opening-panel` 移植；视口单位全换成容器单位 cqw / cqh |
| `tools/e2e-milkcat.mjs` | 端到端（57 项）：不导文件能玩、开局、一轮、钩子、重roll、手机私聊、手机提示词、卡↔包切换、标题画面与轮播、存储隔离 |
| `tools/unit/test-milkcat.mjs` | 单测（50 项） |

## 三、改了 gal 引擎的哪些地方

- `engine.js`
  - `loadCard`：`cfg.phoneMode === 'hook'` 时不加旧的「手机内容输出规则」（[短信|…] 那套）
  - `applyUpdates`：⓪ `_.set / _.add / _.append` 命令（有 `<UpdateVariable>` 或 MilkCat 时）先于 MVU JSONPatch
  - `processOutput`：MilkCat 分支；背景时段用 `MilkCat.periodOf(vars)`（变量里的 `时间.具体时间` 钟点 → 白日 / 黄昏 / 夜晚）；
    MilkCat 不回写 `时间.时段`；结果多了 `format / snapshot / hooks`
  - `renderVars`：时间带星期和钟点
  - `memoryTick`：每轮都有快照时 `Memory.snapshotText()` 直接拼记忆块，不请求
  - `tidyRenderBlocks`：**白名单加了 MilkCat 各块和 CG**。它会删掉「单独占一行的空壳标签」，
    不加的话 `<MilkCat_hook>` 这些开合标签全被删，钩子就丢了（第一次接通时就栽在这）
- `script.js toModules`：`opt.autoJoin`（写过登场 / 退场后，没登场就开口的角色也上台）；模块带 `pcg`、`bg.name`
- `prompt.js`：`{{stat_data::路径}}` 宏（读 `o.statData`，dryRun 传 `this.vars`）、`{{producer}}` = `{{user}}`
- `phone.js`：`[趋势|分类|标题|正文]` 三段式拆开显示；默认群名「闲聊群」；提示词里的称呼走 Terms
- `opening.js`：身份 / 事件预设改成通用的（角色包可以给 `openingPresets` 覆盖）；`script()` 输出 MilkCat 格式
- `app.js`
  - 「角色包」一节：`packMode / usePacks / useCard / fillOpeningsPack / renderPacks / packColor`。
    默认用包（`mc_source`），导入酒馆卡切到卡，「改回角色包」切回
  - 「钩子 → 手机」一节：`HOOK_APPS`（line / line_group / line_call / twitter / twitch）、`runHooks(res, snap)`、
    `buildLinePrompt / parseLineMessage / parseTwitter / parseTwitch / fillAppPrompt`
  - 重roll / 撤回：`revertTurn` 摘掉 `hookTurn === 这一轮` 的手机记录；`runHooks` 生成完发现这一轮已经变了（`turnStack` 栈顶或 `vi` 变了）就丢掉结果
  - 舞台：`syncCG` 先看 `m.pcg`（角色包 CG，两种 CG 模式都铺）；名字牌用角色代表色
  - 设置新分区「手机提示词」（`mc_phone_prompts`）
  - 插画规则后面附上角色包的固定外观词
- `app/phone-inner.css`：`.av` 头像尺寸（gal 引擎里漏了，真图会按原尺寸撑满）

## 四、存储（v0.2 起和 juus 版隔开）

GitHub Pages 上同一个账号的所有仓库是同一个「源」（`tianchengztiancheng-gif.github.io`），
浏览器按源分 localStorage 和 IndexedDB。引擎来自 juus 版，键名一样，v0.1 时两边会读到对方的接口、存档、预设、正则。

- `core/ns.js` 在所有脚本之前把 `window.localStorage` 换成一个包装：`getItem('x')` 实际读 `mc:x`，
  `key(i)` / `length` / `clear()` 只看 `mc:` 开头的。引擎、界面、测试里的 `localStorage.xxx` 一行都不用改。
  换不掉（极少数浏览器）时 `MCStore.isolated === false`，退回原生，能玩但不隔离
- IndexedDB 库名 `milkcat`（juus 版是 `gal_engine`）。`core/storage.js`、`core/crash.js` 都从 `MCStore.DB` 取
- `MCStore.raw` 是原生 localStorage，只给「沿用 juus 版的接口设置」按钮用（`MCStore.importJuus()`：
  `gal_api_config / gal_api2_config / gal_imagegen / gal_imgnet`，玩家点了才复制）
- v0.1 留下的无前缀 `mc_source / mc_packs / mc_phone_prompts` 第一次打开时搬进命名空间
- **写测试注意**：Playwright 的 `addInitScript` 在 ns.js 之前跑，直接写原生 localStorage，所以要自己加前缀
  （`localStorage.setItem('mc:gal_api_config', …)`）；页面加载后 `page.evaluate` 里的 `localStorage` 已经是包装，不用加

| 键（命名空间里） | 内容 |
| --- | --- |
| `mc_source` | `"pack"` / `"card"` |
| `mc_packs` | `{ main, extra[] }` 主角包和客串包 |
| `mc_phone_prompts` | 玩家改过的手机 App 提示词 |
| 其余 | 沿用 gal 引擎（`gal_*`） |

## 五、标题画面 + 开局轮播（v0.2）

天青原版的开始界面：满幅主视觉（包里的 `title.bg`，天青是 Larimar 的 `system/主页面.png`）+ 天青色装饰框 + 右侧黑色渐变栏。
手机竖屏改成底部居中的菜单。

| 菜单 | 做什么 |
| --- | --- |
| 开始新游戏 | 接口没填 → 提示并去设置的「接口」一步；只有一个角色 → 直接开局轮播；多个角色 → 先角色轮播，「选她」后换主角包（`usePacks`），再开局轮播（有「‹ 换角色」） |
| 继续游戏 | 最近的自动存档（`renderRuns()` 的第一条，和引导页「继续上次」同一个） |
| 存档界面 | 游戏里的存读档界面（`openSaves()`），`html.mc-at-title` 时 z-index 抬到标题之上 |
| 设置界面 | 收起标题，露出原来的四步引导；左栏「‹ 返回标题画面」 |

开局轮播：包里的开局（卡面 = `coverBgId` 场景的白日图 + `coverExpr` 立绘）+ 最后一张「自定义开场」（去引导的开场一步、自定义模式）。
「开始开局」= 选中 `#opening-sel` 的那一项再调 `btn-start` 的逻辑。点中间那张卡也算确定；←/→/Enter/Esc 能用。

- 酒馆卡模式没有标题画面（`titleOn()` 要求 `packMode()`）
- 退出游戏（⏻）回标题画面；`enterGame()` 收起标题和轮播
- 手机手动转屏（整页转 90°）：title.css 用容器单位，拖拽在 title.js 里按 `m-rot-cw / ccw` 换轴
- URL 带 `?title=0` 不显示标题（老的 e2e 测试都加了它，它们直接点引导页）
- 角色包要给：`title: { bg, sub }`、`tagline`（角色轮播的副标题）、`cover: { bg: 场景名, expr: 表情 }`

## 五·五、第二个角色：祈语（v0.3）

- **数据**：`tools/build-pack-qiyu.mjs` 读角色卡（PNG 的 tEXt `ccv3` / `chara`）和立绘清单（「表情：地址」开新表情，只有地址的行是上一个表情的另一张；
  同名表情出现两次接着加，重复地址去掉）。卡里的开场白是散文，脚本按段转成 `<MilkCat>`：整段引号 = 祈语说话（套「」），整段反引号 = 心里话（套（）），
  其余旁白。每句配的表情、背景、登场位置、选项、快照、开局变量写在脚本里的 `SPEC`；表情个数和句数对不上、用了名单外的表情、
  文字里有 `| < >` 都直接报错。`data.greetings` 留着原文；单测会逐段核对原文都在剧本里。
- **配置**（`packs/qiyu/pack.js`）：称呼「旅伴」；名字色 `#ecd28e`；背景借天青包的 `scenes`（她满世界跑，背景名写「卢布尔雅那的河边小街」，ID 用 `小镇`）；
  变量 = 时间 / 地点 / **奇迹能量**（0~100，完成小奇迹 +5~15，攒满才能瞬间移动）。
  提示词分三组：`prompts`（她当主角，order 对齐天青包：-1000 变量列表 / 200 更新规则 / 201 格式 / 202 立绘 / 203 背景 / 204 APP / 205 多人同台 / 206 钩子补充）、
  `guestPrompts`（她当客串：立绘名单 + 怎么写她，order 207）、`phonePrompts`（line / call / twitter / agency；没有 twitch）。
- **天青包加了 `guestPrompts`**：原版「立绘」名单只在主角的 `prompts` 里，天青当客串时模型不知道她有哪些表情，单独给一条「天青（客串）」。
- **同台开局**：开局对象可以带 `packs: { main, extra }`。`MilkCatPacks.openings(pk)` 把别的包里点名了 pk 的同台开局也列进来（天青、祈语的列表里都有「天青 × 祈语」），
  要的包没装就不列。开演（`btn-start`）时 `MilkCatPacks.satisfies(pick.packs)` 不满足就 `usePacks()` 换包，再按 `id` 在新列表里找回同一个开局。
- **称呼跟着主角包换**：`usePacks` 里，玩家名字是空的 / 「指挥官」/ 任何一个包的默认称呼（`MilkCatPacks.allTerms()`）时换成新主角包的；玩家自己起过名字就不动。
- **手机提示词按角色**：`phonePrompt(app, who)`——`who` 所在的包有这个 App 的提示词就用它的（客串的祈语私聊用祈语的 LINE 提示词），否则主角包的。
  `fillAppPrompt(..., native)`：用的是她自己包的提示词时，不再把主角名替换成她。
  玩家改过的存在 `mc_phone_prompts` 的 `包id:App` 键里；v0.2 存的无前缀键算天青的（恢复默认时一起删）。设置 · 手机提示词里，客串包有自己的提示词时可以切着改。
- 引导页角色包卡片的头像加了 `loading="lazy"`：祈语的头像在猫箱，图床被墙时不拖住整页 `load`（e2e-imgnet 的「图床黑洞」就是卡在这）。

### 怎么加一个角色（照着祈语走一遍）

1. **数据**：写 `tools/build-pack-<id>.mjs`，从她的来源（角色卡 / 原版仓库）生成 `packs/<id>/data.js`：立绘（`{ 表情: [url] }`）、小头像、世界书（卡格式条目原样）、开局（`<MilkCat>` 剧本）。
   来源是散文的开场白，参考祈语的 `SPEC` 按段转，文字照抄。
2. **配置**：`packs/<id>/pack.js` 里 `MilkCatPacks.register({ id, name, main, terms, title, tagline, cover, characters, scenes, cg, stickers, openings, worldbook, prompts, guestPrompts, phonePrompts, variables, mechanics })`。
   `prompts` 是她当主角时的系统提示词（格式约定、立绘、背景、变量、APP、多人同台、钩子补充，order 对齐天青包）；`guestPrompts` 是她当客串时的（至少给立绘名单）。
   没有背景图就借别的包的 `scenes`。
3. **和别人同台的开局**：在她的 `openings` 里加一条带 `packs: { main, extra }` 的，两边的列表都会出现。
4. **装上**：`index.html` 里 `packs/<id>/data.js`、`pack.js`（带 `?v=`）放在 `core/packs.js` 之后、`app/title.js` 之前；`tools/smoke-test.js` 的 `FILES` 也加上。
5. **测**：`tools/unit/test-packs.mjs` 照着加她的检查（表情都在名单里、开局能解析、提示词路由）；`tools/e2e-milkcat.mjs` 的「J」一节是端到端的样子。
   标题轮播的角色数、开局数在 e2e 里是写死的，加了角色要跟着改。
6. **NOTICE**：写清来源和条款。

## 六、下一步

1. 直播间（`mechanics/livestream`）：Larimar 的 Twitch 界面（关注页、弹幕、SC、回放），现在先落成一条动态
2. 名气面板（`mechanics/idol-fame`）：读 `名气.*` 变量，不调模型
3. LINE 通话：来电 / 接通后切成立绘对话场景（现在只记「未接来电」）
4. 二级钩子（App 生成里再带钩子）、Twitter 热度衰减
5. 门面：~~标题画面、开局封面轮播~~（v0.2 做了）、边生成边演、自动播放、资源缓存；标题主视觉视频（Larimar 默认关着，没搬）、天青原版的全屏存档 DATA 页
6. ~~第二个角色到了以后：写「怎么加一个角色」的说明，用她走一遍主角 / 客串~~（v0.3：祈语，见五·五）
7. 祈语的机制：奇迹能量现在只是变量，可以做成面板（攒满时的「瞬间移动」演出）；她没有自己的背景图和 CG
