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

    // 轻量事件总线（为什么：把反馈层与业务层解耦，后续可独立替换成更复杂 VFX 系统）
    const eventBus = (() => {
      const listeners = new Map();
      const on = (event, handler) => {
        const bucket = listeners.get(event) || [];
        bucket.push(handler);
        listeners.set(event, bucket);
      };
      const emit = (event, payload) => {
        (listeners.get(event) || []).forEach((fn) => fn(payload));
      };
      return { on, emit };
    })();

    // ════════════════════════════════════════════════
    // ⑨ 工具函数（生产层，独立于 DOM）
    // ════════════════════════════════════════════════
    const bld      = (id) => buildings.find(b=>b.id===id);
    const skillLv  = (id) => skills.find(s=>s.id===id)?.level||0;
    const discount = ()   => Math.max(0.6, 1 - skillLv("bulk_discount")*0.04);
    const price    = (b,off=0) => Math.floor(b.basePrice * Math.pow(PRICE_GROWTH, b.owned+off) * discount());

    // 建筑产出：基础 dps × 专属倍率
    const bldGPS   = (b) => b.dps * b.owned * (bldBoost[b.id]||1);
    const baseGPS  = ()  => buildings.reduce((s,b)=>s+bldGPS(b),0);
    const resMult  = ()  => 1 + st.researchPoints * 0.1;
    const skillGPS = ()  => 1 + skillLv("line_optimizer")*0.25;
    const mktMult  = ()  => {
      const base = st.marketIsBull ? MARKET_BULL_BONUS : MARKET_BEAR_PENALTY;
      return st.marketIsBull ? base*(1+skillLv("market_sense")*0.1) : base;
    };
    const getTotalGPS  = () => baseGPS() * st.gpsMultiplier * resMult() * skillGPS() * mktMult();
    const getManualGain= () => st.manualPower * st.manualMult * (1+skillLv("manual_mastery")*0.3);

    // ── 批量购买计算（生产层独立）──
    const affordableCount = (b,budget,mode) => {
      if (mode==="1") return budget>=price(b)?1:0;
      if (mode==="10"||mode==="100") {
        const tgt=Number(mode); let tot=0;
        for (let i=0;i<tgt;i++){tot+=price(b,i);if(tot>budget)return i;}
        return tgt;
      }
      let n=0,tot=0;
      while(n<10000){tot+=price(b,n);if(tot>budget)return n;n++;}
      return n;
    };
    const purchaseCost = (b,n) => { let c=0; for(let i=0;i<n;i++) c+=price(b,i); return c; };

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

    // ════════════════════════════════════════════════
    // ⑩ Web Audio 音效（M3）
    //    无外部依赖，纯 AudioContext 合成
    // ════════════════════════════════════════════════
    let audioCtx = null;
    const getAudioCtx = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      return audioCtx;
    };

    const playTone = (freq, type, duration, gainVal, detune=0) => {
      if (!st.soundEnabled) return;
      try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain= ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type      = type;
        osc.frequency.value = freq;
        osc.detune.value    = detune;
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(); osc.stop(ctx.currentTime + duration);
      } catch {}
    };

    // 三种音效场景（调频率/时长调手感）
    const sfxClick   = () => playTone(520, "triangle", 0.08, 0.12);        // 手动撮合：短促高音
    const sfxBuy     = () => { playTone(330,"square",0.12,0.08); playTone(440,"square",0.1,0.06,50); }; // 购买：双音上扬
    const sfxUpgrade = () => { playTone(660,"sine",0.15,0.1); setTimeout(()=>playTone(880,"sine",0.2,0.08),80); }; // 研发：上扬双音
    const sfxMarket  = (bull) => playTone(bull?330:220, "sawtooth", 0.25, 0.06, bull?0:-20); // 市场切换

    // ════════════════════════════════════════════════
    // ⑪ 市场切换（含屏闪动效 M3）
    // ════════════════════════════════════════════════
    const doMarketSwitch = () => {
      st.marketIsBull = !st.marketIsBull;
      st.marketCycleDuration = MARKET_CYCLE_MIN + Math.random()*(MARKET_CYCLE_MAX-MARKET_CYCLE_MIN);
      st.marketTimer = st.marketCycleDuration;
      const label = st.marketIsBull ? "📈 多头行情爆发！" : "📉 空头来袭，注意风控";
      pushLog(label); st.lastRewardText = label;
      sfxMarket(st.marketIsBull);
      dirty.market = true; dirty.logs = true;
      eventBus.emit("market:switched", { isBull: st.marketIsBull });
    };

    const tickMarket = (dt) => {
      st.marketTimer -= dt * st.gameSpeed;
      if (st.marketTimer <= 0) doMarketSwitch();
    };

    // ════════════════════════════════════════════════
    // ⑬ 浮动数字特效
    // ════════════════════════════════════════════════
    const spawnFloat = (x,y,text,color="#fbbf24")=>{
      const el=document.createElement("div");
      el.className="float-num"; el.textContent=text;
      el.style.left=`${x}px`; el.style.top=`${y}px`; el.style.color=color;
      document.body.appendChild(el);
      el.addEventListener("animationend",()=>el.remove());
    };

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
    const claimAchievement = (a) => {
      if(!a.reward||a.claimed) return;
      a.claimed=true; grantReward(a.reward,`成就「${a.name}」`); saveGame();
    };

    // ════════════════════════════════════════════════
    // ⑯ 解锁条件检查
    // ════════════════════════════════════════════════
    const upgradeLockedReason = (u) => {
      if(st.researchPoints<u.unlockRP) return `需要 ${u.unlockRP} RP`;
      if(u.requires){ const r=upgrades.find(x=>x.id===u.requires); if(r&&!r.purchased) return `前置：${r.name}`; }
      // 建筑专属升级：只有在对应建筑已解锁时才显示
      if(u.type==="bldBoost"){
        const b=bld(u.value.id);
        if(b&&st.lifetimeGears<b.unlock) return `解锁「${b.name}」后可用`;
      }
      return "";
    };
    const isBldUnlocked = (b) => st.lifetimeGears >= b.unlock;

    // ════════════════════════════════════════════════
    // ⑰ 购买操作
    // ════════════════════════════════════════════════
    const buyBuilding = (id) => {
      const b=bld(id); if(!b||!isBldUnlocked(b)) return;
      const n=affordableCount(b,st.gears,st.purchaseMode); if(n<=0) return;
      const pc=st.purchaseMode==="max"?n:Math.min(n,Number(st.purchaseMode)||1);
      const cost=purchaseCost(b,pc); if(st.gears<cost) return;
      st.gears-=cost; b.owned+=pc;
      pushLog(`收购 ${b.emoji}${b.name} ×${pc}（-${fmt(cost)}）`);
      sfxBuy();
      // 购买弹跳动效（M3）
      const v=buildingViewMap.get(id);
      if(v){ v.row.classList.remove("bought"); void v.row.offsetWidth; v.row.classList.add("bought"); }
      dirty.buildings = dirty.stats = dirty.logs = true;
      saveGame();
    };

    const buyUpgrade = (id) => {
      const u=upgrades.find(x=>x.id===id); if(!u||u.purchased) return;
      const locked=upgradeLockedReason(u); if(locked||st.gears<u.price) return;
      st.gears-=u.price; u.purchased=true;
      applyUpgradeEffect(u);
      dirty.upgrades = dirty.buildings = dirty.stats = dirty.logs = true;
      saveGame();
    };

    const buySkill = (id) => {
      const sk=skills.find(s=>s.id===id);
      if(!sk||sk.level>=sk.maxLevel||st.researchPoints<sk.costRP) return;
      st.researchPoints-=sk.costRP; sk.level++;
      sfxUpgrade(); pushLog(`技能升级：${sk.name} Lv.${sk.level}`);
      dirty.skills = dirty.logs = true;
      saveGame();
    };

    const tryAutoBuy = () => {
      for(const u of upgrades){ if(u.purchased||upgradeLockedReason(u))continue; if(st.gears>=u.price){buyUpgrade(u.id);return;} }
      for(const b of [...buildings].reverse()){ if(!isBldUnlocked(b))continue; if(affordableCount(b,st.gears,"1")>0){const p=st.purchaseMode;st.purchaseMode="1";buyBuilding(b.id);st.purchaseMode=p;return;} }
    };

    // 反馈事件（为什么：避免在业务代码里散落动效细节）
    eventBus.on("manual:clicked", ({ x, y, gain }) => {
      sfxClick();
      spawnFloat(x + (Math.random() * JUICE.manualFloatJitter * 2 - JUICE.manualFloatJitter), y - 10, `+${fmt(gain)}`);
      manualBtn.classList.remove("clicked");
      if (JUICE.clickPulseResetReflow) void manualBtn.offsetWidth;
      manualBtn.classList.add("clicked");
      const rect = manualZone.getBoundingClientRect();
      manualZone.style.setProperty("--rx", `${((x - rect.left) / rect.width) * 100}%`);
      manualZone.style.setProperty("--ry", `${((y - rect.top) / rect.height) * 100}%`);
      manualZone.classList.add("ripple");
      setTimeout(() => manualZone.classList.remove("ripple"), JUICE.rippleDurationMs);
    });

    eventBus.on("market:switched", ({ isBull }) => {
      marketFlashEl.style.background = isBull ? "#10b981" : "#ef4444";
      marketFlashEl.classList.add("on");
      setTimeout(() => marketFlashEl.classList.remove("on"), JUICE.marketFlashDurationMs);

      if (!gameShellEl) return;
      gameShellEl.style.setProperty("--shake-x", `${JUICE.marketShakePx}px`);
      gameShellEl.classList.remove("screen-shake");
      void gameShellEl.offsetWidth;
      gameShellEl.classList.add("screen-shake");
      setTimeout(() => gameShellEl.classList.remove("screen-shake"), JUICE.marketShakeMs);
    });

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

    const renderMarket = () => {
      const bull=st.marketIsBull, mult=mktMult();
      marketMultEl.textContent=`×${mult.toFixed(2)}`; marketMultEl.style.color=bull?"var(--bull)":"var(--bear)";
      marketStatusEl.textContent=bull?"多头市场":"空头市场"; marketStatusEl.style.color=bull?"var(--bull)":"var(--bear)";
      marketDotEl.classList.toggle("bear",!bull);
      marketLabelEl.textContent=bull?"多头市场":"空头市场"; marketLabelEl.style.color=bull?"var(--bull)":"var(--bear)";
      const pct=bull?50+(1-st.marketTimer/st.marketCycleDuration)*50:(st.marketTimer/st.marketCycleDuration)*50;
      marketWaveEl.style.width=`${Math.max(5,Math.min(95,pct))}%`;
      marketCountEl.textContent=`切换：${Math.ceil(st.marketTimer)}s`;
      marketEffectEl.textContent=bull?`多头加成 ×${MARKET_BULL_BONUS.toFixed(1)}`:`空头折损 ×${MARKET_BEAR_PENALTY.toFixed(1)}`;
      marketEffectEl.style.color=bull?"var(--bull)":"var(--bear)";
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
        lastRewardText:"",gameSpeed:1,questIndex:0,autoBuy:false,autoBuyAccumulator:0,bullClicks:0});
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
        soundEnabled:true,logs:["[--:--:--] 清盘重来"]});
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
    dirty.market = dirty.buildings = dirty.upgrades = dirty.skills = dirty.achievements = dirty.quest = dirty.stats = dirty.logs = true;

    let lastSave = performance.now();
    const tick = (now) => {
      const dt = Math.min((now-st.lastTimestamp)/1000, MAX_ACCUMULATED_SECS);
      st.lastTimestamp = now;
      st.accumulator  += dt;

      const gps = getTotalGPS();
      while(st.accumulator >= FIXED_STEP){
        const gain = gps * FIXED_STEP * st.gameSpeed;
        st.gears += gain; st.lifetimeGears += gain;
        st.accumulator -= FIXED_STEP;
        tickMarket(FIXED_STEP);
        if(st.autoBuy){
          st.autoBuyAccumulator += FIXED_STEP*st.gameSpeed;
          if(st.autoBuyAccumulator>=0.5){st.autoBuyAccumulator=0;tryAutoBuy();}
        }
      }

      dirty.gears = dirty.market = true;
      if(now-lastSave>SAVE_INTERVAL){saveGame();lastSave=now;}
      render();
      requestAnimationFrame(tick);
    };

    render(true);
    requestAnimationFrame(tick);
  
