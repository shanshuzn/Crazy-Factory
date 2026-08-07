    // ════════════════════════════════════════════════
    // ① 经济常量（调这里调手感）
    // ════════════════════════════════════════════════
    const PRICE_GROWTH         = 1.12;   // 1.15 → 1.12：降低价格指数，缩短瓶颈期
    const SAVE_KEY             = "finance_empire_v2";
    const TICK_RATE            = 60;
    const FIXED_STEP           = 1 / TICK_RATE;
    const MAX_ACCUMULATED_SECS = 0.25;   // 防止补帧过多
    const OFFLINE_CAP_SECONDS  = 6 * 3600;  // 8h → 6h：平衡离线收益与在线粘性
    const SAVE_INTERVAL        = 5000;    // 自动存档间隔(ms)
    const SMOOTH_SPEED         = 0.15;   // 数字滚动平滑速度
    const RENDER_THROTTLE      = 100;     // 渲染节流间隔(ms)

    // 市场参数
    // 优化市场稳定性：增加周期长度，缩小多头/空头差距
    const MARKET_CYCLE_MIN  = 45;        // 25 → 35 → 45：进一步延长，减少频繁切换
    const MARKET_CYCLE_MAX  = 90;        // 55 → 75 → 90：进一步延长，提升稳定性
    const MARKET_BULL_BONUS = 1.15;      // 1.4 → 1.25 → 1.15：进一步降低多头加成
    const MARKET_BEAR_PENALTY = 0.85;    // 0.7 → 0.8 → 0.85：进一步提高空头底线
    const SKILL_MASTERY_STEP = 3;     // 每 3 级技能提升 1 个专精层级
    const SKILL_MASTERY_BONUS = 0.05; // 每层专精提供 +5% 总收益

    // 政策利率参数
    const POLICY_RATE_MIN = 0;
    const POLICY_RATE_MAX = 10;
    const POLICY_RATE_DEFAULT = 2;
    const POLICY_GUIDANCE_BASE_BIAS = 0.5;

    // 前瞻奖惩参数
    const OUTLOOK_REWARD_BASE = 100;
    const OUTLOOK_REWARD_RATE_SCALE = 35;
    const OUTLOOK_PENALTY_BASE = 80;
    const OUTLOOK_PENALTY_RATE_SCALE = 24;
    const OUTLOOK_PENALTY_GEAR_RATIO = 0.03;

    // 连击（动量）参数
    const MARKET_MOMENTUM_CAP = 10;
    const MARKET_MOMENTUM_DURATION = 30;
    const MARKET_MOMENTUM_GPS_PER_STACK = 0.05;
    const MARKET_MOMENTUM_MANUAL_PER_STACK = 0.1;

    // 宏观策略预案参数
    const MACRO_PREFERRED_BONUS = 0.12;

    // 宏观事件定义
    const MACRO_EVENTS = [
      { id: 'inflation_hot', name: '通胀升温', guidanceBiasUp: 0.8, durationSwitches: 3, preferredBuildingId: 'bank', nextEventId: 'growth_cool' },
      { id: 'growth_cool', name: '增长放缓', guidanceBiasUp: 0.2, durationSwitches: 3, preferredBuildingId: 'logistics', nextEventId: 'inflation_hot' },
    ];

    // ════════════════════════════════════════════════
    // ② 产业链数据
    //    新增 2 层：中央银行 + 金融集团（M3 新建筑层级）
    //    解锁阈值经过 10 分钟曲线校准（M1 调优）
    // ════════════════════════════════════════════════
    const buildings = [
      // id            name         basePrice   dps    owned  unlock(累计)  emoji
      { id:"workshop",   name:"手工作坊",  basePrice:15,        dps:1,       owned:0, unlock:0,          emoji:"🔧",
        synergy:{upstream:[], downstream:["factory"], bonusPerUpstream:0, bonusPerDownstream:0.05,
          desc:"为轻工厂提供原材料，手工作坊越多轻工厂产出越高"} },
      { id:"factory",    name:"轻工厂",    basePrice:110,       dps:8,       owned:0, unlock:250,        emoji:"🏭",
        synergy:{upstream:["workshop"], downstream:["logistics"], bonusPerUpstream:0.08, bonusPerDownstream:0.05,
          desc:"消耗原材料产出制成品，享上游折扣，促下游需求"} },
      { id:"logistics",  name:"物流公司",  basePrice:1200,      dps:47,      owned:0, unlock:2000,       emoji:"🚛",
        synergy:{upstream:["factory"], downstream:["realestate"], bonusPerUpstream:0.10, bonusPerDownstream:0.06,
          desc:"为房地产运输建材，物流越密地产营销越畅"} },
      { id:"realestate", name:"房地产",    basePrice:13000,     dps:260,     owned:0, unlock:12000,      emoji:"🏢",
        synergy:{upstream:["logistics"], downstream:["bank"], bonusPerUpstream:0.12, bonusPerDownstream:0.08,
          desc:"需要物流运输建材，银行存款支撑地价"} },
      { id:"bank",       name:"商业银行",  basePrice:140000,    dps:1400,    owned:0, unlock:100000,     emoji:"🏦",
        synergy:{upstream:["realestate"], downstream:["fund"], bonusPerUpstream:0.15, bonusPerDownstream:0.10,
          desc:"吸收房地产存款，为量化基金提供客户资金"} },
      { id:"fund",       name:"量化基金",  basePrice:1500000,   dps:7800,    owned:0, unlock:600000,     emoji:"📊",
        synergy:{upstream:["bank"], downstream:["central"], bonusPerUpstream:0.18, bonusPerDownstream:0.12,
          desc:"管理银行资产，中央银行是其最后贷款人"} },
      { id:"central",    name:"中央银行",  basePrice:20000000,  dps:44000,   owned:0, unlock:10000000,   emoji:"🏛️",
        synergy:{upstream:["fund"], downstream:["conglom"], bonusPerUpstream:0.20, bonusPerDownstream:0.15,
          desc:"监管量化基金，为金融集团提供流动性支持"} },
      { id:"conglom",    name:"金融集团",  basePrice:300000000, dps:260000,  owned:0, unlock:180000000,  emoji:"🌐",
        synergy:{upstream:["central"], downstream:[], bonusPerUpstream:0.25, bonusPerDownstream:0,
          desc:"产业链顶端，享受全链路最高加成"} },
      { id:"fintech",    name:"金融科技",  basePrice:4e12,      dps:1600000,  owned:0, unlock:2e12,     emoji:"💳",
        synergy:{upstream:["conglom"], downstream:["blockchain"], bonusPerUpstream:0.30, bonusPerDownstream:0.15,
          desc:"移动支付与P2P借贷，数据驱动收益增长"} },
      { id:"blockchain", name:"区块链",    basePrice:5e13,      dps:10000000, owned:0, unlock:25e12,    emoji:"⛓️",
        synergy:{upstream:["fintech"], downstream:[], bonusPerUpstream:0.35, bonusPerDownstream:0,
          desc:"加密货币与DeFi，高波动高收益的终极产业"} },
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
      { id:"sp_central",   name:"货币政策",  price:500000000,  desc:"中央银行产出 ×2",        type:"bldBoost",   value:{id:"central",    mult:2}, purchased:false, unlockRP:3, requires:null },
      { id:"sp_conglom",   name:"帝国整合",  price:5e9,        desc:"金融集团产出 ×2",        type:"bldBoost",   value:{id:"conglom",    mult:2}, purchased:false, unlockRP:4, requires:null },
      { id:"sp_fintech",   name:"数字支付",  price:5e11,       desc:"金融科技产出 ×2",        type:"bldBoost",   value:{id:"fintech",    mult:2}, purchased:false, unlockRP:5, requires:null },
      { id:"sp_blockchain",name:"智能合约",  price:5e13,       desc:"区块链产出 ×2",          type:"bldBoost",   value:{id:"blockchain", mult:2}, purchased:false, unlockRP:6, requires:null },
    ];

    // 建筑专属倍率表（运行时维护，存档时持久化）
    const bldBoost = { workshop:1, factory:1, logistics:1, realestate:1, bank:1, fund:1, central:1, conglom:1, fintech:1, blockchain:1 };

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
    // ⑤-2 Prestige 天赋树（永久生效，reset 后不重置）
    // ════════════════════════════════════════════════
    // 机制参考：BubbleByte 的"声望真正改变游戏方式"，而非枯燥 +1%
    // 每类天赋一个独立开关，购买后永久激活，效果在对应计算处直接应用
    const prestigePerks = [
      {
        id:"perk_auto_combo", name:"自动连击", desc:"每 10s 自动触发一次虚拟撮合，享受当前连击加成",
        costRP:3, purchased:false,
        check:()=>st.perkAutoCombo||false,
      },
      {
        id:"perk_offline_mult", name:"离线倍化", desc:"离线收益 ×1.5",
        costRP:2, purchased:false,
        check:()=>st.perkOfflineMult||false,
      },
      {
        id:"perk_synergy_plus", name:"协同增强", desc:"产业链联动加成额外 +50%",
        costRP:4, purchased:false,
        check:()=>st.perkSynergyPlus||false,
      },
      {
        id:"perk_crisp_immune", name:"危机免疫", desc:"危机事件持续时间减半",
        costRP:2, purchased:false,
        check:()=>st.perkCrispImmune||false,
      },
      {
        id:"perk_rp_bonus", name:"股权溢价", desc:"每次 prestige 额外获得 +1 RP",
        costRP:3, purchased:false,
        check:()=>st.perkRpBonus||false,
      },
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
      { id:"fintech_owner", name:"数字先锋",  desc:"拥有 1 个金融科技",               reward:{type:"rp",value:8},       check:()=>bld("fintech").owned>=1,                                               done:false, claimed:false },
      { id:"blockchain_owner", name:"链上之王", desc:"拥有 1 个区块链",               reward:{type:"rp",value:10},      check:()=>bld("blockchain").owned>=1,                                            done:false, claimed:false },
      { id:"fintech_10",    name:"金融科技帝国", desc:"拥有 10 个金融科技",           reward:{type:"rp",value:15},      check:()=>bld("fintech").owned>=10,                                              done:false, claimed:false },
      { id:"blockchain_10", name:"区块链大亨",   desc:"拥有 10 个区块链",             reward:{type:"rp",value:20},      check:()=>bld("blockchain").owned>=10,                                           done:false, claimed:false },
      // ── 新成就：产业链 ──
      { id:"synergy_1",   name:"产业链初成",desc:"激活首个产业链加成",               reward:{type:"gear",value:500},    check:()=>{ const s = typeof window.synergySystem !== "undefined" ? window.synergySystem : null; return s && s.calculateGlobalSynergy().globalMultiplier > 1.01; }, done:false, claimed:false },
      { id:"synergy_chain",name:"全链贯通",desc:"产业链全线激活（每层都有建筑）",    reward:{type:"rp",value:3},        check:()=>{ const s = typeof window.synergySystem !== "undefined" ? window.synergySystem : null; if (!s) return false; const gs=s.calculateGlobalSynergy(); return gs.globalMultiplier>=1.5; }, done:false, claimed:false },
      // ── 新成就：撮合连击 ──
      { id:"combo_5",     name:"五连击",   desc:"连续撮合 5 次（间隔 < 2s）",       reward:{type:"gear",value:100},    check:()=>st.maxCombo>=5,                                                       done:false, claimed:false },
      { id:"combo_20",   name:"二十连击",  desc:"连续撮合 20 次（间隔 < 2s）",      reward:{type:"gear",value:2000},   check:()=>st.maxCombo>=20,                                                      done:false, claimed:false },
      { id:"combo_50",   name:"五十连击",  desc:"连续撮合 50 次（间隔 < 2s）",      reward:{type:"rp",value:2},        check:()=>st.maxCombo>=50,                                                      done:false, claimed:false },
      // ── 新成就：里程碑积累 ──
      { id:"gear_1m",     name:"百万富翁",  desc:"历史资本达到 ¥1,000,000",          reward:{type:"rp",value:3},        check:()=>st.lifetimeGears>=1e6,                                               done:false, claimed:false },
      { id:"gear_1b",     name:"十亿巨头",  desc:"历史资本达到 ¥1,000,000,000",      reward:{type:"rp",value:5},        check:()=>st.lifetimeGears>=1e9,                                               done:false, claimed:false },
      { id:"gps_10k",    name:"日产十万",  desc:"总产出 ≥ ¥10,000/s",               reward:{type:"gear",value:50000},  check:()=>getTotalGPS()>=10000,                                                done:false, claimed:false },
      { id:"gps_1m",     name:"日产百万",  desc:"总产出 ≥ ¥1,000,000/s",            reward:{type:"rp",value:4},        check:()=>getTotalGPS()>=1e6,                                                   done:false, claimed:false },
      // ── 新成就：离线收益 ──
      { id:"offline_1h",  name:"离线玩家",  desc:"离线期间收益超 ¥10,000",          reward:{type:"gear",value:10000},  check:()=>st.maxOfflineGears>=10000,                                            done:false, claimed:false },
      { id:"offline_1m",  name:"睡后收入",  desc:"单次离线收益超 ¥1,000,000",       reward:{type:"rp",value:5},        check:()=>st.maxOfflineGears>=1e6,                                              done:false, claimed:false },
      // ── 新成就：市场预测 ──
      { id:"rate_predict",name:"利率先锋",  desc:"利率预测命中 5 次",               reward:{type:"gear",value:5000},   check:()=>st.rateOutlookHits>=5,                                               done:false, claimed:false },
      { id:"rate_master", name:"央行观察员",desc:"利率预测命中 20 次",               reward:{type:"rp",value:4},        check:()=>st.rateOutlookHits>=20,                                              done:false, claimed:false },
      // ── 新成就：技能树 ──
      { id:"skill_10",   name:"专精学徒",  desc:"累计激活 10 级技能",              reward:{type:"gear",value:2000},   check:()=>skills.reduce((s,v)=>s+v.level,0)>=10,                             done:false, claimed:false },
      { id:"skill_25",   name:"专精大师",  desc:"累计激活 25 级技能",              reward:{type:"rp",value:3},        check:()=>skills.reduce((s,v)=>s+v.level,0)>=25,                             done:false, claimed:false },
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
    // ⑥-2 限时竞速里程碑（参考 BubbleByte Timed Milestones）
    // 每局重置后从第一个开始计时；完成后永久解锁，触发时记录 bestTime
    // st.speedRecords: { [questId]: bestTimeMs }
    const speedQuests = [
      { id:"sq1", title:"🏁 速通：10 秒内达到 ¥100",         timeLimit:10,  reward:{type:"rp",value:1}, },
      { id:"sq2", title:"🏁 速通：60 秒内拥有 10 家工厂",     timeLimit:60,  reward:{type:"gear",value:5000}, },
      { id:"sq3", title:"🏁 速通：180 秒内研发「量化 2.0」",  timeLimit:180, reward:{type:"rp",value:2}, },
      { id:"sq4", title:"🏁 速通：300 秒内拥有 1 家中央银行", timeLimit:300, reward:{type:"rp",value:3}, },
      { id:"sq5", title:"🏁 速通：600 秒内完成首次 prestige",  timeLimit:600, reward:{type:"rp",value:5}, },
    ];

    // ════════════════════════════════════════════════
    // ⑦ 游戏状态
    // ════════════════════════════════════════════════
    // st 原始对象（所有子系统的引用源）
    let st = {
      gears:0, purchaseMode:"1", lastTimestamp:performance.now(), accumulator:0,
      pendingOfflineGears:0, manualPower:1, manualMult:1, gpsMultiplier:1,
      totalClicks:0, lifetimeGears:0, researchPoints:0,
      lastRewardText:"", gameSpeed:1, questIndex:0, logs:[],
      autoBuy:false, autoBuyAccumulator:0,
      bullClicks:0,
      marketIsBull:true, marketTimer:35, marketCycleDuration:35,
      soundEnabled:true,
      skillMasteryTier:0,
      // 连击系统
      combo:0, lastClickTime:0, comboTimer:null, maxCombo:0,
      // 离线收益追踪
      maxOfflineGears:0,
      // Prestige 天赋（永久有效，reset/prestige 不重置）
      perkAutoCombo:false, perkOfflineMult:false, perkSynergyPlus:false,
      perkCrispImmune:false, perkRpBonus:false,
      // 速通计时
      speedRecords:{},    // { [questId]: bestTimeMs } — 永久记录
      gameStartTime:0,    // 每局开始时间戳（毫秒）
      speedQuestIndex:0,  // 当前活跃速通任务索引
      // 资产配置/风险偏好系统
      assetAllocation:{
        riskProfile:'balanced',
        allocation:{buildings:0.65, upgrades:0.20, derivativesMargin:0.15},
        stats:{lastRebalanceAt:0, totalRebalances:0},
      },
    };

    // ── st 写入追踪 Proxy：所有对 st.XX = YY 的写入自动记录 dirty 字段 ──
    // 增量存档核心：_makeSaveData 只序列化 dirty 字段 + 完整引用数组
    const _stDirtyFields = new Set();
    st = new Proxy(st, {
      set(target, key, value) {
        // NaN 防护：阻止任何数值字段被设为 NaN
        if (typeof value === 'number' && Number.isNaN(value)) {
          if (typeof target[key] !== 'number' || !Number.isNaN(target[key])) {
            const stack = new Error().stack;
            console.warn(`[NaN guard] Blocked NaN write to st.${key}, keeping ${target[key]}\n${stack}`);
          }
          return true;
        }
        target[key] = value;
        if (typeof key === 'string') _stDirtyFields.add(key);
        return true;
      },
    });

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
