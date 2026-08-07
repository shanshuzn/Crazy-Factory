/**
 * 联盟/公会系统 (Guild System) - P6-T5
 *
 * 功能：玩家加入虚拟公会，参与公会竞争，获得公会加成
 * 机制：
 * 1. 预定义虚拟公会：玩家选择加入
 * 2. 公会贡献：通过游戏进度为公会贡献
 * 3. 公会排名：公会间竞争排名
 * 4. 公会加成：根据公会等级获得加成
 */

const createGuildSystem = ({
  st,
  eventBus,
  pushLog,
  I18N,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储
  // ═══════════════════════════════════════════════════════════════════════════

  const initGuildData = () => {
    if (!st.guild) {
      st.guild = {
        // 当前加入的公会
        currentGuild: null,
        // 个人贡献
        personalContribution: 0,
        // 贡献历史
        contributionHistory: [],
        // 已领取的奖励
        claimedRewards: [],
        // 加入时间
        joinedAt: null,
      };
    }

    // 初始化虚拟公会数据（如果不存在）
    if (!st.virtualGuilds) {
      st.virtualGuilds = createVirtualGuilds();
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 虚拟公会配置
  // ═══════════════════════════════════════════════════════════════════════════

  const GUILD_TYPES = {
    trading: { name: { zh: '交易型', en: 'Trading' }, icon: '📈', focus: 'gps' },
    investment: { name: { zh: '投资型', en: 'Investment' }, icon: '💰', focus: 'investment' },
    technology: { name: { zh: '科技型', en: 'Technology' }, icon: '🔬', focus: 'research' },
    balanced: { name: { zh: '平衡型', en: 'Balanced' }, icon: '⚖️', focus: 'balanced' },
  };

  const createVirtualGuilds = () => {
    const now = Date.now();
    return {
      alpha_traders: {
        id: 'alpha_traders',
        name: { zh: '阿尔法交易团', en: 'Alpha Traders' },
        type: 'trading',
        description: { zh: '专注于高频交易和市场套利', en: 'Focused on high-frequency trading and arbitrage' },
        members: 42,
        totalPower: 1e12,
        totalContribution: 5e15,
        level: 5,
        createdAt: now - 30 * 24 * 60 * 60 * 1000, // 30天前
        bonuses: { gpsBonus: 0.15, arbitrageBonus: 0.2 },
        rank: 1,
      },
      beta_investors: {
        id: 'beta_investors',
        name: { zh: '贝塔投资联盟', en: 'Beta Investors' },
        type: 'investment',
        description: { zh: '稳健投资，长期收益', en: 'Steady investment, long-term returns' },
        members: 38,
        totalPower: 8e11,
        totalContribution: 4e15,
        level: 4,
        createdAt: now - 25 * 24 * 60 * 60 * 1000,
        bonuses: { investmentBonus: 0.25, offlineBonus: 0.15 },
        rank: 2,
      },
      gamma_holders: {
        id: 'gamma_holders',
        name: { zh: '伽马持有会', en: 'Gamma Holders' },
        type: 'balanced',
        description: { zh: '平衡发展，全面成长', en: 'Balanced development, all-round growth' },
        members: 55,
        totalPower: 1.5e12,
        totalContribution: 6e15,
        level: 6,
        createdAt: now - 45 * 24 * 60 * 60 * 1000,
        bonuses: { allBonus: 0.1 },
        rank: 3,
      },
      delta_tech: {
        id: 'delta_tech',
        name: { zh: '德尔塔科技社', en: 'Delta Tech' },
        type: 'technology',
        description: { zh: '科技研发，创新驱动', en: 'Technology R&D, innovation driven' },
        members: 31,
        totalPower: 6e11,
        totalContribution: 3e15,
        level: 4,
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        bonuses: { researchBonus: 0.2, buildingCostReduction: 0.1 },
        rank: 4,
      },
      epsilon_global: {
        id: 'epsilon_global',
        name: { zh: '艾普西隆全球', en: 'Epsilon Global' },
        type: 'balanced',
        description: { zh: '全球布局，跨国经营', en: 'Global layout, multinational operations' },
        members: 48,
        totalPower: 9e11,
        totalContribution: 4.5e15,
        level: 5,
        createdAt: now - 35 * 24 * 60 * 60 * 1000,
        bonuses: { globalMarketBonus: 0.15, allBonus: 0.05 },
        rank: 5,
      },
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 公会操作
  // ═══════════════════════════════════════════════════════════════════════════

  const getCurrentGuild = () => st.guild.currentGuild;

  const isInGuild = () => st.guild.currentGuild !== null;

  // 加入公会
  const joinGuild = (guildId) => {
    const lang = getLang();

    if (!st.virtualGuilds[guildId]) {
      return { success: false, error: lang === 'en' ? 'Guild not found' : '公会不存在' };
    }

    if (isInGuild()) {
      return { success: false, error: lang === 'en' ? 'Already in a guild' : '已加入公会' };
    }

    const guild = st.virtualGuilds[guildId];

    // 更新公会数据
    guild.members++;
    st.guild.currentGuild = guildId;
    st.guild.joinedAt = Date.now();

    // 触发事件
    eventBus.emit('guild:joined', { guildId, guild });

    pushLog(lang === 'en'
      ? `🏛️ Joined ${guild.name.en}! Welcome to the guild.`
      : `🏛️ 加入${guild.name.zh}！欢迎加入公会。`
    );

    return { success: true, guild };
  };

  // 退出公会
  const leaveGuild = () => {
    const lang = getLang();

    if (!isInGuild()) {
      return { success: false, error: lang === 'en' ? 'Not in a guild' : '未加入公会' };
    }

    const guildId = st.guild.currentGuild;
    const guild = st.virtualGuilds[guildId];

    // 更新公会数据
    guild.members = Math.max(1, guild.members - 1);
    st.guild.currentGuild = null;
    st.guild.joinedAt = null;

    // 触发事件
    eventBus.emit('guild:left', { guildId });

    pushLog(lang === 'en'
      ? `👋 Left ${guild.name.en}. You can join another guild in 24 hours.`
      : `👋 已退出${guild.name.zh}。24小时后可加入其他公会。`
    );

    return { success: true };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 贡献系统
  // ═══════════════════════════════════════════════════════════════════════════

  const contribute = (amount) => {
    const lang = getLang();

    if (!isInGuild()) {
      return { success: false, error: lang === 'en' ? 'Not in a guild' : '未加入公会' };
    }

    if (st.money < amount) {
      return { success: false, error: lang === 'en' ? 'Insufficient funds' : '资金不足' };
    }

    // 扣除资金
    st.money -= amount;

    // 更新贡献
    st.guild.personalContribution += amount;
    const guild = st.virtualGuilds[st.guild.currentGuild];
    guild.totalContribution += amount;

    // 记录历史
    st.guild.contributionHistory.push({
      amount,
      timestamp: Date.now(),
    });

    // 检查公会升级
    checkGuildLevelUp(guild);

    // 触发事件
    eventBus.emit('guild:contributed', { guildId: st.guild.currentGuild, amount });

    pushLog(lang === 'en'
      ? `💎 Contributed ${formatNumber(amount)} to your guild!`
      : `💎 向公会贡献 ${formatNumber(amount)}！`
    );

    return { success: true, totalContribution: st.guild.personalContribution };
  };

  // 自动贡献（基于GPS）
  const autoContribute = () => {
    if (!isInGuild()) return;

    // 每秒自动贡献 0.01% 的GPS
    const contribution = st.totalGPS * 0.0001;
    if (contribution > 0) {
      const guild = st.virtualGuilds[st.guild.currentGuild];
      guild.totalContribution += contribution;
      st.guild.personalContribution += contribution;
    }
  };

  // 预计算等级阈值（避免 checkGuildLevelUp 每次重新分配对象）
  const _LEVEL_THRESHOLDS = {
    2: 1e15, 3: 5e15, 4: 2e16, 5: 1e17,
    6: 5e17, 7: 2e18, 8: 1e19, 9: 5e19, 10: 2e20,
  };

  // 排名缓存（避免每秒对 5 个公会重复排序）
  let _cachedRanking = null;
  let _rankingDirty = true;

  // 检查公会升级
  const checkGuildLevelUp = (guild) => {
    const nextLevel = guild.level + 1;
    if (_LEVEL_THRESHOLDS[nextLevel] && guild.totalContribution >= _LEVEL_THRESHOLDS[nextLevel]) {
      guild.level = nextLevel;

      // 升级时增强加成
      Object.keys(guild.bonuses).forEach(key => {
        guild.bonuses[key] *= 1.1; // 每项加成增加10%
      });

      eventBus.emit('guild:leveledUp', { guildId: guild.id, newLevel: nextLevel });

      const lang = getLang();
      pushLog(lang === 'en'
        ? `🎉 ${guild.name.en} has reached level ${nextLevel}! Bonuses increased.`
        : `🎉 ${guild.name.zh} 升级到 ${nextLevel} 级！公会加成提升。`
      );
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 公会排名
  // ═══════════════════════════════════════════════════════════════════════════

  const updateGuildRanks = () => {
    const guilds = Object.values(st.virtualGuilds);

    // 按总贡献排序
    guilds.sort((a, b) => b.totalContribution - a.totalContribution);

    // 更新排名
    for (let i = 0; i < guilds.length; i++) {
      guilds[i].rank = i + 1;
    }
    _rankingDirty = false;
    _cachedRanking = null; // 数据变化时清除缓存
  };

  const getGuildRanking = () => {
    if (_rankingDirty) updateGuildRanks();
    if (_cachedRanking) return _cachedRanking;
    _cachedRanking = Object.values(st.virtualGuilds)
      .sort((a, b) => a.rank - b.rank)
      .map(g => ({
        rank: g.rank,
        id: g.id,
        name: g.name,
        type: g.type,
        members: g.members,
        level: g.level,
        totalContribution: g.totalContribution,
        bonuses: g.bonuses,
      }));
    return _cachedRanking;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 公会加成
  // ═══════════════════════════════════════════════════════════════════════════

  const getGuildBonuses = () => {
    if (!isInGuild()) {
      return {
        gpsBonus: 0,
        investmentBonus: 0,
        researchBonus: 0,
        offlineBonus: 0,
        arbitrageBonus: 0,
        globalMarketBonus: 0,
        buildingCostReduction: 0,
        allBonus: 0,
      };
    }

    const guild = st.virtualGuilds[st.guild.currentGuild];
    const bonuses = { ...guild.bonuses };

    // 确保所有加成都有默认值
    return {
      gpsBonus: bonuses.gpsBonus || 0,
      investmentBonus: bonuses.investmentBonus || 0,
      researchBonus: bonuses.researchBonus || 0,
      offlineBonus: bonuses.offlineBonus || 0,
      arbitrageBonus: bonuses.arbitrageBonus || 0,
      globalMarketBonus: bonuses.globalMarketBonus || 0,
      buildingCostReduction: bonuses.buildingCostReduction || 0,
      allBonus: bonuses.allBonus || 0,
    };
  };

  // 计算总GPS加成
  const getTotalGPSBonus = () => {
    const bonuses = getGuildBonuses();
    return 1 + bonuses.gpsBonus + bonuses.allBonus;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 更新循环
  // ═══════════════════════════════════════════════════════════════════════════

  const update = () => {
    // 自动贡献
    autoContribute();

    // 更新排名
    updateGuildRanks();

    // 模拟其他公会成员的增长
    simulateOtherMembers();
  };

  // 模拟其他公会成员的贡献增长
  const simulateOtherMembers = () => {
    Object.values(st.virtualGuilds).forEach(guild => {
      // 每秒每个成员平均贡献 1e6
      const simulatedContribution = (guild.members - (isInGuild() && st.guild.currentGuild === guild.id ? 1 : 0)) * 1e6;
      guild.totalContribution += simulatedContribution;

      // 偶尔升级
      if (Math.random() < 0.001) {
        checkGuildLevelUp(guild);
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getGuildInfo = () => {
    if (!isInGuild()) return null;

    const guild = st.virtualGuilds[st.guild.currentGuild];
    const bonuses = getGuildBonuses();

    return {
      ...guild,
      personalContribution: st.guild.personalContribution,
      joinedAt: st.guild.joinedAt,
      effectiveBonuses: bonuses,
    };
  };

  const getAllGuilds = () => Object.values(st.virtualGuilds).map(g => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    members: g.members,
    level: g.level,
    rank: g.rank,
    bonuses: g.bonuses,
  }));

  const getStats = () => ({
    personalContribution: st.guild.personalContribution,
    contributionCount: st.guild.contributionHistory.length,
    joinedAt: st.guild.joinedAt,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  const renderGuildPanel = () => {
    const lang = getLang();
    const guildInfo = getGuildInfo();

    if (!guildInfo) {
      // 显示可加入的公会列表
      const guildsHtml = getAllGuilds().map(g => {
        const typeInfo = GUILD_TYPES[g.type];
        return `
          <div class="guild-item">
            <div class="guild-header">
              <span class="guild-icon">${typeInfo.icon}</span>
              <span class="guild-name">${g.name[lang]}</span>
              <span class="guild-rank">#${g.rank}</span>
            </div>
            <div class="guild-info">
              <span class="guild-type">${typeInfo.name[lang]}</span>
              <span class="guild-level">Lv.${g.level}</span>
              <span class="guild-members">👥 ${g.members}</span>
            </div>
            <div class="guild-description">${g.description[lang]}</div>
            <div class="guild-bonuses">
              ${Object.entries(g.bonuses).map(([key, val]) => `
                <span class="bonus-tag">${key}: +${(val * 100).toFixed(0)}%</span>
              `).join('')}
            </div>
            <button class="join-guild-btn" data-guild="${g.id}">${lang === 'en' ? 'Join' : '加入'}</button>
          </div>
        `;
      }).join('');

      return `
        <div class="guild-panel no-guild">
          <h3>${lang === 'en' ? '🏛️ Join a Guild' : '🏛️ 加入公会'}</h3>
          <div class="guild-list">
            ${guildsHtml}
          </div>
        </div>
      `;
    }

    // 显示当前公会信息
    const typeInfo = GUILD_TYPES[guildInfo.type];
    const joinedDays = Math.floor((Date.now() - guildInfo.joinedAt) / (24 * 60 * 60 * 1000));

    return `
      <div class="guild-panel in-guild">
        <h3>${typeInfo.icon} ${guildInfo.name[lang]}</h3>
        <div class="guild-stats">
          <span class="guild-rank">${lang === 'en' ? 'Rank' : '排名'}: #${guildInfo.rank}</span>
          <span class="guild-level">${lang === 'en' ? 'Level' : '等级'}: ${guildInfo.level}</span>
          <span class="guild-members">👥 ${guildInfo.members}</span>
        </div>
        <div class="personal-contribution">
          <span>${lang === 'en' ? 'Your Contribution' : '你的贡献'}: ${formatNumber(guildInfo.personalContribution)}</span>
          <span>${lang === 'en' ? 'Joined' : '已加入'}: ${joinedDays} ${lang === 'en' ? 'days' : '天'}</span>
        </div>
        <div class="active-bonuses">
          <h4>${lang === 'en' ? 'Active Bonuses' : '生效加成'}</h4>
          ${Object.entries(guildInfo.effectiveBonuses).filter(([_, val]) => val > 0).map(([key, val]) => `
            <span class="bonus-tag active">${key}: +${(val * 100).toFixed(0)}%</span>
          `).join('')}
        </div>
        <div class="guild-actions">
          <button class="contribute-btn" onclick="window.contributeToGuild(1e9)">${lang === 'en' ? 'Contribute 1B' : '贡献 1B'}</button>
          <button class="leave-btn" onclick="window.leaveGuild()">${lang === 'en' ? 'Leave Guild' : '退出公会'}</button>
        </div>
      </div>
    `;
  };

  const renderGuildRanking = () => {
    const lang = getLang();
    const ranking = getGuildRanking();

    const rankingHtml = ranking.slice(0, 5).map(g => {
      const isMyGuild = isInGuild() && st.guild.currentGuild === g.id;
      return `
        <div class="rank-item ${isMyGuild ? 'my-guild' : ''}">
          <span class="rank-num">#${g.rank}</span>
          <span class="rank-name">${g.name[lang]}</span>
          <span class="rank-level">Lv.${g.level}</span>
          <span class="rank-contribution">${formatNumber(g.totalContribution)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="guild-ranking-panel">
        <h4>${lang === 'en' ? '🏆 Guild Rankings' : '🏆 公会排名'}</h4>
        ${rankingHtml}
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initGuildData();

    // 定期更新（统一由 RAF 驱动，移除独立 setInterval）
    if (window.__timerManager) window.__timerManager.schedule(update, 1000);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════


  // Guild Tech Tree
  const getTechTree = () => {
    if (!st.guild || !st.guild.techTree) return null;
    return st.guild.techTree;
  };

  const upgradeTech = (techId) => {
    const lang = getLang();
    if (!st.guild || !st.guild.techTree) return { success: false, error: 'Not in guild' };
    const tech = st.guild.techTree[techId];
    if (!tech) return { success: false, error: 'Tech not found' };
    if (tech.level >= tech.maxLevel) return { success: false, error: 'Max level' };
    const cost = Math.floor(tech.costBase * Math.pow(tech.costMult, tech.level));
    if (st.gears < cost) return { success: false, error: 'Need $' + cost };
    st.gears -= cost;
    tech.level++;
    if (eventBus) eventBus.emit('guild:techUpgraded', { techId: techId, level: tech.level });
    if (pushLog) pushLog('Tech upgraded: ' + (tech.desc[lang] || tech.desc.zh) + ' Lv.' + tech.level);
    return { success: true, level: tech.level, cost: cost };
  };

  const getTechBonuses = () => {
    const tech = getTechTree();
    if (!tech) return { gps: 1, discount: 1, rp: 1, synergy: 1, offline: 1 };
    return {
      gps: 1 + (tech.gpsBoost ? tech.gpsBoost.level * tech.gpsBoost.bonusPerLevel : 0),
      discount: 1 - (tech.discountBoost ? tech.discountBoost.level * tech.discountBoost.bonusPerLevel : 0),
      rp: 1 + (tech.rpBonus ? tech.rpBonus.level * tech.rpBonus.bonusPerLevel : 0),
      synergy: 1 + (tech.synergyBoost ? tech.synergyBoost.level * tech.synergyBoost.bonusPerLevel : 0),
      offline: 1 + (tech.offlineBoost ? tech.offlineBoost.level * tech.offlineBoost.bonusPerLevel : 0),
    };
  };

  const renderTechTree = () => {
    const lang = getLang();
    const tech = getTechTree();
    if (!tech) return '';
    let html = '<div class="guild-tech-tree" style="padding:12px;">';
    html += '<h3 style="margin:0 0 8px;">' + (lang === 'en' ? 'Guild Tech Tree' : '公会科技树') + '</h3>';
    for (const [id, t] of Object.entries(tech)) {
      const cost = Math.floor(t.costBase * Math.pow(t.costMult, t.level));
      const maxed = t.level >= t.maxLevel;
      const canAfford = st.gears >= cost;
      const desc = t.desc[lang] || t.desc.zh;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);">';
      html += '<div><div style="font-size:13px;">' + desc + '</div>';
      html += '<div style="font-size:11px;opacity:0.6;">Lv.' + t.level + '/' + t.maxLevel + '</div></div>';
      html += '<button class="btn"' + (maxed || !canAfford ? ' disabled style="opacity:0.4"' : '') + '>';
      html += maxed ? (lang === 'en' ? 'MAX' : '满级') : '$' + cost;
      html += '</button></div>';
    }
    html += '</div>';
    return html;
  };

  return {
    // 初始化
    init,
    update,

    // 公会操作
    joinGuild,
    leaveGuild,
    isInGuild,
    getCurrentGuild,

    // 贡献
    contribute,
    autoContribute,

    // 排名
    getGuildRanking,
    updateGuildRanks,

    // 加成
    getGuildBonuses,
    getTotalGPSBonus,

    // 查询
    getGuildInfo,
    getAllGuilds,
    getStats,

    // UI
    renderGuildPanel,
    renderGuildRanking,
    renderTechTree,

    // Tech Tree
    getTechTree,
    upgradeTech,
    getTechBonuses,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGuildSystem };
}

// 辅助函数：数字格式化
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
