═══════════════════════════════════════════════
    // ① 经济常量（调这里调手感）
    // ════════════════════════════════════════════════
    const PRICE_GROWTH         = 1.15;   // 建筑价格增长指数
    const SAVE_KEY             = "finance_empire_v2";
    const TICK_RATE            = 60;
    const FIXED_STEP           = 1 / TICK_RATE;
    const MAX_ACCUMULATED_SECS = 0.25;   // 防止补帧过多
    const OFFLINE_CAP_SECONDS  = 8 * 3600;
    const SAVE_INTERVAL        = 5000;    // 自动存档间隔(ms)
    const SMOOTH_SPEED         = 0.15;   // 数字滚动平滑速度
    const RENDER_THROTTLE      = 100;     // 渲染节流间隔(ms)

    // 市场参数
    const MARKET_CYCLE_MIN  = 25;
    const MARKET_CYCLE_MAX  = 55;
    const MARKET_BULL_BONUS = 1.4;
    const MARKET_BEAR_PENALTY = 0.7;

    // ════════════════════════════════════════════════
    // ② 产业链数据
    //    新增 2 层：中央银行 + 金融集团（M3 新建筑层级）
    //    解锁阈值经过 10 分钟曲线校准（M1 调优）
    // ════════════════════════════════════════════════
    const buildings = [
      // id            name         basePrice   dps    owned  unlock(累计)  emoji
      { id:"workshop",   name:"手工作坊",  basePrice:15,        dps:1,       owned:0, unlock:0,          emoji:"🔧" },
      { id:"factory",    name:"轻工厂",    basePrice:110,       dps:8,       owned:0, unlock:250,        emoji:"🏭" },
      { id:"logistics",  name:"物流公司",  basePrice:1200,      dps:47,      owned:0, unlock:2000,       emoji:"🚛" },
      { id:"realestate", name:"房地产",    basePrice:13000,     dps:260,     owned:0, unlock:15000,      emoji:"🏢" },
      { id:"bank",       name:"商业银行",  basePrice:140000,    dps:1400,    owned:0, unlock:100000,     emoji:"🏦" },
      { id:"fund",       name:"量化基金",  basePrice:1500000,   dps:7800,    owned:0, unlock:800000,     emoji:"📊" },
      { id:"central",    name:"中央银行",  basePrice:20000000,  dps:44000,   owned:0, unlock:12000000,   emoji:"🏛️" },  // M3 新增
      { id:"conglom",    name:"金融集团",  basePrice:300000000, dps:260000,  owned:0, unlock:180000000,  emoji:"🌐" },  // M3 新增
    ];

    // ════════════════════════════════════════════════
    // ③ 研发升级（含建筑专属升级 —— M3 建筑专属加成）
    // ════════════════════════════════════════════════
    const upgrades = [
      // 通用链
      { id:"training",    name:"员工培训",   price:300,        desc:"手动撮合 +1",            type:"manual",     value:1,    purchased:false, unlockRP:0, requires:null },
      { id:"automation",  name:"流程自动化", price:1200,       desc:"总产出 ×1.5",            type:"gps",        value:1.5,  purchased:false, unlockRP:0, requires:"training" },
      { id:"fintech",     name:"金融科技",   price:8000,       desc:"总产出 ×2",              type:"gps",        value:2,    purchased:false, unlockRP:1, requires:"automation" },
      { id:"algo",        name:"算法交易",   price:60000,      desc:"手动撮合 ×3",            type:"manualMult", value:3,    purchased:false, unlockRP:2, requires:"fintech" },
      { id:"derivatives", name:"衍生品套利", price:500000,     desc:"总产出 ×3",              type:"gps",        value:3,    purchased:false, unlockRP:3, requires:"algo" },
      { id:"quant2",      name:"量化 2.0",   price:8000000,    desc:"总产出 ×4",              type:"gps",        value:4,    purchased:false, unlockRP:5, requires:"derivatives" },
      // 建筑专属升级（每个产业解锁后可研发）
      { id:"sp_workshop",  name:"作坊精工",  price:500,        desc:"手工作坊产出 ×2",        type:"bldBoost",   value:{id:"workshop",   mult:2}, purchased:false, unlockRP:0, requires:null },
      { id:"sp_factory",   name:"流水线",    price:3500,       desc:"轻工厂产出 ×2",          type:"bldBoost",   value:{id:"factory",    mult:2}, purchased:false, unlockRP:0, requires:null },
      { id:"sp_logistics", name:"智慧物流",  price:35000,      desc:"物流公司产出 ×2",        type:"bldBoost",   value:{id:"logistics",  mult:2}, purchased:false, unlockRP:0, requires:null },
      { id:"sp_realestate",name:"土地溢价",  price:350000,     desc:"房地产产出 ×2",          type:"bldBoost",   value:{id:"realestate", mult:2}, purchased:false, unlockRP:0, requires:null },
      { id:"sp_bank",      name:"存款准备金",price:4000000,    desc:"商业银行产出 ×2",        type:"bldBoost",   value:{id:"bank",       mult:2}, purchased:false, unlockRP:1, requires:null },
      { id:"sp_fund",      name:"高频策略",  price:50000000,   desc:"量化基金产出 ×2",        type:"bldBoost",   value:{id:"fund",       mult:2}, purchased:false, unlockRP:2, requires:null },
    ];

    // 建筑专属倍率表（运行时维护，存档时持久化）
    const bldBoost = { workshop:1, factory:1, logistics:1, realestate:1, bank:1, fund:1, central:1, conglom:1 };

    // ════════════════════════════════════════════════
    // ④ 技能树
    // ════════════════════════════════════════════════
    const skills = [
      { id:"manual_mastery", name:"交易直觉",  desc:"手动收益每级 +30%",  maxLevel:5, level:0, costRP:1 },
      { id:"line_optimizer", name:"产线优化",  desc:"总产出每级 +25%",    maxLevel:5, level:0, costRP:1 },
      { id:"bulk_discount",  name:"采购折扣",  desc:"建筑价格每级 -4%",   maxLevel:5, level:0, costRP:1 },
      { id:"market_sense",   name:"市场嗅觉",  desc:"市场乘数每级 +10%",  maxLevel:3, level:0, costRP:2 },
    ];

    // ════════════════════════════════════════════════
    // ⑤ 成就
    // ════════════════════════════════════════════════
    const achievements = [
      { id:"first_click",  name:"初入江湖",  desc:"完成首次撮合",                    reward:{type:"gear",value:20},    check:()=>st.totalClicks>=1,                                                     done:false, claimed:false },
      { id:"workshop_1",   name:"小作坊主",  desc:"拥有 1 个手工作坊",               reward:{type:"gear",value:60},    check:()=>bld("workshop").owned>=1,                                              done:false, claimed:false },
      { id:"hundred",      name:"百元起步",  desc:"历史资本达到 ¥100",               reward:{type:"gear",value:150},   check:()=>st.lifetimeGears>=100,                                                 done:false, claimed:false },
      { id:"gps_50",       name:"产能初成",  desc:"总产出 ≥ ¥50/s",                 reward:{type:"rp",value:1},       check:()=>getTotalGPS()>=50,                                                     done:false, claimed:false },
      { id:"bank_owner",   name:"银行家",    desc:"拥有 1 家商业银行",               reward:{type:"rp",value:2},       check:()=>bld("bank").owned>=1,                                                  done:false, claimed:false },
      { id:"bull_market",  name:"牛市猎手",  desc:"多头市场中完成 50 次撮合",         reward:{type:"gear",value:2000},  check:()=>st.bullClicks>=50,                                                     done:false, claimed:false },
      { id:"central_bank", name:"央行行长",  desc:"拥有 1 家中央银行",               reward:{type:"rp",value:3},       check:()=>bld("central").owned>=1,                                               done:false, claimed:false },
      { id:"conglom_owner",name:"金融帝国",  desc:"拥有 1 个金融集团",               reward:{type:"rp",value:5},       check:()=>bld("conglom").owned>=1,                                               done:false, claimed:false },
    ];

    // ════════════════════════════════════════════════
    // ⑥ 任务链（M1：前 10 分钟节奏校准）
    // ════════════════════════════════════════════════
    const questChain = [
      { id:"q1", title:"任务一：手动撮合 20 次",       rewardText:"+¥200",      reward:{type:"gear",value:200},   progress:()=>Math.min(st.totalClicks,20), target:20 },
      { id:"q2", title:"任务二：拥有 10 家手工作坊",   rewardText:"+¥600",      reward:{type:"gear",value:600},   progress:()=>Math.min(bld("workshop").owned,10), target:10 },
      { id:"q3", title:"任务三：总产出 ≥ ¥100/s",     rewardText:"+1 RP",      reward:{type:"rp",value:1},       progress:()=>Math.min(getTotalGPS(),100), target:100 },
      { id:"q4", title:"任务四：拥有 5 家轻工厂",      rewardText:"+¥5000",     reward:{type:"gear",value:5000},  progress:()=>Math.min(bld("factory").owned,5), target:5 },
      { id:"q5", title:"任务五：拥有 1 家商业银行",    rewardText:"+¥50000",    reward:{type:"gear",value:50000}, progress:()=>Math.min(bld("bank").owned,1), target:1 },
      { id:"q6", title:"任务六：研发「衍生品套利」",   rewardText:"+2 RP",      reward:{type:"rp",value:2},       progress:()=>upgrades.find(u=>u.id==="derivatives")?.purchased?1:0, target:1 },
      { id:"q7", title:"任务七：拥有 1 家中央银行",    rewardText:"+¥5000000",  reward:{type:"gear",value:5000000},progress:()=>Math.min(bld("central").owned,1), target:1 },
    ];

    // ════════════════════════════════════════════════
    // ⑦ 游戏状态
    // ════════════════════════════════════════════════
    const st = {
      gears:0, purchaseMode:"1", lastTimestamp:performance.now(), accumulator:0,
      pendingOfflineGears:0, manualPower:1, manualMult:1, gpsMultiplier:1,
      totalClicks:0, lifetimeGears:0, researchPoints:0,
      lastRewardText:"", gameSpeed:1, questIndex:0, logs:[],
      autoBuy:false, autoBuyAccumulator:0,
      bullClicks:0,
      marketIsBull:true, marketTimer:35, marketCycleDuration:35,
      soundEnabled:true,
    };

    // 显示值（用于平滑滚动）
    const disp = { gears:0, gps:0, rp:0 };
    // 脏标记（避免每帧全量渲染）
    const dirty = { 
      gears:false, market:false, buildings:false, upgrades:false, 
      skills:false, achievements:false, quest:false, stats:false, logs:false 
    };
    let lastRender = 0;

    // ════════════════════════════════════════════════

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


    // 反馈系统初始化（为什么：反馈层高频迭代，独立工厂减少对主循环的干扰）
    const feedback = createFeedbackSystem({ st, JUICE, fmt, manualBtn, manualZone, marketFlashEl, gameShellEl });
    const { eventBus, sfxBuy, sfxUpgrade, sfxMarket, spawnFloat } = feedback;

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
      // 屏闪
      marketFlashEl.style.background = st.marketIsBull ? "#10b981" : "#ef4444";
      marketFlashEl.classList.add("on");
      setTimeout(()=>marketFlashEl.classList.remove("on"), 250);
    };

    const tickMarket = (dt) => {
      st.marketTimer -= dt * st.gameSpeed;
      if (st.marketTimer <= 0) doMarketSwitch();
    };

    // ════════════════════════════════════════════════
    // ⑫ 存档系统
    // ════════════════════════════════════════════════
    const saveGame = () => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        gears:st.gears, purchaseMode:st.purchaseMode, gameSpeed:st.gameSpeed,
        autoBuy:st.autoBuy, questIndex:st.questIndex, logs:st.logs.slice(0,20),
        manualPower:st.manualPower, manualMult:st.manualMult, gpsMultiplier:st.gpsMultiplier,
        totalClicks:st.totalClicks, lifetimeGears:st.lifetimeGears, researchPoints:st.researchPoints,
        bullClicks:st.bullClicks, marketIsBull:st.marketIsBull, soundEnabled:st.soundEnabled,
        buildings: buildings.map(b=>({id:b.id,owned:b.owned})),
        upgrades:  upgrades.map(u=>({id:u.id,purchased:u.purchased})),
        skills:    skills.map(s=>({id:s.id,level:s.level})),
        achievements: achievements.map(a=>({id:a.id,done:a.done,claimed:a.claimed})),
        bldBoost: {...bldBoost},
        savedAt: Date.now(),
      }));
    };

    const loadGame = () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY); if(!raw) return;
        const d = JSON.parse(raw); if(!d||typeof d!=="object") return;

        st.gears          = Number(d.gears)||0;
        st.manualPower    = Math.max(1,Number(d.manualPower)||1);
        st.manualMult     = Math.max(1,Number(d.manualMult)||1);
        st.gpsMultiplier  = Math.max(1,Number(d.gpsMultiplier)||1);
        st.totalClicks    = Math.max(0,Number(d.totalClicks)||0);
        st.lifetimeGears  = Math.max(0,Number(d.lifetimeGears)||0);
        st.researchPoints = Math.max(0,Math.floor(Number(d.researchPoints)||0));
        st.bullClicks     = Math.max(0,Number(d.bullClicks)||0);
        st.marketIsBull   = d.marketIsBull!==false;
        st.soundEnabled   = d.soundEnabled!==false;
        if(["1","10","100","max"].includes(d.purchaseMode)) st.purchaseMode=d.purchaseMode;
        if([1,2,4].includes(Number(d.gameSpeed))) st.gameSpeed=Number(d.gameSpeed);
        st.autoBuy    = Boolean(d.autoBuy);
        st.questIndex = Math.max(0,Math.min(Number(d.questIndex)||0,questChain.length));
        if(Array.isArray(d.logs)) st.logs=d.logs.slice(0,20);

        (d.buildings||[]).forEach(s=>{const t=bld(s.id);if(t)t.owned=Math.max(0,Math.floor(Number(s.owned)||0));});
        (d.upgrades||[]).forEach(s=>{const t=upgrades.find(u=>u.id===s.id);if(t){t.purchased=Boolean(s.purchased);if(t.purchased)applyUpgradeEffect(t,true);}});
        (d.skills||[]).forEach(s=>{const t=skills.find(x=>x.id===s.id);if(t)t.level=Math.max(0,Math.min(t.maxLevel,Math.floor(Number(s.level)||0)));});
        (d.achievements||[]).forEach(s=>{const t=achievements.find(a=>a.id===s.id);if(t){t.done=Boolean(s.done);t.claimed=Boolean(s.claimed);}});
        if(d.bldBoost&&typeof d.bldBoost==="object") Object.assign(bldBoost,d.bldBoost);

        const off = Math.max(0,Math.min((Date.now()-(Number(d.savedAt)||Date.now()))/1000,OFFLINE_CAP_SECONDS));
        const ofg = getTotalGPS()*off;
        if(ofg>0) st.pendingOfflineGears=ofg;
      } catch(e){ console.warn("存档读取失败",e); }
    };

    const exportSave = async () => {
      const raw=localStorage.getItem(SAVE_KEY)||"";
      if(!raw){alert("暂无存档");return;}
      try{await navigator.clipboard.writeText(raw);pushLog("存档已复制到剪贴板");}
      catch{prompt("复制以下存档：",raw);}
    };
    const importSave = () => {
      const raw=prompt("粘贴存档文本（覆盖当前进度）");if(!raw)return;
      try{
        const d=JSON.parse(raw);if(!d||typeof d!=="object")throw 0;
        localStorage.setItem(SAVE_KEY,raw);loadGame();render();pushLog("存档导入成功");
      }catch{alert("存档格式无效");}
    };

    // ── 升级效果应用（独立函数，load 时可静默重放）──
    const applyUpgradeEffect = (u, silent=false) => {
      if(u.type==="manual")     st.manualPower += u.value;
      if(u.type==="gps")        st.gpsMultiplier *= u.value;
      if(u.type==="manualMult") st.manualMult *= u.value;
      if(u.type==="bldBoost")   bldBoost[u.value.id] = (bldBoost[u.value.id]||1) * u.value.mult;
      if(!silent){ sfxUpgrade(); pushLog(`研发完成：${u.name}`); }
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

      sfxClick();
      spawnFloat(e.clientX+(Math.random()*20-10), e.clientY-10, `+${fmt(gain)}`);
      manualBtn.classList.remove("clicked"); void manualBtn.offsetWidth; manualBtn.classList.add("clicked");
      const rect=manualZone.getBoundingClientRect();
      manualZone.style.setProperty("--rx",`${((e.clientX-rect.left)/rect.width)*100}%`);
      manualZone.style.setProperty("--ry",`${((e.clientY-rect.top)/rect.height)*100}%`);
      manualZone.classList.add("ripple"); setTimeout(()=>manualZone.classList.remove("ripple"),400);

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

        soundEnabled:true,skillMasteryTier:0,logs:["[--:--:--] 清盘重来"]});

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

  
