    // ⑧ DOM 引用（渲染层缓存，M1 解耦）
    // ════════════════════════════════════════════════
    const $ = (id) => document.getElementById(id);
    const gearsEl       = $("gears");
    const gpsEl         = $("gps");
    const rpDisplayEl   = $("rpDisplay");
    const rpMetaEl      = $("rpMeta");
    const marketMultEl  = $("marketMult");
    const marketStatusEl= $("marketStatus");
    const marketDotEl   = $("marketDot");
    const marketLabelEl = $("marketLabel");
    const marketWaveEl  = $("marketWave");
    const marketCountEl = $("marketCountdown");
    const marketEffectEl= $("marketEffect");
    const marketEventEl = $("marketEvent");
    const marketOutlookEl = $("marketOutlook");
    const marketFlashEl = $("marketFlash");
    const manualBtn     = $("manualBtn");
    const manualDesc    = $("manualDesc");
    const manualZone    = $("manualZone");
    const buildingListEl= $("buildingList");
    const upgradeListEl = $("upgradeList");
    const skillListEl   = $("skillList");
    const skillMasteryMetaEl = $("skillMasteryMeta");
    const appVersionEl  = $("appVersion");
    const changelogListEl= $("changelogList");
    const achievListEl  = $("achievementList");
    const modeButtons   = [...document.querySelectorAll("[data-mode]")];
    const speedButtons  = [...document.querySelectorAll("[data-speed]")];
    const autoBuyBtn    = $("autoBuyBtn");
    const soundBtn      = $("soundBtn");
    const langBtn       = $("langBtn");
    const offlineEl     = $("offlineNotice");
    const offlineTextEl = $("offlineText");
    const claimBtn      = $("claimOfflineBtn");
    const goalTitleEl   = $("goalTitle");
    const goalFillEl    = $("goalFill");
    const goalHintEl    = $("goalHint");
    const goalPctEl     = $("goalPct");
    const questRewardEl = $("questReward");
    const rewardFeedEl  = $("rewardFeed");
    const eventLogEl    = $("eventLog");
    const statBldEl     = $("statBuildings");
    const statUpgEl     = $("statUpgrades");
    const statAchEl     = $("statAchievements");
    const statQstEl     = $("statQuest");
    const statModeEl    = $("statMode");
    const statLifeEl    = $("statLifetime");
    const gameShellEl   = document.querySelector(".game");

    // View 缓存（渲染解耦核心，避免每帧 querySelector）
    const buildingViewMap   = new Map();
    const upgradeViewMap    = new Map();
    const skillViewMap      = new Map();
    const achievViewMap     = new Map();

    // ════════════════════════════════════════════════
    // ⑨ 工具函数
    // ════════════════════════════════════════════════
    // ── 数值格式化 ──
    const fmt = (n) => {
      if (!Number.isFinite(n)) return "¥0";
      const abs=Math.abs(n), sg=n<0?"-":"";
      if(abs>=1e12) return `${sg}¥${(abs/1e12).toFixed(2)}T`;
      if(abs>=1e9)  return `${sg}¥${(abs/1e9).toFixed(2)}B`;
      if(abs>=1e6)  return `${sg}¥${(abs/1e6).toFixed(2)}M`;
      if(abs>=1e3)  return `${sg}¥${(abs/1e3).toFixed(2)}K`;
      return `${sg}¥${abs.toLocaleString("zh-CN",{maximumFractionDigits:1})}`;
    };

    // 反馈系统初始化（为什么：反馈层高频迭代，独立工厂减少对主循环的干扰）
    const feedback = createFeedbackSystem({ st, JUICE, fmt, manualBtn, manualZone, marketFlashEl, gameShellEl });
    const { eventBus, sfxBuy, sfxUpgrade, sfxMarket, spawnFloat } = feedback;

    // ════════════════════════════════════════════════
    // ⑭ DOM 构建（只调用一次）
    // ════════════════════════════════════════════════
    const createBuildingRow = (b) => {
      const row=document.createElement("div");
      row.className="building";
      row.innerHTML=`
        <div>
          <div class="name">${b.emoji} ${b.name}</div>
          <div class="meta">
            <span>基础产出：${b.dps}/s</span>
            <span>持有：<strong data-owned="${b.id}">0</strong></span>
          </div>
          <div class="hint"       data-hint="${b.id}"></div>
          <div class="locked-note" data-lock="${b.id}"></div>
        </div>
        <button class="btn buy-btn" data-buy="${b.id}">购买 ×1（¥0）</button>`;
      buildingListEl.appendChild(row);
      buildingViewMap.set(b.id,{
        row, ownedEl:row.querySelector(`[data-owned="${b.id}"]`),
        buyBtn:row.querySelector(`[data-buy="${b.id}"]`),
        hintEl:row.querySelector(`[data-hint="${b.id}"]`),
        lockEl:row.querySelector(`[data-lock="${b.id}"]`),
      });
    };

    const createUpgradeRow = (u) => {
      const row=document.createElement("div");
      row.className="upgrade";
      row.innerHTML=`
        <div>
          <div class="name">${u.name}</div>
          <div class="meta">${u.desc}</div>
          <div class="meta" data-ulock="${u.id}" style="color:#f87171;margin-top:3px"></div>
        </div>
        <button class="btn upgrade-btn" data-upgrade="${u.id}">研发（${fmt(u.price)}）</button>`;
      upgradeListEl.appendChild(row);
      upgradeViewMap.set(u.id,{
        btn:row.querySelector(`[data-upgrade="${u.id}"]`),
        lockEl:row.querySelector(`[data-ulock="${u.id}"]`),
      });
    };

    const createSkillRow = (sk) => {
      const row=document.createElement("div");
      row.className="skill";
      row.innerHTML=`
        <div>
          <div class="name">${sk.name}</div>
          <div class="meta">${sk.desc}</div>
          <div class="meta" data-smeta="${sk.id}"></div>
        </div>
        <button class="btn skill-btn" data-skbuy="${sk.id}">升级（${sk.costRP} RP）</button>`;
      skillListEl.appendChild(row);
      skillViewMap.set(sk.id,{
        btn:row.querySelector(`[data-skbuy="${sk.id}"]`),
        meta:row.querySelector(`[data-smeta="${sk.id}"]`),
      });
    };


    const renderChangelog = () => {
      if(appVersionEl) appVersionEl.textContent = APP_VERSION;
      if(!changelogListEl) return;
      changelogListEl.innerHTML = "";
      for(const item of CHANGELOG){
        const wrap=document.createElement("article");
        wrap.className="changelog-item";
        const notes=item.notes.map(n=>`<li>${n}</li>`).join("");
        wrap.innerHTML=`<div class="changelog-head"><strong>${item.version}</strong><span>${item.date}</span></div><ul class="changelog-notes">${notes}</ul>`;
        changelogListEl.appendChild(wrap);
      }
    };

    const createAchievRow = (a) => {
      const row=document.createElement("div");
      row.className="achievement";
      row.innerHTML=`
        <div>
          <div class="name">${a.name}</div>
          <div class="meta">${a.desc}</div>
        </div>
        <span class="badge" data-abadge="${a.id}">未完成</span>`;
      achievListEl.appendChild(row);
      achievViewMap.set(a.id,{badge:row.querySelector(`[data-abadge="${a.id}"]`)});
    };

    // ════════════════════════════════════════════════
    // ⑮ 奖励/日志
    // ════════════════════════════════════════════════
    const { pushLog } = createLogSystem({ st, dirty, LOG_CAP });
    const grantReward = (rw,label) => {
      if(!rw) return;
      if(rw.type==="gear"){ st.gears+=rw.value; st.lifetimeGears+=rw.value; st.lastRewardText=`${label}：+${fmt(rw.value)}`; pushLog(st.lastRewardText); }
      if(rw.type==="rp"  ){ st.researchPoints+=rw.value; st.lastRewardText=`${label}：+${rw.value} RP`; pushLog(st.lastRewardText); }
    };

    // 经济系统初始化（为什么：将平衡与购买逻辑从 UI/循环中抽离，便于独立调数值）
    const economy = createEconomySystem({
      st,
      buildings,
      upgrades,
      skills,
      bldBoost,
      PRICE_GROWTH,
      MARKET_BULL_BONUS,
      MARKET_BEAR_PENALTY,
      POLICY_RATE_MIN,
      POLICY_RATE_MAX,
      MARKET_MOMENTUM_GPS_PER_STACK,
      MARKET_MOMENTUM_MANUAL_PER_STACK,
      SKILL_MASTERY_BONUS,
      MACRO_PREFERRED_BONUS,
      dirty,
      buildingViewMap,
      pushLog,
      saveGame,
      fmt,
      sfxBuy,
      sfxUpgrade,
      applyUpgradeEffect,
    });
    const {
      bld,
      skillLv,
      price,
      mktMult,
      getTotalGPS,
      getManualGain,
      getGpsBreakdown,
      affordableCount,
      purchaseCost,
      upgradeLockedReason,
      isBldUnlocked,
      buyBuilding,
      buyUpgrade,
      tryAutoBuy,
    } = economy;

    const skillSystem = createSkillSystem({
      st,
      skills,
      dirty,
      pushLog,
      saveGame,
      sfxUpgrade,
      eventBus,
      SKILL_MASTERY_STEP,
      SKILL_MASTERY_BONUS,
    });
    const { buySkill, getTotalSkillLevels, refreshSkillMastery } = skillSystem;

    const marketSystem = createMarketSystem({
      st,
      dirty,
      pushLog,
      eventBus,
      sfxMarket,
      mktMult,
      MARKET_CYCLE_MIN,
      MARKET_CYCLE_MAX,
      MARKET_BULL_BONUS,
      MARKET_BEAR_PENALTY,
      POLICY_RATE_MIN,
      POLICY_RATE_MAX,
      OUTLOOK_REWARD_BASE,
      OUTLOOK_REWARD_RATE_SCALE,
      OUTLOOK_PENALTY_BASE,
      OUTLOOK_PENALTY_RATE_SCALE,
      OUTLOOK_PENALTY_GEAR_RATIO,
      MACRO_EVENTS,
      POLICY_GUIDANCE_BASE_BIAS,
      marketMultEl,
      marketStatusEl,
      marketDotEl,
      marketLabelEl,
      marketWaveEl,
      marketCountEl,
      marketEffectEl,
      marketEventEl,
      marketOutlookEl,
    });
    const { tickMarket, renderMarket } = marketSystem;

    // Event System (P3-T2)
    const eventSystem = createEventSystem({
      st,
      dirty,
      pushLog,
      eventBus,
      buildings,
      skills,
      sfxSuccess: sfxBuy,
      sfxFail: () => { /* optional fail sound */ }
    });
    const { tick: tickEvent } = eventSystem;

    const claimAchievement = (a) => {
      if(!a.reward||a.claimed) return;
      a.claimed=true; grantReward(a.reward,`成就「${a.name}」`); saveGame();
    };

    const renderSystem = createRenderSystem({
      st,
      disp,
      dirty,
      buildings,
      upgrades,
      skills,
      achievements,
      questChain,
      buildingViewMap,
      upgradeViewMap,
      skillViewMap,
      achievViewMap,
      modeButtons,
      speedButtons,
      autoBuyBtn,
      soundBtn,
      gearsEl,
      gpsEl,
      rpDisplayEl,
      rpMetaEl,
      manualDesc,
      offlineEl,
      offlineTextEl,
      rewardFeedEl,
      eventLogEl,
      statBldEl,
      statUpgEl,
      statAchEl,
      statQstEl,
      statModeEl,
      statLifeEl,
      skillMasteryMetaEl,
      goalTitleEl,
      goalFillEl,
      goalHintEl,
      goalPctEl,
      questRewardEl,
      fmt,
      mktMult,
      getTotalGPS,
      getManualGain,
      getGpsBreakdown,
      affordableCount,
      purchaseCost,
      isBldUnlocked,
      price,
      upgradeLockedReason,
      claimAchievement,
      grantReward,
      saveGame,
      renderMarket,
      getTotalSkillLevels,
      SKILL_MASTERY_BONUS,
      SMOOTH_SPEED,
      RENDER_THROTTLE,
    });
    const { render } = renderSystem;

    const debugSystem = createDebugSystem({
      st,
      buildings,
      getGpsBreakdown,
      SAVE_KEY,
      fmt,
    });

    // ════════════════════════════════════════════════
    // ⑲ 事件绑定
    // ════════════════════════════════════════════════
    manualBtn.addEventListener("click",(e)=>{
      const gain=getManualGain();
      st.gears+=gain; st.lifetimeGears+=gain; st.totalClicks++;
      if(st.marketIsBull) {
        st.bullClicks++;
        st.marketMomentum = Math.min(MARKET_MOMENTUM_CAP, (st.marketMomentum || 0) + 1);
        st.marketMomentumTimer = MARKET_MOMENTUM_DURATION;
      }
      if(st.totalClicks===1) pushLog("完成首次撮合");
      eventBus.emit("manual:clicked", { x: e.clientX, y: e.clientY, gain });
      dirty.gears = dirty.stats = true;
      saveGame();
    });

    buildingListEl.addEventListener("click",e=>{
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.buy; if(!id)return;
      buyBuilding(id);
      eventBus.emit('building:purchased', { id });
    });
    upgradeListEl.addEventListener("click",e=>{
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.upgrade; if(!id)return;
      buyUpgrade(id);
      eventBus.emit('upgrade:purchased', { id });
    });
    skillListEl.addEventListener("click",e=>{
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.skbuy; if(!id)return; buySkill(id);
    });

    document.querySelector(".controls").addEventListener("click",e=>{
      if(!(e.target instanceof HTMLButtonElement))return;
      const mode=e.target.dataset.mode;
      if(mode){st.purchaseMode=mode;saveGame();return;}
      const spd=Number(e.target.dataset.speed);
      if([1,2,4].includes(spd)){st.gameSpeed=spd;saveGame();return;}
      const id=e.target.id;
      if(id==="autoBuyBtn"){ st.autoBuy=!st.autoBuy; pushLog(`自动投资已${st.autoBuy?"开启":"关闭"}`); dirty.logs = dirty.stats = true; saveGame(); }
      if(id==="soundBtn")  { st.soundEnabled=!st.soundEnabled; saveGame(); }
      if(id==="langBtn")   { 
        const newLang = I18N.toggle(); 
        e.target.textContent = `语言: ${newLang === 'zh' ? '中文' : 'English'}`;
        pushLog(`语言已切换为: ${newLang === 'zh' ? '中文' : 'English'}`);
        location.reload();
      }
    });

    $("exportSaveBtn").addEventListener("click",()=>{exportSave();});
    $("importSaveBtn").addEventListener("click",()=>{importSave();dirty.gears = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;});

    claimBtn.addEventListener("click",()=>{
      if(st.pendingOfflineGears<=0)return;
      spawnFloat(window.innerWidth/2,window.innerHeight/2,`+${fmt(st.pendingOfflineGears)} 💤`,"#fbbf24");
      st.gears+=st.pendingOfflineGears; st.lifetimeGears+=st.pendingOfflineGears;
      st.pendingOfflineGears=0; dirty.gears = dirty.stats = true;
      saveGame();
    });

    $("prestigeBtn").addEventListener("click",()=>{
      const gain=GameFormulas.calcPrestigeGain({ lifetimeGears: st.lifetimeGears, divisor: 2000 });
      if(gain<=0){alert("历史资本不足，无法增发股权。");return;}
      if(!confirm(`增发股权可获得 ${gain} RP，本轮进度将重置。继续？`))return;
      st.researchPoints+=gain; pushLog(`增发股权，获得 +${gain} RP`);
      Object.assign(st,{gears:0,purchaseMode:"1",pendingOfflineGears:0,accumulator:0,
        manualPower:1,manualMult:1,gpsMultiplier:1,totalClicks:0,lifetimeGears:0,
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,lastAutoPlanTarget:"",bullClicks:0,marketMomentum:0,marketMomentumTimer:0,policyRate:POLICY_RATE_DEFAULT,policyHedge:0,macroEventId:"",macroEventTimer:0,macroPreferredBuildingId:"",lastMacroEventId:"",macroChainCount:0,rateOutlookDirection:"上调",rateOutlookBiasUp:POLICY_GUIDANCE_BASE_BIAS,rateOutlookConfidence:0,rateOutlookHits:0,rateOutlookMisses:0,skillMasteryTier:0,logTrimNotified:false});
      buildings.forEach(b=>b.owned=0);
      upgrades.forEach(u=>u.purchased=false);
      skills.forEach(s=>s.level=0);
      achievements.forEach(a=>{a.done=false;a.claimed=false;});
      Object.keys(bldBoost).forEach(k=>bldBoost[k]=1);
      dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;
      saveGame();render(true);
    });

    $("resetSaveBtn").addEventListener("click",()=>{
      if(!confirm("确认清盘？所有进度将归零。"))return;
      localStorage.removeItem(SAVE_KEY);
      Object.assign(st,{gears:0,purchaseMode:"1",pendingOfflineGears:0,accumulator:0,
        manualPower:1,manualMult:1,gpsMultiplier:1,totalClicks:0,lifetimeGears:0,researchPoints:0,
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,lastAutoPlanTarget:"",
        bullClicks:0,marketMomentum:0,marketMomentumTimer:0,policyRate:POLICY_RATE_DEFAULT,policyHedge:0,macroEventId:"",macroEventTimer:0,macroPreferredBuildingId:"",lastMacroEventId:"",macroChainCount:0,rateOutlookDirection:"上调",rateOutlookBiasUp:POLICY_GUIDANCE_BASE_BIAS,rateOutlookConfidence:0,rateOutlookHits:0,rateOutlookMisses:0,marketIsBull:true,marketTimer:35,marketCycleDuration:35,
        soundEnabled:true,skillMasteryTier:0,logs:["[--:--:--] 清盘重来"],logTrimNotified:false});
      buildings.forEach(b=>b.owned=0);
      upgrades.forEach(u=>u.purchased=false);
      skills.forEach(s=>s.level=0);
      achievements.forEach(a=>{a.done=false;a.claimed=false;});
      Object.keys(bldBoost).forEach(k=>bldBoost[k]=1);
      dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;
      render(true);
    });

    // ════════════════════════════════════════════════
    // ⑳ 初始化 & 主循环
    // ════════════════════════════════════════════════
    buildings.forEach(createBuildingRow);
    upgrades.forEach(createUpgradeRow);
    skills.forEach(createSkillRow);
    achievements.forEach(createAchievRow);
    renderChangelog();

    loadGame();
    refreshSkillMastery(true);
    dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;

    const loopSystem = createLoopSystem({
      st,
      dirty,
      MAX_ACCUMULATED_SECS,
      FIXED_STEP,
      SAVE_INTERVAL,
      getTotalGPS,
      tickMarket,
      tickEvent,
      tryAutoBuy,
      saveGame,
      render,
      onAfterFrame: debugSystem.update,
    });

    loopSystem.startLoop();

    // ════════════════════════════════════════════════
    // ㉑ 滚动更新检测系统
    // ════════════════════════════════════════════════
    const updateDetection = createUpdateDetectionSystem({
      currentVersion: APP_VERSION,
      checkIntervalMs: 5 * 60 * 1000, // 5 分钟检测一次
      versionUrl: './version.json',
      enabled: !window.location.search.includes('noupdate=1'), // URL参数可禁用
      onUpdateAvailable: ({ currentVersion, newVersion, dismiss, reload }) => {
        // 使用游戏内通知系统显示更新提示
        pushLog(`🚀 新版本 ${newVersion} 可用！当前版本: ${currentVersion}`);
        // 延迟显示 Toast 避免干扰初始加载
        setTimeout(() => {
          if (typeof I18N !== 'undefined' && I18N.getCurrentLang() === 'en') {
            // 英文提示
            const toast = document.createElement('div');
            toast.className = 'update-toast';
            toast.innerHTML = `
              <div class="update-toast-content">
                <span class="update-icon">🚀</span>
                <span class="update-text">New version ${newVersion} available!</span>
                <button class="update-btn update-btn-primary" id="updateBtnReload">Reload</button>
                <button class="update-btn update-btn-secondary" id="updateBtnDismiss">Later</button>
              </div>
            `;
            document.body.appendChild(toast);
            toast.querySelector('#updateBtnReload').addEventListener('click', reload);
            toast.querySelector('#updateBtnDismiss').addEventListener('click', () => {
              dismiss();
              toast.remove();
            });
          }
        }, 2000);
      },
      onError: (err) => {
        // 静默处理错误，不干扰用户体验
        if (window.console && console.debug) {
          console.debug('Update check failed:', err.message);
        }
      },
    });

    // 启动滚动更新检测（延迟启动，避免干扰初始加载）
    setTimeout(() => updateDetection.start(), 10000); // 10 秒后启动

    // ════════════════════════════════════════════════
    // ㉒ 新手引导系统 (P4-T3)
    // ════════════════════════════════════════════════
    const tutorialSystem = createTutorialSystem({
      st,
      I18N,
      eventBus,
      onComplete: () => {
        pushLog('✅ 新手引导完成！开始你的金融帝国之旅吧！');
      },
      onSkip: () => {
        pushLog('⏭️ 已跳过新手引导');
      },
    });

    // 延迟启动新手引导（等游戏完全加载后）
    setTimeout(() => {
      tutorialSystem.start();
    }, 1500);

    // 调试命令：window.resetTutorial() 可重置引导
    window.resetTutorial = () => {
      tutorialSystem.reset();
      location.reload();
    };

    // ════════════════════════════════════════════════
    // ㉓ 每日任务系统 (P5-T2)
    // ════════════════════════════════════════════════
    const dailyQuestSystem = createDailyQuestSystem({
      st,
      I18N,
      eventBus,
      buildings,
      pushLog,
      saveGame,
      onQuestComplete: ({ quest, reward }) => {
        pushLog(`🎁 领取每日任务奖励: ${reward} ${quest.rewardType === 'rp' ? 'RP' : '资本'}`);
      },
      onAllComplete: ({ bonusRP }) => {
        pushLog(`🌟 每日任务全部完成! 额外获得 ${bonusRP} RP`);
      },
    });

    // 初始化每日任务
    dailyQuestSystem.init();
    dailyQuestSystem.setupEventListeners();

    // 在游戏循环中追踪收益
    const originalOnAfterFrame = debugSystem.update;
    debugSystem.update = (dtSec) => {
      originalOnAfterFrame(dtSec);
      dailyQuestSystem.trackEarnedGears();
    };

    // 添加每日任务面板到UI（延迟确保DOM就绪）
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const questContainer = document.createElement('div');
        questContainer.id = 'dailyQuestContainer';
        questContainer.style.marginTop = '16px';
        questContainer.innerHTML = dailyQuestSystem.renderQuestPanel();
        statsPanel.appendChild(questContainer);
        dailyQuestSystem.bindClaimButtons(questContainer);
      }
    }, 2000);

    // 调试命令：window.resetDailyQuests() 可重置每日任务
    window.resetDailyQuests = () => {
      localStorage.removeItem('dailyQuestData');
      localStorage.removeItem('dailyQuestLastReset');
      location.reload();
    };

    // ════════════════════════════════════════════════
    // ㉔ 数据分析埋点系统 (P5-T5)
    // ════════════════════════════════════════════════
    const analyticsSystem = createAnalyticsSystem({
      st,
      eventBus,
      enabled: true,
    });

    // 初始化数据分析
    analyticsSystem.init();

    // 监听 Prestige 事件
    eventBus.on('prestige:executed', () => {
      analyticsSystem.track('prestiges');
    });

    // 调试命令：window.getAnalytics() 查看统计
    window.getAnalytics = () => {
      console.log('Analytics Stats:', analyticsSystem.getStats());
      return analyticsSystem.getStats();
    };

    // 调试命令：window.exportAnalytics() 导出原始数据
    window.exportAnalytics = () => {
      console.log('Analytics Raw Data:', analyticsSystem.exportData());
      return analyticsSystem.exportData();
    };

    // 调试命令：window.clearAnalytics() 清除数据
    window.clearAnalytics = () => {
      analyticsSystem.clearData();
      console.log('Analytics data cleared');
      location.reload();
    };

    // ════════════════════════════════════════════════
    // ㉕ 排行榜系统 (P5-T1)
    // ════════════════════════════════════════════════
    const leaderboardSystem = createLeaderboardSystem({
      st,
      buildings,
      skills,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化排行榜
    leaderboardSystem.init();

    // 添加排行榜面板到UI（延迟确保DOM就绪）
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        // 在每日任务之前插入排行榜
        const questContainer = document.getElementById('dailyQuestContainer');
        const leaderboardContainer = document.createElement('div');
        leaderboardContainer.id = 'leaderboardContainer';
        leaderboardContainer.innerHTML = leaderboardSystem.renderLeaderboardPanel() +
                                         leaderboardSystem.renderHistoryPanel();

        if (questContainer) {
          statsPanel.insertBefore(leaderboardContainer, questContainer);
        } else {
          statsPanel.appendChild(leaderboardContainer);
        }
      }
    }, 2500);

    // 定期刷新排行榜UI（每30秒）
    setInterval(() => {
      const container = document.getElementById('leaderboardContainer');
      if (container) {
        container.innerHTML = leaderboardSystem.renderLeaderboardPanel() +
                              leaderboardSystem.renderHistoryPanel();
      }
    }, 30000);

    // 调试命令：window.resetLeaderboard() 重置排行榜
    window.resetLeaderboard = () => {
      leaderboardSystem.resetData();
      console.log('Leaderboard data cleared');
      location.reload();
    };

    // ════════════════════════════════════════════════
    // ㉖ 邀请好友系统 (P5-T4)
    // ════════════════════════════════════════════════
    const inviteSystem = createInviteSystem({
      st,
      I18N,
      eventBus,
      pushLog,
      saveGame,
      onInviteSuccess: ({ friend, rewardGears, rewardRP }) => {
        pushLog(`🎉 好友邀请奖励发放成功！+${rewardGears} 资本, +${rewardRP} RP`);
      },
    });

    // 初始化邀请系统（需要在最前面，因为会检查URL参数）
    inviteSystem.init();

    // 添加邀请面板到UI
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const inviteContainer = document.createElement('div');
        inviteContainer.id = 'inviteContainer';
        inviteContainer.innerHTML = inviteSystem.renderInvitePanel();
        statsPanel.insertBefore(inviteContainer, statsPanel.firstChild);
        inviteSystem.bindInviteButtons(inviteContainer);
      }
    }, 3000);

    // 调试命令：window.getInviteStats() 查看邀请统计
    window.getInviteStats = () => {
      const stats = inviteSystem.getInviteStats();
      console.log('Invite Stats:', stats);
      return stats;
    };

    // 调试命令：window.resetInvite() 重置邀请数据
    window.resetInvite = () => {
      inviteSystem.resetData();
      console.log('Invite data cleared');
      location.reload();
    };

    // ════════════════════════════════════════════════
    // ㉗ 产业链联动系统 (P6-T2)
    // ════════════════════════════════════════════════
    const synergySystem = createSynergySystem({
      buildings,
      st,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化产业链系统
    synergySystem.init();

    // 将产业链加成应用到经济系统
    economy.setSynergyMultiplier(() => {
      const global = synergySystem.calculateGlobalSynergy();
      return global.globalMultiplier;
    });

    // 添加产业链面板到UI（在排行榜之后）
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const synergyContainer = document.createElement('div');
        synergyContainer.id = 'synergyContainer';
        synergyContainer.innerHTML = synergySystem.renderGlobalSynergyPanel();

        // 插入在排行榜之后
        const leaderboardContainer = document.getElementById('leaderboardContainer');
        if (leaderboardContainer && leaderboardContainer.nextSibling) {
          statsPanel.insertBefore(synergyContainer, leaderboardContainer.nextSibling);
        } else {
          statsPanel.insertBefore(synergyContainer, statsPanel.firstChild);
        }
      }
    }, 2800);

    // 定期刷新产业链面板（每30秒）
    setInterval(() => {
      const container = document.getElementById('synergyContainer');
      if (container) {
        container.innerHTML = synergySystem.renderGlobalSynergyPanel();
      }
    }, 30000);

    // 监听产业链加成变化
    eventBus.on('synergy:activated', ({ building, bonus }) => {
      pushLog(`🔗 产业链加成激活！${building} 获得 ${((bonus - 1) * 100).toFixed(0)}% 加成`);
    });

    // 调试命令：window.getSynergyInfo() 查看产业链详情
    window.getSynergyInfo = (buildingId) => {
      const info = synergySystem.getBuildingSynergyInfo(buildingId);
      console.log('Synergy Info:', info);
      return info;
    };

    // ════════════════════════════════════════════════
    // ㉘ 金融衍生品系统 (P6-T1)
    // ════════════════════════════════════════════════
    const derivativesSystem = createDerivativesSystem({
      st,
      market,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化衍生品系统
    derivativesSystem.init();

    // 添加衍生品面板到UI（在产业链面板之后）
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const derivativesContainer = document.createElement('div');
        derivativesContainer.id = 'derivativesContainer';
        derivativesContainer.innerHTML =
          derivativesSystem.renderFuturesPanel() +
          derivativesSystem.renderOptionsPanel() +
          derivativesSystem.renderStatsPanel();

        // 插入在产业链面板之后
        const synergyContainer = document.getElementById('synergyContainer');
        if (synergyContainer && synergyContainer.nextSibling) {
          statsPanel.insertBefore(derivativesContainer, synergyContainer.nextSibling);
        } else {
          statsPanel.appendChild(derivativesContainer);
        }
      }
    }, 3200);

    // 定期刷新衍生品面板（每10秒）
    setInterval(() => {
      const container = document.getElementById('derivativesContainer');
      if (container) {
        container.innerHTML =
          derivativesSystem.renderFuturesPanel() +
          derivativesSystem.renderOptionsPanel() +
          derivativesSystem.renderStatsPanel();
      }
    }, 10000);

    // 监听衍生品事件
    eventBus.on('futures:opened', ({ contract, margin }) => {
      pushLog(`📈 期货${contract.type === 'long' ? '做多' : '做空'}开仓成功，保证金: ${formatNumber(margin)}`);
    });

    eventBus.on('futures:closed', ({ contract, pnl }) => {
      const profit = pnl >= 0;
      pushLog(`${profit ? '📈' : '📉'} 期货平仓: ${profit ? '盈利' : '亏损'} ${formatNumber(Math.abs(pnl))}`);
    });

    eventBus.on('futures:liquidated', ({ contract, pnl }) => {
      pushLog(`💥 期货爆仓！亏损: ${formatNumber(Math.abs(pnl))}`);
    });

    eventBus.on('options:purchased', ({ contract, premium }) => {
      pushLog(`🛡️ 购买${contract.type === 'call' ? '看涨' : '看跌'}期权，权利金: ${formatNumber(premium)}`);
    });

    // 调试命令：window.openFutures(type, leverage, value) 开期货仓
    window.openFutures = (type, leverage, contractValue) => {
      const result = derivativesSystem.openFutures({ type, leverage, contractValue });
      console.log('Open Futures:', result);
      return result;
    };

    // 调试命令：window.closeFuturesPosition(id) 平期货仓
    window.closeFuturesPosition = (contractId) => {
      const result = derivativesSystem.closeFutures(contractId);
      console.log('Close Futures:', result);
      return result;
    };

    // 调试命令：window.buyOptions(type, strikePrice, value, expiryDays) 购买期权
    window.buyOptions = (type, strikePrice, contractValue, expiryDays) => {
      const result = derivativesSystem.buyOptions({ type, strikePrice, contractValue, expiryDays });
      console.log('Buy Options:', result);
      return result;
    };

    // 调试命令：window.getDerivativesStats() 查看衍生品统计
    window.getDerivativesStats = () => {
      const stats = derivativesSystem.getStats();
      const config = derivativesSystem.getConfig();
      console.log('Derivatives Stats:', stats);
      console.log('Derivatives Config:', config);
      return { stats, config };
    };

    // ════════════════════════════════════════════════
    // ㉙ 全球化市场系统 (P6-T3)
    // ════════════════════════════════════════════════
    const globalMarketSystem = createGlobalMarketSystem({
      st,
      market,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化全球化市场系统
    globalMarketSystem.init();

    // 将地区加成应用到经济系统
    economy.setRegionMultiplier(() => {
      const bonus = globalMarketSystem.getRegionBonus();
      return bonus.productionMultiplier;
    });

    // 添加全球市场面板到UI（在衍生品面板之后）
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const globalMarketContainer = document.createElement('div');
        globalMarketContainer.id = 'globalMarketContainer';
        globalMarketContainer.innerHTML =
          globalMarketSystem.renderRegionPanel() +
          globalMarketSystem.renderArbitragePanel() +
          globalMarketSystem.renderInvestmentPanel();

        // 插入在衍生品面板之后
        const derivativesContainer = document.getElementById('derivativesContainer');
        if (derivativesContainer && derivativesContainer.nextSibling) {
          statsPanel.insertBefore(globalMarketContainer, derivativesContainer.nextSibling);
        } else {
          statsPanel.appendChild(globalMarketContainer);
        }
      }
    }, 3400);

    // 定期刷新全球市场面板（每5秒）
    setInterval(() => {
      const container = document.getElementById('globalMarketContainer');
      if (container) {
        container.innerHTML =
          globalMarketSystem.renderRegionPanel() +
          globalMarketSystem.renderArbitragePanel() +
          globalMarketSystem.renderInvestmentPanel();
      }
    }, 5000);

    // 监听地区切换事件
    eventBus.on('region:switched', ({ from, to }) => {
      pushLog(`🌍 切换市场：${from} → ${to}`);
    });

    // 监听地区事件
    eventBus.on('region:eventStarted', ({ region, event }) => {
      pushLog(`📢 地区事件：${event.name.zh} 在 ${region} 开始！`);
    });

    // 监听套利交易
    eventBus.on('arbitrage:executed', ({ opportunity, profit }) => {
      pushLog(`💱 套利成功！收益: ${formatNumber(profit)}`);
    });

    // 调试命令：window.switchRegion(regionId) 切换地区
    window.switchRegion = (regionId) => {
      const result = globalMarketSystem.switchRegion(regionId);
      console.log('Switch Region:', result);
      return result;
    };

    // 调试命令：window.getRegionInfo() 查看地区信息
    window.getRegionInfo = () => {
      const regions = globalMarketSystem.getAllRegions();
      const current = globalMarketSystem.getCurrentRegion();
      const bonus = globalMarketSystem.getRegionBonus();
      console.log('Regions:', regions);
      console.log('Current:', current);
      console.log('Bonus:', bonus);
      return { regions, current, bonus };
    };

    // 调试命令：window.executeArbitrage(idx, amount) 执行套利
    window.executeArbitrage = (idx, amount) => {
      const opportunities = globalMarketSystem.detectArbitrageOpportunities();
      if (opportunities[idx]) {
        const result = globalMarketSystem.executeArbitrage(opportunities[idx], amount);
        console.log('Arbitrage Result:', result);
        return result;
      }
      return { success: false, error: 'Invalid opportunity index' };
    };

    // 调试命令：window.investInRegion(regionId, amount) 地区投资
    window.investInRegion = (regionId, amount) => {
      const result = globalMarketSystem.investInRegion(regionId, amount);
      console.log('Investment Result:', result);
      return result;
    };
  
