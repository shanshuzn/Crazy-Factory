    // ════════════════════════════════════════════════
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
    const SKILL_MASTERY_STEP = 3;     // 每 3 级技能提升 1 个专精层级
    const SKILL_MASTERY_BONUS = 0.05; // 每层专精提供 +5% 总收益

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
      skillMasteryTier:0,
    };

    // 显示值（用于平滑滚动）
    const disp = { gears:0, gps:0, rp:0 };
    // 脏标记（避免每帧全量渲染）
    const dirty = { 
      gears:false, market:false, buildings:false, upgrades:false, 
      skills:false, achievements:false, quest:false, stats:false, logs:false 
    };
    let lastRender = 0;

    // 反馈参数（为什么单独抽离：调“手感”时不需要翻业务逻辑）
    const JUICE = {
      manualFloatJitter: 10,       // 点击飘字横向随机幅度(px)
      rippleDurationMs: 400,       // 手动点击涟漪持续时间
      marketFlashDurationMs: 250,  // 市场切换屏闪时长
      marketShakePx: 6,            // 市场切换屏幕抖动强度
      marketShakeMs: 220,          // 市场切换屏幕抖动时间
      clickPulseResetReflow: true, // 允许强制 reflow 来稳定触发点击 pulse
    };

    // ════════════════════════════════════════════════
