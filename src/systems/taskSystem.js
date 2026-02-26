// 任务/订单纯函数：只接收快照与配置，避免直接依赖 DOM/state 单例。
export function getOrderProgress(order, progressSources) {
  if (!order) return 0;
  if (order.type === "clicks") return Math.max(0, progressSources.totalClicks - order.startValue);
  if (order.type === "lifetime") return Math.max(0, progressSources.lifetimeGears - order.startValue);
  if (order.type === "building") {
    const owned = progressSources.buildingOwnedById?.[order.buildingId] || 0;
    return Math.max(0, owned - order.startValue);
  }
  return 0;
}

export function pickWeightedOrderTemplate(unlockedTemplates, marketKey, rng = Math.random) {
  if (!Array.isArray(unlockedTemplates) || unlockedTemplates.length === 0) return null;
  const weighted = unlockedTemplates.map((template) => ({
    ...template,
    dynWeight: template.weight * (template.preferredMarket === marketKey ? 1.8 : 1)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.dynWeight, 0);
  let roll = rng() * totalWeight;
  for (const template of weighted) {
    roll -= template.dynWeight;
    if (roll <= 0) return template;
  }
  return weighted[weighted.length - 1] || null;
}

export function createOrderFromTemplate({ template, tier, timestamp, rewardScale, targetScale, runtimeSnapshot }) {
  const rewardGear = 150 * tier;
  const rewardRP = 1 + Math.floor(tier / 3);
  const common = {
    id: `order_${template.key}_${timestamp}`,
    title: template.title,
    desc: template.desc,
    financeTag: template.financeTag || null
  };

  if (template.type === "clicks") {
    return {
      ...common,
      type: "clicks",
      target: Math.max(10, Math.floor((25 + tier * 5) * targetScale)),
      startValue: runtimeSnapshot.totalClicks,
      reward: { type: template.rewardType || "gear", value: Math.max(1, Math.floor(rewardGear * rewardScale)) }
    };
  }

  if (template.type === "lifetime") {
    return {
      ...common,
      type: "lifetime",
      target: Math.max(400, Math.floor((800 + tier * 250) * targetScale)),
      startValue: runtimeSnapshot.lifetimeGears,
      reward: {
        type: template.rewardType || "gear",
        value: Math.max(1, Math.floor((template.rewardType === "rp" ? rewardRP : rewardGear * 2) * rewardScale))
      }
    };
  }

  if (template.type === "building") {
    const buildingId = template.buildingId;
    const baseTarget = buildingId === "assembler" ? 2 : 3;
    return {
      ...common,
      type: "building",
      buildingId,
      target: Math.max(1, Math.floor((baseTarget + Math.floor(tier / 2)) * targetScale)),
      startValue: runtimeSnapshot.buildingOwnedById?.[buildingId] || 0,
      reward: {
        type: template.rewardType || (buildingId === "assembler" ? "rp" : "gear"),
        value: Math.max(1, Math.floor((buildingId === "assembler" ? rewardRP : rewardGear) * rewardScale))
      }
    };
  }

  return null;
}
