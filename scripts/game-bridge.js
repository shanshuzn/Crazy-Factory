// ════════════════════════════════════════════════
// Game Bridge - 暴露游戏 API 给 MCP Server
// 注入到浏览器游戏，提供 WebSocket 接口
// ════════════════════════════════════════════════

(function() {
  'use strict';

  const BRIDGE_PORT = 8765;
  let ws = null;
  let connected = false;

  // 连接状态指示器
  function createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'mcpBridgeStatus';
    indicator.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #333;
      color: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 9999;
      opacity: 0.7;
      transition: opacity 0.3s;
    `;
    indicator.textContent = 'MCP: 连接中...';
    document.body.appendChild(indicator);
    return indicator;
  }

  let statusEl = null;

  function updateStatus(status, color) {
    if (!statusEl) return;
    statusEl.textContent = `MCP: ${status}`;
    statusEl.style.background = color || '#333';
  }

  // 连接 WebSocket
  function connect() {
    if (ws) {
      ws.close();
    }

    try {
      ws = new WebSocket(`ws://localhost:${BRIDGE_PORT}`);

      ws.onopen = () => {
        connected = true;
        updateStatus('已连接', '#22c55e');
        console.log('[GameBridge] Connected to MCP server');
      };

      ws.onclose = () => {
        connected = false;
        updateStatus('已断开', '#ef4444');
        console.log('[GameBridge] Disconnected, reconnecting in 3s...');
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[GameBridge] WebSocket error:', error);
        updateStatus('错误', '#ef4444');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('[GameBridge] Failed to parse message:', error);
        }
      };
    } catch (error) {
      console.error('[GameBridge] Failed to connect:', error);
      setTimeout(connect, 3000);
    }
  }

  // 处理来自 MCP Server 的消息
  function handleMessage(message) {
    const { requestId, method, params } = message;
    let result;
    let error;

    try {
      switch (method) {
        case 'getState':
          result = getGameState();
          break;

        case 'buyBuilding':
          result = doBuyBuilding(params.buildingId, params.quantity);
          break;

        case 'buyUpgrade':
          result = doBuyUpgrade(params.upgradeId);
          break;

        case 'buySkill':
          result = doBuySkill(params.skillId);
          break;

        case 'setAutoBuy':
          result = doSetAutoBuy(params.enabled);
          break;

        default:
          error = `Unknown method: ${method}`;
      }
    } catch (e) {
      error = e.message;
    }

    // 发送响应
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        requestId,
        result,
        error,
      }));
    }
  }

  // 获取游戏状态
  function getGameState() {
    // 检查游戏是否初始化
    if (typeof st === 'undefined') {
      return {
        error: 'Game not initialized',
      };
    }

    return {
      st: {
        gears: st.gears,
        lifetimeGears: st.lifetimeGears,
        researchPoints: st.researchPoints,
        manualPower: st.manualPower,
        manualMult: st.manualMult,
        gps: typeof economy !== 'undefined' ? economy.getTotalGPS() : 0,
        marketIsBull: st.marketIsBull,
        marketTimer: st.marketTimer,
        marketMomentum: st.marketMomentum,
        policyRate: st.policyRate,
        autoBuy: st.autoBuy,
        gameSpeed: st.gameSpeed,
        purchaseMode: st.purchaseMode,
        skillMasteryTier: st.skillMasteryTier,
      },
      buildings: typeof buildings !== 'undefined' ? buildings.map(b => ({
        id: b.id,
        name: b.name,
        emoji: b.emoji,
        owned: b.owned,
        price: typeof economy !== 'undefined' ? economy.price(b.id) : b.price,
        dps: b.dps,
        locked: b.locked,
      })) : [],

      upgrades: typeof upgrades !== 'undefined' ? upgrades.map(u => ({
        id: u.id,
        name: u.name,
        price: u.price,
        type: u.type,
        value: u.value,
        purchased: u.purchased,
        locked: u.locked,
      })) : [],

      skills: typeof skills !== 'undefined' ? skills.map(s => ({
        id: s.id,
        name: s.name,
        level: s.level,
        maxLevel: s.maxLevel,
        costRP: s.costRP,
      })) : [],
    };
  }

  // 购买建筑
  function doBuyBuilding(buildingId, quantity = 1) {
    if (typeof economy === 'undefined') {
      return { error: 'Economy system not available' };
    }

    const building = economy.bld(buildingId);
    if (!building) {
      return { error: `Building not found: ${buildingId}` };
    }

    // 尝试购买
    const gearsBefore = st.gears;
    economy.buyBuilding(buildingId);
    const gearsAfter = st.gears;

    if (gearsAfter < gearsBefore) {
      return {
        st: { gears: st.gears, researchPoints: st.researchPoints },
        building: {
          id: building.id,
          name: building.name,
          owned: building.owned,
        },
        success: true,
      };
    } else {
      return { error: 'Not enough gears or building locked' };
    }
  }

  // 购买升级
  function doBuyUpgrade(upgradeId) {
    if (typeof economy === 'undefined') {
      return { error: 'Economy system not available' };
    }

    const upgrade = upgrades.find(u => u.id === upgradeId);
    if (!upgrade) {
      return { error: `Upgrade not found: ${upgradeId}` };
    }

    if (upgrade.purchased) {
      return { error: 'Upgrade already purchased' };
    }

    const gearsBefore = st.gears;
    economy.buyUpgrade(upgradeId);
    const gearsAfter = st.gears;

    if (gearsAfter < gearsBefore) {
      return {
        st: { gears: st.gears, researchPoints: st.researchPoints },
        upgrade: {
          id: upgrade.id,
          name: upgrade.name,
          type: upgrade.type,
          value: upgrade.value,
        },
        success: true,
      };
    } else {
      return { error: 'Not enough gears or upgrade locked' };
    }
  }

  // 购买技能
  function doBuySkill(skillId) {
    if (typeof skillSystem === 'undefined') {
      return { error: 'Skill system not available' };
    }

    const skill = skills.find(s => s.id === skillId);
    if (!skill) {
      return { error: `Skill not found: ${skillId}` };
    }

    if (skill.level >= skill.maxLevel) {
      return { error: 'Skill already at max level' };
    }

    const rpBefore = st.researchPoints;
    skillSystem.buySkill(skillId);
    const rpAfter = st.researchPoints;

    if (rpAfter < rpBefore) {
      return {
        st: { gears: st.gears, researchPoints: st.researchPoints },
        skill: {
          id: skill.id,
          name: skill.name,
          level: skill.level,
          maxLevel: skill.maxLevel,
        },
        success: true,
      };
    } else {
      return { error: 'Not enough RP' };
    }
  }

  // 设置自动购买
  function doSetAutoBuy(enabled) {
    if (typeof st === 'undefined') {
      return { error: 'Game state not available' };
    }

    st.autoBuy = enabled;
    if (typeof saveGame === 'function') {
      saveGame();
    }

    return {
      success: true,
      autoBuy: st.autoBuy,
    };
  }

  // 初始化
  function init() {
    // 延迟创建状态指示器，等待 DOM 加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        statusEl = createStatusIndicator();
        connect();
      });
    } else {
      statusEl = createStatusIndicator();
      connect();
    }
  }

  // 暴露 API
  window.gameBridge = {
    getState: getGameState,
    buyBuilding: doBuyBuilding,
    buyUpgrade: doBuyUpgrade,
    buySkill: doBuySkill,
    setAutoBuy: doSetAutoBuy,
    isConnected: () => connected,
  };

  // 自动初始化
  init();
})();
