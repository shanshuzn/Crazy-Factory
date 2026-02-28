/**
 * 每日任务系统 (Daily Quest System)
 * 
 * 功能：提供每日任务，增加玩家登录动力和游戏目标
 * 机制：
 * 1. 每日 0 点重置任务
 * 2. 3-4 个随机任务，涵盖不同游戏行为
 * 3. 完成任务获得奖励（资本或 RP）
 * 4. 任务进度实时更新
 * 5. 所有任务完成后有额外奖励
 */

const createDailyQuestSystem = ({
  st,
  I18N,
  eventBus,
  buildings,
  pushLog,
  saveGame,
  onQuestComplete = null,
  onAllComplete = null,
}) => {
  const DAILY_QUEST_KEY = 'dailyQuestData';
  const LAST_RESET_KEY = 'dailyQuestLastReset';

  // 任务类型定义
  const QUEST_TYPES = {
    MANUAL_CLICKS: {
      id: 'manual_clicks',
      title: { zh: '勤劳致富', en: 'Hard Work' },
      description: { zh: '手动点击 {target} 次', en: 'Click manually {target} times' },
      rewardType: 'gears',
      getReward: (target) => target * 10,
    },
    BUY_BUILDINGS: {
      id: 'buy_buildings',
      title: { zh: '扩张产业', en: 'Expand Business' },
      description: { zh: '购买 {target} 个产业', en: 'Buy {target} buildings' },
      rewardType: 'gears',
      getReward: (target) => target * 50,
    },
    EARN_GEARS: {
      id: 'earn_gears',
      title: { zh: '资本积累', en: 'Capital Accumulation' },
      description: { zh: '累计赚取 ¥{target}', en: 'Earn ¥{target} total' },
      rewardType: 'rp',
      getReward: (target) => Math.max(1, Math.floor(target / 10000)),
    },
    DO_UPGRADES: {
      id: 'do_upgrades',
      title: { zh: '技术研发', en: 'Research & Development' },
      description: { zh: '完成 {target} 次研发升级', en: 'Complete {target} upgrades' },
      rewardType: 'rp',
      getReward: (target) => target,
    },
    LOGIN: {
      id: 'login',
      title: { zh: '每日登录', en: 'Daily Login' },
      description: { zh: '登录游戏', en: 'Login to the game' },
      rewardType: 'gears',
      getReward: () => 1000,
    },
  };

  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // 获取今日日期字符串
  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  };

  // 检查是否需要重置
  const shouldReset = () => {
    const lastReset = localStorage.getItem(LAST_RESET_KEY);
    const today = getTodayString();
    return lastReset !== today;
  };

  // 生成随机任务
  const generateQuests = () => {
    const types = Object.values(QUEST_TYPES);
    const selected = [];
    const count = 3 + Math.floor(Math.random() * 2); // 3-4 个任务

    // 确保包含登录任务
    selected.push({
      ...QUEST_TYPES.LOGIN,
      target: 1,
      progress: 1,
      completed: true,
      claimed: false,
    });

    // 随机选择其他任务
    const otherTypes = types.filter(t => t.id !== 'login');
    for (let i = 0; i < count - 1; i++) {
      const type = otherTypes[Math.floor(Math.random() * otherTypes.length)];
      const target = generateTarget(type.id);
      selected.push({
        ...type,
        target,
        progress: 0,
        completed: false,
        claimed: false,
      });
    }

    return selected;
  };

  // 根据任务类型生成目标值
  const generateTarget = (typeId) => {
    const ranges = {
      manual_clicks: [10, 50, 100],
      buy_buildings: [1, 5, 10],
      earn_gears: [10000, 50000, 100000],
      do_upgrades: [1, 2, 3],
    };
    const range = ranges[typeId] || [1];
    return range[Math.floor(Math.random() * range.length)];
  };

  // 获取或初始化任务数据
  const getQuestData = () => {
    if (shouldReset()) {
      const newQuests = generateQuests();
      const data = {
        date: getTodayString(),
        quests: newQuests,
        allClaimed: false,
      };
      saveQuestData(data);
      localStorage.setItem(LAST_RESET_KEY, getTodayString());
      return data;
    }

    const saved = localStorage.getItem(DAILY_QUEST_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }

    const newQuests = generateQuests();
    const data = {
      date: getTodayString(),
      quests: newQuests,
      allClaimed: false,
    };
    saveQuestData(data);
    return data;
  };

  // 保存任务数据
  const saveQuestData = (data) => {
    localStorage.setItem(DAILY_QUEST_KEY, JSON.stringify(data));
  };

  // 更新任务进度
  const updateProgress = (typeId, amount = 1) => {
    const data = getQuestData();
    let changed = false;

    data.quests.forEach(quest => {
      if (quest.id === typeId && !quest.completed) {
        quest.progress = Math.min(quest.progress + amount, quest.target);
        if (quest.progress >= quest.target) {
          quest.completed = true;
          const lang = getLang();
          const title = quest.title[lang] || quest.title.zh;
          pushLog(`✅ 每日任务完成: ${title}`);
          if (eventBus) {
            eventBus.emit('dailyQuest:completed', { quest });
          }
        }
        changed = true;
      }
    });

    if (changed) {
      saveQuestData(data);
      checkAllCompleted();
    }
  };

  // 领取任务奖励
  const claimReward = (questIndex) => {
    const data = getQuestData();
    const quest = data.quests[questIndex];

    if (!quest || !quest.completed || quest.claimed) return false;

    const reward = quest.getReward(quest.target);
    quest.claimed = true;

    if (quest.rewardType === 'gears') {
      st.gears += reward;
      st.lifetimeGears += reward;
      pushLog(`🎁 获得 ${reward} 资本奖励`);
    } else if (quest.rewardType === 'rp') {
      st.researchPoints += reward;
      pushLog(`🎁 获得 ${reward} RP 奖励`);
    }

    saveQuestData(data);
    saveGame();

    if (onQuestComplete) onQuestComplete({ quest, reward });

    checkAllCompleted();
    return true;
  };

  // 检查是否所有任务都已完成并领取
  const checkAllCompleted = () => {
    const data = getQuestData();
    const allCompleted = data.quests.every(q => q.completed && q.claimed);

    if (allCompleted && !data.allClaimed) {
      data.allClaimed = true;
      saveQuestData(data);

      // 额外奖励
      const bonusRP = 5;
      st.researchPoints += bonusRP;
      pushLog(`🌟 每日任务全部完成! 额外获得 ${bonusRP} RP`);
      saveGame();

      if (onAllComplete) onAllComplete({ bonusRP });
      if (eventBus) {
        eventBus.emit('dailyQuest:allCompleted', { bonusRP });
      }
    }
  };

  // 渲染任务面板（返回 HTML 字符串）
  const renderQuestPanel = () => {
    const data = getQuestData();
    const lang = getLang();

    const questsHtml = data.quests.map((quest, index) => {
      const title = quest.title[lang] || quest.title.zh;
      const desc = quest.description[lang] || quest.description.zh;
      const descFormatted = desc.replace('{target}', quest.target);
      const progressPercent = Math.min(100, (quest.progress / quest.target) * 100);

      let statusHtml = '';
      if (quest.claimed) {
        statusHtml = `<span style="color: #10b981;">✓ ${lang === 'en' ? 'Claimed' : '已领取'}</span>`;
      } else if (quest.completed) {
        const reward = quest.getReward(quest.target);
        statusHtml = `<button class="daily-claim-btn" data-index="${index}" style="padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">${lang === 'en' ? 'Claim' : '领取'} ${reward} ${quest.rewardType === 'rp' ? 'RP' : '💰'}</button>`;
      } else {
        statusHtml = `
          <div style="width: 80px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
            <div style="width: ${progressPercent}%; height: 100%; background: #3b82f6; transition: width 0.3s;"></div>
          </div>
          <span style="font-size: 11px; opacity: 0.8;">${quest.progress}/${quest.target}</span>
        `;
      }

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 500; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.8;">${descFormatted}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            ${statusHtml}
          </div>
        </div>
      `;
    }).join('');

    const allCompleteStatus = data.allClaimed
      ? `<div style="text-align: center; padding: 12px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); border-radius: 8px; margin-top: 12px;">🌟 ${lang === 'en' ? 'All daily quests completed!' : '今日任务全部完成!'}</div>`
      : '';

    return `
      <div class="daily-quest-panel" style="background: rgba(30,58,138,0.9); border-radius: 12px; padding: 16px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 16px;">📅 ${lang === 'en' ? 'Daily Quests' : '每日任务'}</h3>
          <span style="font-size: 12px; opacity: 0.8;">${data.date}</span>
        </div>
        <div class="daily-quests-list">
          ${questsHtml}
        </div>
        ${allCompleteStatus}
      </div>
    `;
  };

  // 绑定领取按钮事件
  const bindClaimButtons = (container) => {
    container.querySelectorAll('.daily-claim-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (claimReward(index)) {
          // 重新渲染
          const panel = container.querySelector('.daily-quest-panel');
          if (panel) {
            panel.outerHTML = renderQuestPanel();
            bindClaimButtons(container);
          }
        }
      });
    });
  };

  // 初始化时检查登录任务
  const init = () => {
    const data = getQuestData();
    // 登录任务默认已完成
    const loginQuest = data.quests.find(q => q.id === 'login');
    if (loginQuest && loginQuest.completed && !loginQuest.claimed) {
      const lang = getLang();
      pushLog(lang === 'en' ? '📅 Daily quests refreshed!' : '📅 每日任务已刷新！');
    }
  };

  // 监听游戏事件更新任务进度
  const setupEventListeners = () => {
    if (!eventBus) return;

    eventBus.on('manual:clicked', () => updateProgress('manual_clicks'));
    eventBus.on('building:purchased', () => updateProgress('buy_buildings'));
    eventBus.on('upgrade:purchased', () => updateProgress('do_upgrades'));
  };

  // 计算累计收益（需要在游戏循环中调用）
  let lastGears = 0;
  const trackEarnedGears = () => {
    if (lastGears === 0) {
      lastGears = st.lifetimeGears;
      return;
    }

    const earned = st.lifetimeGears - lastGears;
    if (earned > 0) {
      updateProgress('earn_gears', earned);
      lastGears = st.lifetimeGears;
    }
  };

  return {
    init,
    getQuestData,
    renderQuestPanel,
    bindClaimButtons,
    claimReward,
    updateProgress,
    trackEarnedGears,
    setupEventListeners,
    shouldReset,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createDailyQuestSystem };
}
