/**
 * 滚动更新检测系统 (Rolling Update Detection System)
 * 
 * 功能：定期检测服务器版本变化，当有新版本发布时提示用户刷新页面
 * 机制：
 * 1. 轮询检测：每 5 分钟检查一次版本文件
 * 2. 版本比对：比较本地 APP_VERSION 与服务器版本
 * 3. 智能提示：检测到新版本时显示非侵入式更新提示
 * 4. 用户控制：用户可选择立即刷新或延迟提醒
 */

const createUpdateDetectionSystem = ({
  currentVersion,
  checkIntervalMs = 5 * 60 * 1000, // 默认 5 分钟
  versionUrl = './version.json',
  onUpdateAvailable = null,
  onError = null,
  enabled = true,
}) => {
  if (!enabled) {
    return { start: () => {}, stop: () => {}, checkNow: () => {}, isRunning: () => false };
  }

  let timerId = null;
  let isChecking = false;
  let lastDetectedVersion = null;
  let dismissedVersion = localStorage.getItem('updateDismissedVersion') || '';
  // 优先使用统一 RAF 调度器（window.__timerManager）；不可用时回退到原生 setInterval
  const _getTimerManager = () =>
    (typeof window !== 'undefined' && window.__timerManager) || null;
  // timerId 作为调度句柄（RAF 调度器使用平凡值 1 作为运行中标记，原生定时器保存 interval id）
  const _scheduleUpdateCheck = () => {
    if (timerId) return;
    const tm = _getTimerManager();
    if (tm && typeof tm.schedule === 'function') {
      timerId = 1; // RAF 调度器无 ID，平凡值仅作运行中标记
      tm.schedule(checkVersion, checkIntervalMs);
    } else {
      timerId = setInterval(checkVersion, checkIntervalMs);
    }
  };
  const _cancelScheduledCheck = () => {
    if (!timerId) return;
    const tm = _getTimerManager();
    if (tm && typeof tm.cancel === 'function') {
      tm.cancel(checkVersion);
    } else {
      clearInterval(timerId);
    }
    timerId = null;
  };

  /**
   * 获取服务器版本
   * 添加时间戳防止缓存
   */
  const fetchServerVersion = async () => {
    const url = `${versionUrl}?t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.version || data.APP_VERSION || null;
  };

  /**
   * 比较版本号
   * 支持语义化版本格式：v1.2.3 或 1.2.3
   * 返回：-1 (本地 < 服务器), 0 (相等), 1 (本地 > 服务器)
   */
  const compareVersions = (local, remote) => {
    const normalize = (v) => v.replace(/^v/, '').split('.').map(Number);
    const localParts = normalize(local);
    const remoteParts = normalize(remote);

    const maxLen = Math.max(localParts.length, remoteParts.length);
    for (let i = 0; i < maxLen; i++) {
      const localPart = localParts[i] || 0;
      const remotePart = remoteParts[i] || 0;
      if (localPart < remotePart) return -1;
      if (localPart > remotePart) return 1;
    }
    return 0;
  };

  /**
   * 执行版本检测
   */
  const checkVersion = async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      const serverVersion = await fetchServerVersion();
      if (!serverVersion) {
        throw new Error('Invalid version format from server');
      }

      const comparison = compareVersions(currentVersion, serverVersion);

      if (comparison < 0) {
        // 服务器有新版本
        lastDetectedVersion = serverVersion;

        // 检查用户是否已经忽略了这个版本
        if (dismissedVersion !== serverVersion) {
          notifyUpdateAvailable(serverVersion);
        }
      }

      return { hasUpdate: comparison < 0, serverVersion, currentVersion };
    } catch (error) {
      if (onError) onError(error);
      return { hasUpdate: false, error: error.message };
    } finally {
      isChecking = false;
    }
  };

  /**
   * 显示更新提示 UI
   */
  const notifyUpdateAvailable = (newVersion) => {
    // 优先使用回调通知，让主应用决定如何展示
    if (onUpdateAvailable) {
      onUpdateAvailable({
        currentVersion,
        newVersion,
        dismiss: () => dismissUpdate(newVersion),
        reload: forceReload,
      });
      return;
    }

    // 内置默认 UI
    showDefaultUpdateToast(newVersion);
  };

  /**
   * 内置默认更新提示 Toast
   */
  const showDefaultUpdateToast = (newVersion) => {
    // 移除已存在的提示
    const existingToast = document.getElementById('updateToast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'updateToast';
    toast.className = 'update-toast';
    toast.innerHTML = `
      <div class="update-toast-content">
        <span class="update-icon">🚀</span>
        <span class="update-text">新版本 ${newVersion} 可用</span>
        <button class="update-btn update-btn-primary" id="updateBtnReload">立即刷新</button>
        <button class="update-btn update-btn-secondary" id="updateBtnDismiss">稍后</button>
      </div>
    `;

    // 添加样式
    if (!document.getElementById('updateToastStyles')) {
      const styles = document.createElement('style');
      styles.id = 'updateToastStyles';
      styles.textContent = `
        .update-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          z-index: 10000;
          animation: slideInUp 0.4s ease-out;
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 380px;
        }
        @keyframes slideInUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .update-toast-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .update-icon { font-size: 20px; }
        .update-text { font-weight: 500; flex: 1; }
        .update-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .update-btn-primary {
          background: white;
          color: #1e3a8a;
        }
        .update-btn-primary:hover { background: #f0f9ff; }
        .update-btn-secondary {
          background: rgba(255,255,255,0.2);
          color: white;
        }
        .update-btn-secondary:hover { background: rgba(255,255,255,0.3); }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // 绑定事件
    toast.querySelector('#updateBtnReload').addEventListener('click', forceReload);
    toast.querySelector('#updateBtnDismiss').addEventListener('click', () => {
      dismissUpdate(newVersion);
      toast.remove();
    });
  };

  /**
   * 忽略当前版本更新
   */
  const dismissUpdate = (version) => {
    dismissedVersion = version;
    localStorage.setItem('updateDismissedVersion', version);
  };

  /**
   * 强制刷新页面（清除缓存）
   */
  const forceReload = () => {
    // 清除忽略的版本记录
    localStorage.removeItem('updateDismissedVersion');
    // 强制刷新（不使用缓存）
    window.location.reload(true);
  };

  /**
   * 启动定期检测
   */
  const start = () => {
    if (timerId) return; // 已经在运行

    // 立即执行一次检测
    checkVersion();

    // 设置定期检测（迁移到 RAF 统一调度器，融入主循环）
    _scheduleUpdateCheck();
  };

  /**
   * 停止定期检测
   */
  const stop = () => {
    if (timerId) {
      _cancelScheduledCheck();
    }
  };

  /**
   * 立即执行一次检测
   */
  const checkNow = () => checkVersion();

  /**
   * 检查是否正在运行
   */
  const isRunning = () => timerId !== null;

  /**
   * 获取检测状态
   */
  const getStatus = () => ({
    isRunning: timerId !== null,
    isChecking,
    currentVersion,
    lastDetectedVersion,
    dismissedVersion,
    checkIntervalMs,
  });

  return {
    start,
    stop,
    checkNow,
    isRunning,
    getStatus,
    forceReload,
    dismissUpdate,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createUpdateDetectionSystem };
}
