// 纯经济计算：与 DOM/存档解耦，便于脚本回归和后续单测。
export function getEffectiveOwnedForPrice(owned, curve) {
  const { midStart, lateStart, midFactor, lateFactor } = curve;
  if (owned <= midStart) return owned;
  if (owned <= lateStart) return midStart + (owned - midStart) * midFactor;
  const midSegment = (lateStart - midStart) * midFactor;
  const lateSegment = (owned - lateStart) * lateFactor;
  return midStart + midSegment + lateSegment;
}

export function getCurrentPrice({ basePrice, owned, ownedOffset = 0, growth, discountMultiplier, curve }) {
  const effectiveOwned = getEffectiveOwnedForPrice(owned + ownedOffset, curve);
  return Math.floor(basePrice * Math.pow(growth, effectiveOwned) * discountMultiplier);
}

export function getPrestigeGain(lifetimeGears, { baseDivisor, lateBonusStart, lateBonusStep }) {
  const base = Math.floor(Math.sqrt(lifetimeGears / baseDivisor));
  if (lifetimeGears < lateBonusStart) return base;
  const lateBonus = Math.floor((lifetimeGears - lateBonusStart) / lateBonusStep) + 1;
  return base + lateBonus;
}
