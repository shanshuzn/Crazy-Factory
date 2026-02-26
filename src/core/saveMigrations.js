// 存档迁移映射：每个版本只处理本版本引入字段，避免大块条件分支难以维护。
export const SAVE_MIGRATIONS = [
  {
    toVersion: 2,
    apply(data) {
      if (data.activeOrder && typeof data.activeOrder === 'object') {
        const hasType = ['clicks', 'lifetime', 'building'].includes(data.activeOrder.type);
        const hasTarget = Number.isFinite(Number(data.activeOrder.target));
        if (!hasType || !hasTarget) data.activeOrder = null;
      }
      return data;
    }
  },
  {
    toVersion: 3,
    apply(data) {
      if (!data.prestigeBranches || typeof data.prestigeBranches !== 'object') {
        data.prestigeBranches = { legacy_manual: 0, legacy_line: 0 };
      }
      return data;
    }
  },
  {
    toVersion: 4,
    apply(data) {
      data.financeSeasonIndex = Math.max(0, Math.floor(Number(data.financeSeasonIndex) || 0));
      data.financeLeaderboard = Array.isArray(data.financeLeaderboard) ? data.financeLeaderboard : [];
      if (!data.financeAssets || typeof data.financeAssets !== 'object') {
        data.financeAssets = { bond: 0.34, equity: 0.33, derivative: 0.33 };
      }
      if (!Number.isFinite(Number(data.financeLineage))) data.financeLineage = 0;
      if (!Number.isFinite(Number(data.debugManualMult))) data.debugManualMult = 1;
      if (!Number.isFinite(Number(data.debugGpsMult))) data.debugGpsMult = 1;
      if (typeof data.debugPanelOpen !== 'boolean') data.debugPanelOpen = false;
      return data;
    }
  }
];

export function migrateSaveData(rawData, latestVersion) {
  if (!rawData || typeof rawData !== 'object') return null;
  const data = { ...rawData };
  let version = Number(data.saveVersion) || 1;

  for (const migration of SAVE_MIGRATIONS) {
    if (version < migration.toVersion) {
      migration.apply(data);
      version = migration.toVersion;
      data.saveVersion = version;
    }
  }

  if (!Number.isFinite(Number(data.overdriveUntil))) data.overdriveUntil = 0;
  if (!Number.isFinite(Number(data.overdriveCooldownUntil))) data.overdriveCooldownUntil = 0;
  if (!Number.isFinite(Number(data.overdriveActivations))) data.overdriveActivations = 0;

  if (!Number.isFinite(Number(data.saveVersion))) {
    data.saveVersion = latestVersion;
  }

  return data;
}
