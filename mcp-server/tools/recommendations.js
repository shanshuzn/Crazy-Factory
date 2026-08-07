// Recommendations Tool - AI-powered strategy suggestions
import { z } from 'zod';

const getRecommendationsSchema = z.object({
  focus: z.enum(['maximize_gears', 'balance', 'speed_run', 'prestige']).optional().default('balance')
    .describe('Strategy focus: maximize_gears, balance, speed_run, or prestige'),
});

export async function getRecommendations(bridge, args) {
  const parsed = getRecommendationsSchema.safeParse(args || {});
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { focus } = parsed.data;

  try {
    const state = await bridge.getState();

    if (!state.success) {
      return {
        content: [{ type: 'text', text: `Game not connected: ${state.error}` }],
        isError: true,
      };
    }

    const { st, buildings, upgrades, skills } = state.data;

    // Analyze state
    const totalBuildings = buildings.reduce((sum, b) => sum + b.owned, 0);
    const purchasedUpgrades = upgrades.filter(u => u.purchased).length;
    const studiedSkills = skills.filter(s => s.level > 0).length;
    const gps = st.gps || 0;

    // Calculate recommendations based on state
    let recommendations = `## 策略建议 (${focus}模式)\n\n`;

    // Affordability analysis
    const affordableBuildings = buildings
      .filter(b => b.price * (st.purchaseMode === 'max' ? 1 : 10) <= st.gears)
      .sort((a, b) => a.price - b.price);

    const affordableUpgrades = upgrades
      .filter(u => !u.purchased && u.price <= st.gears);

    const affordableSkills = skills
      .filter(s => s.level < s.maxLevel && s.costRP <= st.researchPoints);

    // GPS analysis
    recommendations += `### 当前产出\n`;
    recommendations += `- 每秒产出: ¥${gps.toFixed(2)}/s\n`;
    recommendations += `- 资本: ¥${st.gears.toFixed(2)}\n`;
    recommendations += `- 建筑: ${totalBuildings}个\n`;

    // Market timing advice
    recommendations += `\n### 市场分析\n`;
    if (st.marketIsBull) {
      recommendations += `- 🐂 当前牛市: 可大胆扩张，收益×1.4\n`;
      recommendations += `  → 建议加速购买建筑和升级\n`;
    } else {
      recommendations += `- 🐻 当前熊市: 谨慎操作，收益×0.7\n`;
      recommendations += `  → 建议储备资本，等待牛市\n`;
    }

    // Building recommendations
    recommendations += `\n### 建筑建议\n`;
    if (affordableBuildings.length > 0) {
      const top3 = affordableBuildings.slice(0, 3);
      for (const b of top3) {
        const roi = b.dps / b.price * 1000;
        recommendations += `- ${b.emoji} ${b.name}: ¥${b.price} → ¥${b.dps}/s (ROI: ${roi.toFixed(2)})\n`;
      }
    } else {
      recommendations += `- 暂无可购买的建筑，积累资本中...\n`;
      const cheapest = buildings[0];
      const needed = cheapest.price - st.gears;
      recommendations += `  → 还需 ¥${needed.toFixed(2)} 购买${cheapest.name}\n`;
    }

    // Upgrade recommendations
    recommendations += `\n### 升级建议\n`;
    if (affordableUpgrades.length > 0) {
      for (const u of affordableUpgrades.slice(0, 3)) {
        recommendations += `- ${u.name}: ¥${u.price} [${u.type} +${u.value}]\n`;
      }
    } else {
      recommendations += `- 暂无可研发的升级\n`;
    }

    // Skill recommendations
    recommendations += `\n### 技能建议\n`;
    if (affordableSkills.length > 0) {
      for (const s of affordableSkills.slice(0, 3)) {
        recommendations += `- ${s.name}: ${s.costRP} RP (当前${s.level}/${s.maxLevel})\n`;
      }
    } else if (st.researchPoints > 0) {
      recommendations += `- RP充足但无可用技能（已达满级）\n`;
    } else {
      recommendations += `- 需要更多RP才能学习技能（通过Prestige获得）\n`;
    }

    // Prestige check
    const prestigeGain = Math.max(0, Math.log10(Math.max(1, st.lifetimeGears)) - 2);
    recommendations += `\n### Prestige 预览\n`;
    recommendations += `- 预计可获得: ${prestigeGain.toFixed(2)} RP\n`;
    if (prestigeGain > 1) {
      recommendations += `→ 建议: 可以考虑Prestige获取大量RP\n`;
    } else {
      recommendations += `→ 建议: 继续积累达到更高倍率\n`;
    }

    // Action plan
    recommendations += `\n### 执行计划\n`;
    if (focus === 'maximize_gears') {
      if (affordableBuildings.length > 0) {
        recommendations += `1. 购买 ${affordableBuildings[0].id} (最高性价比)\n`;
      }
      if (affordableUpgrades.length > 0) {
        recommendations += `2. 研发 ${affordableUpgrades[0].id}\n`;
      }
    } else if (focus === 'speed_run') {
      if (affordableBuildings.length > 0) {
        recommendations += `1. 购买 ${affordableBuildings[0].id} (快速扩张)\n`;
      }
      recommendations += `2. 开启自动投资\n`;
    } else if (focus === 'prestige') {
      recommendations += `1. 最大化 lifetimeGears\n`;
      recommendations += `2. 条件满足后执行 Prestige\n`;
    } else {
      recommendations += `1. 平衡购买建筑和升级\n`;
      recommendations += `2. 保持一定资本储备\n`;
    }

    return {
      content: [{ type: 'text', text: recommendations }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export { getRecommendationsSchema };
