var levels = [
  {
    levelId: 1,
    name: '第 1 关',
    introText: '交换两个节点，解开红色交叉线',
    reward: 10,
    nodes: [
      { fx: 0.30, fy: 0.35, rune: '火', color: '#f97316' },
      { fx: 0.70, fy: 0.35, rune: '冰', color: '#38bdf8' },
      { fx: 0.70, fy: 0.65, rune: '雷', color: '#facc15' },
      { fx: 0.30, fy: 0.65, rune: '术', color: '#a855f7' },
    ],
    edges: [[0,1],[0,2],[1,3]],
  },
  {
    levelId: 2,
    name: '第 2 关',
    introText: '观察整体线路再行动',
    reward: 10,
    nodes: [
      { fx: 0.30, fy: 0.28, rune: '火', color: '#f97316' },
      { fx: 0.70, fy: 0.28, rune: '冰', color: '#38bdf8' },
      { fx: 0.70, fy: 0.52, rune: '雷', color: '#facc15' },
      { fx: 0.30, fy: 0.52, rune: '术', color: '#a855f7' },
      { fx: 0.50, fy: 0.75, rune: '光', color: '#34d399' },
    ],
    edges: [[0,2],[1,3],[2,4],[3,4],[0,1]],
  },
  {
    levelId: 3,
    name: '第 3 关',
    introText: '一次交换会同时影响多条线',
    reward: 15,
    nodes: [
      { fx: 0.50, fy: 0.22, rune: '影', color: '#9ca3af' },
      { fx: 0.25, fy: 0.42, rune: '火', color: '#f97316' },
      { fx: 0.75, fy: 0.42, rune: '冰', color: '#38bdf8' },
      { fx: 0.70, fy: 0.65, rune: '雷', color: '#facc15' },
      { fx: 0.30, fy: 0.65, rune: '术', color: '#a855f7' },
    ],
    edges: [[0,3],[0,4],[1,2],[3,4],[1,3]],
  },
  // ── Level 4 ──────────────────────────────────────────────────────────────
  {
    levelId: 4,
    name: '第 4 关',
    introText: '符文节点各有其力',
    reward: 20,
    nodes: [
      { fx: 0.22, fy: 0.30, rune: '火', color: '#f97316' },
      { fx: 0.72, fy: 0.26, rune: '冰', color: '#38bdf8' },
      { fx: 0.84, fy: 0.58, rune: '雷', color: '#facc15' },
      { fx: 0.50, fy: 0.78, rune: '术', color: '#a855f7' },
      { fx: 0.15, fy: 0.62, rune: '影', color: '#9ca3af' },
    ],
    edges: [[0,2],[1,4],[0,3],[1,3],[2,4],[3,4]],
  },
  // ── Level 5 ──────────────────────────────────────────────────────────────
  {
    levelId: 5,
    name: '第 5 关',
    introText: '红线越多，越需要冷静',
    reward: 20,
    nodes: [
      { fx: 0.28, fy: 0.26, rune: '火', color: '#f97316' },
      { fx: 0.74, fy: 0.26, rune: '冰', color: '#38bdf8' },
      { fx: 0.82, fy: 0.60, rune: '雷', color: '#facc15' },
      { fx: 0.18, fy: 0.65, rune: '术', color: '#a855f7' },
      { fx: 0.50, fy: 0.80, rune: '影', color: '#9ca3af' },
    ],
    edges: [[0,2],[1,3],[0,4],[2,3],[1,4],[0,1]],
  },
  // ── Level 6 ──────────────────────────────────────────────────────────────
  {
    levelId: 6,
    name: '第 6 关',
    introText: '六大符文全部觉醒',
    reward: 25,
    nodes: [
      { fx: 0.25, fy: 0.24, rune: '火', color: '#f97316' },
      { fx: 0.68, fy: 0.22, rune: '冰', color: '#38bdf8' },
      { fx: 0.85, fy: 0.54, rune: '雷', color: '#facc15' },
      { fx: 0.60, fy: 0.78, rune: '术', color: '#a855f7' },
      { fx: 0.18, fy: 0.72, rune: '影', color: '#9ca3af' },
      { fx: 0.44, fy: 0.46, rune: '光', color: '#34d399' },
    ],
    edges: [[0,2],[1,4],[0,3],[2,4],[1,3],[5,1],[5,4]],
  },
  // ── Level 7 ──────────────────────────────────────────────────────────────
  {
    levelId: 7,
    name: '第 7 关',
    introText: '先观察，再行动',
    reward: 25,
    nodes: [
      { fx: 0.20, fy: 0.26, rune: '火', color: '#f97316' },
      { fx: 0.66, fy: 0.22, rune: '冰', color: '#38bdf8' },
      { fx: 0.86, fy: 0.52, rune: '雷', color: '#facc15' },
      { fx: 0.64, fy: 0.76, rune: '术', color: '#a855f7' },
      { fx: 0.18, fy: 0.70, rune: '影', color: '#9ca3af' },
      { fx: 0.42, fy: 0.46, rune: '光', color: '#34d399' },
    ],
    edges: [[0,2],[1,4],[0,3],[2,4],[1,3],[5,0],[5,2],[3,4]],
  },
  // ── Level 8 ──────────────────────────────────────────────────────────────
  {
    levelId: 8,
    name: '第 8 关',
    introText: '你开始掌握魔网的规律',
    reward: 30,
    nodes: [
      { fx: 0.24, fy: 0.24, rune: '火', color: '#f97316' },
      { fx: 0.70, fy: 0.20, rune: '冰', color: '#38bdf8' },
      { fx: 0.88, fy: 0.50, rune: '雷', color: '#facc15' },
      { fx: 0.68, fy: 0.78, rune: '术', color: '#a855f7' },
      { fx: 0.16, fy: 0.74, rune: '影', color: '#9ca3af' },
      { fx: 0.46, fy: 0.48, rune: '光', color: '#34d399' },
    ],
    edges: [[0,2],[1,4],[0,3],[2,4],[1,3],[5,1],[5,4],[5,2],[0,1]],
  },
  // ── Level 9 ──────────────────────────────────────────────────────────────
  {
    levelId: 9,
    name: '第 9 关',
    introText: '魔网开始反噬',
    reward: 35,
    nodes: [
      { fx: 0.25, fy: 0.22, rune: '火', color: '#f97316' },
      { fx: 0.65, fy: 0.20, rune: '冰', color: '#38bdf8' },
      { fx: 0.86, fy: 0.46, rune: '雷', color: '#facc15' },
      { fx: 0.72, fy: 0.74, rune: '术', color: '#a855f7' },
      { fx: 0.28, fy: 0.76, rune: '影', color: '#9ca3af' },
      { fx: 0.14, fy: 0.48, rune: '光', color: '#34d399' },
      { fx: 0.50, fy: 0.50, rune: '火', color: '#f97316' },
    ],
    edges: [[0,2],[1,4],[0,3],[2,5],[1,5],[3,6],[4,6],[6,1],[6,2],[0,4]],
  },
  // ── Level 10 ─────────────────────────────────────────────────────────────
  {
    levelId: 10,
    name: '第 10 关',
    introText: '第一章终章——魔网之心',
    reward: 40,
    nodes: [
      { fx: 0.25, fy: 0.20, rune: '火', color: '#f97316' },
      { fx: 0.65, fy: 0.18, rune: '冰', color: '#38bdf8' },
      { fx: 0.88, fy: 0.44, rune: '雷', color: '#facc15' },
      { fx: 0.75, fy: 0.76, rune: '术', color: '#a855f7' },
      { fx: 0.30, fy: 0.80, rune: '影', color: '#9ca3af' },
      { fx: 0.12, fy: 0.50, rune: '光', color: '#34d399' },
      { fx: 0.50, fy: 0.48, rune: '冰', color: '#38bdf8' },
    ],
    edges: [[0,2],[1,4],[0,3],[2,5],[1,5],[3,6],[4,6],[6,1],[6,2],[0,4],[5,3]],
  },
];

module.exports = { levels: levels };
