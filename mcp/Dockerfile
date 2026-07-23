FROM node:24-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY mcp/package.json mcp/package-lock.json ./mcp/
RUN npm ci --prefix mcp

COPY PROJECT_CHARTER.md protocol-manifest.json ./
COPY validator/package.json ./validator/package.json
COPY docs ./docs
COPY conformance ./conformance
COPY scripts ./scripts
COPY mcp/tsconfig.json ./mcp/tsconfig.json
COPY mcp/src ./mcp/src

RUN npm run build:protocol
RUN npm --prefix mcp run build
RUN npm prune --prefix mcp --omit=dev

FROM node:24-alpine3.24

WORKDIR /app
ENV NODE_ENV=production
ARG MCP_VERSION=unknown
ARG PROTOCOL_ARTIFACT_VERSION=unknown
ARG VALIDATOR_VERSION=unknown
LABEL org.opencontainers.image.title="Schema-UI MCP" \
      org.opencontainers.image.description="Schema-UI MCP stdio server (protocol reader and validator)" \
      org.opencontainers.image.version="${MCP_VERSION}" \
      io.schema-ui.protocol.artifact-version="${PROTOCOL_ARTIFACT_VERSION}" \
      io.schema-ui.validator.version="${VALIDATOR_VERSION}"

# Runtime only needs node; remove bundled npm/npx to avoid shipping npm dependency CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm \
	/usr/local/bin/npm \
	/usr/local/bin/npx \
	/usr/local/share/man/man1/npm* \
	/usr/local/share/man/man1/npx*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/protocol/docs ./docs
COPY --from=build /app/dist/protocol/manifest.json ./manifest.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/validator/package.json ./validator/package.json
COPY --from=build /app/mcp/package.json ./mcp/package.json
COPY --from=build /app/mcp/node_modules ./mcp/node_modules
COPY --from=build /app/mcp/dist ./mcp/dist

ENTRYPOINT ["node", "mcp/dist/server.js"]
