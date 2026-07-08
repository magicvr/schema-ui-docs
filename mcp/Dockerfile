FROM node:24-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY mcp/package.json mcp/package-lock.json ./mcp/
RUN npm ci --prefix mcp

COPY docs ./docs
COPY scripts ./scripts
COPY mcp/tsconfig.json ./mcp/tsconfig.json
COPY mcp/src ./mcp/src

RUN npm --prefix mcp run build
RUN npm prune --prefix mcp --omit=dev

FROM node:24-alpine3.24

WORKDIR /app
ENV NODE_ENV=production

# Runtime only needs node; remove bundled npm/npx to avoid shipping npm dependency CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm \
	/usr/local/bin/npm \
	/usr/local/bin/npx \
	/usr/local/share/man/man1/npm* \
	/usr/local/share/man/man1/npx*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/docs ./docs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/mcp/package.json ./mcp/package.json
COPY --from=build /app/mcp/node_modules ./mcp/node_modules
COPY --from=build /app/mcp/dist ./mcp/dist

ENTRYPOINT ["node", "mcp/dist/server.js"]
