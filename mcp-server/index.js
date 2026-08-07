// MCP Server for Crazy Factory
// Enables AI agents to control the game via Claude Code MCP protocol

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { GameBridge } from './bridge.js';
import { getGameState, getGameStateSchema } from './tools/game-state.js';
import {
  buyBuilding,
  buyUpgrade,
  buySkill,
  setAutoBuy,
  buyBuildingSchema,
  buyUpgradeSchema,
  buySkillSchema,
  setAutoBuySchema,
} from './tools/game-actions.js';
import { getRecommendations, getRecommendationsSchema } from './tools/recommendations.js';

// Configuration
const BRIDGE_PORT = parseInt(process.env.MCP_BRIDGE_PORT || process.env.BRIDGE_PORT || '8765');

class CrazyFactoryMCPServer {
  constructor() {
    this.bridge = new GameBridge(BRIDGE_PORT);
    this.server = null;
  }

  async start() {
    // Connect to game bridge
    console.error(`Connecting to game bridge on port ${BRIDGE_PORT}...`);
    await this.bridge.start();

    // Check connection
    const state = await this.bridge.getState();
    if (!state.success) {
      console.error(`Warning: Game not connected. ${state.error}`);
      console.error('Start the game in a browser first, then restart this server.');
    } else {
      console.error('Game connected successfully!');
    }

    // Create MCP server
    this.server = new Server(
      {
        name: 'crazy-factory',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Register tools
    this.registerTools();

    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server running');
  }

  registerTools() {
    // Get Game State
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [
          {
            name: 'get_game_state',
            description: '获取游戏当前状态，包括资本、建筑、升级、技能和市场信息',
            inputSchema: {
              type: 'object',
              properties: {
                includeBuildings: {
                  type: 'boolean',
                  description: '包含建筑信息 (默认: true)',
                },
                includeUpgrades: {
                  type: 'boolean',
                  description: '包含升级信息 (默认: true)',
                },
                includeSkills: {
                  type: 'boolean',
                  description: '包含技能信息 (默认: true)',
                },
                includeMarket: {
                  type: 'boolean',
                  description: '包含市场信息 (默认: true)',
                },
              },
            },
          },
          {
            name: 'buy_building',
            description: '购买建筑，增加被动收入',
            inputSchema: {
              type: 'object',
              properties: {
                buildingId: {
                  type: 'string',
                  description: '建筑ID，如 "intern", "factory_1", "logistics_1" 等',
                },
                quantity: {
                  type: 'number',
                  description: '购买数量 (默认: 1)',
                },
              },
              required: ['buildingId'],
            },
          },
          {
            name: 'buy_upgrade',
            description: '研发升级，提升手动产出或总GPS',
            inputSchema: {
              type: 'object',
              properties: {
                upgradeId: {
                  type: 'string',
                  description: '升级ID',
                },
              },
              required: ['upgradeId'],
            },
          },
          {
            name: 'buy_skill',
            description: '学习技能，消耗RP获得永久效率提升',
            inputSchema: {
              type: 'object',
              properties: {
                skillId: {
                  type: 'string',
                  description: '技能ID',
                },
              },
              required: ['skillId'],
            },
          },
          {
            name: 'get_recommendations',
            description: '获取基于当前状态的策略建议和行动规划',
            inputSchema: {
              type: 'object',
              properties: {
                focus: {
                  type: 'string',
                  enum: ['maximize_gears', 'balance', 'speed_run', 'prestige'],
                  description: '策略模式: maximize_gears(最大化资本), balance(平衡), speed_run(速通), prestige(声望优先)',
                },
              },
            },
          },
          {
            name: 'set_auto_buy',
            description: '开启或关闭自动投资',
            inputSchema: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  description: 'true=启用自动投资, false=禁用',
                },
              },
              required: ['enabled'],
            },
          },
        ],
      })
    );

    // Handle tool calls
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;

        try {
          switch (name) {
            case 'get_game_state':
              return await getGameState(this.bridge, args);

            case 'buy_building':
              return await buyBuilding(this.bridge, args);

            case 'buy_upgrade':
              return await buyUpgrade(this.bridge, args);

            case 'buy_skill':
              return await buySkill(this.bridge, args);

            case 'get_recommendations':
              return await getRecommendations(this.bridge, args);

            case 'set_auto_buy':
              return await setAutoBuy(this.bridge, args);

            default:
              return {
                content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                isError: true,
              };
          }
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      }
    );
  }
}

// Start server
const mcpServer = new CrazyFactoryMCPServer();
mcpServer.start().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
