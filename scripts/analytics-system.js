/**
 * 数据分析埋点系统 (Analytics System)
 * 
 * 功能：追踪用户行为数据，为产品优化提供数据支持
 * 隐私保护：所有数据本地存储，不上传到服务器
 * 追踪内容：
 * 1. 核心游戏事件（点击、购买、升级等）
 * 2. 会话统计（时长、频次）
 * 3. 留存指标（次日、7日留存）
 * 4. 游戏进度（Lifetime Gears, Prestige 次数等）
 */

const createAnalyticsSystem = ({
  st,
  eventBus,
  enabled = true,
}) => {
  if (!enabled) {
    return { track: () => {}, getStats: () => ({}), exportData: () => {} };
  }

  const ANALYTICS_KEY = 'gameAnalytics';
  const SESSION_KEY = 'currentSession';

  // 内存缓存：只读写 localStorage 一次，track() 操作只打脏标记
  let _cache = null;
  let _dirty = false;
  let _rafId = null;

  const _schedulePersist = () => {
    if (_rafId !== null) return;
    _rafId = requestAnimationFrame(() => {
      _rafId = null;
      if (!_dirty || !_cache) return;
      _dirty = false;
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(_cache));
    });
  };

  // 获取或初始化分析数据（内存优先）
  const getAnalyticsData = () => {
    if (_cache) return _cache;
    const saved = localStorage.getItem(ANALYTICS_KEY);
    if (saved) {
      try { _cache = JSON.parse(saved); return _cache; } catch {}
    }
    _cache = {
      version: 1,
      firstVisit: Date.now(),
      totalSessions: 0,
      totalPlayTime: 0,
      events: {
        manualClicks: 0,
        buildingsPurchased: 0,
        upgradesPurchased: 0,
        skillsUpgraded: 0,
        prestiges: 0,
        marketSwitches: 0,
        dailyQuestsCompleted: 0,
      },
      milestones: {
        first1K: null,
        first10K: null,
        first100K: null,
        first1M: null,
        first1B: null,
      },
      dailyStats: {},
      retention: { day1: null, day7: null },
    };
    return _cache;
  };

  // 标记脏，延迟写入（不再每事件一次 localStorage）
  const _markDirty = () => {
    _dirty = true;
    _schedulePersist();
  };

  // 获取当前会话数据
  const getSessionData = () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  };

  // 开始新会话
  const startSession = () => {
    const session = {
      startTime: Date.now(),
      events: {
        manualClicks: 0,
        buildingsPurchased: 0,
        upgradesPurchased: 0,
        skillsUpgraded: 0,
      },
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    const data = getAnalyticsData();
    data.totalSessions++;
    checkRetention(data);
    _markDirty();

    return session;
  };

  // 结束会话
  const endSession = () => {
    const session = getSessionData();
    if (!session) return;

    const endTime = Date.now();
    const duration = Math.floor((endTime - session.startTime) / 1000);

    const data = getAnalyticsData();
    data.totalPlayTime += duration;

    const date = new Date().toISOString().split('T')[0];
    // 30 天过期清理
    const cutoff = Date.now() - 30 * 86400000;
    for (const k of Object.keys(data.dailyStats)) {
      if (k < date && new Date(k).getTime() < cutoff) delete data.dailyStats[k];
    }
    if (!data.dailyStats[date]) {
      data.dailyStats[date] = { sessions: 0, playTime: 0, events: {} };
    }
    data.dailyStats[date].sessions++;
    data.dailyStats[date].playTime += duration;

    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_dirty && _cache) localStorage.setItem(ANALYTICS_KEY, JSON.stringify(_cache));
    localStorage.removeItem(SESSION_KEY);
  };

  // 检查留存指标
  const checkRetention = (data) => {
    const firstVisit = data.firstVisit;
    const now = Date.now();
    const daysSinceFirst = Math.floor((now - firstVisit) / (1000 * 60 * 60 * 24));

    // 次日留存（第1天）
    if (daysSinceFirst >= 1 && data.retention.day1 === null) {
      data.retention.day1 = true;
    }

    // 7日留存
    if (daysSinceFirst >= 7 && data.retention.day7 === null) {
      data.retention.day7 = true;
    }
  };

  // 追踪事件
  const track = (eventName, value = 1) => {
    const data = getAnalyticsData();

    if (data.events[eventName] !== undefined) {
      data.events[eventName] += value;
    }

    const date = new Date().toISOString().split('T')[0];
    // 30 天以前的 dailyStats 过期删除（防止 localStorage 无限膨胀）
    const cutoff = Date.now() - 30 * 86400000;
    for (const k of Object.keys(data.dailyStats)) {
      if (k < date && new Date(k).getTime() < cutoff) delete data.dailyStats[k];
    }
    if (!data.dailyStats[date]) {
      data.dailyStats[date] = { sessions: 0, playTime: 0, events: {} };
    }
    if (!data.dailyStats[date].events[eventName]) {
      data.dailyStats[date].events[eventName] = 0;
    }
    data.dailyStats[date].events[eventName] += value;

    checkMilestones(data);

    _markDirty();
  };

  // 检查里程碑
  const checkMilestones = (data) => {
    const gears = st.lifetimeGears;

    if (gears >= 1000 && !data.milestones.first1K) {
      data.milestones.first1K = Date.now();
    }
    if (gears >= 10000 && !data.milestones.first10K) {
      data.milestones.first10K = Date.now();
    }
    if (gears >= 100000 && !data.milestones.first100K) {
      data.milestones.first100K = Date.now();
    }
    if (gears >= 1000000 && !data.milestones.first1M) {
      data.milestones.first1M = Date.now();
    }
    if (gears >= 1000000000 && !data.milestones.first1B) {
      data.milestones.first1B = Date.now();
    }
  };

  // 获取统计数据
  const getStats = () => {
    const data = getAnalyticsData();
    const session = getSessionData();

    const now = Date.now();
    const currentSessionTime = session ? Math.floor((now - session.startTime) / 1000) : 0;

    // 计算留存率
    const daysActive = Object.keys(data.dailyStats).length;
    const retentionRate = data.totalSessions > 0 ? (daysActive / Math.max(1, Math.floor((now - data.firstVisit) / (1000 * 60 * 60 * 24)))) : 0;

    return {
      overview: {
        firstVisit: new Date(data.firstVisit).toLocaleDateString(),
        totalSessions: data.totalSessions,
        totalPlayTime: formatDuration(data.totalPlayTime),
        currentSessionTime: formatDuration(currentSessionTime),
        avgSessionTime: data.totalSessions > 0 ? formatDuration(Math.floor(data.totalPlayTime / data.totalSessions)) : '0s',
      },
      events: data.events,
      milestones: formatMilestones(data.milestones),
      retention: {
        day1: data.retention.day1,
        day7: data.retention.day7,
        activeDays: daysActive,
        retentionRate: (retentionRate * 100).toFixed(1) + '%',
      },
      dailyStats: data.dailyStats,
    };
  };

  // 格式化时长
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // 格式化里程碑
  const formatMilestones = (milestones) => {
    const result = {};
    for (const [key, value] of Object.entries(milestones)) {
      result[key] = value ? new Date(value).toLocaleDateString() : null;
    }
    return result;
  };

  // 导出数据（用于调试）
  const exportData = () => {
    return getAnalyticsData();
  };

  // 清除数据（用于调试）
  const clearData = () => {
    localStorage.removeItem(ANALYTICS_KEY);
    localStorage.removeItem(SESSION_KEY);
    _cache = null;
  };

  // 初始化
  const init = () => {
    const session = getSessionData();
    if (!session) {
      startSession();
    }

    // 监听游戏事件
    if (eventBus) {
      eventBus.on('manual:clicked', () => track('manualClicks'));
      eventBus.on('building:purchased', () => track('buildingsPurchased'));
      eventBus.on('upgrade:purchased', () => track('upgradesPurchased'));
      eventBus.on('skill:upgraded', () => track('skillsUpgraded'));
      eventBus.on('market:switched', () => track('marketSwitches'));
      eventBus.on('dailyQuest:completed', () => track('dailyQuestsCompleted'));
    }


    // 定期保存（统一由 RAF 驱动，移除独立 setInterval）
    const _persistSession = () => {
      const session = getSessionData();
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    };
    if (window.__timerManager) window.__timerManager.scheduleIdle(_persistSession, 30000);
  };

  // 渲染统计面板（用于调试面板）
  const renderStatsPanel = () => {
    const stats = getStats();

    return `
      <div style="padding: 12px; font-size: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #3b82f6;">Analytics</h4>
        <div style="margin-bottom: 8px;">
          <strong>Sessions:</strong> ${stats.overview.totalSessions}<br>
          <strong>Total Time:</strong> ${stats.overview.totalPlayTime}<br>
          <strong>Avg Session:</strong> ${stats.overview.avgSessionTime}<br>
          <strong>Active Days:</strong> ${stats.retention.activeDays}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Events:</strong><br>
          Clicks: ${stats.events.manualClicks}<br>
          Buildings: ${stats.events.buildingsPurchased}<br>
          Upgrades: ${stats.events.upgradesPurchased}<br>
          Skills: ${stats.events.skillsUpgraded}
        </div>
        <div>
          <strong>Retention:</strong> ${stats.retention.retentionRate}
        </div>
      </div>
    `;
  };


  // ════════════════════════════════════════════════
  // A/B Testing Framework (Phase 3)
  // ════════════════════════════════════════════════
  const AB_KEY = 'abTestAssignments';

  const getAssignment = (experimentId) => {
    try {
      const assignments = JSON.parse(localStorage.getItem(AB_KEY) || '{}');
      return assignments[experimentId] || null;
    } catch { return null; }
  };

  const assignExperiment = (experimentId, variants) => {
    // Check existing assignment
    const existing = getAssignment(experimentId);
    if (existing) return existing;

    // Random assignment (50/50 for two variants, equal for N)
    const variantIdx = Math.floor(Math.random() * variants.length);
    const variant = variants[variantIdx];

    try {
      const assignments = JSON.parse(localStorage.getItem(AB_KEY) || '{}');
      assignments[experimentId] = { variant: variant, assignedAt: Date.now() };
      localStorage.setItem(AB_KEY, JSON.stringify(assignments));
    } catch {}

    return variant;
  };

  const trackConversion = (experimentId, metric, value) => {
    const assignment = getAssignment(experimentId);
    if (!assignment) return;

    track('ab_conversion', {
      experiment: experimentId,
      variant: assignment.variant,
      metric: metric,
      value: value,
    });
  };

  const getExperimentResults = (experimentId) => {
    const data = getData();
    const events = data.events.filter(e =>
      e.type === 'ab_conversion' && e.data.experiment === experimentId
    );

    const results = {};
    for (const event of events) {
      const variant = event.data.variant;
      if (!results[variant]) results[variant] = { count: 0, conversions: {} };
      results[variant].count++;
      if (!results[variant].conversions[event.data.metric]) {
        results[variant].conversions[event.data.metric] = { sum: 0, count: 0 };
      }
      results[variant].conversions[event.data.metric].sum += event.data.value || 0;
      results[variant].conversions[event.data.metric].count++;
    }
    return results;
  };

  // Pre-defined experiments
  const EXPERIMENTS = {
    offline_rate: {
      id: 'offline_rate',
      name: { zh: '离线收益比例测试', en: 'Offline Rate Test' },
      variants: ['standard_57', 'reduced_40', 'increased_70'],
      description: { zh: '测试不同离线收益比例对留存的影响', en: 'Testing offline rate impact on retention' },
    },
    prestige_timing: {
      id: 'prestige_timing',
      name: { zh: 'Prestige 时机测试', en: 'Prestige Timing Test' },
      variants: ['early_12h', 'standard_22h', 'late_36h'],
      description: { zh: '测试不同 Prestige 解锁时间对留存的影响', en: 'Testing prestige unlock time impact on retention' },
    },
  };

  return {
    init,
    track,
    getStats,
    exportData,
    clearData,
    startSession,
    endSession,
    renderStatsPanel,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAnalyticsSystem };
}
