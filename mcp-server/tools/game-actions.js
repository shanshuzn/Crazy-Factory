// Game Actions Tool - Execute actions in the browser game
import { z } from 'zod';

const buyBuildingSchema = z.object({
  buildingId: z.string().describe('Building ID to purchase'),
  quantity: z.number().int().positive().optional().default(1).describe('Quantity to buy (default: 1)'),
});

const buyUpgradeSchema = z.object({
  upgradeId: z.string().describe('Upgrade ID to purchase'),
});

const buySkillSchema = z.object({
  skillId: z.string().describe('Skill ID to upgrade'),
});

const setAutoBuySchema = z.object({
  enabled: z.boolean().describe('Enable or disable auto-buy'),
});

export async function buyBuilding(bridge, args) {
  const parsed = buyBuildingSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { buildingId, quantity } = parsed.data;

  try {
    const result = await bridge.buyBuilding(buildingId, quantity);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `购买失败: ${result.error}` }],
        isError: true,
      };
    }

    const { st, building } = result.data;
    return {
      content: [{
        type: 'text',
        text: `✅ 成功购买 ${quantity}个 ${building.name}\n当前持有: ${building.owned}个\n剩余资本: ¥${st.gears.toFixed(2)}`
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export async function buyUpgrade(bridge, args) {
  const parsed = buyUpgradeSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { upgradeId } = parsed.data;

  try {
    const result = await bridge.buyUpgrade(upgradeId);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `研发失败: ${result.error}` }],
        isError: true,
      };
    }

    const { st, upgrade } = result.data;
    return {
      content: [{
        type: 'text',
        text: `✅ 研发成功: ${upgrade.name}\n效果: ${upgrade.type} +${upgrade.value}\n剩余资本: ¥${st.gears.toFixed(2)}`
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export async function buySkill(bridge, args) {
  const parsed = buySkillSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { skillId } = parsed.data;

  try {
    const result = await bridge.buySkill(skillId);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `技能升级失败: ${result.error}` }],
        isError: true,
      };
    }

    const { st, skill } = result.data;
    return {
      content: [{
        type: 'text',
        text: `✅ 技能升级成功: ${skill.name}\n当前等级: ${skill.level}/${skill.maxLevel}\n剩余RP: ${st.researchPoints}`
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export async function setAutoBuy(bridge, args) {
  const parsed = setAutoBuySchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { enabled } = parsed.data;

  try {
    const result = await bridge.setAutoBuy(enabled);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `设置失败: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ 自动投资已${enabled ? '启用' : '禁用'}`
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export { buyBuildingSchema, buyUpgradeSchema, buySkillSchema, setAutoBuySchema };
