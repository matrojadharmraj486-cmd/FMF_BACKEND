export const BANNER_TYPES = ["banner1", "banner2", "banner3", "banner4", "banner5"];

export const normalizeBannerType = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  const match = normalized.match(/^(?:banner|type)\s*([1-5])$/);
  return match ? `banner${match[1]}` : null;
};

export const getBannerTypeAliases = (value) => {
  const bannerType = normalizeBannerType(value);
  if (!bannerType) return [];

  const number = bannerType.replace("banner", "");
  return Array.from(new Set([
    bannerType,
    `type${number}`,
    `Type${number}`,
    `Banner ${number}`
  ]));
};
