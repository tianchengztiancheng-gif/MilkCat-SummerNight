# 超级奶猫 v0.1

多人同台的角色 galgame 前端。不依赖 SillyTavern，双击 `index.html`（或打开 GitHub Pages 网址）就能玩。
**天青是第一个角色**，之后的角色以「角色包」的形式加进来，可以同台、互相在群里聊天。

取了两家的长处：

- **天青（Larimar）**：`<MilkCat>` 剧本格式（正文 / 选项 / 快照 / 手机钩子 / 变量分块写）、
  正文钩子驱动手机（LINE、Twitter、直播）、CG 区间、提示词全部可改、`{{stat_data::路径}}` 变量宏
- **juus 版 gal 引擎**：多人同台（最多 4 人，登场 / 退场）、私聊和群聊、文生图（NovelAI）、
  手机端适配（竖屏 / 横屏 / 手动转屏）、存档树 + 重roll + 撤回、长期记忆、副 API、自定义开场、图片中转

## 快速上手

1. 打开 `index.html`。第 1 步「角色」里天青已经选好，**不用导入任何文件**。
   想要更好的文风，可以导入自己的酒馆聊天补全预设（不导就用内置的最小预设）。
2. 第 2 步填接口：协议 / 地址 / 密钥 / 模型。可以另填一个「副 API」给手机用。
3. 第 3 步插画：可选，填 NovelAI 的 token 就会每轮出 1~2 张图。
4. 第 4 步挑开局（校门口 / MV企划 / 婚纱拍摄），或者用「自定义开场」自己搭，点开始。

所有设置、存档都只存在你自己的浏览器里。

## 剧本格式 `<MilkCat>`

模型每一轮按这个格式写，前端照着演（格式约定写在天青包的系统提示词里，玩家不用管）：

```
<MilkCat>
  <MilkCat_maintext>
    <背景|校园|校门口>              换背景（图片ID = 场景表里的地点）
    <登场|天青:得意|角色B:微笑>      有人走上台（最多 4 人同台）
    <天青|得意|看到没！>             有立绘的角色：名字 | 表情 | 台词
    <同学|每次都这样……>             没立绘的人 / 旁白 / 玩家：名字 | 台词
    <CG|璀璨笑容> … </CG>           包住的几句都铺这张 CG
    <退场|角色B>
  </MilkCat_maintext>
  <MilkCat_branches>[选项一][选项二]</MilkCat_branches>
  <MilkCat_snapshots>一句话总结这一轮</MilkCat_snapshots>
  <MilkCat_hook>
    <line|天青|到家后给制作人报备>                 私聊
    <line_group|事务所群|天青,角色B|讨论排练>       群聊
    <line_call|天青|打电话>  <twitter|…>  <twitch|…>
  </MilkCat_hook>
  <UpdateVariable>…<MilkCat_variables>_.set('stat_data.地点', '公园')</MilkCat_variables></UpdateVariable>
</MilkCat>
```

天青原来的 `<summernight>` 和 juus 卡的 `<Gal>` 也都认。

## 手机

正文最后的钩子决定「这一轮手机上谁冒消息」，每条钩子再用对应 App 的提示词单独生成一次
（填了副 API 就走副 API）。所以手机内容是剧情推出来的，不会乱冒；重roll 或撤回一轮，这一轮生成的手机内容一起撤。

- **LINE**：私聊（文字 + 表情包）、群聊；你在手机里给她发消息，她用 LINE 提示词回
- **Twitter**：动态 + 评论 + 趋势
- **直播**：现在先做成一条「直播回放」动态，直播间界面下一版做
- 手机 → 设置 → **手机提示词**：每个 App 的提示词都能看、能改、能恢复默认

## 角色包

一个角色一个文件夹（`packs/<id>/`），只放内容和配置，不放玩法代码：

| 文件 | 内容 |
| --- | --- |
| `data.js` | 立绘、头像、背景、CG、表情包、开局、世界书、提示词、默认变量（天青的由脚本从 Larimar 生成） |
| `pack.js` | 名字、对玩家的称呼、代表色、文生图外观词、启用哪些机制模块，以及新增的提示词 |

一次可以选一个主角包，其它包作为客串加入（主角包定开局、称呼和世界观）。
角色独有的玩法（天青的直播间、名气面板）做成「机制模块」，角色包在配置里启用，改玩法只改模块一处。

重新生成天青的数据：`node tools/build-pack-tianqing.mjs <Larimar 仓库目录>`。

## 目录

```
index.html              入口
app/                    界面（舞台、手机、设置、开场引导）与样式
core/                   引擎
  milkcat.js            <MilkCat> 格式解析、变量命令（_.set / _.add / _.append）
  packs.js              角色包：装素材、拼虚拟角色卡、开局、初始变量、手机提示词
  terms.js              称呼表（制作人 / 指挥官…，由角色包定）
  engine.js prompt.js worldbook.js script.js phone.js memory.js …   引擎主体（来自 gal 引擎）
packs/tianqing/         天青角色包
tools/                  生成脚本、测试
docs/                   交接文档
```

## 测试

```
npm i                         # 只有冒烟测试要 jsdom
node tools/unit/run-all.mjs   # 单测
node tools/smoke-test.js      # 冒烟（jsdom 跑 index.html）
node tools/e2e-milkcat.mjs . ./shots   # 端到端（需要 Playwright）
```

## 署名

天青的设定、素材、开局与提示词来自 Larimar（SummerNight Plus），经天青作者授权使用，权利归原作者。
详见 `NOTICE`。
