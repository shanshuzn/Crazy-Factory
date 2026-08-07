const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url.split('?')[0];
  if (filePath === './') filePath = './index.html';
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    // Service Worker 必须使用强缓存（浏览器通过字节对比检测 SW 更新）
    // 其他资源保持 no-cache，避免开发期缓存陈旧
    const isSW = path.basename(filePath) === 'sw.js';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': isSW ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate',
      'Pragma': isSW ? '' : 'no-cache',
      'Expires': isSW ? '' : '0'
    });
    res.end(data);
  });
});
server.listen(8080, () => console.log('Server on http://localhost:8080 (PWA-enabled)'));
