# Runs the Init MCP server over stdio (used by Glama, Smithery and Docker MCP catalogs).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --omit=dev && npm run build
ENV NODE_ENV=production
ENTRYPOINT ["node", "packages/mcp/bin/init-mcp.js"]
