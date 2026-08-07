// 用 Node.js 启动浏览器并连接到游戏
import http from 'http';
import { spawn } from 'child_process';

const gameUrl = 'http://127.0.0.1:4173';

// 尝试多个浏览器
const browsers = [
  { cmd: 'msedge', args: [`--app=${gameUrl}`] },
  { cmd: 'chrome', args: [`--app=${gameUrl}`] },
  { cmd: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: [`--app=${gameUrl}`] },
  { cmd: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args: [`--app=${gameUrl}`] },
];

console.log('正在尝试打开浏览器...');

for (const browser of browsers) {
  try {
    const child = spawn(browser.cmd, browser.args, {
      detached: true,
      stdio: 'ignore',
      shell: true
    });
    child.unref();
    console.log(`✓ 已通过 ${browser.cmd} 打开游戏`);
    process.exit(0);
  } catch (e) {
    // 继续尝试下一个
  }
}

// 备选：使用 Windows shell 关联
spawn('cmd', ['/c', 'start', '""', gameUrl], {
  detached: true,
  stdio: 'ignore',
  shell: true
}).unref();

console.log('✓ 已通过默认浏览器打开游戏');
console.log('\n游戏URL:', gameUrl);
console.log('\n请在浏览器中确认游戏已加载, 然后我才能通过 MCP 控制它。');
