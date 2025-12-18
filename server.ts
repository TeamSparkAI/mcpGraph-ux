#!/usr/bin/env node

/**
 * Server entry point for mcpGraph UX
 * 
 * Usage:
 *   npm run server <port> <config-path>
 *   Example: npm run server 3000 ../mcpGraph/examples/count_files.yaml
 * 
 * Or set MCPGRAPH_CONFIG_PATH environment variable:
 *   MCPGRAPH_CONFIG_PATH=../mcpGraph/examples/count_files.yaml npm run server 3000
 * 
 * Or with tsx directly:
 *   tsx server.ts 3000 ../mcpGraph/examples/count_files.yaml
 * 
 * The config path can be provided either as:
 * - Command-line argument (3rd argument)
 * - MCPGRAPH_CONFIG_PATH environment variable (takes precedence)
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { resolve } from 'path';

const port = parseInt(process.argv[2] || '3000', 10);
const configPathArg = process.argv[3];

// Use env var if set, otherwise use command-line argument
let configPath: string;
if (process.env.MCPGRAPH_CONFIG_PATH) {
  configPath = resolve(process.cwd(), process.env.MCPGRAPH_CONFIG_PATH);
  console.log(`Using config path from MCPGRAPH_CONFIG_PATH env var: ${configPath}`);
} else if (configPathArg) {
  configPath = resolve(process.cwd(), configPathArg);
  // Store config path in environment variable for API routes
  process.env.MCPGRAPH_CONFIG_PATH = configPath;
} else {
  console.error('Usage: npm run server <port> <config-path>');
  console.error('Example: npm run server 3000 ../mcpGraph/examples/count_files.yaml');
  console.error('');
  console.error('Alternatively, set MCPGRAPH_CONFIG_PATH environment variable:');
  console.error('  MCPGRAPH_CONFIG_PATH=../mcpGraph/examples/count_files.yaml npm run server 3000');
  process.exit(1);
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err?: Error) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Config path: ${configPath}`);
  });
});

