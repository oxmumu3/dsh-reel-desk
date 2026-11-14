// Single Source of Truth for the 8 Reel Desk Scene Kinds.
//
// Shared across:
//   1. Backend schema normalization & strict Agent validation (`lib/schema.js`)
//   2. Agent `reel_list` documentation & examples (`lib/tools.js`)
//   3. In-place single-scene copywriting rewrite (`lib/suggest.js`)
//   4. Client style picker miniature cards, inspector labels, & starter scenes (`src-client/panel-body.js`)

export const FIELD_LABELS = {
  label: '镜名',
  headline: '主标题',
  eyebrow: '小字',
  typedQuery: '输入句',
  ctaLabel: '按钮',
  footnote: '底部说明',
  asset: '截图',
  windowTitle: '窗口标题',
  caption: '说明',
  view: '取景',
  focus: '重点框',
  cursor: '光标',
  steps: '数字',
  excludedLabel: '标签引导',
  excluded: '标签',
  blocks: '模块',
  lightCardTitle: '浅卡标题',
  lightCardSub: '浅卡说明',
  lightBrickCount: '图形格数',
  darkCardEyebrow: '深卡小字',
  darkCardTitle: '深卡主句',
  darkCardBadge: '深卡状态',
  ctaPrimary: '主按钮',
  ctaSecondary: '副按钮',
  beforeLabel: '旧做法',
  fileLabel: '文件名',
  codeLines: '代码',
  badge: '徽章',
  lines: '金句',
  subline: '底行小字',
}

export const SCENE_KINDS = [
  {
    kind: 'pain-input',
    label: '一句话开场',
    fit: '适合开场',
    summary: '演用户一句大白话输入，光标逐字敲出需求并点下按钮',
    defaultSec: 3.0,
    textRewriteKeys: ['eyebrow', 'headline', 'typedQuery', 'ctaLabel', 'footnote'],
    fieldGuide: '必填 headline, typedQuery；选填 eyebrow, ctaLabel, footnote',
    starter: {
      eyebrow: '真实使用场景',
      headline: '不用先背复杂配置，直接说出你想做成的事。',
      typedQuery: '帮我盯住目录变化，每天早上汇总成一页清单',
      ctaLabel: '开始处理',
      footnote: '',
    },
    example: {
      kind: 'pain-input',
      label: '一句话开场',
      durationSec: 3.0,
      eyebrow: '告别繁琐配置',
      headline: '想让工具帮你做什么，直接说人话就够了。',
      typedQuery: '帮我盯住项目文档更新，有关键改动马上提醒我',
      ctaLabel: '立即开启',
    },
  },
  {
    kind: 'screen-shot',
    label: '真实界面特写',
    fit: '适合讲真实界面',
    summary: '把真实产品界面截图装进精致窗口，支持取景推近、框重点与光标点击',
    defaultSec: 3.4,
    textRewriteKeys: ['eyebrow', 'headline', 'windowTitle', 'caption'],
    fieldGuide: '必填 headline, asset（先调 reel_add_asset 导入工作区图片拿到文件名）；选填 eyebrow, windowTitle, caption, view({x,y,z}), focus({x,y,w,h}), cursor({x,y})（focus/cursor 为截图 0..1 归一化坐标）',
    starter: {
      eyebrow: '真实产品画面',
      headline: '在一个地方看清今天要紧的事。',
      asset: '',
      windowTitle: '产品界面',
      caption: '',
      view: { x: 0.5, y: 0, z: 1 },
      focus: null,
      cursor: null,
      coordSpace: 'image',
    },
    example: {
      kind: 'screen-shot',
      label: '真实界面特写',
      durationSec: 3.4,
      eyebrow: '真机实拍',
      headline: '改动一落盘，面板自动标出重点项。',
      asset: 'dashboard.png',
      windowTitle: 'DSH · 工作台',
      caption: '右上角状态实时同步',
      view: { x: 0.5, y: 0, z: 1 },
      focus: { x: 0.52, y: 0.18, w: 0.36, h: 0.24 },
      cursor: { x: 0.68, y: 0.3 },
    },
  },
  {
    kind: 'funnel-ticker',
    label: '数字漏斗递进',
    fit: '有真实数字才用',
    summary: '2–4 级真实数字滚动收束，只放仓库里能核实的数字',
    defaultSec: 3.2,
    textRewriteKeys: ['eyebrow', 'headline', 'excludedLabel', 'excluded'],
    fieldGuide: '必填 headline, steps（2-4 项数组，每项必填 count(数字) 与 title(文字)，选填 unit）；选填 eyebrow, excludedLabel, excluded（字符串数组，最多 4 项）',
    starter: {
      eyebrow: '层层核对筛选',
      headline: '从杂乱输入里筛出真正要处理的几件事。',
      steps: [
        { count: 120, unit: '条', title: '原始变动记录' },
        { count: 14, unit: '条', title: '和当前任务有关' },
        { count: 3, unit: '项', title: '今天需要你拍板' },
      ],
      excludedLabel: '',
      excluded: [],
    },
    example: {
      kind: 'funnel-ticker',
      label: '数字漏斗递进',
      durationSec: 3.2,
      eyebrow: '真实基准数据',
      headline: '层层过滤噪音，只把关键事项递到面前。',
      steps: [
        { count: 128, unit: '个', title: '扫描候选模块' },
        { count: 12, unit: '个', title: '通过兼容校验' },
        { count: 3, unit: '块', title: '组成最终方案' },
      ],
      excludedLabel: '已自动过滤：',
      excluded: ['版本不兼容', '缺少权限声明'],
    },
  },
  {
    kind: 'lego-snap',
    label: '三块能力拼合',
    fit: '适合讲怎么配合',
    summary: '2–3 块核心模块并排咬合，可演「待补缺口 → 已跑通」点亮过程',
    defaultSec: 3.6,
    textRewriteKeys: ['eyebrow', 'headline', 'blocks', 'ctaLabel', 'footnote'],
    fieldGuide: '必填 headline, blocks（2-3 项数组，每项必填 name 与 role，选填 status("ready"|"gap-to-solved"|"solved"), tag, solvedTag）；选填 eyebrow, ctaLabel, footnote',
    starter: {
      eyebrow: '分工协作闭环',
      headline: '三步环环相扣，把零散动作串成完整闭环。',
      blocks: [
        { name: '采集与感知', role: '监听文件与上下文变化', status: 'ready', tag: '自动运行', solvedTag: '' },
        { name: '核对与归纳', role: '比对前后差异提炼重点', status: 'ready', tag: '结构化整理', solvedTag: '' },
        { name: '确认与交付', role: '关键动作等你点头才落盘', status: 'gap-to-solved', tag: '等你确认', solvedTag: '已确认完成' },
      ],
      ctaLabel: '',
      footnote: '',
    },
    example: {
      kind: 'lego-snap',
      label: '三块能力拼合',
      durationSec: 3.6,
      eyebrow: '模块化组合',
      headline: '两块现成能力搭底，最后一步由你把关。',
      blocks: [
        { name: '本地索引器', role: '毫秒级追踪文档增删改', status: 'ready', tag: '已就绪' },
        { name: '摘要生成器', role: '按项目归类提炼变更重点', status: 'ready', tag: '已就绪' },
        { name: '每日简报投递', role: '核对无误后准时发到手机', status: 'gap-to-solved', tag: '待启用', solvedTag: '已打通' },
      ],
      ctaLabel: '立即体验',
      footnote: '所有数据均保存在本机目录',
    },
  },
  {
    kind: 'dual-showcase',
    label: '明暗双卡展示',
    fit: '适合讲明暗或前后',
    summary: '浅色卡片与深色卡片错落同屏，适合对比前后状态或日夜双主题',
    defaultSec: 3.0,
    textRewriteKeys: [
      'eyebrow',
      'headline',
      'lightCardTitle',
      'lightCardSub',
      'darkCardEyebrow',
      'darkCardTitle',
      'darkCardBadge',
      'ctaPrimary',
      'ctaSecondary',
    ],
    fieldGuide: '必填 headline（浅色卡主句）, darkCardTitle（深色卡主句）；选填 eyebrow, lightCardTitle, lightCardSub, lightBrickCount(0-24), darkCardEyebrow, darkCardBadge, ctaPrimary, ctaSecondary',
    starter: {
      eyebrow: '双视角对照',
      headline: '平时安静待在后台，有事才把重点递到眼前。',
      lightCardTitle: '日常巡检态',
      lightCardSub: '清晰呈现结构与当前进度',
      lightBrickCount: 10,
      darkCardEyebrow: '重点提醒态',
      darkCardTitle: '筛掉重复噪音，只留真正需要拍板的一条。',
      darkCardBadge: '实时同步',
      ctaPrimary: '立即试试',
      ctaSecondary: '查看详情',
    },
    example: {
      kind: 'dual-showcase',
      label: '明暗双卡展示',
      durationSec: 3.0,
      eyebrow: '清晰掌握全局',
      headline: '白天看清全局脉络，夜间聚焦核心决策。',
      lightCardTitle: '浅色工作台',
      lightCardSub: '全量事项与依赖关系一目了然',
      lightBrickCount: 12,
      darkCardEyebrow: '深色专注态',
      darkCardTitle: '自动高亮阻塞点，下一步该做什么清清楚楚。',
      darkCardBadge: '自动适配',
      ctaPrimary: '装进客户端',
      ctaSecondary: '阅读文档',
    },
  },
  {
    kind: 'code-diff',
    label: '代码与步骤卡',
    fit: '适合讲省了什么',
    summary: '上方划掉旧做法痛点，下方深色终端逐行弹出清晰代码或命令',
    defaultSec: 3.2,
    textRewriteKeys: ['eyebrow', 'headline', 'beforeLabel', 'fileLabel', 'codeLines', 'badge'],
    fieldGuide: '必填 headline, codeLines（1-6 行字符串数组）；选填 eyebrow, beforeLabel, fileLabel, badge',
    starter: {
      eyebrow: '化繁为简',
      headline: '原本要翻三处目录的事，现在合成一步。',
      fileLabel: 'workflow.sh',
      beforeLabel: '以前：手动挨个翻日志、抄路径、拼命令',
      codeLines: [
        'dsh plugin add ./my-plugin --offline',
        'dsh status --verify',
      ],
      badge: '一步到位',
    },
    example: {
      kind: 'code-diff',
      label: '代码与步骤卡',
      durationSec: 3.2,
      eyebrow: '极简接入',
      headline: '两行命令装好即用，告别手工配置。',
      beforeLabel: '旧做法：手改多处配置文件还要重启排错',
      fileLabel: 'terminal',
      codeLines: [
        'dsh plugin add @oxmumu3/dsh-dot',
        'dsh dot check --today',
      ],
      badge: '零配置启动',
    },
  },
  {
    kind: 'quote-kinetic',
    label: '金句逐行弹出',
    fit: '适合竖屏开场和收束',
    summary: '大标题配 2–4 张编号观点卡逐行弹入，节奏利落，横竖屏皆宜',
    defaultSec: 3.2,
    textRewriteKeys: ['eyebrow', 'headline', 'lines', 'footnote'],
    fieldGuide: '必填 headline, lines（1-4 句字符串数组）；选填 eyebrow, footnote',
    starter: {
      eyebrow: '核心亮点',
      headline: '把零碎的变化收成一页清楚的结论。',
      lines: [
        '自己盯着资料变化，不用人惦记',
        '和手头有关的事才出声提醒',
        '改完当场预览，满意再发出去',
      ],
      footnote: '',
    },
    example: {
      kind: 'quote-kinetic',
      label: '金句逐行弹出',
      durationSec: 3.2,
      eyebrow: '为什么顺手',
      headline: '好工具不抢方向盘，只在关键处托你一把。',
      lines: [
        '本地资料变动毫秒级感知',
        '结合上下文筛掉无关打扰',
        '重要决定永远留给你拍板',
      ],
      footnote: 'DeepSeek Harness 生态插件',
    },
  },
  {
    kind: 'end-cta',
    label: '片尾行动号召',
    fit: '适合结尾',
    summary: '居中收束核心价值，突出醒目行动按钮与仓库或安装命令',
    defaultSec: 2.5,
    textRewriteKeys: ['badge', 'headline', 'ctaLabel', 'subline'],
    fieldGuide: '必填 headline, ctaLabel；选填 badge, subline',
    starter: {
      eyebrow: '',
      badge: '',
      headline: '装进客户端，打开侧栏就能直接用。',
      ctaLabel: '现在装上试试',
      subline: '',
    },
    example: {
      kind: 'end-cta',
      label: '片尾行动号召',
      durationSec: 2.5,
      badge: 'DeepSeek Harness 插件',
      headline: '现在装进工作台，让它替你盯住每一处关键变化。',
      ctaLabel: '打开侧栏立即体验',
      subline: 'github.com/oxmumu3',
    },
  },
]

export const PRIMITIVE_KINDS = SCENE_KINDS.map(item => item.kind)

export const KIND_BY_ID = Object.fromEntries(SCENE_KINDS.map(item => [item.kind, item]))
export const KIND_LABELS = Object.fromEntries(SCENE_KINDS.map(item => [item.kind, item.label]))
export const KIND_FITS = Object.fromEntries(SCENE_KINDS.map(item => [item.kind, item.fit]))
export const KIND_SUMMARIES = Object.fromEntries(SCENE_KINDS.map(item => [item.kind, item.summary]))

function deepClone(val) {
  return JSON.parse(JSON.stringify(val))
}

export function createKindStarterScene(kind, index = 0, fps = 60, prevScene = null) {
  const def = KIND_BY_ID[kind] || SCENE_KINDS[0]
  const safeFps = Number(fps) === 30 ? 30 : 60
  const starter = deepClone(def.starter)
  const durationSec = prevScene && Number.isFinite(Number(prevScene.durationSec)) && Number(prevScene.durationSec) > 0
    ? Number(prevScene.durationSec)
    : def.defaultSec
  const durationInFrames = Math.max(15, Math.round(durationSec * safeFps))

  const prevDefaultLabel = prevScene ? KIND_LABELS[prevScene.kind] : ''
  const nextLabel = prevScene && prevScene.label && prevScene.label !== prevDefaultLabel
    ? prevScene.label
    : def.label

  const base = {
    id: (prevScene && prevScene.id) || `scene-${index + 1}`,
    rev: (prevScene && Number.isInteger(prevScene.rev)) ? prevScene.rev : 1,
    kind: def.kind,
    label: nextLabel,
    durationSec: Number((durationInFrames / safeFps).toFixed(2)),
    durationInFrames,
    ...starter,
  }

  if (prevScene) {
    if (typeof prevScene.headline === 'string' && prevScene.headline.trim()) {
      base.headline = prevScene.headline
    }
    if (typeof prevScene.eyebrow === 'string') {
      base.eyebrow = prevScene.eyebrow
    }
    if (def.kind === 'screen-shot') {
      base.asset = ''
      base.view = { x: 0.5, y: 0, z: 1 }
      base.focus = null
      base.cursor = null
      base.coordSpace = 'image'
    }
  }

  return base
}
