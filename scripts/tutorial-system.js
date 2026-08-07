/**
 * 新手引导系统 (Tutorial System)
 * 
 * 功能：为新玩家提供逐步引导，介绍游戏核心机制
 * 机制：
 * 1. 首次进入游戏时自动启动（通过 localStorage 标记判断）
 * 2. 分步骤引导：点击 → 购买 → 升级 → 市场
 * 3. 高亮目标元素，显示提示信息
 * 4. 用户可随时跳过引导
 */

const createTutorialSystem = ({
  st,
  I18N,
  eventBus,
  onComplete = null,
  onSkip = null,
}) => {
  const TUTORIAL_KEY = 'tutorialCompleted';
  const isCompleted = () => localStorage.getItem(TUTORIAL_KEY) === 'true';
  const markCompleted = () => localStorage.setItem(TUTORIAL_KEY, 'true');
  const reset = () => localStorage.removeItem(TUTORIAL_KEY);

  // 引导步骤配置
  const steps = [
    {
      id: 'welcome',
      title: { zh: '欢迎来到金融帝国', en: 'Welcome to Financial Empire' },
      content: {
        zh: '这是一个放置类游戏，通过经营产业和把握市场波动来积累财富。让我们快速了解一下核心玩法！',
        en: 'This is an idle game. Build wealth by managing industries and capturing market fluctuations. Let\'s learn the basics!'
      },
      target: null,
      action: { zh: '开始引导', en: 'Start Tutorial' },
    },
    {
      id: 'manualClick',
      title: { zh: '第一步：手动生产', en: 'Step 1: Manual Production' },
      content: {
        zh: '点击这里的按钮开始手动生产资本。每次点击都会直接增加你的资本！连续点击还有连击加成哦。',
        en: 'Click this button to manually produce capital. Each click adds capital directly! Chain clicks for combo bonuses.'
      },
      target: '#manualBtn',
      targetEvent: 'click',
      action: { zh: '点击按钮', en: 'Click Button' },
    },
    {
      id: 'buyBuilding',
      title: { zh: '第二步：购买产业', en: 'Step 2: Buy Buildings' },
      content: {
        zh: '积累足够资本后，购买产业来自动产生收益。产业是被动收入的主要来源！你可以使用 ×1/×10/×100/Max 来批量购买。',
        en: 'After accumulating enough capital, buy buildings to generate passive income. Use ×1/×10/×100/Max to bulk buy!'
      },
      target: '#buildingList .buy-btn',
      targetEvent: 'click',
      action: { zh: '购买产业', en: 'Buy Building' },
    },
    {
      id: 'upgrades',
      title: { zh: '第三步：研发升级', en: 'Step 3: Research Upgrades' },
      content: {
        zh: '升级可以大幅提升生产效率。用齿轮购买升级项目，每个升级都有独特的加成效果！',
        en: 'Upgrades boost production efficiency. Purchase upgrade projects with Gears for unique bonuses!'
      },
      target: null,
      action: { zh: '查看升级', en: 'View Upgrades' },
    },
    {
      id: 'market',
      title: { zh: '第四步：把握市场', en: 'Step 4: Market Timing' },
      content: {
        zh: '市场会在牛市和熊市之间周期切换。牛市时收益增加，熊市时减少。把握切换时机很重要！',
        en: 'The market cycles between bull and bear. Profits increase in bull markets, decrease in bear. Timing matters!'
      },
      target: '.market-bar',
      targetEvent: null,
      action: { zh: '下一步', en: 'Next' },
    },
    {
      id: 'skills',
      title: { zh: '第五步：技能树', en: 'Step 5: Skill Tree' },
      content: {
        zh: '研究点（RP）通过声望重置获得，可以学习永久技能。技能分为：交易直觉、产线优化、采购折扣、市场嗅觉。',
        en: 'Research Points (RP) from Prestige unlock permanent skills: trading, production, discount, and market sense.'
      },
      target: null,
      action: { zh: '了解技能', en: 'Learn Skills' },
    },
    {
      id: 'synergy',
      title: { zh: '第六步：产业链联动', en: 'Step 6: Industry Synergy' },
      content: {
        zh: '建筑之间有上下游联动关系！手工作坊为轻工厂提供原材料，物流公司为房地产运输建材。均衡发展产业链可以获得额外加成。',
        en: 'Buildings have upstream/downstream synergy! Workshop feeds Factory, Logistics supports Real Estate. Balance your chain for bonuses.'
      },
      target: null,
      action: { zh: '下一步', en: 'Next' },
    },
    {
      id: 'autoBuy',
      title: { zh: '第七步：自动投资', en: 'Step 7: Auto Investment' },
      content: {
        zh: '当积累一定资本后，可以开启自动投资。系统会根据当前状态智能分配资金到最优建筑，让你解放双手！',
        en: 'Once you have enough capital, enable Auto Investment. The system intelligently allocates funds to optimal buildings!'
      },
      target: '#autoBuyBtn',
      targetEvent: 'click',
      action: { zh: '了解自动投资', en: 'Enable Auto' },
    },
    {
      id: 'prestige',
      title: { zh: '第八步：声望重置', en: 'Step 8: Prestige' },
      content: {
        zh: '当进度放缓时，可以进行声望重置。重置会清空建筑和资本，但获得研究点（RP）用于解锁强力天赋和技能。这是长期增长的关键！',
        en: 'When progress slows, Prestige resets buildings but grants RP for powerful perks and skills. Key to long-term growth!'
      },
      target: '#prestigeBtn',
      targetEvent: null,
      action: { zh: '了解声望', en: 'Learn Prestige' },
    },
    {
      id: 'complete',
      title: { zh: '引导完成！', en: 'Tutorial Complete!' },
      content: {
        zh: '你已经了解了游戏的核心玩法。继续积累资本、扩张产业、把握市场时机，建立你的金融帝国吧！提示：右下角的MCP状态可以让AI Agent帮你操控游戏。',
        en: 'You now know the basics! Keep growing your empire. Tip: The MCP status indicator enables AI agent control.'
      },
      target: null,
      action: { zh: '开始游戏', en: 'Start Playing' },
    },
  ];

  let currentStep = 0;
  let isActive = false;
  let overlayEl = null;
  let tooltipEl = null;

  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // 创建遮罩层
  const createOverlay = () => {
    overlayEl = document.createElement('div');
    overlayEl.className = 'tutorial-overlay';
    overlayEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 9998;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(overlayEl);
  };

  // 创建提示框
  const createTooltip = () => {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tutorial-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      max-width: 320px;
      z-index: 10000;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      font-family: system-ui, -apple-system, sans-serif;
      animation: tooltipFadeIn 0.3s ease-out;
    `;

    // 添加动画样式
    if (!document.getElementById('tutorialStyles')) {
      const style = document.createElement('style');
      style.id = 'tutorialStyles';
      style.textContent = `
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tutorial-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px #3b82f6, 0 0 20px rgba(59,130,246,0.5) !important;
          border-radius: 4px;
          transition: box-shadow 0.3s;
        }
        .tutorial-pulse {
          animation: tutorialPulse 2s infinite;
        }
        @keyframes tutorialPulse {
          0%, 100% { box-shadow: 0 0 0 4px #3b82f6, 0 0 20px rgba(59,130,246,0.5); }
          50% { box-shadow: 0 0 0 8px #3b82f6, 0 0 30px rgba(59,130,246,0.7); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(tooltipEl);
  };

  // 高亮目标元素
  const highlightTarget = (selector) => {
    // 清除之前的高亮
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight', 'tutorial-pulse');
    });

    if (!selector) return null;

    const target = document.querySelector(selector);
    if (target) {
      target.classList.add('tutorial-highlight', 'tutorial-pulse');
      return target;
    }
    return null;
  };

  // 定位提示框
  const positionTooltip = (target) => {
    if (!target) {
      // 居中显示
      tooltipEl.style.left = '50%';
      tooltipEl.style.top = '50%';
      tooltipEl.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const margin = 20;

    // 默认显示在目标下方
    let top = rect.bottom + margin;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // 边界检查
    if (top + tooltipRect.height > window.innerHeight) {
      top = rect.top - tooltipRect.height - margin;
    }
    if (left < margin) left = margin;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tooltipRect.width - margin;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.transform = 'none';
  };

  // 渲染当前步骤
  const renderStep = () => {
    const step = steps[currentStep];
    const lang = getLang();

    const title = step.title[lang] || step.title.zh;
    const content = step.content[lang] || step.content.zh;
    const action = step.action[lang] || step.action.zh;

    tooltipEl.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 14px; opacity: 0.8;">
        ${currentStep + 1} / ${steps.length}
      </div>
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${title}</h3>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; opacity: 0.95;">${content}</p>
      <div style="display: flex; gap: 10px; justify-content: space-between;">
        ${currentStep > 0 ? `<button id="tutorialPrev" style="padding: 8px 16px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: white; border-radius: 6px; cursor: pointer; font-size: 13px;">←</button>` : '<span></span>'}
        <div style="display: flex; gap: 10px;">
          <button id="tutorialSkip" style="padding: 8px 16px; border: none; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; cursor: pointer; font-size: 13px;">
            ${lang === 'en' ? 'Skip' : '跳过'}
          </button>
          <button id="tutorialNext" style="padding: 8px 16px; border: none; background: white; color: #1e3a8a; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">
            ${action}
          </button>
        </div>
      </div>
    `;

    // 高亮目标
    const target = highlightTarget(step.target);
    positionTooltip(target);

    // 绑定事件
    const nextBtn = tooltipEl.querySelector('#tutorialNext');
    const skipBtn = tooltipEl.querySelector('#tutorialSkip');
    const prevBtn = tooltipEl.querySelector('#tutorialPrev');

    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (skipBtn) skipBtn.addEventListener('click', skip);
    if (prevBtn) prevBtn.addEventListener('click', prevStep);

    // 如果有目标事件，监听它
    if (step.target && step.targetEvent) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        const eventHandler = () => {
          setTimeout(nextStep, 300);
          targetEl.removeEventListener(step.targetEvent, eventHandler);
        };
        targetEl.addEventListener(step.targetEvent, eventHandler);
      }
    }
  };

  // 下一步
  const nextStep = () => {
    currentStep++;
    if (currentStep >= steps.length) {
      complete();
    } else {
      renderStep();
    }
  };

  // 上一步
  const prevStep = () => {
    if (currentStep > 0) {
      currentStep--;
      renderStep();
    }
  };

  // 跳过引导
  const skip = () => {
    destroy();
    if (onSkip) onSkip();
  };

  // 完成引导
  const complete = () => {
    markCompleted();
    destroy();
    if (eventBus) {
      eventBus.emit('tutorial:completed');
    }
    if (onComplete) onComplete();
  };

  // 销毁
  const destroy = () => {
    // 清除高亮
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight', 'tutorial-pulse');
    });

    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    isActive = false;
  };

  // 启动引导
  const start = () => {
    if (isActive || isCompleted()) return;

    isActive = true;
    currentStep = 0;
    createOverlay();
    createTooltip();
    renderStep();
  };

  // 强制启动（用于调试）
  const forceStart = () => {
    reset();
    start();
  };

  return {
    start,
    forceStart,
    skip,
    complete,
    reset,
    isCompleted,
    isActive: () => isActive,
  };
};

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createTutorialSystem };
}
