export type SeedChapter = {
  sortOrder: number;
  title: string;
  subtitle: string;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription: string;
  badgeEmoji: string;
  mapThemeKey: string;
};

/** 占位世界观：双人小旅程。上线前可整表替换文案。 */
export const DEFAULT_ADVENTURE_SEED: SeedChapter[] = [
  {
    sortOrder: 1,
    title: "启程灯塔",
    subtitle: "第一次把约定写进日历",
    storyText: "你们在灯塔下约好：每天只前进一点点。海风不急，光会一直亮着。",
    thresholdLifetimeXp: 50,
    badgeName: "启程徽章",
    badgeDescription: "迈出第一段共享旅程",
    badgeEmoji: "🏮",
    mapThemeKey: "lighthouse"
  },
  {
    sortOrder: 2,
    title: "林间小径",
    subtitle: "连续的脚步声",
    storyText: "小路不宽，却刚好容得下两个人并肩。落叶记得你们走过的日子。",
    thresholdLifetimeXp: 150,
    badgeName: "林径徽章",
    badgeDescription: "习惯开始有了回声",
    badgeEmoji: "🌲",
    mapThemeKey: "forest"
  },
  {
    sortOrder: 3,
    title: "河边集市",
    subtitle: "把坚持换成微笑",
    storyText: "集市上没有人催促。你们用一点一点攒下的光，换一袋甜的回忆。",
    thresholdLifetimeXp: 300,
    badgeName: "集市徽章",
    badgeDescription: "奖励自己温柔一点",
    badgeEmoji: "🧺",
    mapThemeKey: "market"
  },
  {
    sortOrder: 4,
    title: "星空营地",
    subtitle: "停下来也算前进",
    storyText: "帐篷外是很长的夜。你们数星星，也数一起完成的小目标。",
    thresholdLifetimeXp: 500,
    badgeName: "营地徽章",
    badgeDescription: "休息是旅程的一部分",
    badgeEmoji: "⛺",
    mapThemeKey: "camp"
  },
  {
    sortOrder: 5,
    title: "云上桥梁",
    subtitle: "跨过容易放弃的那天",
    storyText: "桥在云里若隐若现。握住栏杆的手是热的——另一只手也是。",
    thresholdLifetimeXp: 800,
    badgeName: "云桥徽章",
    badgeDescription: "一起跨过动摇",
    badgeEmoji: "🌉",
    mapThemeKey: "bridge"
  },
  {
    sortOrder: 6,
    title: "山顶邮局",
    subtitle: "给未来的两个人",
    storyText: "山顶有一封未寄出的信：谢谢你们没有只靠热情，还靠了日程表。",
    thresholdLifetimeXp: 1200,
    badgeName: "山顶徽章",
    badgeDescription: "阶段旅程的纪念戳",
    badgeEmoji: "⛰️",
    mapThemeKey: "summit"
  }
];
