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
      const id=e.target.dataset.buy; if(!id)return; buyBuilding(id);
    });
    upgradeListEl.addEventListener("click",e=>{
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.upgrade; if(!id)return; buyUpgrade(id);
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
      tryAutoBuy,
      saveGame,
      render,
      onAfterFrame: debugSystem.update,
    });

    loopSystem.startLoop();
  
