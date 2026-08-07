/**
 * 产业链联动系统 (Synergy System) - P6-T2
 * 
 * 功能：建筑之间的上下游加成机制
 * 机制：
 * 1. 上游建筑为下游提供原材料/服务加成
 * 2. 下游建筑为上游提供市场需求加成
 * 3. 加成实时计算，影响 GPS
 */

const createSynergySystem = ({
  buildings,
  st,
  eventBus,
  pushLog,
  I18N,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // 预计算建筑查找表（消除 calculateBuildingSynergy 内每帧 reduce 中 O(n) find 调用）
  const _bldMap = new Map(buildings.map(b => [b.id, b]));
  const _getBld = (id) => _bldMap.get(id) || null;

  // 计算单个建筑的产业链加成
  const calculateBuildingSynergy = (building) => {
    if (!building.synergy) return { totalBonus: 1.0, upstreamBonus: 0, downstreamBonus: 0, details: [] };

    let upstreamBonus = 0;
    let downstreamBonus = 0;
    const details = [];
    const lang = getLang();

    // 上游加成：根据上游建筑数量计算
    if (building.synergy.upstream && building.synergy.upstream.length > 0) {
      const upstreamCount = building.synergy.upstream.reduce((sum, upstreamId) => {
        const upstreamBuilding = _getBld(upstreamId);
        return sum + (upstreamBuilding?.owned || 0);
      }, 0);

      if (upstreamCount > 0 && building.synergy.bonusPerUpstream) {
        const bonus = upstreamCount * building.synergy.bonusPerUpstream;
        upstreamBonus = bonus;
        details.push({
          type: 'upstream',
          count: upstreamCount,
          bonus: bonus,
          label: lang === 'en' ? `From upstream: +${(bonus * 100).toFixed(0)}%` : `上游加成: +${(bonus * 100).toFixed(0)}%`,
        });
      }
    }

    // 下游加成：根据下游建筑数量计算
    if (building.synergy.downstream && building.synergy.downstream.length > 0) {
      const downstreamCount = building.synergy.downstream.reduce((sum, downstreamId) => {
        const downstreamBuilding = _getBld(downstreamId);
        return sum + (downstreamBuilding?.owned || 0);
      }, 0);

      if (downstreamCount > 0 && building.synergy.bonusPerDownstream) {
        const bonus = downstreamCount * building.synergy.bonusPerDownstream;
        downstreamBonus = bonus;
        details.push({
          type: 'downstream',
          count: downstreamCount,
          bonus: bonus,
          label: lang === 'en' ? `To downstream: +${(bonus * 100).toFixed(0)}%` : `下游加成: +${(bonus * 100).toFixed(0)}%`,
        });
      }
    }

    const totalBonus = 1 + upstreamBonus + downstreamBonus;

    return {
      totalBonus,
      upstreamBonus,
      downstreamBonus,
      details,
    };
  };

  // 计算所有建筑的总产业链加成（加权平均）
  const calculateGlobalSynergy = () => {
    let totalGPSWithSynergy = 0;
    let totalGPSWithoutSynergy = 0;

    buildings.forEach(building => {
      const baseGPS = building.owned * building.dps;
      const synergy = calculateBuildingSynergy(building);
      const gpsWithSynergy = baseGPS * synergy.totalBonus;

      totalGPSWithSynergy += gpsWithSynergy;
      totalGPSWithoutSynergy += baseGPS;
    });

    const globalMultiplier = totalGPSWithoutSynergy > 0
      ? totalGPSWithSynergy / totalGPSWithoutSynergy
      : 1.0;

    return {
      globalMultiplier,
      totalGPSWithSynergy,
      totalGPSWithoutSynergy,
    };
  };

  // 获取建筑的产业链信息（用于UI显示）
  const getBuildingSynergyInfo = (buildingId) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || !building.synergy) return null;

    return calculateBuildingSynergy(building);
  };

  // 格式化加成显示
  const formatSynergyBonus = (bonus) => {
    const percent = ((bonus - 1) * 100).toFixed(0);
    return percent > 0 ? `+${percent}%` : '0%';
  };

  // 渲染建筑产业链提示
  const renderSynergyTooltip = (buildingId) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || !building.synergy) return '';

    const lang = getLang();
    const synergy = calculateBuildingSynergy(building);

    const title = lang === 'en' ? 'Industry Chain' : '产业链联动';
    const descLabel = lang === 'en' ? 'Effect' : '效果';
    const totalLabel = lang === 'en' ? 'Total Bonus' : '总加成';

    let detailsHtml = '';
    if (synergy.details.length > 0) {
      detailsHtml = synergy.details.map(d =>
        `<div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">• ${d.label}</div>`
      ).join('');
    } else {
      const noBonus = lang === 'en' ? 'No active synergy' : '暂无产业链加成';
      detailsHtml = `<div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">${noBonus}</div>`;
    }

    return `
      <div style="background: rgba(30,58,138,0.95); border-radius: 8px; padding: 12px; color: white; max-width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #60a5fa;">🔗 ${title}</div>
        <div style="font-size: 12px; margin-bottom: 8px; opacity: 0.9; line-height: 1.4;">${building.synergy.desc}</div>
        ${detailsHtml}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 12px; font-weight: 500;">
          ${totalLabel}: ${formatSynergyBonus(synergy.totalBonus)}
        </div>
      </div>
    `;
  };

  // 渲染全局产业链统计
  const renderGlobalSynergyPanel = () => {
    const lang = getLang();
    const global = calculateGlobalSynergy();

    const title = lang === 'en' ? '🏭 Industry Chain Overview' : '🏭 产业链总览';
    const multiplierLabel = lang === 'en' ? 'Global Multiplier' : '全局加成倍率';
    const chainBonus = lang === 'en' ? 'Chain Bonus' : '产业链额外产出';

    const bonusGears = global.totalGPSWithSynergy - global.totalGPSWithoutSynergy;
    const bonusFormatted = bonusGears >= 1e9 ? `${(bonusGears / 1e9).toFixed(2)}B` :
                          bonusGears >= 1e6 ? `${(bonusGears / 1e6).toFixed(2)}M` :
                          bonusGears >= 1e3 ? `${(bonusGears / 1e3).toFixed(2)}K` :
                          Math.floor(bonusGears).toString();

    return `
      <div style="background: linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(5,150,105,0.9) 100%); border-radius: 12px; padding: 16px; color: white; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${title}</h3>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">${global.globalMultiplier.toFixed(2)}x</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">${multiplierLabel}</div>
          </div>
          <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">+${bonusFormatted}</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">${chainBonus}/s</div>
          </div>
        </div>
      </div>
    `;
  };

  // 检查是否有新的产业链加成激活
  let lastSynergyState = {};
  const checkSynergyChanges = () => {
    let hasChanges = false;

    buildings.forEach(building => {
      if (!building.synergy) return;

      const synergy = calculateBuildingSynergy(building);
      const key = building.id;

      if (lastSynergyState[key] !== synergy.totalBonus) {
        // 加成发生变化
        if (lastSynergyState[key] !== undefined && synergy.totalBonus > lastSynergyState[key]) {
          // 加成提升，触发事件
          if (eventBus) {
            eventBus.emit('synergy:activated', {
              building: building.name,
              bonus: synergy.totalBonus,
            });
          }
        }
        hasChanges = true;
      }

      lastSynergyState[key] = synergy.totalBonus;
    });

    return hasChanges;
  };

  // 初始化
  const init = () => {
    // 记录初始状态
    checkSynergyChanges();

    // 定期检查和更新（统一由 RAF 驱动，移除独立 setInterval）
    if (typeof window !== 'undefined' && window.__timerManager) window.__timerManager.schedule(checkSynergyChanges, 10000);
  };

  return {
    calculateBuildingSynergy,
    calculateGlobalSynergy,
    getBuildingSynergyInfo,
    formatSynergyBonus,
    renderSynergyTooltip,
    renderGlobalSynergyPanel,
    checkSynergyChanges,
    init,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSynergySystem };
}
