// 渲染系统工厂
// 为什么拆分：渲染是高频路径，独立后更容易做性能优化和UI迭代。
const createRenderSystem = ({
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
}) => {
  let lastRender = 0;

  const renderQuest = () => {
    if(st.questIndex>=questChain.length){
      goalTitleEl.textContent='产业目标：全部完成！'; goalFillEl.style.width='100%';
      goalHintEl.textContent='恭喜，金融帝国已建成'; goalPctEl.textContent='100%';
      questRewardEl.textContent='全部奖励已领取'; return;
    }
    const q=questChain[st.questIndex];
    const cur=q.progress(), pct=Math.min(100,(cur/q.target)*100);
    goalTitleEl.textContent=q.title;
    goalFillEl.style.width=`${pct}%`;
    goalHintEl.textContent= cur>=q.target?'目标达成，奖励已发放':`进度 ${cur} / ${q.target}`;
    goalPctEl.textContent=`${pct.toFixed(0)}%`;
    questRewardEl.textContent=`奖励：${q.rewardText}`;
    if(cur>=q.target){ grantReward(q.reward,`任务「${q.title}」`); st.questIndex++; dirty.quest = dirty.gears = dirty.stats = dirty.logs = true; saveGame(); }
  };

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

    const targetGPS = getTotalGPS();
    disp.gps += (targetGPS - disp.gps) * SMOOTH_SPEED;
    disp.gears = smoothUpdate(st.gears);
    gearsEl.textContent = fmt(disp.gears);
    gpsEl.textContent = `收益率 ${fmt(disp.gps)}/s`;
    rpDisplayEl.textContent = `${st.researchPoints} RP`;
    rpMetaEl.textContent = `研究加成 ×${(1 + st.researchPoints * 0.1).toFixed(1)}`;
    manualDesc.textContent = `每次撮合 +${fmt(getManualGain())}`;
    if(dirty.market) renderMarket();

    if(dirty.buildings){
      for(const b of buildings){
        const v=buildingViewMap.get(b.id); if(!v) continue;
        const cnt=affordableCount(b,st.gears,st.purchaseMode);
        const pc =st.purchaseMode==='max'?cnt:Math.min(cnt,Number(st.purchaseMode)||1);
        const spc=Math.max(1,pc||0);
        const unlocked=isBldUnlocked(b);
        v.ownedEl.textContent=b.owned;
        v.buyBtn.textContent=`购买 ×${spc}（${fmt(purchaseCost(b,spc))}）`;
        v.buyBtn.disabled=!(cnt>0&&unlocked);
        v.lockEl.textContent=!unlocked?`解锁条件：历史资本 ${fmt(b.unlock)}`:'';
        v.hintEl.textContent=(unlocked&&cnt<=0)?`还差 ${fmt(price(b)-st.gears)}`:'';
      }
      dirty.buildings = false;
    }

    if(dirty.upgrades){
      for(const u of upgrades){
        const v=upgradeViewMap.get(u.id); if(!v) continue;
        if(u.purchased){v.btn.textContent='已研发';v.btn.disabled=true;v.lockEl.textContent='';continue;}
        const lr=upgradeLockedReason(u);
        v.lockEl.textContent=lr;
        v.btn.textContent=`研发（${fmt(u.price)}）`;
        v.btn.disabled=st.gears<u.price||Boolean(lr);
      }
      dirty.upgrades = false;
    }

    if(dirty.quest) renderQuest();

    if(dirty.skills){
      for(const sk of skills){
        const v=skillViewMap.get(sk.id); if(!v) continue;
        v.meta.textContent=`等级 ${sk.level}/${sk.maxLevel}`;
        if(sk.level>=sk.maxLevel){v.btn.disabled=true;v.btn.textContent='已满级';}
        else{v.btn.disabled=st.researchPoints<sk.costRP;v.btn.textContent=`升级（${sk.costRP} RP）`;}
      }
      if(skillMasteryMetaEl){
        const totalLv = getTotalSkillLevels();
        skillMasteryMetaEl.textContent = `专精 T${st.skillMasteryTier} · 总技能等级 ${totalLv} · 总收益加成 ×${(1 + st.skillMasteryTier * SKILL_MASTERY_BONUS).toFixed(2)}`;
      }
      dirty.skills = false;
    }

    if(dirty.achievements){
      for(const a of achievements){
        if(!a.done&&a.check()){a.done=true;claimAchievement(a);}
        const v=achievViewMap.get(a.id); if(!v) continue;
        v.badge.classList.toggle('done',a.done);
        v.badge.textContent=a.done?(a.claimed?'已完成✓':'已完成'):'未完成';
      }
      dirty.achievements = false;
    }

    if(st.pendingOfflineGears>0){offlineEl.style.display='flex';offlineTextEl.textContent=`离线期间产生收益 ${fmt(st.pendingOfflineGears)}`;}
    else{offlineEl.style.display='none';}

    rewardFeedEl.textContent=st.lastRewardText||'';

    if(dirty.logs){
      eventLogEl.innerHTML='';
      for(const line of st.logs.slice(0,8)){
        const el=document.createElement('div'); el.className='log-item'; el.textContent=line;
        eventLogEl.appendChild(el);
      }
      dirty.logs = false;
    }

    if(dirty.stats){
      statBldEl.textContent  =`产业数：${buildings.reduce((s,b)=>s+b.owned,0)}`;
      statUpgEl.textContent  =`已研发：${upgrades.filter(u=>u.purchased).length}/${upgrades.length}`;
      statAchEl.textContent  =`成就：${achievements.filter(a=>a.done).length}/${achievements.length}`;
      statQstEl.textContent  =`任务：${Math.min(st.questIndex,questChain.length)}/${questChain.length}`;
      statModeEl.textContent =`自动投资：${st.autoBuy?'开':'关'}`;
      statLifeEl.textContent =`历史资本：${fmt(st.lifetimeGears)}`;
      dirty.stats = false;
    }

    modeButtons.forEach(b =>b.classList.toggle('active',b.dataset.mode===st.purchaseMode));
    speedButtons.forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===st.gameSpeed));
    autoBuyBtn.classList.toggle('active',st.autoBuy);
    autoBuyBtn.textContent=`自动投资: ${st.autoBuy?'开':'关'}`;
    soundBtn.textContent  =`音效: ${st.soundEnabled?'开':'关'}`;

    dirty.gears = dirty.market = false;
  };

  return { render };
};
