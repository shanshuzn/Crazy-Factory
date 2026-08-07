const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('正在加载游戏...');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);
  
  // 获取当前状态
  const title = await page.title();
  console.log(`页面标题: ${title}`);
  
  // 检查游戏元素
  const gearsText = await page.locator('#gears').textContent();
  console.log(`初始资本: ${gearsText}`);
  
  const gpsText = await page.locator('#gps').textContent();
  console.log(`收益率: ${gpsText}`);
  
  // 点击"撮合交易"按钮
  console.log('\n--- 开始点击撮合交易 ---');
  for (let i = 0; i < 10; i++) {
    await page.click('#manualBtn');
    await page.waitForTimeout(100);
  }
  
  await page.waitForTimeout(500);
  const gearsAfterClick = await page.locator('#gears').textContent();
  console.log(`点击10次后资本: ${gearsAfterClick}`);
  
  // 查看可购买的建筑
  console.log('\n--- 检查产业链 ---');
  const buildings = await page.locator('.buildings').first().locator('.card').all();
  console.log(`可购买建筑数: ${buildings.length}`);
  
  // 尝试购买第一个建筑
  if (buildings.length > 0) {
    const firstBuilding = buildings[0];
    const name = await firstBuilding.locator('.name').textContent();
    const price = await firstBuilding.locator('.price').textContent();
    console.log(`尝试购买: ${name} (${price})`);
    
    const buyBtn = firstBuilding.locator('button:has-text("购买")');
    if (await buyBtn.count() > 0) {
      await buyBtn.click();
      await page.waitForTimeout(500);
      const gearsAfterBuy = await page.locator('#gears').textContent();
      console.log(`购买后资本: ${gearsAfterBuy}`);
    }
  }
  
  // 等待几秒看自动收益
  console.log('\n--- 等待自动收益 (3秒) ---');
  await page.waitForTimeout(3000);
  const gearsFinal = await page.locator('#gears').textContent();
  const gpsFinal = await page.locator('#gps').textContent();
  console.log(`3秒后资本: ${gearsFinal}`);
  console.log(`当前收益率: ${gpsFinal}`);
  
  // 截图
  await page.screenshot({ path: 'D:/OpenClaw/Crazy-Factory/game-screenshot.png', fullPage: false });
  console.log('\n截图已保存: game-screenshot.png');
  
  await browser.close();
  console.log('\n游戏体验完成!');
})().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
