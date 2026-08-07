// WebSocket Bridge - Connects MCP Server to Browser Game
import { WebSocketServer } from 'ws';

const DEFAULT_PORT = 8765;

export class GameBridge {
  constructor(port = DEFAULT_PORT) {
    this.port = port;
    this.wss = null;
    this.browserWs = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('listening', () => {
        console.log(`GameBridge listening on ws://localhost:${this.port}`);
        resolve(this.port);
      });

      this.wss.on('connection', (ws) => {
        console.log('Browser connected');
        this.browserWs = ws;

        ws.on('message', (data) => {
          this.handleBrowserMessage(data.toString());
        });

        ws.on('close', () => {
          console.log('Browser disconnected');
          this.browserWs = null;
        });

        ws.on('error', (error) => {
          console.error('Browser WebSocket error:', error.message);
        });
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error.message);
        reject(error);
      });
    });
  }

  handleBrowserMessage(data) {
    try {
      const message = JSON.parse(data);

      // Handle responses to pending requests
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject } = this.pendingRequests.get(message.requestId);
        this.pendingRequests.delete(message.requestId);

        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      }
    } catch (error) {
      console.error('Error parsing browser message:', error.message);
    }
  }

  sendToBrowser(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.browserWs || this.browserWs.readyState !== 1) {
        reject(new Error('Browser not connected'));
        return;
      }

      const requestId = ++this.requestId;
      this.pendingRequests.set(requestId, { resolve, reject });

      const message = JSON.stringify({
        requestId,
        method,
        params,
      });

      this.browserWs.send(message);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  // High-level API for MCP tools
  async getState() {
    try {
      const result = await this.sendToBrowser('getState');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buyBuilding(buildingId, quantity = 1) {
    try {
      const result = await this.sendToBrowser('buyBuilding', { buildingId, quantity });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buyUpgrade(upgradeId) {
    try {
      const result = await this.sendToBrowser('buyUpgrade', { upgradeId });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buySkill(skillId) {
    try {
      const result = await this.sendToBrowser('buySkill', { skillId });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setAutoBuy(enabled) {
    try {
      const result = await this.sendToBrowser('setAutoBuy', { enabled });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  isConnected() {
    return this.browserWs !== null && this.browserWs.readyState === 1;
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.BRIDGE_PORT || DEFAULT_PORT);
  const bridge = new GameBridge(port);
  bridge.start().catch(console.error);

  process.on('SIGINT', () => {
    console.log('\nShutting down bridge...');
    bridge.stop();
    process.exit(0);
  });
}
