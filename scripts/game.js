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
    const perkViewMap       = new Map();
    const speedQuestViewMap = new Map();

    // 版本号
    const APP_VERSION = 'v2.10.0';
    const CHANGELOG = [
      { version: 'v2.11.0', date: '2026-08-08', notes: ['性能监控面板增强：12 项 GPS 乘数分解、FPS/帧耗时/Heap 趋势图、场景/资产配置实时状态', '官网同步 v2.11.0：新增 UGC 场景编辑器介绍与更新日志'] },
      { version: 'v2.10.0', date: '2026-08-07', notes: ['UGC 场景编辑器正式接入游戏（创建/导入/导出/模板切换）', '修复滚动更新检测在无 RAF 调度器环境下的崩溃', '存档新增场景状态持久化'] },
      { version: 'v2.9.0', date: '2026-06-08', notes: ['市场稳定性优化', '新增公会科技树', 'i18n 扩展至 10 种语言'] },
    ];

    // ════════════════════════════════════════════════
    // ⑨ 工具函数
    // ════════════════════════════════════════════════
    // ── 数值格式化 ──
    const _fmtInt = (n) => {
      // 快速千分位（整数专用，无 GC，无 locale 解析）
      if (n < 1e3) return String(n);
      if (n < 1e6) return `${Math.floor(n / 1e3)},${String(n % 1e3).padStart(3,'0')}`;
      if (n < 1e9) return `${Math.floor(n / 1e6)},${String(Math.floor(n % 1e6 / 1e3)).padStart(3,'0')},${String(n % 1e3).padStart(3,'0')}`;
      return `${Math.floor(n / 1e9)},${String(Math.floor(n % 1e9 / 1e6)).padStart(3,'0')},${String(Math.floor(n % 1e6 / 1e3)).padStart(3,'0')},${String(n % 1e3).padStart(3,'0')}`;
    };
    const fmt = (n) => {
      if (!Number.isFinite(n)) return "¥0";
      const abs=Math.abs(n), sg=n<0?"-":"";
      if(abs>=1e12) return `${sg}¥${(abs/1e12).toFixed(2)}T`;
      if(abs>=1e9)  return `${sg}¥${(abs/1e9).toFixed(2)}B`;
      if(abs>=1e6)  return `${sg}¥${(abs/1e6).toFixed(2)}M`;
      if(abs>=1e3)  return `${sg}¥${(abs/1e3).toFixed(2)}K`;
      // abs < 1000：整数用千分位，小数保留 1 位（消除 toLocaleString）
      return `${sg}¥${Number.isInteger(abs) ? _fmtInt(abs) : abs.toFixed(1).replace(/\.0$/,'')}`;
    };

    // ── 安全面板注入辅助 ──
    // 用法: injectPanel(delay, parentSelector, panelId, renderFn, insertBeforeId?)
    const injectPanel = (delay, parentSelector, panelId, renderFn, insertBeforeId) => {
      setTimeout(() => {
        const parent = document.querySelector(parentSelector);
        if (!parent) {
          console.warn(`[injectPanel] 父元素未找到: ${parentSelector}，跳过面板 ${panelId}`);
          return;
        }
        const container = document.createElement('div');
        container.id = panelId;
        container.innerHTML = renderFn();
        if (insertBeforeId) {
          const ref = document.getElementById(insertBeforeId);
          if (ref && ref.parentNode === parent) {
            parent.insertBefore(container, ref);
            return;
          }
        }
        parent.appendChild(container);
      }, delay);
    };

    // 反馈系统初始化（为什么：反馈层高频迭代，独立工厂减少对主循环的干扰）
    const feedback = createFeedbackSystem({ st, JUICE, fmt, manualBtn, manualZone, marketFlashEl, gameShellEl });
    const { eventBus, sfxBuy, sfxUpgrade, sfxMarket, spawnFloat, tickCanvas } = feedback;

    // ════════════════════════════════════════════════
    // ⑭ DOM 构建（只调用一次）
    // ════════════════════════════════════════════════
    // 灵感来源：CSDN游戏开发文章 — DocumentFragment批量DOM操作，减少初始化时的DOM回流次数
    // 创建建筑行（返回row元素，由调用方批量插入DOM）
    const createBuildingRow = (b, parentEl) => {
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
      (parentEl || buildingListEl).appendChild(row);
      buildingViewMap.set(b.id,{
        row, ownedEl:row.querySelector(`[data-owned="${b.id}"]`),
        buyBtn:row.querySelector(`[data-buy="${b.id}"]`),
        hintEl:row.querySelector(`[data-hint="${b.id}"]`),
        lockEl:row.querySelector(`[data-lock="${b.id}"]`),
      });
      // 预计算 _changed() 键（消除每帧 `b.id+'|field'` 字符串拼接分配）
      if (!b._ck) b._ck = {};
      b._ck.owned = `${b.id}|owned`;
      b._ck.buy   = `${b.id}|buy`;
      b._ck.lock  = `${b.id}|lock`;
      b._ck.hint  = `${b.id}|hint`;
    };

    // 创建升级行（支持DocumentFragment批量插入）
    const createUpgradeRow = (u, parentEl) => {
      const row=document.createElement("div");
      row.className="upgrade";
      row.innerHTML=`
        <div>
          <div class="name">${u.name}</div>
          <div class="meta">${u.desc}</div>
          <div class="meta" data-ulock="${u.id}" style="color:#f87171;margin-top:3px"></div>
        </div>
        <button class="btn upgrade-btn" data-upgrade="${u.id}">研发（${fmt(u.price)}）</button>`;
      (parentEl || upgradeListEl).appendChild(row);
      upgradeViewMap.set(u.id,{
        row,
        btn:row.querySelector(`[data-upgrade="${u.id}"]`),
        lockEl:row.querySelector(`[data-ulock="${u.id}"]`),
      });
      if (!u._ck) u._ck = {};
      u._ck.btn = `${u.id}|btn`;
      u._ck.lock = `${u.id}|lock`;
      u._ck.disabled = `${u.id}|disabled`;
    };

    // 创建技能行（支持DocumentFragment批量插入）
    const createSkillRow = (sk, parentEl) => {
      const row=document.createElement("div");
      row.className="skill";
      row.innerHTML=`
        <div>
          <div class="name">${sk.name}</div>
          <div class="meta">${sk.desc}</div>
          <div class="meta" data-smeta="${sk.id}"></div>
        </div>
        <button class="btn skill-btn" data-skbuy="${sk.id}">升级（${sk.costRP} RP）</button>`;
      (parentEl || skillListEl).appendChild(row);
      skillViewMap.set(sk.id,{
        btn:row.querySelector(`[data-skbuy="${sk.id}"]`),
        meta:row.querySelector(`[data-smeta="${sk.id}"]`),
      });
      if (!sk._ck) sk._ck = {};
      sk._ck.meta = `${sk.id}|meta`;
      sk._ck.btn = `${sk.id}|btn`;
      sk._ck.disabled = `${sk.id}|disabled`;
    };


    const renderChangelog = () => {
      if(appVersionEl) appVersionEl.textContent = APP_VERSION;
      if(!changelogListEl) return;
      changelogListEl.innerHTML = "";
      const frag = document.createDocumentFragment();
      for(const item of CHANGELOG){
        const wrap=document.createElement("article");
        wrap.className="changelog-item";
        const notes=item.notes.map(n=>`<li>${n}</li>`).join("");
        wrap.innerHTML=`<div class="changelog-head"><strong>${item.version}</strong><span>${item.date}</span></div><ul class="changelog-notes">${notes}</ul>`;
        frag.appendChild(wrap);
      }
      changelogListEl.appendChild(frag);
    };

    // 创建成就行（支持DocumentFragment批量插入）
    const createAchievRow = (a, parentEl) => {
      const row=document.createElement("div");
      row.className="achievement";
      row.innerHTML=`
        <div>
          <div class="name">${a.name}</div>
          <div class="meta">${a.desc}</div>
        </div>
        <span class="badge" data-abadge="${a.id}">未完成</span>`;
      (parentEl || achievListEl).appendChild(row);
      achievViewMap.set(a.id,{badge:row.querySelector(`[data-abadge="${a.id}"]`)});
      if (!a._ck) a._ck = {};
      a._ck.badge = `${a.id}|badge`;
    };

    // ════════════════════════════════════════════════
    // ⑮ 奖励/日志
    // ════════════════════════════════════════════════
    const LOG_CAP = 200;
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
      setSynergyMultiplier,
      invalidateROICache,
      invalidateBaseGPS,
      invalidateGPSMult,
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
    const { tickMarket, renderMarket, setScenarioParams: marketSetScenarioParams } = marketSystem;

    // ════════════════════════════════════════════════
    // UGC 场景编辑器系统（ROADMAP P0）
    // 场景参数覆盖经济/市场参数，切换时同步到各系统
    // ════════════════════════════════════════════════
    const scenarioSystem = createScenarioEditorSystem({
      st,
      eventBus,
      pushLog,
      I18N,
      buildings,
    });
    scenarioSystem.init();

    // 监听场景切换：将参数同步到经济系统与市场系统
    eventBus.on('scenario:applied', ({ params }) => {
      if (params) {
        economy.setScenarioParams(params);
        marketSetScenarioParams(params);
      } else {
        economy.setScenarioParams(null);
        marketSetScenarioParams(null);
      }
    });

    // 注入场景编辑器面板（延迟确保 DOM 就绪，插入到市场栏之后）
    setTimeout(() => {
      const marketBar = document.querySelector('.market-bar');
      const content = document.querySelector('.content');
      if (!content) return;
      const scenarioContainer = document.createElement('div');
      scenarioContainer.id = 'scenarioContainer';
      scenarioContainer.className = 'scenario-editor';
      scenarioContainer.innerHTML = scenarioSystem.renderScenarioPanel();
      content.insertBefore(scenarioContainer, content.firstChild);
      scenarioSystem.bindEvents(scenarioContainer);
    }, 1500);

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
      comboEl:$("comboDisplay"),
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
      perkViewMap,
      speedQuestViewMap,
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

    // 资产配置系统在下方创建，这里用惰性 getter 在 debug 面板刷新时再解析
    const debugSystem = createDebugSystem({
      st,
      buildings,
      getGpsBreakdown,
      SAVE_KEY,
      fmt,
      getBudgetSplit: () => (allocationSystem ? allocationSystem.getBudgetSplit(st.gears) : null),
      getRiskProfile: () => (st.assetAllocation ? st.assetAllocation.riskProfile : 'balanced'),
    });

    // ════════════════════════════════════════════════
    // ⑲ 事件绑定（含引用保存，页面卸载时统一清理，防止内存泄漏）
    // ════════════════════════════════════════════════
    // 命名 listener 引用（用于 removeEventListener）
    const _listeners = [];

    const _onManualClick = (e) => {
      const now = Date.now();
      const COMBO_WINDOW = 2000; // 2秒内连续撮合视为连击
      const prevCombo = st.combo || 0;
      // 连击：2秒内再次撮合
      if (st.lastClickTime && (now - st.lastClickTime) < COMBO_WINDOW) {
        st.combo = prevCombo + 1;
      } else {
        st.combo = 1;
      }
      st.lastClickTime = now;
      // 记录最高连击
      if (st.combo > (st.maxCombo || 0)) st.maxCombo = st.combo;
      // 连击加成倍率
      const comboMult = 1 + Math.min(st.combo - 1, 99) * 0.05; // 每级 +5%，上限 ×5
      const baseGain = getManualGain();
      const gain = Math.floor(baseGain * comboMult);
      st.gears+=gain; st.lifetimeGears+=gain; st.totalClicks++;
      if(st.marketIsBull) {
        st.bullClicks++;
        st.marketMomentum = Math.min(MARKET_MOMENTUM_CAP, (st.marketMomentum || 0) + 1);
        st.marketMomentumTimer = MARKET_MOMENTUM_DURATION;
      }
      if(st.totalClicks===1) pushLog("完成首次撮合");
      // 连击提示
      if (st.combo >= 3) pushLog(`🔥 连击 ×${st.combo}！撮合收益 ×${comboMult.toFixed(2)}`);
      eventBus.emit("manual:clicked", { x: e.clientX, y: e.clientY, gain });
      dirty.gears = dirty.stats = true;
      saveGame();
    };
    manualBtn.addEventListener("click", _onManualClick);
    _listeners.push([manualBtn, "click", _onManualClick]);

    const _onBuildingClick = (e) => {
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.buy; if(!id)return;
      buyBuilding(id);
      eventBus.emit('building:purchased', { id });
    };
    buildingListEl.addEventListener("click", _onBuildingClick);
    _listeners.push([buildingListEl, "click", _onBuildingClick]);

    const _onUpgradeClick = (e) => {
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.upgrade; if(!id)return;
      buyUpgrade(id);
      eventBus.emit('upgrade:purchased', { id });
    };
    upgradeListEl.addEventListener("click", _onUpgradeClick);
    _listeners.push([upgradeListEl, "click", _onUpgradeClick]);

    const _onSkillClick = (e) => {
      if(!(e.target instanceof HTMLButtonElement))return;
      const id=e.target.dataset.skbuy; if(!id)return; buySkill(id);
    };
    skillListEl.addEventListener("click", _onSkillClick);
    _listeners.push([skillListEl, "click", _onSkillClick]);

    const _onControlsClick = (e) => {
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
      // 以下 4 个按钮（都在 .controls 内）通过事件委托合并到此 handler
      if(id==="exportSaveBtn"){ _onExportSave(); return; }
      if(id==="importSaveBtn"){ _onImportSave(); return; }
      if(id==="prestigeBtn"){ _onPrestige(); return; }
      if(id==="resetSaveBtn"){ _onResetSave(); return; }
    };
    document.querySelector(".controls").addEventListener("click", _onControlsClick);
    _listeners.push([document.querySelector(".controls"), "click", _onControlsClick]);

    const _onExportSave = () => { exportSave(); };
    const _onImportSave = () => {
      importSave();
      dirty.gears = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;
    };
    const _onPrestige = () => {
      const gain=GameFormulas.calcPrestigeGain({ lifetimeGears: st.lifetimeGears, divisor: 2000 });
      if(gain<=0){alert("历史资本不足，无法增发股权。");return;}
      // perk_rp_bonus: 额外 +1 RP
      const totalGain = gain + (st.perkRpBonus ? 1 : 0);
      if(!confirm(`增发股权可获得 ${totalGain} RP，本轮进度将重置。继续？`))return;
      st.researchPoints+=totalGain; pushLog(`增发股权，获得 +${totalGain} RP`);
      // prestige 时重置大多数状态，但保留 perks（永久）和 speedRecords（永久）
      Object.assign(st,{gears:0,purchaseMode:"1",pendingOfflineGears:0,accumulator:0,
        manualPower:1,manualMult:1,gpsMultiplier:1,totalClicks:0,lifetimeGears:0,
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,lastAutoPlanTarget:"",bullClicks:0,marketMomentum:0,marketMomentumTimer:0,policyRate:POLICY_RATE_DEFAULT,policyHedge:0,macroEventId:"",macroEventTimer:0,macroPreferredBuildingId:"",lastMacroEventId:"",macroChainCount:0,rateOutlookDirection:"上调",rateOutlookBiasUp:POLICY_GUIDANCE_BASE_BIAS,rateOutlookConfidence:0,rateOutlookHits:0,rateOutlookMisses:0,skillMasteryTier:0,logTrimNotified:false,
        // 速通本轮数据重置（speedRecords 永久保留）
        gameStartTime:Date.now(), speedQuestIndex:0,
        // 资产配置重置为默认值（风险偏好保留，但资金分配重置）
        assetAllocation:{riskProfile:st.assetAllocation?.riskProfile||'balanced',allocation:{buildings:0.65,upgrades:0.20,derivativesMargin:0.15},stats:{lastRebalanceAt:0,totalRebalances:0}},
      });
      buildings.forEach(b=>b.owned=0);
      upgrades.forEach(u=>u.purchased=false);
      skills.forEach(s=>s.level=0);
      achievements.forEach(a=>{a.done=false;a.claimed=false;});
      Object.keys(bldBoost).forEach(k=>bldBoost[k]=1);
      dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;
      saveGame();render(true);
    };
    const _onResetSave = () => {
      if(!confirm("确认清盘？所有进度将归零。"))return;
      localStorage.removeItem(SAVE_KEY);
      Object.assign(st,{gears:0,purchaseMode:"1",pendingOfflineGears:0,accumulator:0,
        manualPower:1,manualMult:1,gpsMultiplier:1,totalClicks:0,lifetimeGears:0,researchPoints:0,
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,lastAutoPlanTarget:"",
        bullClicks:0,marketMomentum:0,marketMomentumTimer:0,policyRate:POLICY_RATE_DEFAULT,policyHedge:0,macroEventId:"",macroEventTimer:0,macroPreferredBuildingId:"",lastMacroEventId:"",macroChainCount:0,rateOutlookDirection:"上调",rateOutlookBiasUp:POLICY_GUIDANCE_BASE_BIAS,rateOutlookConfidence:0,rateOutlookHits:0,rateOutlookMisses:0,marketIsBull:true,marketTimer:35,marketCycleDuration:35,
        soundEnabled:true,skillMasteryTier:0,logs:["[--:--:--] 清盘重来"],logTrimNotified:false,
        combo:0,maxCombo:0,
        gameStartTime:Date.now(), speedQuestIndex:0,
        // 资产配置重置为默认值（全量重置）
        assetAllocation:{riskProfile:'balanced',allocation:{buildings:0.65,upgrades:0.20,derivativesMargin:0.15},stats:{lastRebalanceAt:0,totalRebalances:0}},
        // perks 在清盘时保留（永久）
      });
      buildings.forEach(b=>b.owned=0);
      upgrades.forEach(u=>u.purchased=false);
      skills.forEach(s=>s.level=0);
      achievements.forEach(a=>{a.done=false;a.claimed=false;});
      Object.keys(bldBoost).forEach(k=>bldBoost[k]=1);
      dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;
      render(true);
    };
    // claimBtn（离线收益）在 #offlineNotice 内，不在 .controls，统一管理
    const _onClaim = () => {
      if(st.pendingOfflineGears<=0)return;
      // perk_offline_mult: 离线收益 ×1.5
      const offlineGain = st.perkOfflineMult
        ? Math.floor(st.pendingOfflineGears * 1.5)
        : st.pendingOfflineGears;
      if(offlineGain > (st.maxOfflineGears||0)) st.maxOfflineGears = offlineGain;
      spawnFloat(window.innerWidth/2,window.innerHeight/2,`+${fmt(offlineGain)} 💤`,"#fbbf24");
      st.gears+=offlineGain; st.lifetimeGears+=offlineGain;
      st.pendingOfflineGears=0; dirty.gears = dirty.stats = true;
      saveGame();
    };
    claimBtn.addEventListener("click", _onClaim);
    _listeners.push([claimBtn, "click", _onClaim]);


    // ════════════════════════════════════════════════
    // ⑳ 初始化 & 主循环
    // ════════════════════════════════════════════════
    // 虚拟滚动可见性追踪（跳过离屏建筑的 DOM 更新，减少 JS 执行时间）
    // 灵感：gamedev 论坛虚拟列表模式 — 只渲染可视区域元素
    const _visibleBuildingIds = new Set();
    window.__visibleBuildingIds = _visibleBuildingIds; // render-system.js 通过 window 访问
    const _bldObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.buildingId;
        if (e.isIntersecting) _visibleBuildingIds.add(id);
        else _visibleBuildingIds.delete(id);
      }
    }, { threshold: 0.1 });

    // 灵感来源：CSDN游戏开发文章 — DocumentFragment 批量插入，将每列表的 N 次 DOM 回流合并为 1 次
    const _bldFrag = document.createDocumentFragment();
    buildings.forEach((b) => createBuildingRow(b, _bldFrag));
    buildingListEl.appendChild(_bldFrag);
    // 标记 buildingId 并开始观察（row 已在 DOM 中）
    buildings.forEach((b) => {
      const v = buildingViewMap.get(b.id);
      if (v) { v.row.dataset.buildingId = b.id; _bldObserver.observe(v.row); }
    });

    // 升级列表虚拟滚动可见性追踪
    const _visibleUpgradeIds = new Set();
    window.__visibleUpgradeIds = _visibleUpgradeIds;
    const _upgObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.upgradeId;
        if (e.isIntersecting) _visibleUpgradeIds.add(id);
        else _visibleUpgradeIds.delete(id);
      }
    }, { threshold: 0.1 });

    const _upgFrag = document.createDocumentFragment();
    upgrades.forEach((u) => createUpgradeRow(u, _upgFrag));
    upgradeListEl.appendChild(_upgFrag);
    upgrades.forEach((u) => {
      const v = upgradeViewMap.get(u.id);
      if (v) { v.row.dataset.upgradeId = u.id; _upgObserver.observe(v.row); }
    });

    const _skFrag = document.createDocumentFragment();
    skills.forEach((sk) => createSkillRow(sk, _skFrag));
    skillListEl.appendChild(_skFrag);

    const _achFrag = document.createDocumentFragment();
    achievements.forEach((a) => createAchievRow(a, _achFrag));
    achievListEl.appendChild(_achFrag);

    // 天赋列表初始化
    const _perkFrag = document.createDocumentFragment();
    if (typeof prestigePerks !== 'undefined') {
      prestigePerks.forEach((pk) => {
        const row = document.createElement('div');
        row.className = 'building-row';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)';
        const owned = st[`perk${pk.id.charAt(4).toUpperCase() + pk.id.slice(5)}`] || false;
        row.innerHTML = `
          <span style="font-size:18px">${owned ? '⭐' : '☆'}</span>
          <div style="flex:1">
            <div style="font-weight:600;color:#fbbf24">${pk.name}</div>
            <div style="font-size:12px;opacity:0.8">${pk.desc}</div>
          </div>
          <button class="btn" data-perk="${pk.id}" ${owned || st.researchPoints < pk.costRP ? 'disabled' : ''} style="background:${owned ? '#374151' : '#7c3aed'};min-width:80px">
            ${owned ? '已激活' : `${pk.costRP} RP`}
          </button>`;
        _perkFrag.appendChild(row);
        perkViewMap.set(pk.id, { row, btn: row.querySelector(`[data-perk="${pk.id}"]`) });
      });
      document.getElementById('perkList').appendChild(_perkFrag);
    }

    // 速通挑战列表初始化
    const _sqFrag = document.createDocumentFragment();
    if (typeof speedQuests !== 'undefined') {
      speedQuests.forEach((sq) => {
        const best = st.speedRecords?.[sq.id];
        const done = best != null;
        const row = document.createElement('div');
        row.className = 'building-row';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)';
        row.innerHTML = `
          <span style="font-size:18px">${done ? '🏆' : '⏱️'}</span>
          <div style="flex:1">
            <div style="font-weight:500">${sq.title}</div>
            <div style="font-size:11px;opacity:0.7">限时 ${sq.timeLimit}s · 奖励：${sq.reward.type === 'rp' ? `${sq.reward.value} RP` : `¥${sq.reward.value}`}</div>
            ${done ? `<div style="font-size:11px;color:#22c55e">最佳：${(best/1000).toFixed(1)}s ${best/1000 <= sq.timeLimit ? '✅' : '❌'}</div>` : ''}
          </div>`;
        _sqFrag.appendChild(row);
        speedQuestViewMap.set(sq.id, { row });
      });
      document.getElementById('speedQuestList').appendChild(_sqFrag);
    }

    renderChangelog();

    loadGame();
    // 读档后恢复场景参数（存档中的 activeScenario 需重新应用到经济/市场系统）
    {
      const activeScen = scenarioSystem.getActiveScenario();
      const scenParams = activeScen && activeScen.params ? activeScen.params : null;
      economy.setScenarioParams(scenParams);
      marketSetScenarioParams(scenParams);
    }
    // 首次加载或读档后，设置本局开始时间（用于速通计时）
    if (!st.gameStartTime) st.gameStartTime = Date.now();
    refreshSkillMastery(true);
    dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;

    // ════════════════════════════════════════════════
    // 资产配置/风险偏好系统 (v1.0)
    // ════════════════════════════════════════════════
    const allocationSystem = createAssetAllocationSystem({
      st,
      eventBus,
      pushLog,
      I18N,
      buildings,
    });

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
      getBudgetSplit: allocationSystem.getBudgetSplit, // 资产配置系统预算分配
      saveGame,
      render,
      onAfterFrame: (now) => { debugSystem.update(now); tickCanvas(now); },
    });

    loopSystem.startLoop();

    // Tab 可见性处理
    document.addEventListener('visibilitychange', loopSystem.handleVisibilityChange);
    _listeners.push([document, 'visibilitychange', loopSystem.handleVisibilityChange]);

    // ════════════════════════════════════════════════
    // ㉚ 国债系统 (moved before usage at line 708)
    // ════════════════════════════════════════════════
    const treasurySystem = createTreasurySystem({
      st,
      eventBus,
      pushLog,
      I18N,
      fmt,
    });
    treasurySystem.initTreasuryData();

    // 注入国债面板
    treasurySystem.injectPanel('treasuryContainer');
    treasurySystem.bindEvents('treasuryContainer');

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
    // 注：使用装饰器模式是因为 dailyQuestSystem 在 loopSystem.startLoop() 之后才初始化
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

    // ROI 缓存失效：宏观偏好建筑或市场多空切换时，ROI 排序可能反转
    eventBus.on('market:switched', () => { invalidateROICache(); invalidateGPSMult(); });
    eventBus.on('macro:changed', () => { invalidateROICache(); invalidateBaseGPS(); });

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
    // ㉕ 统一 beforeunload（整合 save/analytics 子系统的卸载逻辑）
    // ════════════════════════════════════════════════
    const _cleanupListeners = () => {
      for (const [el, type, fn] of _listeners) {
        el.removeEventListener(type, fn);
      }
      _listeners.length = 0;
    };
    window.addEventListener('beforeunload', () => {
      _cleanupListeners();
      saveGame();
      analyticsSystem.endSession();
    });

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

    // 定期刷新排行榜UI（每30秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
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
    window.synergySystem = synergySystem;

    // 将产业链加成应用到经济系统
    economy.setSynergyMultiplier(() => {
      const global = synergySystem.calculateGlobalSynergy();
      // perk_synergy_plus: 产业链联动加成额外 +50%
      const synergyMult = st.perkSynergyPlus ? global.globalMultiplier * 1.5 : global.globalMultiplier;
      return synergyMult;
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

    // 定期刷新产业链面板（每30秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
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
      market: marketSystem,
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

    // 定期刷新衍生品面板（每10秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
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
      pushLog(`📈 期货${contract.type === 'long' ? '做多' : '做空'}开仓成功，保证金: ${fmt(margin)}`);
    });

    eventBus.on('futures:closed', ({ contract, pnl }) => {
      const profit = pnl >= 0;
      pushLog(`${profit ? '📈' : '📉'} 期货平仓: ${profit ? '盈利' : '亏损'} ${fmt(Math.abs(pnl))}`);
    });

    eventBus.on('futures:liquidated', ({ contract, pnl }) => {
      pushLog(`💥 期货爆仓！亏损: ${fmt(Math.abs(pnl))}`);
    });

    eventBus.on('options:purchased', ({ contract, premium }) => {
      pushLog(`🛡️ 购买${contract.type === 'call' ? '看涨' : '看跌'}期权，权利金: ${fmt(premium)}`);
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
      market: marketSystem,
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

    // 定期刷新全球市场面板（每5秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
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
      pushLog(`💱 套利成功！收益: ${fmt(profit)}`);
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

    // 定期结算国债利息（每30秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
      treasurySystem.tickBonds(30);
      treasurySystem.tickMaturities();
      const container = document.getElementById('treasuryContainer');
      if (container) treasurySystem.injectPanel('treasuryContainer');
    }, 30000);

    // ════════════════════════════════════════════════
    // ㉛ 危机事件系统 (P6-T4)
    // ════════════════════════════════════════════════
    const crisisSystem = createCrisisSystem({
      st,
      eventBus,
      buildings,
      pushLog,
      I18N,
      economy,
    });

    // 初始化危机系统
    crisisSystem.init();

    // 添加危机面板到UI（在顶部显示）
    setTimeout(() => {
      const header = document.querySelector('.header');
      if (header) {
        const crisisContainer = document.createElement('div');
        crisisContainer.id = 'crisisContainer';
        crisisContainer.innerHTML = crisisSystem.renderCrisisPanel() + crisisSystem.renderCrisisHistory();
        header.appendChild(crisisContainer);
      }
    }, 3600);

    // 定期刷新危机面板（每1秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
      const container = document.getElementById('crisisContainer');
      if (container) {
        container.innerHTML = crisisSystem.renderCrisisPanel() + crisisSystem.renderCrisisHistory();
      }
    }, 1000);

    // 将危机效果应用到经济系统
    economy.setCrisisMultiplier(() => {
      const effects = crisisSystem.getCrisisEffects();
      if (!effects) return 1.0;
      return effects.gpsMultiplier || 1.0;
    });

    // 监听危机事件
    eventBus.on('crisis:started', ({ crisis, config }) => {
      pushLog(`${config.icon} ${config.name.zh} 危机爆发！${config.description.zh}`);
      spawnFloat(window.innerWidth/2, window.innerHeight/2, `${config.icon} ${config.name.zh}`, '#ef4444');
    });

    eventBus.on('crisis:ended', ({ crisisId, method }) => {
      const crisisName = { financial_crisis: '金融危机', pandemic: '全球疫情', cyber_attack: '网络攻击', trade_war: '贸易战', inflation_spike: '恶性通胀' }[crisisId];
      const methodText = method === 'bailout' ? '已通过救助结束' : '已自然结束';
      pushLog(`✅ ${crisisName} ${methodText}`);
      spawnFloat(window.innerWidth/2, window.innerHeight/2, `✅ ${crisisName}结束`, '#22c55e');
    });

    // 初始化资产配置系统
    allocationSystem.init();

    // 注入风险偏好参数到经济系统
    economy.setRiskLambdaFn(() => allocationSystem.getLambda());
    economy.setRiskVolatilityFn(() => allocationSystem.getVolatilityScale());

    // 监听资产配置变化事件
    eventBus.on('risk:changed', () => {
      economy.invalidateROICache();
      economy.invalidateGPSMult();
    });
    eventBus.on('allocation:changed', () => {
      economy.invalidateROICache();
    });

    // 添加资产配置面板到UI
    setTimeout(() => {
      const controls = document.querySelector('.controls');
      if (controls) {
        const allocationPanel = document.createElement('div');
        allocationPanel.id = 'allocationPanel';
        allocationPanel.innerHTML = allocationSystem.renderFullPanel();
        controls.parentNode.insertBefore(allocationPanel, controls.nextSibling);
      }
    }, 3800);

    // perk_auto_combo: 每 10s 自动触发一次虚拟撮合
    window.__timerManager.schedule(() => {
      if (!st.perkAutoCombo) return;
      const now = Date.now();
      const elapsed = st.gameStartTime ? (now - st.gameStartTime) / 1000 : 0;
      if (elapsed < 1) return;
      // 模拟 1 次撮合，应用当前连击加成
      const baseGain = getManualGain();
      const comboLevel = st.combo || 0;
      const comboMult = comboLevel >= 2 ? (1 + Math.min(comboLevel - 1, 99) * 0.05) : 1;
      const gain = Math.floor(baseGain * comboMult);
      if (gain > 0) {
        st.gears += gain;
        st.lifetimeGears += gain;
        st.totalClicks++;
        dirty.gears = dirty.stats = true;
        spawnFloat(window.innerWidth / 2, window.innerHeight / 2 - 60, `+${fmt(gain)} ⚡`, '#60a5fa');
      }
    }, 10000);

    // 监听奖励/危机随机事件
    eventBus.on('event:bonus', ({ eventId }) => {
      const bonusLabels = {
        gear_100: '💰 +100', gear_500: '💰 +500', gear_1000: '💰 +1000',
        manual_boost: '⚡ 手动+50%', policy_hedge: '🏦 利率对冲+10%',
      };
      if (bonusLabels[eventId]) spawnFloat(window.innerWidth/2, window.innerHeight/2, bonusLabels[eventId], '#fbbf24');
    });

    eventBus.on('event:crisis', ({ eventId }) => {
      const crisisLabels = {
        crisis_maintenance: '🔧 系统维护', crisis_theft: '⚠️ 安全漏洞',
      };
      if (crisisLabels[eventId]) spawnFloat(window.innerWidth/2, window.innerHeight/2, crisisLabels[eventId], '#ef4444');
    });

    // 调试命令：window.triggerCrisis(crisisId) 手动触发危机
    window.triggerCrisis = (crisisId) => {
      const result = crisisSystem.triggerCrisis(crisisId);
      console.log('Trigger Crisis:', result);
      return result;
    };

    // 调试命令：window.recoverCrisis(method) 结束危机
    window.recoverCrisis = (method = 'wait') => {
      const result = crisisSystem.recoverCrisis(method);
      console.log('Recover Crisis:', result);
      return result;
    };

    // 调试命令：window.getCrisisInfo() 查看危机信息
    window.getCrisisInfo = () => {
      const info = crisisSystem.getCrisisInfo();
      const stats = crisisSystem.getStats();
      console.log('Crisis Info:', info);
      console.log('Crisis Stats:', stats);
      return { info, stats };
    };

    // ════════════════════════════════════════════════
    // ㉛ 联盟/公会系统 (P6-T5)
    // ════════════════════════════════════════════════
    const guildSystem = createGuildSystem({
      st,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化公会系统
    guildSystem.init();

    // 将公会加成应用到经济系统
    economy.setGuildMultiplier(() => {
      return guildSystem.getTotalGPSBonus();
    });

    // 添加公会面板到UI
    setTimeout(() => {
      const statsPanel = document.querySelector('.stats');
      if (statsPanel) {
        const guildContainer = document.createElement('div');
        guildContainer.id = 'guildContainer';
        guildContainer.innerHTML = guildSystem.renderGuildPanel() + guildSystem.renderGuildRanking();
        statsPanel.appendChild(guildContainer);
      }
    }, 4000);

    // 定期刷新公会面板（每10秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
      const container = document.getElementById('guildContainer');
      if (container) {
        container.innerHTML = guildSystem.renderGuildPanel() + guildSystem.renderGuildRanking();
      }
    }, 10000);

    // 监听公会事件
    eventBus.on('guild:joined', ({ guildId, guild }) => {
      pushLog(`🏛️ 加入公会：${guild.name.zh}！享受公会加成吧！`);
    });

    eventBus.on('guild:left', ({ guildId }) => {
      pushLog(`👋 已退出公会`);
    });

    eventBus.on('guild:contributed', ({ guildId, amount }) => {
      pushLog(`💎 向公会贡献 ${fmt(amount)}！`);
    });

    eventBus.on('guild:leveledUp', ({ guildId, newLevel }) => {
      const guild = st.virtualGuilds[guildId];
      pushLog(`🎉 ${guild.name.zh} 升级到 ${newLevel} 级！公会加成提升！`);
    });

    // 调试命令：window.joinGuild(guildId) 加入公会
    window.joinGuild = (guildId) => {
      const result = guildSystem.joinGuild(guildId);
      console.log('Join Guild:', result);
      return result;
    };

    // 调试命令：window.leaveGuild() 退出公会
    window.leaveGuild = () => {
      const result = guildSystem.leaveGuild();
      console.log('Leave Guild:', result);
      return result;
    };

    // 调试命令：window.contributeToGuild(amount) 贡献公会
    window.contributeToGuild = (amount) => {
      const result = guildSystem.contribute(amount);
      console.log('Contribute:', result);
      return result;
    };

    // 调试命令：window.getGuildInfo() 查看公会信息
    window.getGuildInfo = () => {
      const info = guildSystem.getGuildInfo();
      const stats = guildSystem.getStats();
      const ranking = guildSystem.getGuildRanking();
      console.log('Guild Info:', info);
      console.log('Guild Stats:', stats);
      console.log('Guild Ranking:', ranking);
      return { info, stats, ranking };
    };

    // ════════════════════════════════════════════════
    // ㉜ 加速道具系统 (P7-T2)
    // ════════════════════════════════════════════════
    const boostSystem = createBoostSystem({
      st,
      eventBus,
      pushLog,
      I18N,
      economy,
    });

    // 初始化加速道具系统
    boostSystem.init();

    // 将道具加成应用到经济系统
    economy.setBoostMultiplier(() => {
      return boostSystem.getGPSMultiplier();
    });

    // 添加道具商店UI
    setTimeout(() => {
      const gameContainer = document.querySelector('.game');
      if (gameContainer) {
        const boostContainer = document.createElement('div');
        boostContainer.id = 'boostContainer';
        boostContainer.innerHTML =
          boostSystem.renderShopPanel() +
          boostSystem.renderInventoryPanel() +
          boostSystem.renderActiveEffectsPanel();
        gameContainer.appendChild(boostContainer);
      }
    }, 4400);

    // 定期刷新道具面板（每5秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
      const container = document.getElementById('boostContainer');
      if (container) {
        container.innerHTML =
          boostSystem.renderShopPanel() +
          boostSystem.renderInventoryPanel() +
          boostSystem.renderActiveEffectsPanel();
      }
    }, 5000);

    // 监听道具事件
    eventBus.on('boost:purchased', ({ itemId, item, price }) => {
      pushLog(`💎 购买成功：${item.name.zh} ($${price})`);
    });

    eventBus.on('boost:used', ({ itemId, item, result }) => {
      pushLog(`✨ 使用道具：${item.name.zh} - ${result.message}`);
    });

    // 调试命令：window.purchaseBoostItem(itemId) 购买道具
    window.purchaseBoostItem = async (itemId) => {
      const result = await boostSystem.purchaseItem(itemId);
      console.log('Purchase Result:', result);
      return result;
    };

    // 调试命令：window.useBoostItem(itemId) 使用道具
    window.useBoostItem = (itemId) => {
      const result = boostSystem.useItem(itemId);
      console.log('Use Result:', result);
      return result;
    };

    // 调试命令：window.getBoostInventory() 查看道具背包
    window.getBoostInventory = () => {
      const inventory = boostSystem.getInventory();
      const stats = boostSystem.getStats();
      const activeEffects = boostSystem.getActiveEffects();
      console.log('Inventory:', inventory);
      console.log('Stats:', stats);
      console.log('Active Effects:', activeEffects);
      return { inventory, stats, activeEffects };
    };

    // ════════════════════════════════════════════════
    // ㉝ 特权订阅系统 (P7-T3)
    // ════════════════════════════════════════════════
    const subscriptionSystem = createSubscriptionSystem({
      st,
      eventBus,
      pushLog,
      I18N,
    });

    // 初始化订阅系统
    subscriptionSystem.init();

    // 将订阅加成应用到经济系统
    economy.setSubscriptionMultiplier(() => {
      return subscriptionSystem.getTotalGPSBonus();
    });

    // 添加订阅UI
    setTimeout(() => {
      const gameContainer = document.querySelector('.game');
      if (gameContainer) {
        const subscriptionContainer = document.createElement('div');
        subscriptionContainer.id = 'subscriptionContainer';
        subscriptionContainer.innerHTML =
          subscriptionSystem.renderSubscriptionPanel() +
          subscriptionSystem.renderBenefitsComparison();
        gameContainer.appendChild(subscriptionContainer);
      }
    }, 4800);

    // 定期刷新订阅面板（每60秒，统一由 RAF 驱动）
    window.__timerManager.schedule(() => {
      const container = document.getElementById('subscriptionContainer');
      if (container) {
        container.innerHTML =
          subscriptionSystem.renderSubscriptionPanel() +
          subscriptionSystem.renderBenefitsComparison();
      }
    }, 60000);

    // 监听订阅事件
    eventBus.on('subscription:subscribed', ({ tier, billingCycle, price }) => {
      pushLog(`🎉 成功订阅！等级: ${tier}，周期: ${billingCycle}，价格: $${price}`);
    });

    eventBus.on('subscription:cancelled', ({ tier, expiresAt }) => {
      const daysRemaining = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      pushLog(`⚠️ 订阅已取消，还有 ${daysRemaining} 天权益`);
    });

    eventBus.on('subscription:monthlyRewardClaimed', ({ tier, reward }) => {
      pushLog(`🎁 月度奖励已领取！获得 ${reward.items.length} 个道具和 ${reward.rp} 研究点`);
    });

    // 调试命令：window.subscribe(tierId, billingCycle) 订阅
    window.subscribe = async (tierId, billingCycle = 'monthly') => {
      const result = await subscriptionSystem.subscribe(tierId, billingCycle);
      console.log('Subscribe Result:', result);
      return result;
    };

    // 调试命令：window.cancelSubscription() 取消订阅
    window.cancelSubscription = () => {
      const result = subscriptionSystem.cancelSubscription();
      console.log('Cancel Result:', result);
      return result;
    };

    // 调试命令：window.claimSubscriptionReward() 领取月度奖励
    window.claimSubscriptionReward = () => {
      const result = subscriptionSystem.claimMonthlyReward();
      console.log('Claim Result:', result);
      return result;
    };

    // 调试命令：window.getSubscriptionStatus() 查看订阅状态
    window.getSubscriptionStatus = () => {
      const status = subscriptionSystem.getSubscriptionStatus();
      const bonuses = subscriptionSystem.getSubscriptionBonuses();
      const privileges = subscriptionSystem.getSubscriptionPrivileges();
      console.log('Subscription Status:', status);
      console.log('Bonuses:', bonuses);
      console.log('Privileges:', privileges);
      return { status, bonuses, privileges };
    };
  

    // ════════════════════════════════════════════════
    // 统一定时管理器调试命令
    // ════════════════════════════════════════════════
    // window.getTimerTasks() — 查看所有已注册的定时任务
    window.getTimerTasks = () => {
      if (window.__timerManager) {
        const tasks = window.__timerManager.getTasks();
        console.table(tasks.map(t => ({
          name: t.name,
          interval: t.intervalMs + 'ms',
          nextIn: t.nextIn.toFixed(0) + 'ms',
          enabled: t.enabled,
        })));
        return tasks;
      }
      console.warn('TimerManager not found');
      return [];
    };
