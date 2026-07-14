// S7 战斗演出层（Cocos 3.8 组件 · Cocos 壳批 2026-07-14 Ron 开工令）。
//
// 职责：消费 S7FxPlayModel（纯逻辑播放态）→ 用 Sprite/Graphics/Label 画出组装 v8
//   同款完整战斗画面（轨道俯瞰板+高空投影+云絮/星流视差+签名弹道+爆点二层+
//   伤害数字+HP 条/头像徽记）。视觉蓝本 = tools/fx-preview/index.html（总谱 §4a 定案）。
//
// 结构：本组件只管节点与绘制；战斗语义在 S7FxScript（指令流）与 S7FxPlayModel
//   （播放态）两层纯 TS 里（可单测）。素材 = resources/fx/**（L78 交接批·0.8MB）。
//
// 红线：弹体节点池上限 = 模型 48 上限同步；无 shadowBlur 类高开销；不展开 Set/Map；
//   贴图缺失自动回矢量兜底（Graphics），演出层残缺不许影响流程。

import {
  _decorator, Component, Node, Sprite, SpriteFrame, Graphics, Label, Color,
  UITransform, resources, gfx, view, UIOpacity,
} from 'cc';
import { S7BattlePlayback } from '../../../core/s7/S7BattlePlayback';
import { buildS7FxScript, S7FxRefResolver } from '../../../core/s7/fx/S7FxScript';
import {
  S7FxPlayModel, S7FxRosterEntry, S7FxUnitState, S7FX_REF_W, S7FX_REF_H,
  S7FX_PART_RIGS, S7FX_PIRATE_FLAG_RIG, S7FX_MASTER_SIZE, S7FX_GROUP_RING,
  S7FX_PILOT_OF_SHIP, s7FxVfxForProjectile, S7FxPartRig,
} from '../../../core/s7/fx/S7FxPlayModel';

const { ccclass } = _decorator;

/** resources/fx 下待预载清单（子目录/资源名）。 */
const FX_ASSET_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['units', 'ship_fengshi'], ['units', 'ship_tiebi'],
  ['units', 'ship_lieyang_body'], ['units', 'ship_lieyang_part0'],
  ['units', 'ship_chenxi_body'], ['units', 'ship_chenxi_part0'],
  ['units', 'ship_suolian_body'], ['units', 'ship_suolian_part0'], ['units', 'ship_suolian_part1'],
  ['units', 'pirate_xiaobing'], ['units', 'pirate_dafu'],
  ['units', 'pirate_chuanzhang_body'], ['units', 'pirate_chuanzhang_flag'],
  ['vfx', 'vfx_bolt_cyan'], ['vfx', 'vfx_bolt_red'], ['vfx', 'vfx_shell_orange'],
  ['vfx', 'vfx_blade_cyan'], ['vfx', 'vfx_orb_purple'], ['vfx', 'vfx_ring_teal'],
  ['vfx', 'vfx_bubble_blue'], ['vfx', 'vfx_heal_orb'], ['vfx', 'vfx_explosion'],
  ['avatars', 'avatar_pil03'], ['avatars', 'avatar_pil06'], ['avatars', 'avatar_pil09'],
  ['avatars', 'avatar_pil13'], ['avatars', 'avatar_pil20'],
  ['bg', 'bg_pirate_turf'], ['bg', 'bg_mint_winter'],
  ['misc', 'grad_air'], ['misc', 'grad_sky'],
];

/** 我方舰皮资源名（body 键=unitRef）。 */
const SHIP_BODY: Record<string, string> = {
  shp03: 'ship_fengshi', shp06: 'ship_tiebi', shp09: 'ship_lieyang_body',
  shp13: 'ship_chenxi_body', shp20: 'ship_suolian_body',
};

function hexColor(hex: string, alpha = 255): Color {
  const h = (hex || '#FFFFFF').replace('#', '');
  return new Color(
    parseInt(h.slice(0, 2), 16) || 255,
    parseInt(h.slice(2, 4), 16) || 255,
    parseInt(h.slice(4, 6), 16) || 255,
    alpha,
  );
}

/** 试挂加法混合（材质态覆写）；失败=保持普通透明混合（特效图已带 alpha·观感兜底可用）。 */
function tryAdditive(sp: Sprite): void {
  try {
    const mi = sp.getMaterialInstance(0);
    if (!mi) return;
    mi.overridePipelineStates({
      blendState: {
        targets: [{
          blend: true,
          blendSrc: gfx.BlendFactor.SRC_ALPHA,
          blendDst: gfx.BlendFactor.ONE,
          blendSrcAlpha: gfx.BlendFactor.SRC_ALPHA,
          blendDstAlpha: gfx.BlendFactor.ONE,
        }],
      },
    });
  } catch (e) {
    // 兜底=普通混合（alpha 特效图不炸黑框），真机验证点之一
  }
}

interface UnitNodeRig {
  root: Node;
  body: Sprite;
  parts: Array<{ node: Node; rig: S7FxPartRig }>;
  hasSprite: boolean;
}

@ccclass('S7BattleFxLayer')
export class S7BattleFxLayer extends Component {
  /** 资源就绪（未就绪时 play 走矢量兜底皮）。 */
  static assetsReady = false;
  private static frames: Record<string, SpriteFrame> = {};
  private static loading = false;

  /** 预载全部演出资源（幂等；建议场景 onLoad 即调）。 */
  static preload(onDone?: (ok: boolean) => void): void {
    if (S7BattleFxLayer.assetsReady || S7BattleFxLayer.loading) { if (onDone) onDone(S7BattleFxLayer.assetsReady); return; }
    S7BattleFxLayer.loading = true;
    let left = FX_ASSET_NAMES.length;
    let fail = 0;
    FX_ASSET_NAMES.forEach(([dir, name]) => {
      resources.load(`fx/${dir}/${name}/spriteFrame`, SpriteFrame, (err, sf) => {
        if (!err && sf) S7BattleFxLayer.frames[name] = sf;
        else fail += 1;
        left -= 1;
        if (left === 0) {
          S7BattleFxLayer.loading = false;
          S7BattleFxLayer.assetsReady = fail === 0;
          if (onDone) onDone(S7BattleFxLayer.assetsReady);
        }
      });
    });
  }

  /** 在父节点下挂一层演出（占满 viewW×viewH·锚中心）。 */
  static mount(parent: Node): S7BattleFxLayer {
    const n = new Node('S7BattleFxLayer');
    n.layer = parent.layer; // UI 相机按 layer 位剔除——不继承=整层隐身（07-14 真机课）
    const uit = n.addComponent(UITransform);
    const vs = view.getVisibleSize();
    uit.setContentSize(vs.width, vs.height);
    parent.addChild(n);
    return n.addComponent(S7BattleFxLayer);
  }

  private model: S7FxPlayModel | null = null;
  private speed = 1;
  private playing = false;
  private onFinish: (() => void) | null = null;
  private k = 1; // 参考像素→视图像素
  private viewW = 720;
  private viewH = 1280;

  // 层节点
  private bgSprite: Sprite | null = null;
  private skyBand: Sprite | null = null;
  private cloudsG: Graphics | null = null;
  private groundG: Graphics | null = null; // 高空投影层
  private unitLayer: Node | null = null;
  private ringG: Graphics | null = null; // 施法环/落点环/牢笼/盾泡描边
  private airHaze: Sprite | null = null;
  private darkenG: Graphics | null = null;
  private fxLayer: Node | null = null; // 弹体/爆点 sprite 池
  private particleG: Graphics | null = null; // 星流/云上飘雪/余烬/星爆
  private hudG: Graphics | null = null; // HP 条
  private avatarLayer: Node | null = null;
  private popLayer: Node | null = null;

  private unitRigs: Record<string, UnitNodeRig> = {};
  private avatarNodes: Node[] = [];
  private projPool: Node[] = [];
  private impactPool: Node[] = [];
  private popPool: Node[] = [];
  private clouds: Array<{ x: number; y: number; s: number; v: number }> = [];
  private stars: Array<{ x: number; y: number; s: number; v: number }> = [];
  private shownHp: Record<string, number> = {}; // 血条显示值（非对称平滑·回涨看得见）
  private rand = (() => { let s = 0xC0C05 >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })();

  /** 开演。resolveRef=unitStatRef→{unitRef,roleTag}（Demo 侧从 runtime 表拼）。 */
  play(pb: S7BattlePlayback, resolveRef: S7FxRefResolver, opts?: { speed?: number; bg?: string; onFinish?: () => void }): void {
    const timeline = buildS7FxScript(pb, resolveRef);
    const roster: S7FxRosterEntry[] = pb.roster.map((u) => {
      const r = resolveRef(u.unitStatRef);
      return { unitId: u.unitId, side: u.side, unitRef: r.unitRef, roleTag: r.roleTag, maxHp: u.maxHp };
    });
    this.model = new S7FxPlayModel(timeline, roster, pb.winner);
    this.speed = opts?.speed ?? 1;
    this.onFinish = opts?.onFinish ?? null;
    this.buildStage(opts?.bg ?? 'bg_pirate_turf');
    this.playing = true;
  }

  setSpeed(s: number): void { this.speed = Math.max(1, s); }

  /** 跳到终局（跳过键）。 */
  skipToEnd(): void {
    if (!this.model) return;
    this.model.skipToEnd();
    this.syncFrame(0);
    this.playing = false;
    if (this.onFinish) { const f = this.onFinish; this.onFinish = null; f(); }
  }

  stopAndClear(): void {
    this.playing = false;
    this.model = null;
    this.node.removeAllChildren();
    this.node.setScale(1, 1, 1);
    this.unitRigs = {};
    this.avatarNodes = [];
    this.projPool = [];
    this.impactPool = [];
    this.popPool = [];
    this.shownHp = {};
  }

  update(dt: number): void {
    if (!this.playing || !this.model) return;
    this.model.step(dt * this.speed);
    this.syncFrame(dt);
    // 镜头（总谱 §5·根节点缩放实现·放大方向不露画布外）
    const z = this.model.zoomScale();
    this.node.setScale(z, z, 1);
    if (this.model.outroDone()) { // 收尾演出放完才收场（胜=冲出画面/负=掉队淡出）
      this.playing = false;
      if (this.onFinish) { const f = this.onFinish; this.onFinish = null; f(); }
    }
  }

  // ===== 舞台搭建 =====

  private buildStage(bgName: string): void {
    this.node.removeAllChildren();
    this.unitRigs = {};
    this.avatarNodes = [];
    this.projPool = [];
    this.impactPool = [];
    this.popPool = [];
    this.shownHp = {};
    this.node.setScale(1, 1, 1);
    const vs = view.getVisibleSize();
    this.viewW = vs.width;
    this.viewH = vs.height;
    this.k = this.viewW / S7FX_REF_W;
    this.getComponent(UITransform)?.setContentSize(this.viewW, this.viewH);

    // 舞台底（常驻深色底板：背景图万一缺失也不透出主界面）
    const baseG = this.child('base').addComponent(Graphics);
    baseG.fillColor = new Color(16, 12, 26, 255);
    baseG.rect(-this.viewW / 2, -this.viewH / 2, this.viewW, this.viewH);
    baseG.fill();
    // 背景板（轨道俯瞰·静态=总谱§4a）
    const bgN = this.child('bg');
    this.bgSprite = bgN.addComponent(Sprite);
    this.bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.setFrame(this.bgSprite, bgName);
    bgN.getComponent(UITransform)!.setContentSize(this.viewW, this.viewH);
    // 顶部深空带（渐变条拉伸）
    const skyN = this.child('sky');
    this.skyBand = skyN.addComponent(Sprite);
    this.skyBand.sizeMode = Sprite.SizeMode.CUSTOM;
    this.setFrame(this.skyBand, 'grad_sky');
    skyN.getComponent(UITransform)!.setContentSize(this.viewW, this.viewH * 0.12);
    skyN.setPosition(0, this.viewH * 0.5 - this.viewH * 0.06);
    // 云絮（Graphics·舰队与地面之间）
    this.cloudsG = this.child('clouds').addComponent(Graphics);
    this.clouds = [];
    for (let i = 0; i < 3; i += 1) {
      this.clouds.push({ x: this.rand() * S7FX_REF_W, y: (i / 3) * S7FX_REF_H + this.rand() * 90, s: 58 + this.rand() * 46, v: 26 + this.rand() * 14 });
    }
    this.stars = [];
    for (let i = 0; i < 90; i += 1) {
      this.stars.push({ x: this.rand() * S7FX_REF_W, y: this.rand() * S7FX_REF_H, s: 0.5 + this.rand() * 1.5, v: 18 + this.rand() * 30 });
    }
    // 高空投影层
    this.groundG = this.child('ground').addComponent(Graphics);
    // 单位层
    this.unitLayer = this.child('units');
    // 环层（施法/落点描边环·画单位之上）
    this.ringG = this.child('rings').addComponent(Graphics);
    // 空气透视（敌区淡雾·罩单位不罩特效）
    const hazeN = this.child('haze');
    this.airHaze = hazeN.addComponent(Sprite);
    this.airHaze.sizeMode = Sprite.SizeMode.CUSTOM;
    this.setFrame(this.airHaze, 'grad_air');
    this.airHaze.color = new Color(255, 255, 255, 26);
    hazeN.getComponent(UITransform)!.setContentSize(this.viewW, this.viewH * 0.36);
    hazeN.setPosition(0, this.viewH * 0.5 - this.viewH * 0.10 - this.viewH * 0.18);
    // V3 压暗（盖场景不盖特效）
    this.darkenG = this.child('darken').addComponent(Graphics);
    // 特效层（弹体/爆点池）+ 粒子 Graphics
    this.fxLayer = this.child('fx');
    this.particleG = this.child('particles').addComponent(Graphics);
    // HUD（血条+头像）与伤害数字
    this.hudG = this.child('hud').addComponent(Graphics);
    this.avatarLayer = this.child('avatars');
    this.popLayer = this.child('pops');

    // 单位节点
    if (this.model) {
      for (const u of this.model.unitList) this.unitRigs[u.unitId] = this.buildUnitRig(u);
      this.buildAvatars();
    }
  }

  private child(name: string): Node {
    const n = new Node(name);
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(this.viewW, this.viewH);
    this.node.addChild(n);
    return n;
  }

  private setFrame(sp: Sprite, name: string): boolean {
    const sf = S7BattleFxLayer.frames[name];
    if (sf) { sp.spriteFrame = sf; return true; }
    sp.enabled = false;
    return false;
  }

  private refToView(x: number, y: number): { x: number; y: number } {
    // 参考像素（y 向下）→ Cocos 局部坐标（中心原点·y 向上）
    return { x: (x - S7FX_REF_W / 2) * this.k, y: (S7FX_REF_H / 2 - y) * this.k };
  }

  private buildUnitRig(u: S7FxUnitState): UnitNodeRig {
    const root = new Node(`u_${u.unitId}`);
    root.layer = this.node.layer;
    root.addComponent(UITransform);
    root.addComponent(UIOpacity);
    this.unitLayer!.addChild(root);
    const bodyN = new Node('body');
    bodyN.layer = this.node.layer;
    bodyN.addComponent(UITransform);
    const body = bodyN.addComponent(Sprite);
    body.sizeMode = Sprite.SizeMode.CUSTOM;
    root.addChild(bodyN);
    const sizePx = u.w * this.k;
    // 皮肤：我方按 unitRef；敌方按尺寸阶（Boss=船长 / 大副 / 小兵）
    let bodyName = '';
    let parts: Array<{ node: Node; rig: S7FxPartRig }> = [];
    let rigs: S7FxPartRig[] = [];
    if (u.side === 'player') {
      bodyName = SHIP_BODY[u.unitRef] ?? '';
      rigs = S7FX_PART_RIGS[u.unitRef] ?? [];
    } else {
      bodyName = u.isBoss ? 'pirate_chuanzhang_body' : u.w >= 78 ? 'pirate_dafu' : 'pirate_xiaobing';
      if (u.isBoss) rigs = [S7FX_PIRATE_FLAG_RIG];
    }
    const hasSprite = bodyName !== '' && this.setFrame(body, bodyName);
    bodyN.getComponent(UITransform)!.setContentSize(sizePx, sizePx);
    if (hasSprite) {
      parts = rigs.map((rig) => {
        const pn = new Node(rig.sprite);
        pn.layer = this.node.layer;
        const put = pn.addComponent(UITransform);
        const ps = pn.addComponent(Sprite);
        ps.sizeMode = Sprite.SizeMode.CUSTOM;
        this.setFrame(ps, rig.sprite);
        // 件图=母版满幅画布：节点与 body 同尺寸，锚点设在轴心 → 旋转即绕轴
        put.setContentSize(sizePx, sizePx);
        put.setAnchorPoint(rig.axis[0] / S7FX_MASTER_SIZE, 1 - rig.axis[1] / S7FX_MASTER_SIZE);
        pn.setPosition(
          (rig.axis[0] / S7FX_MASTER_SIZE - 0.5) * sizePx,
          (0.5 - rig.axis[1] / S7FX_MASTER_SIZE) * sizePx,
        );
        root.addChild(pn);
        return { node: pn, rig };
      });
    }
    return { root, body, parts, hasSprite };
  }

  private buildAvatars(): void {
    if (!this.model || !this.avatarLayer) return;
    for (const u of this.model.unitList) {
      if (u.side !== 'player') continue;
      const pil = S7FX_PILOT_OF_SHIP[u.unitRef];
      if (!pil) continue;
      const n = new Node(`av_${u.unitId}`);
      n.layer = this.node.layer;
      n.addComponent(UITransform).setContentSize(26 * this.k * 0.5, 26 * this.k * 0.5);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      this.setFrame(sp, `avatar_${pil}`);
      n.getComponent(UITransform)!.setContentSize(17 * this.k, 17 * this.k);
      this.avatarLayer.addChild(n);
      this.avatarNodes.push(n);
      (n as unknown as { __fxUnitId: string }).__fxUnitId = u.unitId;
    }
  }

  // ===== 每帧同步 =====

  private syncFrame(dt: number): void {
    const m = this.model;
    if (!m) return;
    const t = m.t;
    this.syncBackdrop(t, dt);
    this.syncUnits(t);
    this.syncProjImpacts(t);
    this.syncParticlesAndHud(t);
    this.syncPops();
    if (this.darkenG) {
      this.darkenG.clear();
      const a = m.darkenAlpha();
      if (a > 0) {
        this.darkenG.fillColor = new Color(10, 8, 20, Math.round(a * 255));
        this.darkenG.rect(-this.viewW / 2, -this.viewH / 2, this.viewW, this.viewH);
        this.darkenG.fill();
      }
    }
  }

  private syncBackdrop(t: number, dt: number): void {
    const g = this.cloudsG;
    if (!g) return;
    g.clear();
    // 云絮（低透白·两椭圆一朵）
    for (const cl of this.clouds) {
      cl.y += cl.v * dt;
      if (cl.y - cl.s > S7FX_REF_H) { cl.y = -cl.s; cl.x = this.rand() * S7FX_REF_W; }
      const p = this.refToView(cl.x, cl.y);
      g.fillColor = new Color(255, 250, 252, 24);
      g.ellipse(p.x, p.y, cl.s * 1.5 * this.k, cl.s * 0.62 * this.k);
      g.fill();
      g.ellipse(p.x + cl.s * 0.7 * this.k, p.y - cl.s * 0.2 * this.k, cl.s * 0.9 * this.k, cl.s * 0.4 * this.k);
      g.fill();
    }
  }

  private idleOffsets(u: S7FxUnitState, t: number): { drift: number; bob: number; ox: number; oy: number; rot: number; sq: number } {
    const fwd = u.side === 'player' ? -1 : 1;
    const drift = Math.sin(t * 0.7 + u.phase * 3.1) * (u.side === 'player' ? 2.2 : 1.6);
    const bob = Math.sin(t * 2 + u.phase) * 1.9;
    let ox = 0, oy = bob;
    if (u.shakeT > 0) { ox += (this.rand() - 0.5) * 4; oy += (this.rand() - 0.5) * 4; }
    if (u.recoilT > 0) oy -= fwd * 4 * (u.recoilT / 0.15);
    if (u.lungeT > 0) oy += fwd * Math.sin((u.lungeT / 0.14) * Math.PI) * 3.5;
    if (u.spawnT > 0) oy += (u.side === 'player' ? 1 : -1) * u.spawnT * 120;
    const rot = Math.sin(t * 1.6 + u.phase) * 0.06;
    const sq = Math.sin(t * 3.1 + u.phase) * 0.024;
    return { drift, bob, ox, oy, rot, sq };
  }

  private syncUnits(t: number): void {
    const m = this.model!;
    const gg = this.groundG!;
    const rg = this.ringG!;
    gg.clear();
    rg.clear();
    for (const u of m.unitList) {
      const rig = this.unitRigs[u.unitId];
      if (!rig) continue;
      const show = u.present && (u.alive || u.deadT > 0);
      rig.root.active = show;
      if (!show) continue;
      const o = this.idleOffsets(u, t);
      const alpha = (!u.alive ? Math.max(0, u.deadT / 0.4) : 1) * m.outroAlpha(u);
      const p = this.refToView(u.x + o.drift + o.ox, u.y + o.oy + m.outroOffsetY(u));
      rig.root.setPosition(p.x, p.y);
      rig.root.angle = (-o.rot * 180) / Math.PI;
      rig.root.setScale(1 - o.sq, 1 + o.sq, 1);
      const op = rig.root.getComponent(UIOpacity);
      if (op) op.opacity = Math.round(alpha * 255);
      // 受击白闪：环层白晕覆一记（sprite tint 只能变暗不能提亮·白晕=可行近似）
      if (u.flashT > 0) {
        rg.fillColor = new Color(255, 255, 255, Math.round((u.flashT / 0.12) * 130));
        rg.ellipse(p.x, p.y, u.w * 0.46 * this.k, u.h * 0.46 * this.k);
        rg.fill();
      }
      // 高空投影（不随悬浮·总谱§4a）
      if (u.spawnT <= 0) {
        const bobK = (o.bob / 1.9 + 1) / 2;
        const sp = this.refToView(u.x + o.drift + u.w * 0.14, u.y + u.h * 0.62);
        gg.fillColor = new Color(42, 20, 48, Math.round((0.11 - bobK * 0.03) * alpha * 255));
        gg.ellipse(sp.x, sp.y, u.w * 0.26 * this.k, u.h * 0.06 * this.k);
        gg.fill();
      }
      // 切件动骨
      for (const part of rig.parts) {
        const pr = part.rig;
        if (pr.mode === 'halo') {
          part.node.angle = (-Math.sin(t * 1.8 + u.phase) * 0.07 * 180) / Math.PI;
          const base = (0.5 - pr.axis[1] / S7FX_MASTER_SIZE) * u.w * this.k;
          part.node.setPosition(part.node.position.x, base + Math.sin(t * 2.3 + u.phase) * 1.6 * this.k);
        } else if (pr.mode === 'spin' || pr.mode === 'spin2') {
          const spin = Math.sin(t * 4.2 + u.phase) * 0.12 * (pr.mode === 'spin2' ? -1 : 1);
          part.node.angle = (-spin * 180) / Math.PI;
        } else if (pr.mode === 'recoil') {
          const rec = u.lungeT > 0 ? Math.sin((u.lungeT / 0.14) * Math.PI) * 7 : 0;
          const base = (0.5 - pr.axis[1] / S7FX_MASTER_SIZE) * u.w * this.k;
          part.node.setPosition(part.node.position.x, base - rec * this.k * 0.5);
        } else if (pr.mode === 'flag') {
          part.node.angle = (-Math.sin(t * 2.1 + u.phase) * 0.09 * 180) / Math.PI;
        }
      }
      // 施法能量环（实心盘淘汰版·两圈描边外扩）
      if (u.castGlowT > 0) {
        const gk = u.castGlowT / 0.55;
        const rr = 0.55 + (1 - gk) * 0.4;
        const ccol = hexColor(u.color, Math.round(gk * 0.75 * alpha * 255));
        rg.strokeColor = ccol;
        rg.lineWidth = (5 * gk + 1.5) * this.k;
        rg.ellipse(p.x, p.y, u.w * rr * this.k, u.h * rr * this.k);
        rg.stroke();
        rg.strokeColor = hexColor(u.color, Math.round(gk * 0.35 * alpha * 255));
        rg.lineWidth = 2 * this.k;
        rg.ellipse(p.x, p.y, u.w * rr * 0.78 * this.k, u.h * rr * 0.78 * this.k);
        rg.stroke();
      }
      // 兜底皮（贴图缺失=舰色圆块·演出不许断）
      if (!rig.hasSprite) {
        rg.fillColor = hexColor(u.color, Math.round(alpha * 255));
        rg.ellipse(p.x, p.y, u.w * 0.42 * this.k, u.h * 0.42 * this.k);
        rg.fill();
      }
    }
  }

  private takeNode(pool: Node[], parent: Node, idx: number, name: string): Node {
    while (pool.length <= idx) {
      const n = new Node(`${name}_${pool.length}`);
      n.layer = this.node.layer;
      n.addComponent(UITransform);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      parent.addChild(n);
      pool.push(n);
    }
    const n = pool[idx];
    n.active = true;
    return n;
  }

  private syncProjImpacts(t: number): void {
    const m = this.model!;
    const fx = this.fxLayer!;
    const rg = this.ringG!;
    // 弹体（sprite 池·独立计数）
    let projUsed = 0;
    for (const pr of m.projs) {
      const pose = m.projPose(pr);
      const vfx = s7FxVfxForProjectile(pr.spec);
      const n = this.takeNode(this.projPool, fx, projUsed, 'proj');
      projUsed += 1;
      const sp = n.getComponent(Sprite)!;
      const p = this.refToView(pose.x, pose.y);
      n.setPosition(p.x, p.y);
      if (vfx && this.setFrame(sp, vfx.name)) {
        sp.enabled = true;
        tryAdditive(sp);
        const size = 30 * pr.spec.size * 1.8 * (pr.spec.shape === 'blade' ? 1.2 : 1) * this.k;
        n.getComponent(UITransform)!.setContentSize(size, size);
        const spinExtra = pr.spec.shape === 'blade' ? pr.age * 14 : 0;
        n.angle = (-(pose.angle - vfx.baseAngle + spinExtra) * 180) / Math.PI;
      } else {
        // 矢量兜底：舰色圆点（演出不许断）
        sp.enabled = false;
        rg.fillColor = hexColor(pr.spec.color, 230);
        rg.circle(p.x, p.y, 6 * pr.spec.size * this.k);
        rg.fill();
      }
    }
    // 爆点：burst 族=爆炸图 sprite 池；muzzle/环/泡=Graphics（几何形本来就干净）
    let impUsed = 0;
    for (const im of m.impacts) {
      const kk = im.age / im.life;
      const fadeIn = Math.min(1, im.age / 0.15);
      const fadeOut = Math.min(1, (im.life - im.age) / 0.25);
      const env = Math.max(0, Math.min(fadeIn, fadeOut));
      const p = this.refToView(im.x, im.y);
      if (im.kind === 'burst_small' || im.kind === 'burst_mid' || im.kind === 'burst_big') {
        const base = im.kind === 'burst_big' ? 30 : im.kind === 'burst_mid' ? 20 : 12;
        const n = this.takeNode(this.impactPool, fx, impUsed, 'imp');
        impUsed += 1;
        const sp = n.getComponent(Sprite)!;
        n.setPosition(p.x, p.y);
        if (this.setFrame(sp, 'vfx_explosion')) {
          sp.enabled = true;
          tryAdditive(sp);
          // burst_big 降档 1.75（V3 三连爆推镜下 2.2 过曝=预览 v2 实测）
          const mul = im.kind === 'burst_big' ? 1.75 : 2.2;
          const size = base * im.size * (1 + kk * 1.6) * mul * this.k;
          n.getComponent(UITransform)!.setContentSize(size, size);
          sp.color = new Color(255, 255, 255, Math.round(env * 235));
        } else {
          sp.enabled = false;
          rg.fillColor = hexColor(im.color, Math.round(env * 220));
          rg.circle(p.x, p.y, base * im.size * (0.6 + kk) * this.k);
          rg.fill();
        }
      } else if (im.kind === 'muzzle') {
        rg.fillColor = hexColor(im.color, Math.round(env * 255));
        rg.circle(p.x, p.y, (6 + kk * 6) * this.k);
        rg.fill();
      } else if (im.kind === 'ring_expand' || im.kind === 'cage_ring') {
        rg.strokeColor = hexColor(im.color, Math.round(env * 235));
        rg.lineWidth = (4 * (1 - kk) + 1.2) * this.k;
        rg.circle(p.x, p.y, (8 + kk * 46 * im.size) * this.k);
        rg.stroke();
        if (im.kind === 'cage_ring') {
          // 牢笼珠链：环上 6 颗光珠旋转（预览壳同款）
          const rr = (8 + kk * 46 * im.size) * this.k;
          for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * Math.PI * 2 + t * 2.4;
            rg.fillColor = hexColor(im.color, Math.round(env * 255));
            rg.circle(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 2.6 * this.k);
            rg.fill();
          }
        }
      } else if (im.kind === 'bubble_pop') {
        // 盾泡：泡体+白描边（Fresnel 简化版·真机过了再加高光弧）
        rg.fillColor = hexColor(im.color, Math.round(env * 60));
        const rr = (14 + Math.min(kk, 0.25) * 40) * im.size * this.k;
        rg.circle(p.x, p.y, rr);
        rg.fill();
        rg.strokeColor = hexColor('#FFFFFF', Math.round(env * 170));
        rg.lineWidth = 1.6 * this.k;
        rg.circle(p.x, p.y, rr);
        rg.stroke();
      }
    }
    // 收池（多余节点熄灯·不销毁）
    for (let i = projUsed; i < this.projPool.length; i += 1) this.projPool[i].active = false;
    for (let i = impUsed; i < this.impactPool.length; i += 1) this.impactPool[i].active = false;
  }

  private syncParticlesAndHud(t: number): void {
    const m = this.model!;
    const g = this.particleG!;
    const hud = this.hudG!;
    g.clear();
    hud.clear();
    // 星点流（近景大气·恒向下）：速度=情绪曲线（总谱 §4）·V3 脉冲期拉成线（曲速感）
    const spdK = m.starSpeedK();
    const streak = m.starStreakK();
    for (const s of this.stars) {
      s.y += s.v * 0.0166 * spdK;
      if (s.y > S7FX_REF_H) { s.y = -2; s.x = this.rand() * S7FX_REF_W; }
      const p = this.refToView(s.x, s.y);
      g.fillColor = new Color(255, 255, 255, streak > 0 ? 160 : 110);
      g.rect(p.x, p.y, s.s * this.k, s.s * 2.2 * (1 + streak * 5) * this.k);
      g.fill();
    }
    // 星爆碎粒+火星余烬
    for (const b of m.bursts) {
      const p = this.refToView(b.x, b.y);
      g.fillColor = hexColor(b.color, Math.round((1 - b.age / b.life) * 255));
      g.circle(p.x, p.y, b.size * this.k);
      g.fill();
    }
    for (const e of m.embers) {
      const p = this.refToView(e.x, e.y);
      g.fillColor = hexColor(e.color, Math.round((1 - e.age / e.life) * 0.85 * 255));
      g.circle(p.x, p.y, e.size * this.k);
      g.fill();
    }
    // 败局收尾：我方冒烟缓缓掉队（总谱 §4·柔和不挫败）——画在清空后免同帧被擦
    if (m.finished && m.winner !== 'player') {
      for (const u of m.unitList) {
        if (u.side !== 'player' || !u.alive || !u.present) continue;
        for (let i = 0; i < 2; i += 1) {
          const puffY = u.y + u.h * 0.42 + ((m.outroT * 40 + i * 11) % 22);
          const pp = this.refToView(u.x + Math.sin(t * 6 + u.phase + i * 2.1) * 4, puffY);
          g.fillColor = new Color(150, 150, 158, 70);
          g.circle(pp.x, pp.y, (3.2 + i * 1.6) * this.k);
          g.fill();
        }
      }
    }
    // HP 条 + 头像徽记环（我方左端头像·敌方裸条）；显示血量做非对称平滑——
    // 掉血快贴（打击感）·回血慢涨（总谱 §3.3"回涨要看得见地长"）
    for (const u of m.unitList) {
      if (!u.present || (!u.alive && u.deadT <= 0)) continue;
      const shown = this.shownHp[u.unitId] ?? u.hpPct;
      const gap = u.hpPct - shown;
      const rate = gap >= 0 ? 2.8 : 10; // 涨慢掉快
      const next = Math.abs(gap) < 0.4 ? u.hpPct : shown + gap * Math.min(1, rate * 0.0166);
      this.shownHp[u.unitId] = next;
      const barW = u.w * 0.9;
      const bx = u.x - barW / 2;
      const by = u.y - u.h * 0.62;
      const p0 = this.refToView(bx, by);
      const isP = u.side === 'player';
      hud.fillColor = new Color(14, 16, 26, 200);
      hud.rect(p0.x, p0.y, barW * this.k, 4.6 * this.k);
      hud.fill();
      hud.fillColor = isP ? new Color(88, 214, 100, 235) : new Color(214, 74, 74, 235);
      hud.rect(p0.x, p0.y, barW * this.k * Math.max(0, next) / 100, 4.6 * this.k);
      hud.fill();
      // 治疗泛绿柔光（总谱 §3.3·0.35s）
      if (u.healGlowT > 0) {
        const hk = u.healGlowT / 0.35;
        const pc = this.refToView(u.x, u.y);
        hud.strokeColor = new Color(126, 217, 87, Math.round(hk * 150));
        hud.lineWidth = 3 * this.k;
        hud.ellipse(pc.x, pc.y, u.w * 0.5 * this.k, u.h * 0.5 * this.k);
        hud.stroke();
      }
    }
    // 头像位置同步
    for (const n of this.avatarNodes) {
      const uid = (n as unknown as { __fxUnitId: string }).__fxUnitId;
      const u = m.units[uid];
      if (!u || !u.present || (!u.alive && u.deadT <= 0)) { n.active = false; continue; }
      n.active = true;
      const p = this.refToView(u.x - u.w * 0.45 - 11, u.y - u.h * 0.62 + 2.3);
      n.setPosition(p.x, p.y);
      // 徽记色环
      const ring = S7FX_GROUP_RING[u.unitRef];
      if (ring && this.hudG) {
        this.hudG.strokeColor = hexColor(ring, 255);
        this.hudG.lineWidth = 1.8 * this.k;
        this.hudG.circle(p.x, p.y, 9.4 * this.k);
        this.hudG.stroke();
      }
    }
  }

  private syncPops(): void {
    const m = this.model!;
    for (let i = 0; i < m.pops.length; i += 1) {
      const pop = m.pops[i];
      while (this.popPool.length <= i) {
        const n = new Node(`pop_${this.popPool.length}`);
        n.layer = this.node.layer;
        n.addComponent(UITransform);
        const lb = n.addComponent(Label);
        lb.fontSize = 12;
        lb.isBold = true;
        lb.enableOutline = true;
        lb.outlineWidth = 2;
        lb.outlineColor = new Color(20, 12, 28, 220);
        this.popLayer!.addChild(n);
        this.popPool.push(n);
      }
      const n = this.popPool[i];
      n.active = true;
      const lb = n.getComponent(Label)!;
      const k = pop.age / pop.life;
      const rise = 26 * (1 - (1 - k) * (1 - k));
      const p = this.refToView(pop.x, pop.y - rise);
      n.setPosition(p.x, p.y);
      lb.string = pop.txt;
      lb.fontSize = Math.round((pop.crit ? 16 : 11.5) * this.k * (pop.crit && pop.age < 0.12 ? 1 + (0.12 - pop.age) * 3 : 1));
      lb.color = pop.crit ? new Color(255, 215, 94, 255) : new Color(244, 247, 255, 255);
      const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      const op = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
      op.opacity = Math.round(Math.max(0, fade) * 255);
    }
    for (let i = 0; i < this.popPool.length; i += 1) {
      if (i >= m.pops.length) this.popPool[i].active = false;
    }
  }
}
