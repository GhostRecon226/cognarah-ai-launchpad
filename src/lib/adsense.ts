// Central AdSense config. AD_SLOTS stay as placeholders until real ad units
// are created in the AdSense dashboard.

export const ADSENSE_CLIENT = "ca-pub-6846746931516022";

export const AD_SLOTS = {
  inArticleTop: "0000000001",
  inArticleBottom: "0000000002",
  homepageBanner: "0000000003",
  sidebar: "0000000004",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;
