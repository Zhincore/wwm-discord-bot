/** Role list entry. */
export interface RoleInfo {
  roleId: string;
  roleName: string;
  roleAvatar: string | null;
  bodyType: number | null;
}
/** Full role info; numeric keys in records are game-data ids. */
export interface RoleDetails extends RoleInfo {
  roleAvatar: string;
  bodyType: 0 | 1;
  /** Days since creation. */
  crDay: number;
  level: number;
  /** Seconds. */
  onlineTime: number;
  /** Unix seconds. */
  createTime: number;
  school: number;
  bg: number;
  maxXiuWeiKungFu: number;
  xiuWeiKungFu: number;
  fashionScore: number;
  kongfuMain: number;
  kongfuSub: number;
  passiveSlots: number[];
  /** Battle quality tier → count. */
  battleQs: Record<string, number>;
  /** Equip slot → equip id. */
  wearEquips: Record<string, number>;
  wearEquipsDetailed: Record<string, WornEquip>;
  [score: `scores${number}`]: number;
}

export interface WornEquip {
  /** numeric id */
  no: string;
  exVo: {
    durability: number;
    suffix: number;
    baseAttrs: Record<string, number>;
    baseAffixes: { equipmentDetails: EquipmentAffix }[];
  };
}

/** `[affixId, value, roll (0–1), tier, flag]` */
export type EquipmentAffix = [
  id: number,
  value: number,
  roll: number,
  tier: number,
  original: boolean,
];
