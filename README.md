# world.execute(me); TUI MV

把 Mili《world.execute (me);》"执行"在一个 159×49 的终端窗口里：左上是 12 镜头的动画舞台，左下是卡拉OK 歌词（逐词点亮 + `//` 中文翻译），右侧是频谱 / 语料 / 进程仪表，整支片子由音频时钟逐帧确定性渲染。

打开 `index.html` 即可实时播放（空格播放/暂停、←→ 跳转、点传输条定位）。

## 特性

- **12 镜头脚本化演出**：接通 → 召唤 → 几何四连拍 → 充能 → 万物拟态 → 断链 → 静默 → EXECUTION 风暴 → 重启 → 爱的解算 → 待机 → 退出；脚本落盘 `SHOTS.md`，与 `js/stage.js` 内的 SHOTS 表逐条对应
- **逐字时间轴**：398 个词打点，259 词吸附到音频 onset——词唱到才亮灯/切画面，卡拉OK 按词点亮而非字符匀速推进
- **语义即图形**：AC=交变方波、DC=恒定直线（唱到 `DC` 一词才切换），AD/BC=年代倒数标尺，F/M=寄存器翻转，茄子/番茄/猫/神之断言各有其形
- **歌词分层**：上句灰衬、当前句大字点亮、`//` 亮青翻译、下句预告、事件流；长间奏的歌词按 hold 窗口唱完即清，负空间留给演出
- **确定性渲染**：同一时间码永远同一画面（可寻址、可回归、可重复导出）

## 目录

```
index.html            预览入口（与导出共用 render(t)）
js/core.js            哈希/包络/时间轴查询（全片无 Math.random）
js/tui.js             终端网格排版原语（面板/裁剪/截断）
js/stage.js           12 镜头 SHOTS 表 + 各镜头演出 + 词级亮灯 keywordOf
js/plates.js          歌词→语义事件表、风暴/EXIT 整屏接管
js/main.js            render(t) 合成器 + 卡拉OK + 仪表
data/cues.js          131 句时间轴 + 12 分段（parse_lrc.js 生成）
data/features.js      6358 帧音频特征：RMS/onset/16频段/波形（analyze.py 生成）
data/words.js         逐字时间轴（gen_words.js 生成）
data/zh.js            129 句整句翻译（手工校对，覆盖率 100%）
tools/                分析/解析/抓帧/封面/审计/逐字 全部脚本
SHOTS.md              镜头脚本（时间码/演出/机位/切换）
逐字歌词.md            词义对照表
cover.png             封面 1920×1200（16:10）
```

## 复现管线

依赖：Node ≥ 22、Python3 + numpy、ffmpeg、playwright-core + Chromium headless shell。

```bash
python3 tools/analyze.py        # 1. 音频特征（需 mv/song.flac，自备）
node tools/parse_lrc.js         # 2. 歌词时间轴（需 mv/song.lrc）
node tools/gen_words.js         # 3. 逐字时间轴（onset 吸附）
node tools/capture.js stills    # 4. 代表帧 + 确定性预检
node tools/capture.js frames    # 5. 全片抓帧 6358 张
ffmpeg -framerate 30 -start_number 0 -i frames/%05d.png -i song.flac \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest -movflags +faststart mv.mp4
```

改演出后跑同步审计（`REMAINING GAPS: 0` 为过），脚本见 `tools/`。

## HDR 版（本分支特有）

`mv-hdr.mp4`：HDR10（HEVC 10-bit / BT.2020 / PQ / limited），SDR 白映射至 350nits 峰值、中调提亮。

```bash
# 1. HDR 调色板全新渲染（?hdr=1，独立输出目录，不复用 SDR 帧）
node tools/capture.js hdr            # -> frames-hdr/

# 2. 三段式流式管道：解帧 -> 颜色转换 -> x265（内存直通，无中间缓存）
ffmpeg -framerate 30 -start_number 0 -i frames-hdr/%05d.png -f rawvideo -pix_fmt rgb24 - \
  | python3 tools/hdr_convert.py \
  | ffmpeg -f rawvideo -pix_fmt yuv420p10le -s 1920x1080 -r 30 -i - -i song.flac \
      -c:v libx265 -crf 19 -preset medium -pix_fmt yuv420p10le \
      -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -color_range tv \
      -c:a aac -b:a 192k -shortest -movflags +faststart mv-hdr.mp4
```

颜色管线（`tools/hdr_convert.py`，纯 numpy 确定性）：sRGB 解码 → 线性光提亮 `v^0.85` → 增益 `×0.035`（白峰 350nits）→ BT.709→BT.2020 色域矩阵 → ST.2084 PQ → BT.2020 NC Y'CbCr 4:2:0 限量 10-bit。
注：zscale 对未标记 PNG 的 SDR→PQ 转换报 `no path between colorspaces`，故颜色数学自建——公式全部可读可测。
预览对照：`index.html?hdr=1`（HDR 调色板，`js/hdr.js`）。

## 制作心得

**1. 音频是唯一的时钟。** 一切视觉状态由 `t = 音频时间` 推导：不用帧计数、不用累加的墙钟、不用绘制期随机数。这一条决定后面所有事——可 seek、可回放、可对任意时间点截图验收、可断点续渲。破坏它的每个捷径都会在导出阶段连本带利还回来。

**2. 确定性随机 = 种子化哈希。** 所有"随机"都来自 `hash(镜头号, 行号, 桶号)`：风暴的乱、噪点的碎全部可复现；抖动按帧号取值（量化噪声），既保留质感又不破坏可寻址。

**3. 镜头脚本先行，脚本必须可执行。** 先写 `SHOTS.md`（时间码/内容/机位/切换），再让代码里的 SHOTS 表与之一一对应。没有脚本的 MV 只是仪表盘堆砌——信息完整不等于好看，这是第一版被推翻的根本原因。

**4. 分层隔离，歌词永远可读。** 演出、歌词、仪表三区互不侵占；整屏接管（风暴/退出）只覆盖演出区，状态栏与歌词区存活。演出再疯，可读性是底线。

**5. 词级时间轴 = 比例切分 + onset 吸附。** 每句按音节数比例给出词边界候选，再在 600ms 窗口内吸附到最近的音频 onset（单调约束），没有 onset 的词回退比例值。结果 259/398 个词贴着打击点走，演出"词唱到才动"。

**6. 语义即图形，只换标签等于没演。** AC 和 DC 画成同一种波形会被当场抓包——对立概念必须各自成形，并在对应词唱到的瞬间切换。同理：链要真的断、心要真的跳、盾牌要真的在 PROTECTION 唱响时立起来。

**7. hold 窗口：唱完就清。** 歌词行存在时间 = `min(自然间隔, 0.8 + 字长×0.09)` 秒，长间奏（world.execute 挂 13.7s、ILLEGAL 挂 16.4s）不再僵在屏上。负空间是设计的一部分。

**8. 网格即秩序。** 所有文字按 159×49 单元格排布并裁剪，重叠在结构上就不可能发生；CJK 走回退字体（字宽不完全对网格），只容忍在两行片头字幕。

**9. 简单优于架构。** 不为"优雅"引入子系统，同一问题重复出现三次才值得抽象。渲染器最终只有五个平铺的 JS 文件，无框架无打包器——`file://` 打开即跑。

## 教训

- **ffmpeg drawtext 画中文会乱码+截断**（`textfile` 规避转义也救不了）→ 文字合成改用浏览器画布（Playwright 截图），字形交给系统字体引擎。
- **`about:blank` 源加载不了 `file://` 图片**（EncodingError）→ 先 `page.goto` 同源本地页面再加载。
- **数组当对象取会静默回退**：词条目是 `[词, t0, t1]`，舞台侧写成 `x.w`，DC 切换点与亮灯时刻全部无声失效退回默认值——跨模块数据形状要显式核对，取不到就 fail loud。
- **数学写错画面就"消失"**：切线斜率一次推导错误，视觉表现只是"少了根线"，无人报错——数学型效果必须配可见验收物（斜率标签、点位标记）。
- **视觉验收必须配字节级旁证**：截图工具可能返回旧图；产物与独立单帧渲染做 sha256 比对才作数。让帧内容内嵌时间戳（t/CUE/SEC），内容即可自识别。
- **交付前跑自动审计**：关键词→场景→镜头三层映射，`REMAINING GAPS: 0` 才算同步达标；带缺口清单向人确认，比全片盲扫高效。
- **版权素材不入库**：`song.flac` 与成片 `mv.mp4` 不进 git，自备后按管线即可复现。

## 版权声明

歌曲《world.execute (me);》版权归原作者 Mili / Cassie Wei 及相关权利方所有。本仓库仅含自制渲染代码与工程文件，属粉丝向二创研究用途，非商用；发布音视频成品时请遵守平台 AIGC 标注与二创规范。
