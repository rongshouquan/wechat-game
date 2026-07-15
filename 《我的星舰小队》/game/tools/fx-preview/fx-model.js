"use strict";
var S7FX = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/fx-preview/model-entry.ts
  var model_entry_exports = {};
  __export(model_entry_exports, {
    S7FX_ENEMY_COLOR: () => S7FX_ENEMY_COLOR,
    S7FX_GROUP_RING: () => S7FX_GROUP_RING,
    S7FX_MASTER_SIZE: () => S7FX_MASTER_SIZE,
    S7FX_MUZZLES: () => S7FX_MUZZLES,
    S7FX_PART_RIGS: () => S7FX_PART_RIGS,
    S7FX_PILOT_OF_SHIP: () => S7FX_PILOT_OF_SHIP,
    S7FX_PIRATE_FLAG_RIG: () => S7FX_PIRATE_FLAG_RIG,
    S7FX_REF_H: () => S7FX_REF_H,
    S7FX_REF_W: () => S7FX_REF_W,
    S7FX_SHIP_COLOR: () => S7FX_SHIP_COLOR,
    S7FxPlayModel: () => S7FxPlayModel,
    s7FxVfxForProjectile: () => s7FxVfxForProjectile
  });

  // assets/scripts/core/s7/fx/S7FxCatalog.ts
  var COLOR_SHIELD = "#63B8FF";
  var ROLE_COLOR = {
    assault: "#4FC3F7",
    // 突击·青蓝系
    guard: "#3BA8A0",
    // 护卫·钢青系
    artillery: "#FF8A3D",
    // 炮击·炽橙系
    support: "#F5A8C0",
    // 支援·金粉系
    engineer: "#9C6BD4"
    // 工程·紫系
  };
  function sig(projectile, impactKind, impactSize, vLevel, impactColor) {
    return { projectile, impact: { kind: impactKind, size: impactSize, color: impactColor }, vLevel };
  }
  function proj(p) {
    return {
      count: 1,
      intervalSec: 0,
      flightSec: 0.3,
      size: 1,
      arc: 0,
      ...p
    };
  }
  var SHIP_SIGNS = {
    shp03: {
      normal: sig(proj({ shape: "bolt", color: "#4FC3F7", count: 3, intervalSec: 0.1, flightSec: 0.18, size: 0.7 }), "burst_small", 0.7, 1),
      ultimate: { ...sig(proj({ shape: "blade", color: "#4FC3F7", count: 2, intervalSec: 0.12, flightSec: 0.32, size: 1.6, arc: 0.25 }), "burst_mid", 1.3, 2), name: "\u5206\u9556" }
    },
    shp06: {
      normal: sig(proj({ shape: "ring", color: "#3BA8A0", flightSec: 0.35, size: 1.1 }), "ring_expand", 1, 1),
      ultimate: { ...sig(null, "ring_expand", 2.2, 2, "#3BA8A0"), name: "\u6012\u543C", impact: { kind: "ring_expand", size: 2.2, color: "#3BA8A0", durationSec: 0.9 } }
      // 自心钢青声波大环
    },
    shp09: {
      normal: sig(proj({ shape: "shell", color: "#FF8A3D", flightSec: 0.4, size: 1.5 }), "burst_mid", 1.3, 1),
      ultimate: { ...sig(proj({ shape: "shell", color: "#FF8A3D", flightSec: 0.55, size: 2.8, arc: 1 }), "burst_big", 2.4, 2), name: "\u8FC7\u8F7D\u8F70\u51FB" }
    },
    shp13: {
      normal: sig(proj({ shape: "bubble", color: COLOR_SHIELD, flightSec: 0.35, size: 1 }), "bubble_pop", 1, 1),
      ultimate: { ...sig(null, "bubble_pop", 1.6, 2, COLOR_SHIELD), name: "\u5723\u76FE", impact: { kind: "bubble_pop", size: 1.6, color: COLOR_SHIELD, durationSec: 2.5 } }
      // 全队罩泡·罩得住看得见
    },
    shp20: {
      normal: sig(proj({ shape: "orb", color: "#9C6BD4", flightSec: 0.38, size: 0.9 }), "burst_small", 0.8, 1),
      ultimate: { ...sig(proj({ shape: "ring", color: "#B96BE0", flightSec: 0.4, size: 1.8 }), "cage_ring", 2, 2), name: "\u529B\u573A\u7262\u7B3C", impact: { kind: "cage_ring", size: 2, color: "#B96BE0", durationSec: 2 } }
      // 牢笼罩 2 秒
    }
  };

  // assets/scripts/core/s7/fx/S7FxPlayModel.ts
  var S7FX_REF_W = 464;
  var S7FX_REF_H = 825;
  var S7FX_SHIP_COLOR = {
    shp03: "#4FC3F7",
    shp06: "#3BA8A0",
    shp09: "#FF8A3D",
    shp13: "#F5A8C0",
    shp20: "#B05CE0"
  };
  var S7FX_ENEMY_COLOR = "#C4453F";
  var S7FX_GROUP_RING = {
    shp03: "#FFA94D",
    shp06: "#63B8FF",
    shp09: "#FFE066",
    shp13: "#7FE7D0",
    shp20: "#B78CF0"
  };
  var S7FX_PILOT_OF_SHIP = {
    shp03: "pil03",
    shp06: "pil06",
    shp09: "pil09",
    shp13: "pil13",
    shp20: "pil20"
  };
  var S7FX_MUZZLES = {
    shp03: [[0, -0.41], [-0.354, 0], [0.354, 0]],
    shp06: [[0, -0.35]],
    shp09: [[-0.05, -0.44], [0.06, -0.44]],
    shp13: [[0, -0.36]],
    shp20: [[-0.27, -0.043], [0.27, -0.043]]
  };
  var MUZZLE_PLAYER_DEFAULT = [[0, -0.38]];
  var MUZZLE_ENEMY_DEFAULT = [[0, 0.36]];
  var S7FX_MASTER_SIZE = 1024;
  var S7FX_PART_RIGS = {
    shp09: [{ sprite: "ship_lieyang_part0", rect: [410, 50, 625, 270], axis: [515, 265], mode: "recoil" }],
    shp13: [{ sprite: "ship_chenxi_part0", rect: [385, 125, 630, 350], axis: [508, 345], mode: "halo" }],
    shp20: [
      { sprite: "ship_suolian_part0", rect: [140, 395, 335, 550], axis: [233, 468], mode: "spin" },
      { sprite: "ship_suolian_part1", rect: [690, 395, 885, 550], axis: [790, 468], mode: "spin2" }
    ]
  };
  var S7FX_PIRATE_FLAG_RIG = {
    sprite: "pirate_chuanzhang_flag",
    rect: [475, 40, 725, 210],
    axis: [515, 208],
    mode: "flag"
  };
  function s7FxVfxForProjectile(spec) {
    if (spec.color === "#7ED957") return { name: "vfx_heal_orb", baseAngle: 0 };
    switch (spec.shape) {
      case "bolt":
        return spec.color === "#D94A4A" ? { name: "vfx_bolt_red", baseAngle: Math.PI } : { name: "vfx_bolt_cyan", baseAngle: Math.PI };
      case "shell":
        return { name: "vfx_shell_orange", baseAngle: 0 };
      case "ring":
        return { name: "vfx_ring_teal", baseAngle: 0 };
      case "orb":
        return { name: "vfx_orb_purple", baseAngle: 0 };
      case "bubble":
        return { name: "vfx_bubble_blue", baseAngle: 0 };
      case "blade":
        return { name: "vfx_blade_cyan", baseAngle: 0 };
      default:
        return null;
    }
  }
  var PROJ_CAP = 48;
  var EMBER_CAP = 90;
  var POP_CAP = 26;
  function hash01(s, salt) {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 1e3 / 1e3;
  }
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  var S7FxPlayModel = class {
    constructor(timeline, roster, winner = "") {
      this.units = {};
      this.unitList = [];
      this.projs = [];
      this.impacts = [];
      this.bursts = [];
      this.embers = [];
      this.pops = [];
      this.t = 0;
      this.darkenT = 0;
      this.darkenDur = 0;
      this.finished = false;
      /** 胜负（收尾演出分流：胜=我方加速冲出画面上缘·负=敌方扬长而去我方冒烟淡出=总谱 §4 速度曲线）。 */
      this.winner = "";
      /** 收尾演出计时（finished 后累计；outroDone 才通知宿主收场）。 */
      this.outroT = 0;
      /** 末杀顿帧（清场最后一击=急刹+顿帧 0.22s·总谱 §4/§5）。 */
      this.freezeT = 0;
      /** V3 曲速脉冲（星光拉线+punch-zoom 0.3s·与压暗同步·总谱 §4/§5）。 */
      this.starPulseT = 0;
      /** Boss 登场推镜（1.00→1.06 约 1s·总谱 §5）。 */
      this.bossZoomT = 0;
      this.bossZoomPlayed = false;
      this.cmdIdx = 0;
      this.rng = makeRng(340853);
      this.cmds = timeline.commands;
      this.endT = timeline.durationSec + 1.5;
      this.winner = winner;
      let maxEnemyHp = 1;
      let secondEnemyHp = 0;
      let bossUnitId = "";
      for (const r of roster) {
        if (r.side !== "enemy") continue;
        if (r.maxHp > maxEnemyHp) {
          secondEnemyHp = maxEnemyHp;
          maxEnemyHp = r.maxHp;
          bossUnitId = r.unitId;
        } else if (r.maxHp > secondEnemyHp) secondEnemyHp = r.maxHp;
      }
      const hasRealBoss = secondEnemyHp <= 0 ? true : maxEnemyHp >= secondEnemyHp * 1.8;
      for (const r of roster) {
        const lay = timeline.layout[r.unitId];
        const isP = r.side === "player";
        let size = 92;
        let isBoss = false;
        if (!isP) {
          if (hasRealBoss && r.unitId === bossUnitId) {
            size = 150;
            isBoss = true;
          } else if (r.maxHp / maxEnemyHp >= 0.35) size = 78;
          else size = 54;
        }
        const u = {
          unitId: r.unitId,
          side: r.side,
          unitRef: r.unitRef,
          roleTag: r.roleTag,
          color: isP ? S7FX_SHIP_COLOR[r.unitRef] ?? ROLE_COLOR[r.roleTag] ?? "#FFE066" : S7FX_ENEMY_COLOR,
          x: (lay ? lay.at.x : 0.5) * S7FX_REF_W,
          y: (lay ? lay.at.y : 0.5) * S7FX_REF_H,
          w: size,
          h: size,
          isBoss,
          hpPct: 100,
          alive: true,
          present: isP,
          flashT: 0,
          shakeT: 0,
          recoilT: 0,
          lungeT: 0,
          spawnT: 0,
          castGlowT: 0,
          deadT: 0,
          healGlowT: 0,
          phase: hash01(r.unitId, 31) * Math.PI * 2
        };
        this.units[r.unitId] = u;
        this.unitList.push(u);
      }
    }
    restart() {
      this.t = 0;
      this.cmdIdx = 0;
      this.darkenT = 0;
      this.darkenDur = 0;
      this.finished = false;
      this.outroT = 0;
      this.freezeT = 0;
      this.starPulseT = 0;
      this.bossZoomT = 0;
      this.bossZoomPlayed = false;
      this.projs.length = 0;
      this.impacts.length = 0;
      this.bursts.length = 0;
      this.embers.length = 0;
      this.pops.length = 0;
      this.rng = makeRng(340853);
      for (const u of this.unitList) {
        u.hpPct = 100;
        u.alive = true;
        u.present = u.side === "player";
        u.flashT = 0;
        u.shakeT = 0;
        u.recoilT = 0;
        u.lungeT = 0;
        u.spawnT = 0;
        u.castGlowT = 0;
        u.deadT = 0;
        u.healGlowT = 0;
      }
    }
    /** 跳到结尾（跳过键）：快进执行全部剩余指令、清飞行物，保留终局单位态。 */
    skipToEnd() {
      while (this.cmdIdx < this.cmds.length) {
        this.exec(this.cmds[this.cmdIdx]);
        this.cmdIdx += 1;
      }
      this.t = this.endT;
      this.projs.length = 0;
      this.impacts.length = 0;
      this.bursts.length = 0;
      this.embers.length = 0;
      this.pops.length = 0;
      this.darkenT = 0;
      this.freezeT = 0;
      this.starPulseT = 0;
      this.bossZoomT = 0;
      for (const u of this.unitList) {
        u.spawnT = 0;
        if (!u.alive) u.deadT = 0;
      }
      this.finished = true;
      this.outroT = 9;
    }
    /** 推进 dt 秒（渲染层每帧调用；speed 由调用方乘进 dt）。 */
    step(dt) {
      if (dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;
      if (this.bossZoomT > 0) this.bossZoomT = Math.max(0, this.bossZoomT - dt);
      if (this.starPulseT > 0) this.starPulseT = Math.max(0, this.starPulseT - dt);
      if (this.finished) {
        this.outroT += dt;
        return;
      }
      if (this.freezeT > 0) {
        this.freezeT -= dt;
        return;
      }
      this.t += dt;
      while (this.cmdIdx < this.cmds.length && this.cmds[this.cmdIdx].tSec <= this.t) {
        this.exec(this.cmds[this.cmdIdx]);
        this.cmdIdx += 1;
      }
      for (let i = this.projs.length - 1; i >= 0; i -= 1) {
        const p = this.projs[i];
        p.age += dt;
        if (p.age >= p.flightSec + 0.02) this.projs.splice(i, 1);
      }
      for (let i = this.impacts.length - 1; i >= 0; i -= 1) {
        const im = this.impacts[i];
        im.age += dt;
        if (im.age >= im.life) this.impacts.splice(i, 1);
      }
      for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
        const b = this.bursts[i];
        b.age += dt;
        if (b.age >= b.life) {
          this.bursts.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      for (let i = this.embers.length - 1; i >= 0; i -= 1) {
        const e = this.embers[i];
        e.age += dt;
        if (e.age >= e.life) {
          this.embers.splice(i, 1);
          continue;
        }
        e.vy += 150 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.age += dt;
        if (p.age >= p.life) this.pops.splice(i, 1);
      }
      for (const u of this.unitList) {
        if (u.flashT > 0) u.flashT = Math.max(0, u.flashT - dt);
        if (u.shakeT > 0) u.shakeT = Math.max(0, u.shakeT - dt);
        if (u.recoilT > 0) u.recoilT = Math.max(0, u.recoilT - dt);
        if (u.lungeT > 0) u.lungeT = Math.max(0, u.lungeT - dt);
        if (u.spawnT > 0) u.spawnT = Math.max(0, u.spawnT - dt);
        if (u.castGlowT > 0) u.castGlowT = Math.max(0, u.castGlowT - dt);
        if (u.healGlowT > 0) u.healGlowT = Math.max(0, u.healGlowT - dt);
        if (!u.alive && u.deadT > 0) u.deadT = Math.max(0, u.deadT - dt);
      }
      if (this.darkenT > 0) this.darkenT = Math.max(0, this.darkenT - dt);
      if (this.t >= this.endT) this.finished = true;
    }
    /** V3 压暗当前 alpha（0-0.42·渲染层直接用）。 */
    darkenAlpha() {
      if (this.darkenT <= 0 || this.darkenDur <= 0) return 0;
      const dk = Math.min(1, (this.darkenDur - this.darkenT) / 0.25, this.darkenT / 0.35);
      return 0.42 * Math.max(0, dk);
    }
    /** 星流速度倍率（总谱 §4 速度情绪曲线：入场快掠/巡航/V3 拉线/末杀急刹/胜负收尾）。 */
    starSpeedK() {
      if (this.finished) return this.winner === "player" ? 3.5 : 0.6;
      if (this.freezeT > 0) return 0.05;
      if (this.starPulseT > 0) return 4.5;
      if (this.t < 0.5) return 3.2;
      return 1;
    }
    /** 星光拉线强度 0-1（V3 脉冲期星点画成长条=曲速感）。 */
    starStreakK() {
      return this.starPulseT > 0 ? this.starPulseT / 0.3 : 0;
    }
    /** 镜头缩放（总谱 §5：Boss 登场推镜 1.00→1.06 / V3 punch-zoom 1.00→1.04→1.00；
     *  同一时刻镜头动作 ≤1——Boss 推镜优先。放大方向永不露画布外。 */
    zoomScale() {
      if (this.bossZoomT > 0) {
        const k = 1 - this.bossZoomT;
        const env = k < 0.4 ? k / 0.4 : k > 0.8 ? (1 - k) / 0.2 : 1;
        return 1 + 0.06 * Math.max(0, Math.min(1, env));
      }
      if (this.starPulseT > 0) {
        const k = 1 - this.starPulseT / 0.3;
        return 1 + 0.04 * Math.sin(Math.PI * k);
      }
      return 1;
    }
    /** 收尾演出完成（渲染层此时才通知宿主开结果窗）。 */
    outroDone() {
      return this.finished && this.outroT >= 0.9;
    }
    /** 收尾纵向位移（参考像素·y 负=向上）：胜=我方依次加速冲出画面上缘；负=敌方扬长而去。 */
    outroOffsetY(u) {
      if (!this.finished || this.outroT <= 0) return 0;
      const win = this.winner === "player";
      const mover = win ? u.side === "player" : u.side === "enemy";
      if (!mover || !u.alive) return 0;
      const stagger = u.phase / (Math.PI * 2) * 0.25;
      const tt = Math.max(0, this.outroT - stagger);
      return -(tt * tt) * (win ? 1400 : 900);
    }
    /** 收尾透明度（负局我方缓缓掉队淡出=柔和不挫败；其余 1）。 */
    outroAlpha(u) {
      if (!this.finished || this.winner === "player" || u.side !== "player") return 1;
      return Math.max(0.25, 1 - this.outroT * 0.8);
    }
    /** 弹体当前位置+朝向（参考像素；含发射锚点与高抛弧）。 */
    projPose(p) {
      const k = Math.min(1, p.age / p.flightSec);
      const x0 = p.fromX + p.ox, y0 = p.fromY + p.oy;
      const x = x0 + (p.toX - x0) * k;
      const lift = (p.spec.arc || 0) * 120 * Math.sin(Math.PI * k);
      const y = y0 + (p.toY - y0) * k - lift;
      const angle = Math.atan2(p.toY - p.fromY, p.toX - p.fromX) + Math.PI / 2;
      return { x, y, angle };
    }
    muzzleOffset(unitId, shotIdx) {
      const u = this.units[unitId];
      if (!u) return [0, 0];
      const anchors = S7FX_MUZZLES[u.unitRef] ?? (u.side === "player" ? MUZZLE_PLAYER_DEFAULT : MUZZLE_ENEMY_DEFAULT);
      const a = anchors[(shotIdx || 0) % anchors.length];
      return [a[0] * u.w, a[1] * u.h];
    }
    exec(c) {
      const u = "unitId" in c ? this.units[c.unitId] : void 0;
      switch (c.kind) {
        case "spawn":
          if (u) {
            u.present = true;
            u.spawnT = 0.4;
            if (u.isBoss && !this.bossZoomPlayed) {
              this.bossZoomPlayed = true;
              this.bossZoomT = 1;
            }
          }
          break;
        case "muzzle": {
          const m = this.muzzleOffset(c.unitId, 0);
          this.impacts.push({ x: c.at.x * S7FX_REF_W + m[0], y: c.at.y * S7FX_REF_H + m[1], kind: "muzzle", size: 0.5, color: c.color, age: 0, life: 0.1 });
          if (u) u.lungeT = 0.14;
          break;
        }
        case "projectile": {
          if (this.projs.length >= PROJ_CAP) this.projs.shift();
          const m = c.srcId !== void 0 ? this.muzzleOffset(c.srcId, c.shotIdx ?? 0) : [0, 0];
          this.projs.push({
            spec: c.spec,
            fromX: c.from.x * S7FX_REF_W,
            fromY: c.from.y * S7FX_REF_H,
            toX: c.to.x * S7FX_REF_W,
            toY: c.to.y * S7FX_REF_H,
            flightSec: c.flightSec,
            age: 0,
            ox: m[0],
            oy: m[1],
            vLevel: c.vLevel
          });
          break;
        }
        case "impact": {
          const dflt = c.impact.kind === "ring_expand" || c.impact.kind === "cage_ring" ? 0.42 : c.impact.kind === "bubble_pop" ? 0.35 : 0.26;
          const life = c.impact.durationSec || dflt;
          const x = c.at.x * S7FX_REF_W, y = c.at.y * S7FX_REF_H;
          this.impacts.push({ x, y, kind: c.impact.kind, size: c.impact.size, color: c.color, age: 0, life });
          if (c.impact.kind === "burst_small" || c.impact.kind === "burst_mid" || c.impact.kind === "burst_big") {
            const n = c.impact.kind === "burst_big" ? 9 : c.impact.kind === "burst_mid" ? 6 : 3;
            for (let i = 0; i < n; i += 1) {
              const a = this.rng() * Math.PI * 2, sp = 30 + this.rng() * 70;
              this.embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 36, age: 0, life: 0.45 + this.rng() * 0.3, color: c.color, size: 1.2 + this.rng() * 1.6 });
            }
            if (this.embers.length > EMBER_CAP) this.embers.splice(0, this.embers.length - EMBER_CAP);
          }
          break;
        }
        case "unit_flash":
          if (u) u.flashT = 0.12;
          break;
        case "unit_shake":
          if (u) u.shakeT = 0.1;
          break;
        case "hp_change": {
          if (u) u.hpPct = c.hpPct;
          if (u && typeof c.delta === "number" && c.delta < 0) {
            const lane = this.pops.length % 3;
            this.pops.push({
              x: u.x + (this.rng() - 0.5) * u.w * 0.9,
              y: u.y - u.h * 0.55 - lane * 9,
              txt: String(-c.delta),
              crit: !!c.crit,
              age: 0,
              life: 0.8
            });
            if (this.pops.length > POP_CAP) this.pops.splice(0, this.pops.length - POP_CAP);
          }
          if (u && typeof c.delta === "number" && c.delta > 0) u.healGlowT = 0.35;
          break;
        }
        case "death_burst": {
          if (u) {
            u.alive = false;
            u.deadT = 0.4;
          }
          const colors = ["#FFD93D", "#FF8A3D", "#F5A8C0", "#4FC3F7", "#7ED957"];
          for (let i = 0; i < 5; i += 1) {
            const a = i / 5 * Math.PI * 2 + this.rng() * 0.5;
            this.bursts.push({ x: c.at.x * S7FX_REF_W, y: c.at.y * S7FX_REF_H, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, age: 0, life: 0.4, color: colors[i % 5], size: 3.4 });
          }
          if (u && u.side === "enemy") {
            let anyEnemyAlive = false;
            for (const other of this.unitList) {
              if (other.side === "enemy" && other.alive) {
                anyEnemyAlive = true;
                break;
              }
            }
            if (!anyEnemyAlive) this.freezeT = 0.22;
          }
          break;
        }
        case "recoil":
          if (u) {
            u.recoilT = 0.15;
            u.castGlowT = 0.55;
          }
          break;
        case "darken":
          this.darkenT = c.durationSec;
          this.darkenDur = c.durationSec;
          this.starPulseT = 0.3;
          break;
        default:
          break;
      }
    }
  };
  return __toCommonJS(model_entry_exports);
})();
