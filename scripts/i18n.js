// i18n.js - Internationalization module (P3-T3)
// Supports Chinese (zh) and English (en)

const I18N = {
  // Current language
  currentLang: 'zh',

  // Supported languages
  supportedLangs: ['zh', 'en'],

  // Translations
  translations: {
    zh: {
      // Game title and headers
      gameTitle: '金融帝国',
      gears: '齿轮',
      gps: '每秒产出',
      offlineEarnings: '离线收益',

      // Buildings
      buildings: '产业',
      buy: '购买',
      buyMax: '最大购买',

      // Upgrades
      upgrades: '升级',
      purchased: '已购买',

      // Skills
      skills: '技能',
      skillPoints: '技能点',

      // Market
      market: '市场',
      bullMarket: '多头市场',
      bearMarket: '空头市场',
      policyRate: '政策利率',
      outlook: '前瞻',
      volatility: '波动率',

      // Events
      events: '事件',
      quest: '任务',
      bonus: '奖励',
      crisis: '危机',
      milestone: '里程碑',

      // Actions
      manualCollect: '手动收集',
      autoBuy: '自动购买',
      prestige: 'Prestige',
      save: '保存',
      export: '导出存档',
      import: '导入存档',

      // Stats
      stats: '统计',
      totalGears: '累计齿轮',
      playTime: '游戏时间',
      buildingsOwned: '拥有建筑',
      upgradesPurchased: '已购升级',

      // System
      settings: '设置',
      language: '语言',
      sound: '音效',
      on: '开',
      off: '关',

      // Notifications
      questComplete: '任务完成',
      eventTriggered: '事件触发',
      achievementUnlocked: '成就解锁',
    },

    en: {
      // Game title and headers
      gameTitle: 'Financial Empire',
      gears: 'Gears',
      gps: 'GPS',
      offlineEarnings: 'Offline Earnings',

      // Buildings
      buildings: 'Buildings',
      buy: 'Buy',
      buyMax: 'Buy Max',

      // Upgrades
      upgrades: 'Upgrades',
      purchased: 'Purchased',

      // Skills
      skills: 'Skills',
      skillPoints: 'Skill Points',

      // Market
      market: 'Market',
      bullMarket: 'Bull Market',
      bearMarket: 'Bear Market',
      policyRate: 'Policy Rate',
      outlook: 'Outlook',
      volatility: 'Volatility',

      // Events
      events: 'Events',
      quest: 'Quest',
      bonus: 'Bonus',
      crisis: 'Crisis',
      milestone: 'Milestone',

      // Actions
      manualCollect: 'Manual Collect',
      autoBuy: 'Auto Buy',
      prestige: 'Prestige',
      save: 'Save',
      export: 'Export Save',
      import: 'Import Save',

      // Stats
      stats: 'Statistics',
      totalGears: 'Total Gears',
      playTime: 'Play Time',
      buildingsOwned: 'Buildings Owned',
      upgradesPurchased: 'Upgrades Purchased',

      // System
      settings: 'Settings',
      language: 'Language',
      sound: 'Sound',
      on: 'On',
      off: 'Off',

      // Notifications
      questComplete: 'Quest Complete',
      eventTriggered: 'Event Triggered',
      achievementUnlocked: 'Achievement Unlocked',
    }
  },

  // Get translation
  t(key, lang = null) {
    const targetLang = lang || this.currentLang;
    const translation = this.translations[targetLang]?.[key];
    return translation || this.translations['en'][key] || key;
  },

  // Set language
  setLanguage(lang) {
    if (this.supportedLangs.includes(lang)) {
      this.currentLang = lang;
      localStorage.setItem('gameLanguage', lang);
      this.updatePageTitle();
      return true;
    }
    return false;
  },

  // Get current language
  getLanguage() {
    return this.currentLang;
  },

  // Initialize language from storage
  init() {
    const savedLang = localStorage.getItem('gameLanguage');
    if (savedLang && this.supportedLangs.includes(savedLang)) {
      this.currentLang = savedLang;
    }
    this.updatePageTitle();
  },

  // Update page title
  updatePageTitle() {
    document.title = this.t('gameTitle');
  },

  // Toggle language
  toggle() {
    const newLang = this.currentLang === 'zh' ? 'en' : 'zh';
    this.setLanguage(newLang);
    return newLang;
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  I18N.init();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N };
}
