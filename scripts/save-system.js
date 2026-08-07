    // ════════════════════════════════════════════════
    // ⑫ 存档系统
    // ════════════════════════════════════════════════
    // 存档脏哈希：避免数据未变时重复写入 localStorage（减少 GC 和存储写入）
    let _lastSaveHash = null;

    // ── 增量存档快照：上次完整存档的深拷贝，用于计算字段级 diff ──
    let _prevSnapshot = null;

    // ── IndexedDB 异步存储（避免 localStorage 同步阻塞主线程）──
    let _idb = null;
    const _openIDB = () => {
      if (_idb) return Promise.resolve(_idb);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('crazy_factory_v2', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('save')) db.createObjectStore('save');
        };
        req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb); };
        req.onerror = () => reject(req.error);
      });
    };

    // 异步写入 IndexedDB（失败时降级到同步 localStorage，不阻塞主线程）
    const _saveToIDB = async (data) => {
      try {
        const db = await _openIDB();
        const tx = db.transaction('save', 'readwrite');
        tx.objectStore('save').put(data, 'slot');
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      } catch {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      }
    };

    // 顶层存档字段白名单（数值类频繁变动，字符串类稀疏变动，统一 diff）
    const _TOP_LEVEL_FIELDS = [
      'gears','purchaseMode','gameSpeed','autoBuy','questIndex','lastAutoPlanTarget','logs',
      'manualPower','manualMult','gpsMultiplier','totalClicks','lifetimeGears','researchPoints',
      'bullClicks','marketMomentum','marketMomentumTimer','policyRate','policyHedge',
      'macroEventId','macroEventTimer','macroPreferredBuildingId','lastMacroEventId','macroChainCount',
      'rateOutlookDirection','rateOutlookBiasUp','rateOutlookConfidence','rateOutlookHits','rateOutlookMisses',
      'marketIsBull','soundEnabled','skillMasteryTier','pendingOfflineGears',
      'combo','maxCombo','maxOfflineGears',
      'perkAutoCombo','perkOfflineMult','perkSynergyPlus','perkCrispImmune','perkRpBonus',
      'speedRecords',
      'derivatives','crisis','guild','boost','subscription','globalMarket','assetAllocation',
      'scenarios',
    ];

    // 两个值是否相等（用于 diff 比较）
    const _eq = (a, b) => {
      if (a === b) return true;
      if (typeof a !== typeof b) return false;
      if (Array.isArray(a) && Array.isArray(b)) return false; // 数组直接认为不等（全量序列化）
      if (typeof a === 'object' && a !== null && b !== null) return false;
      return false;
    };

    // 构建完整存档数据（用于全量写入和快照比较）
    const _makeFullSaveData = () => ({
      gears:st.gears, purchaseMode:st.purchaseMode, gameSpeed:st.gameSpeed,
      autoBuy:st.autoBuy, questIndex:st.questIndex, lastAutoPlanTarget:st.lastAutoPlanTarget, logs:st.logs.slice(0,LOG_CAP),
      manualPower:st.manualPower, manualMult:st.manualMult, gpsMultiplier:st.gpsMultiplier,
      totalClicks:st.totalClicks, lifetimeGears:st.lifetimeGears, researchPoints:st.researchPoints,
      bullClicks:st.bullClicks, marketMomentum:st.marketMomentum, marketMomentumTimer:st.marketMomentumTimer, policyRate:st.policyRate, policyHedge:st.policyHedge, macroEventId:st.macroEventId, macroEventTimer:st.macroEventTimer, macroPreferredBuildingId:st.macroPreferredBuildingId, lastMacroEventId:st.lastMacroEventId, macroChainCount:st.macroChainCount, rateOutlookDirection:st.rateOutlookDirection, rateOutlookBiasUp:st.rateOutlookBiasUp, rateOutlookConfidence:st.rateOutlookConfidence, rateOutlookHits:st.rateOutlookHits, rateOutlookMisses:st.rateOutlookMisses, marketIsBull:st.marketIsBull, soundEnabled:st.soundEnabled,
      skillMasteryTier:st.skillMasteryTier,
      perkAutoCombo:st.perkAutoCombo||false,
      perkOfflineMult:st.perkOfflineMult||false,
      perkSynergyPlus:st.perkSynergyPlus||false,
      perkCrispImmune:st.perkCrispImmune||false,
      perkRpBonus:st.perkRpBonus||false,
      speedRecords:st.speedRecords||{},
      buildings: buildings.map(b=>({id:b.id,owned:b.owned})),
      upgrades:  upgrades.map(u=>({id:u.id,purchased:u.purchased})),
      skills:    skills.map(s=>({id:s.id,level:s.level})),
      achievements: achievements.map(a=>({id:a.id,done:a.done,claimed:a.claimed})),
      bldBoost: {...bldBoost},
      derivatives: st.derivatives ? {...st.derivatives} : undefined,
      crisis: st.crisis ? {...st.crisis} : undefined,
      guild: st.guild ? {...st.guild} : undefined,
      boost: st.boost ? {...st.boost} : undefined,
      subscription: st.subscription ? {...st.subscription} : undefined,
      globalMarket: st.globalMarket ? {...st.globalMarket} : undefined,
      assetAllocation: st.assetAllocation ? {...st.assetAllocation} : undefined,
      scenarios: st.scenarios ? {...st.scenarios} : undefined,
      savedAt: Date.now(),
    });

    // 快速哈希：只对核心数值字段做异或，忽略时间戳
    const _fastHash = (data) => {
      let h = 0;
      const keys = ['gears','totalClicks','lifetimeGears','researchPoints','questIndex',
        'skillMasteryTier','buildings','upgrades','skills','achievements','bldBoost',
        'derivatives','crisis','guild','boost','subscription','globalMarket','assetAllocation',
        'scenarios'];
      for (const k of keys) {
        const v = data[k];
        if (v !== undefined) {
          if (typeof v === 'number') h = (h * 31 + (v | 0)) | 0;
          else if (Array.isArray(v)) h = (h * 31 + v.length) | 0;
          else if (typeof v === 'object') h = (h * 31 + Object.keys(v).length) | 0;
          else h = (h * 31 + (v.length || 0)) | 0;
        }
      }
      return h;
    };

    const saveGame = () => {
      const fullData = _makeFullSaveData();
      const hash = _fastHash(fullData);
      if (hash === _lastSaveHash) return;
      _lastSaveHash = hash;
      st.saveWriteCount = (st.saveWriteCount || 0) + 1;
      st.lastSaveAt = Date.now();

      // 增量存档：比较快照 diff，只写入变化的顶层字段
      // _prevSnapshot 持久化在 localStorage 的 _BASE_KEY，页面刷新后仍可还原
      if (_prevSnapshot) {
        const delta = { _isDelta: true, savedAt: fullData.savedAt };
        for (const k of _TOP_LEVEL_FIELDS) {
          if (!_eq(fullData[k], _prevSnapshot[k])) delta[k] = fullData[k];
        }
        delta.buildings = fullData.buildings;
        delta.upgrades = fullData.upgrades;
        delta.skills = fullData.skills;
        delta.achievements = fullData.achievements;
        delta.bldBoost = fullData.bldBoost;

        const deltaKeys = Object.keys(delta).filter(k => k !== '_isDelta' && k !== 'savedAt');
        if (deltaKeys.length < _TOP_LEVEL_FIELDS.length) {
          // 有 diff：写入 delta + 更新持久化的 base snapshot（浅拷贝替代深序列化）
          _prevSnapshot = { ...fullData };
          localStorage.setItem(SAVE_KEY + '_base', JSON.stringify(_prevSnapshot));
          _saveToIDB(delta).catch(() => localStorage.setItem(SAVE_KEY, JSON.stringify(delta)));
        } else {
          // 无实际 diff（hash 不同但所有值相同，可能是浮点问题），写全量
          _prevSnapshot = { ...fullData };
          localStorage.setItem(SAVE_KEY + '_base', JSON.stringify(_prevSnapshot));
          _saveToIDB(fullData).catch(() => localStorage.setItem(SAVE_KEY, JSON.stringify(fullData)));
        }
      } else {
        // 首次保存：全量 + 建立快照
        _prevSnapshot = JSON.parse(JSON.stringify(fullData));
        localStorage.setItem(SAVE_KEY + '_base', JSON.stringify(_prevSnapshot));
        _saveToIDB(fullData).catch(() => localStorage.setItem(SAVE_KEY, JSON.stringify(fullData)));
      }
    };

    const loadGame = () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY); if(!raw) return;
        const d = JSON.parse(raw); if(!d||typeof d!=="object") return;

        // 增量存档恢复：如果加载的是 delta，先从持久化 base snapshot 合并
        if (d._isDelta) {
          const baseRaw = localStorage.getItem(SAVE_KEY + '_base');
          const base = baseRaw ? JSON.parse(baseRaw) : null;
          if (base) {
            // 合并：base + delta = 完整状态
            for (const k of _TOP_LEVEL_FIELDS) {
              if (k in d) base[k] = d[k];
            }
            base.buildings  = d.buildings  || base.buildings;
            base.upgrades   = d.upgrades   || base.upgrades;
            base.skills     = d.skills     || base.skills;
            base.achievements = d.achievements || base.achievements;
            base.bldBoost   = d.bldBoost   || base.bldBoost;
            base.savedAt    = d.savedAt;
            Object.assign(d, base); // 让下面的统一逻辑继续用 d
          }
          // 即使 base 不存在，d 中也有所有必要字段（建筑/升级等全量存储），不会缺字段
        }

        // 清除加载过程中 proxy 追踪的 dirty 字段（加载是干净的状态）
        _stDirtyFields.clear();

        st.gears          = Number(d.gears)||0;
        st.manualPower    = Math.max(1,Number(d.manualPower)||1);
        st.manualMult     = Math.max(1,Number(d.manualMult)||1);
        st.gpsMultiplier  = Math.max(1,Number(d.gpsMultiplier)||1);
        st.totalClicks    = Math.max(0,Number(d.totalClicks)||0);
        st.lifetimeGears  = Math.max(0,Number(d.lifetimeGears)||0);
        st.researchPoints = Math.max(0,Math.floor(Number(d.researchPoints)||0));
        st.bullClicks     = Math.max(0,Number(d.bullClicks)||0);
        st.marketMomentum  = Math.max(0,Math.min(MARKET_MOMENTUM_CAP,Math.floor(Number(d.marketMomentum)||0)));
        st.marketMomentumTimer = Math.max(0,Number(d.marketMomentumTimer)||0);
        st.policyRate = Math.max(POLICY_RATE_MIN, Math.min(POLICY_RATE_MAX, Number(d.policyRate) || POLICY_RATE_DEFAULT));
        st.policyHedge = Math.max(0, Math.min(0.6, Number(d.policyHedge) || 0));
        st.macroEventId = typeof d.macroEventId === "string" ? d.macroEventId : "";
        st.macroEventTimer = Math.max(0, Math.floor(Number(d.macroEventTimer) || 0));
        st.macroPreferredBuildingId = typeof d.macroPreferredBuildingId === "string" ? d.macroPreferredBuildingId : "";
        st.lastMacroEventId = typeof d.lastMacroEventId === "string" ? d.lastMacroEventId : "";
        st.macroChainCount = Math.max(0, Math.floor(Number(d.macroChainCount) || 0));
        st.rateOutlookDirection = d.rateOutlookDirection === "下调" ? "下调" : "上调";
        st.rateOutlookBiasUp = Math.max(0.05, Math.min(0.95, Number(d.rateOutlookBiasUp) || 0.5));
        st.rateOutlookConfidence = Math.max(0, Math.min(100, Math.floor(Number(d.rateOutlookConfidence) || 0)));
        st.rateOutlookHits = Math.max(0, Math.floor(Number(d.rateOutlookHits) || 0));
        st.rateOutlookMisses = Math.max(0, Math.floor(Number(d.rateOutlookMisses) || 0));
        st.marketIsBull   = d.marketIsBull!==false;
        st.soundEnabled   = d.soundEnabled!==false;
        st.skillMasteryTier = Math.max(0,Math.floor(Number(d.skillMasteryTier)||0));
        st.saveWriteWindowStart = Date.now();
        st.saveWriteCount = 0;
        st.lastSaveAt = Number(d.savedAt)||0;
        if(["1","10","100","max"].includes(d.purchaseMode)) st.purchaseMode=d.purchaseMode;
        if([1,2,4].includes(Number(d.gameSpeed))) st.gameSpeed=Number(d.gameSpeed);
        st.autoBuy    = Boolean(d.autoBuy);
        st.lastAutoPlanTarget = typeof d.lastAutoPlanTarget === "string" ? d.lastAutoPlanTarget : "";
        st.questIndex = Math.max(0,Math.min(Number(d.questIndex)||0,questChain.length));
        if(Array.isArray(d.logs)) st.logs=d.logs.slice(0,LOG_CAP);
        // 连击 + 离线追踪
        st.combo = Math.max(0, Math.floor(Number(d.combo)||0));
        st.maxCombo = Math.max(0, Math.floor(Number(d.maxCombo)||0));
        st.maxOfflineGears = Math.max(0, Number(d.maxOfflineGears)||0);
        // Prestige 天赋（永久）
        st.perkAutoCombo   = Boolean(d.perkAutoCombo);
        st.perkOfflineMult = Boolean(d.perkOfflineMult);
        st.perkSynergyPlus = Boolean(d.perkSynergyPlus);
        st.perkCrispImmune = Boolean(d.perkCrispImmune);
        st.perkRpBonus     = Boolean(d.perkRpBonus);
        // 速通记录（永久）
        if(d.speedRecords&&typeof d.speedRecords==="object") st.speedRecords=d.speedRecords;

        (d.buildings||[]).forEach(s=>{const t=bld(s.id);if(t)t.owned=Math.max(0,Math.floor(Number(s.owned)||0));});
        (d.upgrades||[]).forEach(s=>{const t=upgrades.find(u=>u.id===s.id);if(t){t.purchased=Boolean(s.purchased);if(t.purchased)applyUpgradeEffect(t,true);}});
        (d.skills||[]).forEach(s=>{const t=skills.find(x=>x.id===s.id);if(t)t.level=Math.max(0,Math.min(t.maxLevel,Math.floor(Number(s.level)||0)));});
        if(typeof refreshSkillMastery === "function") refreshSkillMastery(true);
        (d.achievements||[]).forEach(s=>{const t=achievements.find(a=>a.id===s.id);if(t){t.done=Boolean(s.done);t.claimed=Boolean(s.claimed);}});
        if(d.bldBoost&&typeof d.bldBoost==="object") Object.assign(bldBoost,d.bldBoost);

        // 恢复高级子系统状态（旧存档缺失时安全跳过）
        if(d.derivatives&&typeof d.derivatives==="object") st.derivatives={...st.derivatives,...d.derivatives};
        if(d.crisis&&typeof d.crisis==="object") st.crisis={...st.crisis,...d.crisis};
        if(d.guild&&typeof d.guild==="object") st.guild={...st.guild,...d.guild};
        if(d.boost&&typeof d.boost==="object") st.boost={...st.boost,...d.boost};
        if(d.subscription&&typeof d.subscription==="object") st.subscription={...st.subscription,...d.subscription};
        if(d.globalMarket&&typeof d.globalMarket==="object") st.globalMarket={...st.globalMarket,...d.globalMarket};
        if(d.assetAllocation&&typeof d.assetAllocation==="object") st.assetAllocation={...st.assetAllocation,...d.assetAllocation};
        if(d.scenarios&&typeof d.scenarios==="object") st.scenarios={...st.scenarios,...d.scenarios};

        const off = (Date.now()-(Number(d.savedAt)||Date.now()))/1000;
        const ofg = GameFormulas.calcOfflineGain({ gps: getTotalGPS(), elapsedSec: off, capSec: OFFLINE_CAP_SECONDS });
        if(ofg>0) st.pendingOfflineGears=ofg;
      } catch(e){ console.warn("存档读取失败",e); }
      // 重置哈希：确保加载后首次保存必定写入
      _lastSaveHash = null;
      // 重建快照：加载完成后的 d（可能是 delta 合并后的完整状态）作为下次 diff 的基准
      _prevSnapshot = { ...d };
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
        localStorage.setItem(SAVE_KEY,raw);
        // 导入后同步 base snapshot（导入的是全量存档，重建 base）
        if (!d._isDelta) {
          localStorage.setItem(SAVE_KEY + '_base', raw);
        } else {
          // 导入 delta 无意义（缺少 base），清除 base 强制下次全量
          localStorage.removeItem(SAVE_KEY + '_base');
        }
        _prevSnapshot = null; // 强制下次全量写入
        loadGame();render();pushLog("存档导入成功");
      }catch{alert("存档格式无效");}
    };

    // ── 升级效果应用（独立函数，load 时可静默重放）──
    const applyUpgradeEffect = (u, silent=false) => {
      if(u.type==="manual")     st.manualPower += u.value;
      if(u.type==="gps")        st.gpsMultiplier *= u.value;
      if(u.type==="manualMult") st.manualMult *= u.value;
      if(u.type==="bldBoost")   bldBoost[u.value.id] = (bldBoost[u.value.id]||1) * u.value.mult;
      if(u.type==="policyHedge") st.policyHedge = Math.max(0, Math.min(0.6, (st.policyHedge||0) + Number(u.value||0)));
      if(!silent){ sfxUpgrade(); pushLog(`研发完成：${u.name}`); }
    };

