/**
 * 版本单一来源（Single Source of Truth for Version）
 *
 * 为什么拆分：游戏版本号此前在 game.js / debug-system.js / sw.js / site/index.html
 * 等多处硬编码，升级时极易漏改（历史上已发生两次）。本文件作为唯一版本源，
 * 由 tests/version-consistency.test.js 守护其他所有位置与它保持一致。
 *
 * 约定：
 *  - CF_VERSION  = 当前版本字符串（如 'v2.15.0'）
 *  - CF_CHANGELOG = 更新日志数组（最新在前）
 *  - 升级版本时只改本文件 + version.json，其余位置由测试自动校验。
 */
(function () {
  const CF_VERSION = 'v2.15.0';
  const CF_CHANGELOG = [
    { version: 'v2.15.0', date: '2026-08-08', notes: ['场景市场：8 个精选社区场景（大萧条/黄金年代/供应链危机等），支持收藏夹', '版本号收敛为单一来源，新增一致性测试守护'] },
    { version: 'v2.14.0', date: '2026-08-08', notes: ['PWA 离线支持：Service Worker 预缓存全部核心资源，支持安装到桌面/离线游玩', 'manifest 补齐 scope/display_override/shortcuts 等规范字段'] },
    { version: 'v2.13.0', date: '2026-08-08', notes: ['UGC 场景分享码：一键生成/复制 CFS1 短码，支持 URL 参数 ?scenario= 自动导入', '导入框支持粘贴分享码或 JSON，分享按钮直达'] },
    { version: 'v2.12.0', date: '2026-08-08', notes: ['Mod 支持接口：window.CFMod API，支持注册/启用/禁用/持久化，内置示例 Mod', '修复 APP_VERSION 未同步显示版本的问题'] },
    { version: 'v2.11.0', date: '2026-08-08', notes: ['性能监控面板增强：12 项 GPS 乘数分解、FPS/帧耗时/Heap 趋势图、场景/资产配置实时状态', '官网同步 v2.11.0：新增 UGC 场景编辑器介绍与更新日志'] },
    { version: 'v2.10.0', date: '2026-08-07', notes: ['UGC 场景编辑器正式接入游戏（创建/导入/导出/模板切换）', '修复滚动更新检测在无 RAF 调度器环境下的崩溃', '存档新增场景状态持久化'] },
    { version: 'v2.9.0', date: '2026-06-08', notes: ['市场稳定性优化', '新增公会科技树', 'i18n 扩展至 10 种语言'] },
  ];

  // 挂到全局（浏览器 window）
  if (typeof window !== 'undefined') {
    window.CF_VERSION = CF_VERSION;
    window.CF_CHANGELOG = CF_CHANGELOG;
  }

  // Node 环境导出（测试用）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CF_VERSION, CF_CHANGELOG };
  }
})();
