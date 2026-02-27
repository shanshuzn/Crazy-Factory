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
