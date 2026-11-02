/**
 * Esqueleto do stickman e poses animadas. Tudo é calculado por cinemática direta a partir de ângulos,
 * em coordenadas locais (pés em y = 0, olhando para +x). Funções puras: o mesmo (modo, t) gera a mesma pose.
 */
export type CharMode = 'idle' | 'walk' | 'climb' | 'celebrate' | 'checkpoint' | 'summit';

export interface Pose {
  lean: number;
  bob: number;
  head: number;
  armN: [number, number];
  armF: [number, number];
  legN: [number, number];
  legF: [number, number];
}

type V = { x: number; y: number };
export interface Joints {
  hip: V; neck: V; shoulder: V; head: V;
  elbowN: V; handN: V; elbowF: V; handF: V;
  kneeN: V; footN: V; kneeF: V; footF: V;
  lean: number; headAngle: number;
}

const HIP = 21.5;
const TORSO = 16;
const SHOULDER = 13.5;
const NECK_HEAD = 7.4;
const UPPER = 9.5;
const FORE = 9;
const THIGH = 11;
const SHIN = 10.5;
export const HEAD_R = 6.2;

const rad = (d: number) => (d * Math.PI) / 180;
const limb = (o: V, angle: number, len: number): V => ({ x: o.x + Math.sin(rad(angle)) * len, y: o.y + Math.cos(rad(angle)) * len });

export function solve(p: Pose): Joints {
  const hip = { x: 0, y: -HIP + p.bob };
  const up = { x: Math.sin(rad(p.lean)), y: -Math.cos(rad(p.lean)) };
  const neck = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO };
  const shoulder = { x: hip.x + up.x * SHOULDER, y: hip.y + up.y * SHOULDER };
  const ha = p.lean + p.head;
  const head = { x: neck.x + Math.sin(rad(ha)) * NECK_HEAD, y: neck.y - Math.cos(rad(ha)) * NECK_HEAD };
  const elbowN = limb(shoulder, p.armN[0], UPPER);
  const handN = limb(elbowN, p.armN[0] + p.armN[1], FORE);
  const elbowF = limb(shoulder, p.armF[0], UPPER);
  const handF = limb(elbowF, p.armF[0] + p.armF[1], FORE);
  const kneeN = limb(hip, p.legN[0], THIGH);
  const footN = limb(kneeN, p.legN[0] - p.legN[1], SHIN);
  const kneeF = limb(hip, p.legF[0], THIGH);
  const footF = limb(kneeF, p.legF[0] - p.legF[1], SHIN);
  return { hip, neck, shoulder, head, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF, lean: p.lean, headAngle: ha };
}

const TAU = Math.PI * 2;

export function poseFor(mode: CharMode, t: number): Pose {
  switch (mode) {
    case 'walk': {
      const p = TAU * 1.7 * t;
      const s = Math.sin(p);
      return {
        lean: 6, bob: -1.3 * Math.abs(Math.sin(p)), head: -3,
        legN: [26 * s, 6 + 30 * Math.max(0, -Math.cos(p))],
        legF: [-26 * s, 6 + 30 * Math.max(0, Math.cos(p))],
        armN: [-24 * s, 22], armF: [24 * s, 22],
      };
    }
    case 'climb': {
      const p = TAU * 1.25 * t;
      const s = Math.sin(p);
      return {
        lean: 19, bob: -1.6 * Math.abs(Math.sin(p)), head: -14,
        legN: [16 + 30 * s, 18 + 42 * Math.max(0, -Math.cos(p))],
        legF: [16 - 30 * s, 18 + 42 * Math.max(0, Math.cos(p))],
        armN: [38 - 26 * s, 34], armF: [38 + 26 * s, 34],
      };
    }
    case 'celebrate': {
      const p = TAU * 1.5 * t;
      const jump = Math.max(0, Math.sin(p));
      return {
        lean: 0, bob: -6 * jump, head: -6,
        legN: [10, 4 + 26 * (1 - jump)], legF: [-10, 4 + 26 * (1 - jump)],
        armN: [150 + 14 * Math.sin(p * 2), -12], armF: [-150 - 14 * Math.sin(p * 2), 12],
      };
    }
    case 'checkpoint': {
      const p = TAU * t;
      return {
        lean: -2, bob: -0.6 * Math.sin(p), head: -8,
        legN: [12, 3], legF: [-12, 3],
        armN: [168, -6], armF: [-120 + 28 * Math.sin(p * 2.4), 30],
      };
    }
    case 'summit': {
      const p = TAU * 0.8 * t;
      return {
        lean: -3, bob: -0.8 * Math.sin(p), head: -12,
        legN: [14, 2], legF: [-14, 2],
        armN: [160 + 6 * Math.sin(p), -8], armF: [-155 - 6 * Math.sin(p), 8],
      };
    }
    case 'idle':
    default: {
      const p = TAU * 0.35 * t;
      const s = Math.sin(p);
      return {
        lean: 1.5, bob: 0.45 * s, head: 1.5 * Math.sin(p / 2),
        legN: [6, 2], legF: [-6, 2],
        armN: [10 + 2.5 * s, 14], armF: [-8 - 2.5 * s, 12],
      };
    }
  }
}

export const STATIC_POSE: Record<CharMode, Pose> = {
  idle: poseFor('idle', 0),
  walk: poseFor('walk', 0.1),
  climb: poseFor('climb', 0.1),
  celebrate: poseFor('celebrate', 0.17),
  checkpoint: poseFor('checkpoint', 0),
  summit: poseFor('summit', 0),
};
