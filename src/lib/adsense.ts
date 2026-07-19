// Central AdSense config. Swap these placeholder IDs once your AdSense
// account is approved and you have real ad units.

export const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";

export const AD_SLOTS = {
  inArticleTop: "0000000001",
  inArticleBottom: "0000000002",
  homepageBanner: "0000000003",
  sidebar: "0000000004",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;
