import dotenv from 'dotenv';

dotenv.config();

export const config = {
  canvas: {
    baseUrl: process.env.CANVAS_BASE_URL || 'https://canvas.iastate.edu',
    apiKey: process.env.CANVAS_API_KEY || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  server: {
    name: 'Canvas MCP Server',
    version: '1.0.0',
    port: parseInt(process.env.CANVAS_MCP_PORT || '3002', 10),
  }
};

export default config;

