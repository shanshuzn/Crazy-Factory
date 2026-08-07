// Test WebSocket connection
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('✓ WebSocket connected to port 8765');
  ws.send(JSON.stringify({
    requestId: 1,
    method: 'getState',
    params: {}
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString().slice(0, 200));
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('✗ WebSocket error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);
