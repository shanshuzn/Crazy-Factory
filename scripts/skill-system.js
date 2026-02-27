// 技能系统工厂
// 为什么拆分：技能成长属于独立节奏层，和经济购买分离后更利于调“中期体验”。
const createSkillSystem = ({
  st,
  skills,
  dirty,
  pushLog,
  saveGame,
  sfxUpgrade,
  SKILL_MASTERY_STEP,
  SKILL_MASTERY_BONUS
}) => {
  const getTotalSkillLevels = () => skills.reduce((sum, sk) => sum + sk.level, 0);
  const getSkillTier = () => Math.floor(getTotalSkillLevels() / SKILL_MASTERY_STEP);
  const getSkillMasteryMult = () => 1 + st.skillMasteryTier * SKILL_MASTERY_BONUS;

  // 统一在这里校准专精等级：避免 load/prestige/reset 后等级与UI脱节。
  const refreshSkillMastery = (silent = true) => {
    const newTier = getSkillTier();
    const prevTier = st.skillMasteryTier || 0;
    st.skillMasteryTier = newTier;

    if (!silent && newTier > prevTier) {
      const delta = newTier - prevTier;
      const msg = `技能专精提升到 T${newTier}（总收益 +${(delta * SKILL_MASTERY_BONUS * 100).toFixed(0)}%）`;
      st.lastRewardText = msg;
      pushLog(msg);
    }

    dirty.skills = dirty.stats = true;
  };

  const buySkill = (id) => {
    const sk = skills.find((s) => s.id === id);
    if (!sk || sk.level >= sk.maxLevel || st.researchPoints < sk.costRP) return;

    st.researchPoints -= sk.costRP;
    sk.level++;
    sfxUpgrade();
    pushLog(`技能升级：${sk.name} Lv.${sk.level}`);
    refreshSkillMastery(false);
    dirty.skills = dirty.logs = true;
    saveGame();
  };

  return {
    buySkill,
    getTotalSkillLevels,
    getSkillMasteryMult,
    refreshSkillMastery,
  };
};
