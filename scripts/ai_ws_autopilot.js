/**
 * Crazy Factory - AI 自动驾驶（通过 WebSocket Bridge）
 * 
 * 使用方法：
 * 1. 确保游戏在浏览器中打开 (http://localhost:8080)
 * 2. 在游戏中连接到 Bridge（游戏应该会自动连接 ws://localhost:8765）
 * 3. 运行此脚本：node scripts/ai_ws_autopilot.js
 * 4. 等待 10-15 分钟
 * 5. 检查 output/tuning_report.json 中的 market_stability_score
 */

import WebSocket from 'ws';

const BRIDGE_URL = 'ws://localhost:8765';
const TEST_DURATION_MS = 15 * 60 * 1000; // 15 分钟
const ACTION_INTERVAL_MS = 1000; // 每秒执行一次操作
const SAVE_INTERVAL_MS = 30000; // 每 30 秒保存一次

let ws = null;
let isRunning = false;
let startTime = null;
let actionCount = 0;
let requestId = 0;
const pendingRequests = new Map();

// 连接到 Bridge
function connect() {
  console.log(`[AI] 连接到 Bridge: ${BRIDGE_URL}`);
  ws = new WebSocket(BRIDGE_URL);

  ws.on('open', () => {
    console.log('[AI] 已连接到游戏 Bridge');
    isRunning = true;
    startTime = Date.now();
    startGameplay();
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    } catch (error) {
      console.error('[AI] 解析消息失败:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('[AI] 与 Bridge 断开连接');
    isRunning = false;
  });

  ws.on('error', (error) => {
    console.error('[AI] WebSocket 错误:', error.message);
  });
}

// 处理来自游戏的消息
function handleMessage(message) {
  if (message.id && pendingRequests.has(message.id)) {
    const { resolve } = pendingRequests.get(message.id);
    pendingRequests.delete(message.id);
    resolve(message);
  }
}

// 发送命令到游戏
function sendCommand(command, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket 未连接'));
      return;
    }

    const id = ++requestId;
    const message = {
      id,
      command,
      params,
      timestamp: Date.now()
    };

    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify(message));

    // 超时处理
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`命令超时: ${command}`));
      }
    }, 5000);
  });
}

// 获取游戏状态
async function getGameState() {
  try {
    const response = await sendCommand('get_state');
    return response.data;
  } catch (error) {
    console.error('[AI] 获取状态失败:', error.message);
    return null;
  }
}

// 购买建筑
async function buyBuilding(buildingId, quantity = 1) {
  try {
    const response = await sendCommand('buy_building', { buildingId, quantity });
    return response.success;
  } catch (error) {
    // 可能是钱不够，忽略错误
    return false;
  }
}

// 购买升级
async function buyUpgrade(upgradeId) {
  try {
    const response = await sendCommand('buy_upgrade', { upgradeId });
    return response.success;
  } catch (error) {
    return false;
  }
}

// 执行游戏逻辑
async function doGameAction() {
  if (!isRunning) return;

  try {
    const state = await getGameState();
    if (!state) return;

    // 策略：优先购买最便宜的可购买建筑
    const affordableBuildings = state.buildings
      .filter(b => b.owned < b.max && state.gears >= b.cost)
      .sort((a, b) => a.cost - b.cost);

    if (affordableBuildings.length > 0) {
      const bought = await buyBuilding(affordableBuildings[0].id);
      if (bought) {
        actionCount++;
      }
      return;
    }

    // 如果没有可购买建筑，尝试购买升级
    const affordableUpgrades = state.upgrades
      .filter(u => !u.owned && state.gears >= u.cost)
      .sort((a, b) => a.cost - b.cost);

    if (affordableUpgrades.length > 0) {
      await buyUpgrade(affordableUpgrades[0].id);
      actionCount++;
    }
  } catch (error) {
    console.error('[AI] 执行动作失败:', error.message);
  }
}

// 报告状态
function reportStatus() {
  getGameState().then(state => {
    if (!state) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[AI] ${elapsed}s | 齿轮: ${Math.floor(state.gears)} | GPS: ${state.gps.toFixed(2)} | 操作: ${actionCount}`);
  });
}

// 开始游戏循环
function startGameplay() {
  console.log(`[AI] 开始自动驾驶，将持续 ${TEST_DURATION_MS / 60000} 分钟...`);

  let lastReportTime = Date.now();
  let lastSaveTime = Date.now();

  const intervalId = setInterval(async () => {
    if (!isRunning) {
      clearInterval(intervalId);
      return;
    }

    // 执行游戏动作
    await doGameAction();

    // 定期报告状态
    if (Date.now() - lastReportTime >= 10000) {
      reportStatus();
      lastReportTime = Date.now();
    }

    // 定期保存
    if (Date.now() - lastSaveTime >= SAVE_INTERVAL_MS) {
      console.log('[AI] 保存游戏...');
      try {
        await sendCommand('save_game');
      } catch (error) {
        // 忽略保存错误
      }
      lastSaveTime = Date.now();
    }

    // 检查是否结束
    if (Date.now() - startTime >= TEST_DURATION_MS) {
      console.log('\n[AI] ===== 测试完成！=====');
      reportStatus();
      try {
        await sendCommand('save_game');
      } catch (error) {
        // 忽略
      }
      isRunning = false;
      clearInterval(intervalId);
      ws.close();
      console.log('[AI] 请检查 output/tuning_report.json 查看市场稳定性分数');
    }
  }, ACTION_INTERVAL_MS);
}

// 主函数
function main() {
  console.log('[AI] Crazy Factory 自动驾驶启动...');
  console.log('[AI] 提示：确保游戏已打开并连接到 Bridge (ws://localhost:8765)');
  console.log('');

  connect();
}

main();
