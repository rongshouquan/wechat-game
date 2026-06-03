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
];

module.exports = { levels: levels };
