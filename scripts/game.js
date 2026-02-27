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
    const marketFlashEl = $("marketFlash");
    const manualBtn     = $("manualBtn");
    const manualDesc    = $("manualDesc");
    const manualZone    = $("manualZone");
    const buildingListEl= $("buildingList");
    const upgradeListEl = $("upgradeList");
    const skillListEl   = $("skillList");
    const skillMasteryMetaEl = $("skillMasteryMeta");
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
    const pushLog = (msg) => {
      st.logs.unshift(`[${new Date().toLocaleTimeString("zh-CN",{hour12:false})}] ${msg}`);
      st.logs=st.logs.slice(0,20);
      dirty.logs = true;
    };
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
      SKILL_MASTERY_BONUS,
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
      marketMultEl,
      marketStatusEl,
      marketDotEl,
      marketLabelEl,
      marketWaveEl,
      marketCountEl,
      marketEffectEl,
    });
    const { tickMarket, renderMarket } = marketSystem;

    const claimAchievement = (a) => {
      if(!a.reward||a.claimed) return;
      a.claimed=true; grantReward(a.reward,`成就「${a.name}」`); saveGame();
    };

    // ════════════════════════════════════════════════
    // ⑱ 渲染层（与生产层解耦，M1 重构核心）
    // ════════════════════════════════════════════════
    const renderQuest = () => {
      if(st.questIndex>=questChain.length){
        goalTitleEl.textContent="产业目标：全部完成！"; goalFillEl.style.width="100%";
        goalHintEl.textContent="恭喜，金融帝国已建成"; goalPctEl.textContent="100%";
        questRewardEl.textContent="全部奖励已领取"; return;
      }
      const q=questChain[st.questIndex];
      const cur=q.progress(), pct=Math.min(100,(cur/q.target)*100);
      goalTitleEl.textContent=q.title;
      goalFillEl.style.width=`${pct}%`;
      goalHintEl.textContent= cur>=q.target?"目标达成，奖励已发放":`进度 ${cur} / ${q.target}`;
      goalPctEl.textContent=`${pct.toFixed(0)}%`;
      questRewardEl.textContent=`奖励：${q.rewardText}`;
      if(cur>=q.target){ grantReward(q.reward,`任务「${q.title}」`); st.questIndex++; dirty.quest = dirty.gears = dirty.stats = dirty.logs = true; saveGame(); }
    };

    // ════════════════════════════════════════════════
    // 渲染层（带脏标记 + 数字平滑滚动）
    // ════════════════════════════════════════════════
    const smoothUpdate = (target) => {
      const diff = target - disp.gears;
      if(Math.abs(diff) < 1) { disp.gears = target; return target; }
      disp.gears += diff * SMOOTH_SPEED;
      return disp.gears;
    };

    const render = (force = false) => {
      const now = performance.now();
      if(!force && now - lastRender < RENDER_THROTTLE) return;
      lastRender = now;

      // 头部数字 - 平滑滚动
      const targetGPS = getTotalGPS();
      disp.gps += (targetGPS - disp.gps) * SMOOTH_SPEED;
      disp.gears = smoothUpdate(st.gears);
      gearsEl.textContent = fmt(disp.gears);
      gpsEl.textContent = `收益率 ${fmt(disp.gps)}/s`;
      rpDisplayEl.textContent = `${st.researchPoints} RP`;
      rpMetaEl.textContent = `研究加成 ×${resMult().toFixed(1)}`;
      manualDesc.textContent = `每次撮合 +${fmt(getManualGain())}`;
      if(dirty.market) renderMarket();

      // 建筑列表
      if(dirty.buildings){
        for(const b of buildings){
          const v=buildingViewMap.get(b.id); if(!v) continue;
          const cnt=affordableCount(b,st.gears,st.purchaseMode);
          const pc =st.purchaseMode==="max"?cnt:Math.min(cnt,Number(st.purchaseMode)||1);
          const spc=Math.max(1,pc||0);
          const unlocked=isBldUnlocked(b);
          v.ownedEl.textContent=b.owned;
          v.buyBtn.textContent=`购买 ×${spc}（${fmt(purchaseCost(b,spc))}）`;
          v.buyBtn.disabled=!(cnt>0&&unlocked);
          v.lockEl.textContent=!unlocked?`解锁条件：历史资本 ${fmt(b.unlock)}`:"";
          v.hintEl.textContent=(unlocked&&cnt<=0)?`还差 ${fmt(price(b)-st.gears)}`:"";
        }
        dirty.buildings = false;
      }

      // 升级列表
      if(dirty.upgrades){
        for(const u of upgrades){
          const v=upgradeViewMap.get(u.id); if(!v) continue;
          if(u.purchased){v.btn.textContent="已研发";v.btn.disabled=true;v.lockEl.textContent="";continue;}
          const lr=upgradeLockedReason(u);
          v.lockEl.textContent=lr;
          v.btn.textContent=`研发（${fmt(u.price)}）`;
          v.btn.disabled=st.gears<u.price||Boolean(lr);
        }
        dirty.upgrades = false;
      }

      // 任务
      if(dirty.quest) renderQuest();

      // 技能
      if(dirty.skills){
        for(const sk of skills){
          const v=skillViewMap.get(sk.id); if(!v) continue;
          v.meta.textContent=`等级 ${sk.level}/${sk.maxLevel}`;
          if(sk.level>=sk.maxLevel){v.btn.disabled=true;v.btn.textContent="已满级";}
          else{v.btn.disabled=st.researchPoints<sk.costRP;v.btn.textContent=`升级（${sk.costRP} RP）`;}
        }
        if(skillMasteryMetaEl){
          const totalLv = getTotalSkillLevels();
          skillMasteryMetaEl.textContent = `专精 T${st.skillMasteryTier} · 总技能等级 ${totalLv} · 总收益加成 ×${(1 + st.skillMasteryTier * SKILL_MASTERY_BONUS).toFixed(2)}`;
        }
        dirty.skills = false;
      }

      // 成就
      if(dirty.achievements){
        for(const a of achievements){
          if(!a.done&&a.check()){a.done=true;claimAchievement(a);}
          const v=achievViewMap.get(a.id); if(!v) continue;
          v.badge.classList.toggle("done",a.done);
          v.badge.textContent=a.done?(a.claimed?"已完成✓":"已完成"):"未完成";
        }
        dirty.achievements = false;
      }

      // 离线
      if(st.pendingOfflineGears>0){offlineEl.style.display="flex";offlineTextEl.textContent=`离线期间产生收益 ${fmt(st.pendingOfflineGears)}`;}
      else{offlineEl.style.display="none";}

      // 奖励公告
      rewardFeedEl.textContent=st.lastRewardText||"";

      // 日志 - 增量更新
      if(dirty.logs){
        eventLogEl.innerHTML="";
        for(const line of st.logs.slice(0,8)){
          const el=document.createElement("div"); el.className="log-item"; el.textContent=line;
          eventLogEl.appendChild(el);
        }
        dirty.logs = false;
      }

      // 统计摘要
      if(dirty.stats){
        statBldEl.textContent  =`产业数：${buildings.reduce((s,b)=>s+b.owned,0)}`;
        statUpgEl.textContent  =`已研发：${upgrades.filter(u=>u.purchased).length}/${upgrades.length}`;
        statAchEl.textContent  =`成就：${achievements.filter(a=>a.done).length}/${achievements.length}`;
        statQstEl.textContent  =`任务：${Math.min(st.questIndex,questChain.length)}/${questChain.length}`;
        statModeEl.textContent =`自动投资：${st.autoBuy?"开":"关"}`;
        statLifeEl.textContent =`历史资本：${fmt(st.lifetimeGears)}`;
        dirty.stats = false;
      }

      // 控制栏激活态
      modeButtons.forEach(b =>b.classList.toggle("active",b.dataset.mode===st.purchaseMode));
      speedButtons.forEach(b=>b.classList.toggle("active",Number(b.dataset.speed)===st.gameSpeed));
      autoBuyBtn.classList.toggle("active",st.autoBuy);
      autoBuyBtn.textContent=`自动投资: ${st.autoBuy?"开":"关"}`;
      soundBtn.textContent  =`音效: ${st.soundEnabled?"开":"关"}`;

      // 清除脏标记
      dirty.gears = dirty.market = false;
    };

    // ════════════════════════════════════════════════
    // ⑲ 事件绑定
    // ════════════════════════════════════════════════
    manualBtn.addEventListener("click",(e)=>{
      const gain=getManualGain();
      st.gears+=gain; st.lifetimeGears+=gain; st.totalClicks++;
      if(st.marketIsBull) st.bullClicks++;
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
      const gain=Math.floor(Math.sqrt(st.lifetimeGears/2000));
      if(gain<=0){alert("历史资本不足，无法增发股权。");return;}
      if(!confirm(`增发股权可获得 ${gain} RP，本轮进度将重置。继续？`))return;
      st.researchPoints+=gain; pushLog(`增发股权，获得 +${gain} RP`);
      Object.assign(st,{gears:0,purchaseMode:"1",pendingOfflineGears:0,accumulator:0,
        manualPower:1,manualMult:1,gpsMultiplier:1,totalClicks:0,lifetimeGears:0,
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,bullClicks:0,skillMasteryTier:0});
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
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,
        bullClicks:0,marketIsBull:true,marketTimer:35,marketCycleDuration:35,
        soundEnabled:true,skillMasteryTier:0,logs:["[--:--:--] 清盘重来"]});
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
    });

    loopSystem.startLoop();
  
