/**
 * 排行榜系统 (Leaderboard System) - P5-T1 简化版
 * 
 * 功能：本地历史最佳记录，提供自我挑战动力
 * 机制：
 * 1. 追踪个人历史最佳数据
 * 2. 实时对比当前 vs 历史最佳
 * 3. 打破记录时特殊提示
 * 4. 排行榜面板展示
 * 
 * 注意：此为本地版，数据仅存储在浏览器本地
 */

const createLeaderboardSystem = ({
  st,
  buildings,
  skills,
  eventBus,
  pushLog,
  I18N,
}) => {
  const LEADERBOARD_KEY = 'personalLeaderboard';

  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // 获取或初始化排行榜数据
  const getLeaderboardData = () => {
    const saved = localStorage.getItem(LEADERBOARD_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }

    return {
      version: 1,
      records: {
        maxLifetimeGears: { value: 0, date: null },
        maxGPS: { value: 0, date: null },
        maxBuildings: { value: 0, date: null },
        maxSkillLevels: { value: 0, date: null },
        maxResearchPoints: { value: 0, date: null },
        maxTotalClicks: { value: 0, date: null },
      },
      history: [], // 历史突破记录
    };
  };

  // 保存排行榜数据
  const saveLeaderboardData = (data) => {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
  };

  // 格式化数值
  const formatValue = (key, value) => {
    switch (key) {
      case 'maxLifetimeGears':
      case 'maxGPS':
        return value >= 1e9 ? `¥${(value / 1e9).toFixed(2)}B` :
               value >= 1e6 ? `¥${(value / 1e6).toFixed(2)}M` :
               value >= 1e3 ? `¥${(value / 1e3).toFixed(2)}K` :
               `¥${Math.floor(value)}`;
      default:
        return value.toLocaleString();
    }
  };

  // 检查并更新记录
  const checkRecords = () => {
    const data = getLeaderboardData();
    const now = new Date().toISOString();
    const lang = getLang();

    const records = [
      { key: 'maxLifetimeGears', value: st.lifetimeGears, label: { zh: '历史最高资本', en: 'Max Capital' } },
      { key: 'maxGPS', value: getTotalGPS(), label: { zh: '最高产出速度', en: 'Max GPS' } },
      { key: 'maxBuildings', value: buildings.reduce((s, b) => s + b.owned, 0), label: { zh: '最多建筑数量', en: 'Max Buildings' } },
      { key: 'maxSkillLevels', value: skills.reduce((s, sk) => s + sk.level, 0), label: { zh: '最高技能等级', en: 'Max Skill Levels' } },
      { key: 'maxResearchPoints', value: st.researchPoints, label: { zh: '最多 RP', en: 'Max RP' } },
      { key: 'maxTotalClicks', value: st.totalClicks, label: { zh: '最多点击', en: 'Max Clicks' } },
    ];

    let newRecord = false;

    records.forEach(({ key, value, label }) => {
      if (value > data.records[key].value) {
        const oldValue = data.records[key].value;
        data.records[key] = { value, date: now };

        // 记录历史突破
        data.history.push({
          key,
          oldValue,
          newValue: value,
          date: now,
        });

        // 只保留最近 50 条记录
        if (data.history.length > 50) {
          data.history = data.history.slice(-50);
        }

        newRecord = true;

        // 提示新纪录
        const labelText = label[lang] || label.zh;
        pushLog(`🏆 新纪录！${labelText}: ${formatValue(key, value)}`);

        if (eventBus) {
          eventBus.emit('leaderboard:newRecord', { key, value, label: labelText });
        }
      }
    });

    if (newRecord) {
      saveLeaderboardData(data);
    }

    return newRecord;
  };

  // 渲染排行榜面板
  const renderLeaderboardPanel = () => {
    const data = getLeaderboardData();
    const lang = getLang();

    const titles = {
      zh: { title: '🏆 个人排行榜', subtitle: '历史最佳记录', current: '当前', record: '纪录' },
      en: { title: '🏆 Personal Leaderboard', subtitle: 'All-Time Best', current: 'Current', record: 'Record' },
    }[lang];

    const items = [
      { key: 'maxLifetimeGears', icon: '💰', label: { zh: '历史最高资本', en: 'Max Capital' } },
      { key: 'maxGPS', icon: '⚡', label: { zh: '最高产出速度', en: 'Max GPS' } },
      { key: 'maxBuildings', icon: '🏢', label: { zh: '最多建筑数量', en: 'Max Buildings' } },
      { key: 'maxSkillLevels', icon: '⭐', label: { zh: '最高技能等级', en: 'Max Skill Levels' } },
      { key: 'maxResearchPoints', icon: '🔬', label: { zh: '最多 RP', en: 'Max RP' } },
      { key: 'maxTotalClicks', icon: '👆', label: { zh: '最多点击', en: 'Max Clicks' } },
    ];

    const currentValues = {
      maxLifetimeGears: st.lifetimeGears,
      maxGPS: getTotalGPS(),
      maxBuildings: buildings.reduce((s, b) => s + b.owned, 0),
      maxSkillLevels: skills.reduce((s, sk) => s + sk.level, 0),
      maxResearchPoints: st.researchPoints,
      maxTotalClicks: st.totalClicks,
    };

    const rowsHtml = items.map(({ key, icon, label }) => {
      const record = data.records[key];
      const current = currentValues[key];
      const isNewRecord = current > record.value && record.value > 0;
      const isTied = current === record.value && record.value > 0;

      const labelText = label[lang] || label.zh;
      const recordStr = formatValue(key, record.value);
      const currentStr = formatValue(key, current);

      let statusHtml = '';
      if (isNewRecord) {
        statusHtml = `<span style="color: #10b981; font-weight: bold;">🔥 ${lang === 'en' ? 'NEW!' : '新纪录!'}</span>`;
      } else if (isTied) {
        statusHtml = `<span style="color: #f59e0b;">⚡ ${lang === 'en' ? 'Tied' : '持平'}</span>`;
      }

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${icon}</span>
            <span style="font-size: 13px; opacity: 0.9;">${labelText}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 500;">${currentStr} ${statusHtml}</div>
            <div style="font-size: 11px; opacity: 0.6;">${titles.record}: ${recordStr}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="leaderboard-panel" style="background: linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(124,58,237,0.9) 100%); border-radius: 12px; padding: 16px; color: white; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${titles.title}</h3>
          <span style="font-size: 11px; opacity: 0.8;">${titles.subtitle}</span>
        </div>
        <div class="leaderboard-items">
          ${rowsHtml}
        </div>
      </div>
    `;
  };

  // 渲染历史突破记录
  const renderHistoryPanel = () => {
    const data = getLeaderboardData();
    const lang = getLang();

    if (data.history.length === 0) {
      return '';
    }

    const titles = {
      zh: { title: '📈 突破历史', noRecords: '暂无突破记录' },
      en: { title: '📈 Breakthrough History', noRecords: 'No records yet' },
    }[lang];

    // 只显示最近 5 条
    const recentHistory = data.history.slice(-5).reverse();

    const historyHtml = recentHistory.map((h) => {
      const date = new Date(h.date).toLocaleDateString();
      const labelMap = {
        maxLifetimeGears: { zh: '历史最高资本', en: 'Max Capital' },
        maxGPS: { zh: '最高产出速度', en: 'Max GPS' },
        maxBuildings: { zh: '最多建筑数量', en: 'Max Buildings' },
        maxSkillLevels: { zh: '最高技能等级', en: 'Max Skill Levels' },
        maxResearchPoints: { zh: '最多 RP', en: 'Max RP' },
        maxTotalClicks: { zh: '最多点击', en: 'Max Clicks' },
      };
      const label = labelMap[h.key]?.[lang] || labelMap[h.key]?.zh || h.key;

      return `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span style="opacity: 0.8;">${label}</span>
          <span style="color: #10b981;">${formatValue(h.key, h.oldValue)} → ${formatValue(h.key, h.newValue)}</span>
        </div>
      `;
    }).join('');

    return `
      <div style="background: rgba(30,58,138,0.8); border-radius: 12px; padding: 16px; color: white; margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px;">${titles.title}</h4>
        ${historyHtml}
      </div>
    `;
  };

  // 初始化
  const init = () => {
    // 定期检查记录（每30秒）
    setInterval(() => {
      checkRecords();
    }, 30000);

    // 立即检查一次
    checkRecords();
  };

  // 重置数据
  const resetData = () => {
    localStorage.removeItem(LEADERBOARD_KEY);
  };

  return {
    init,
    checkRecords,
    renderLeaderboardPanel,
    renderHistoryPanel,
    getLeaderboardData,
    resetData,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createLeaderboardSystem };
}
