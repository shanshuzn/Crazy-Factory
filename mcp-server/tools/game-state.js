// Game State Tool - Read game state from browser via Bridge
import { z } from 'zod';

const getGameStateSchema = z.object({
  includeBuildings: z.boolean().optional().default(true),
  includeUpgrades: z.boolean().optional().default(true),
  includeSkills: z.boolean().optional().default(true),
  includeMarket: z.boolean().optional().default(true),
});

export async function getGameState(bridge, args) {
  const parsed = getGameStateSchema.safeParse(args || {});
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const options = parsed.data;

  try {
    const state = await bridge.getState();

    if (!state.success) {
      return {
        content: [{ type: 'text', text: `Game not connected: ${state.error}` }],
        isError: true,
      };
    }

    const { st, buildings, upgrades, skills } = state.data;

    // Build response
    let response = `## 游戏状态\n\n`;
    response += `**资本**: ¥${st.gears.toFixed(2)} (¥${st.gears.toFixed(2)}/s)\n`;
    response += `**历史资本**: ¥${st.lifetimeGears.toFixed(2)}\n`;
    response += `**研究点数**: ${st.researchPoints} RP\n`;
    response += `**手动产出**: ¥${st.manualPower}/次 × ${st.manualMult.toFixed(2)}\n`;

    if (options.includeMarket) {
      response += `\n## 市场状态\n\n`;
      response += `**市场**: ${st.marketIsBull ? '🐂 牛市 (×1.4)' : '🐻 熊市 (×0.7)'}\n`;
      response += `**周期切换**: ${st.marketTimer.toFixed(1)}s\n`;
      response += `**动量**: ${st.marketMomentum}\n`;
    }

    if (options.includeBuildings) {
      response += `\n## 建筑 (${buildings.filter(b => b.owned > 0).length}/${buildings.length} 已购买)\n\n`;
      for (const b of buildings) {
        if (b.owned > 0) {
          response += `- ${b.emoji} ${b.name}: ${b.owned}个 (¥${b.dps}/s)\n`;
        }
      }
      if (buildings.filter(b => b.owned > 0).length === 0) {
        response += `(暂无已购买建筑)\n`;
      }
    }

    if (options.includeUpgrades) {
      const purchased = upgrades.filter(u => u.purchased);
      response += `\n## 升级 (${purchased.length}/${upgrades.length} 已研发)\n\n`;
      for (const u of purchased) {
        response += `- ${u.name}: ${u.type} +${u.value}\n`;
      }
      if (purchased.length === 0) {
        response += `(暂无已研发升级)\n`;
      }
    }

    if (options.includeSkills) {
      const maxed = skills.filter(s => s.level === s.maxLevel).length;
      response += `\n## 技能 (${skills.filter(s => s.level > 0).length}/${skills.length} 已学习, ${maxed} 已满级)\n\n`;
      for (const s of skills) {
        if (s.level > 0) {
          const progress = s.maxLevel > 1 ? ` (Lv.${s.level}/${s.maxLevel})` : ' (已满级)';
          response += `- ${s.name}${progress}\n`;
        }
      }
      if (skills.filter(s => s.level > 0).length === 0) {
        response += `(暂无已学习技能)\n`;
      }
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error getting game state: ${error.message}` }],
      isError: true,
    };
  }
}

export { getGameStateSchema };
