    // ════════════════════════════════════════════════
    // ⑫ 存档系统
    // ════════════════════════════════════════════════
    const saveGame = () => {
      st.saveWriteCount = (st.saveWriteCount || 0) + 1;
      st.lastSaveAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        gears:st.gears, purchaseMode:st.purchaseMode, gameSpeed:st.gameSpeed,
        autoBuy:st.autoBuy, questIndex:st.questIndex, lastAutoPlanTarget:st.lastAutoPlanTarget, logs:st.logs.slice(0,LOG_CAP),
        manualPower:st.manualPower, manualMult:st.manualMult, gpsMultiplier:st.gpsMultiplier,
        totalClicks:st.totalClicks, lifetimeGears:st.lifetimeGears, researchPoints:st.researchPoints,
        bullClicks:st.bullClicks, marketMomentum:st.marketMomentum, marketMomentumTimer:st.marketMomentumTimer, policyRate:st.policyRate, policyHedge:st.policyHedge, macroEventId:st.macroEventId, macroEventTimer:st.macroEventTimer, macroPreferredBuildingId:st.macroPreferredBuildingId, lastMacroEventId:st.lastMacroEventId, macroChainCount:st.macroChainCount, rateOutlookDirection:st.rateOutlookDirection, rateOutlookBiasUp:st.rateOutlookBiasUp, rateOutlookConfidence:st.rateOutlookConfidence, rateOutlookHits:st.rateOutlookHits, rateOutlookMisses:st.rateOutlookMisses, marketIsBull:st.marketIsBull, soundEnabled:st.soundEnabled,
        skillMasteryTier:st.skillMasteryTier,
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

        (d.buildings||[]).forEach(s=>{const t=bld(s.id);if(t)t.owned=Math.max(0,Math.floor(Number(s.owned)||0));});
        (d.upgrades||[]).forEach(s=>{const t=upgrades.find(u=>u.id===s.id);if(t){t.purchased=Boolean(s.purchased);if(t.purchased)applyUpgradeEffect(t,true);}});
        (d.skills||[]).forEach(s=>{const t=skills.find(x=>x.id===s.id);if(t)t.level=Math.max(0,Math.min(t.maxLevel,Math.floor(Number(s.level)||0)));});
        if(typeof refreshSkillMastery === "function") refreshSkillMastery(true);
        (d.achievements||[]).forEach(s=>{const t=achievements.find(a=>a.id===s.id);if(t){t.done=Boolean(s.done);t.claimed=Boolean(s.claimed);}});
        if(d.bldBoost&&typeof d.bldBoost==="object") Object.assign(bldBoost,d.bldBoost);

        const off = (Date.now()-(Number(d.savedAt)||Date.now()))/1000;
        const ofg = GameFormulas.calcOfflineGain({ gps: getTotalGPS(), elapsedSec: off, capSec: OFFLINE_CAP_SECONDS });
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
      if(u.type==="policyHedge") st.policyHedge = Math.max(0, Math.min(0.6, (st.policyHedge||0) + Number(u.value||0)));
      if(!silent){ sfxUpgrade(); pushLog(`研发完成：${u.name}`); }
    };
