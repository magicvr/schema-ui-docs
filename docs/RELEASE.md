---
status: stable
owner: 前后端架构组
last_updated: 2026-07-24
---

# 发布流程（协议制品与 MCP）

本文约定 Schema-UI 仓库的正式发布边界：**合并 `main` 只做 CI；正式资产只在人工打 tag 后由工作流发布；协议与 MCP 使用独立 tag，但 MCP 的 MAJOR.MINOR 与协议产品线对齐。**

> 说明：下文中的 `.github/workflows/*` 与 `docs/mcp/*` 路径属于仓库源码布局，**不**进入协议 tar 制品；协议制品内的相对链接校验因此不以 markdown 链接形式引用它们。

## 1. 总原则

| 事件 | 做什么 | 不做什么 |
|---|---|---|
| PR / merge 到 `main` | Protocol / MCP / Validator CI | 不建 GitHub Release、不推镜像、不自动打 tag |
| 人工 `git tag v*` 并 push | `protocol-release.yml` 发布协议制品 | 不发布 MCP 镜像 |
| 人工 `git tag mcp-v*` 并 push | `mcp-cd.yml` 推送 MCP 镜像到 **GHCR** | 不发布协议 tar |
| CI 自动打 tag | — | **禁止**（版本与 digests 须与 commit 原子对齐） |

## 2. 版本对齐（协议线 + MCP PATCH）

| 分量 | 协议 `schema-ui-protocol` | MCP `schema-ui-mcp` |
|---|---|---|
| **MAJOR.MINOR** | 页面/制品协议线（如 `2.4` / 制品 `2.4.0`） | **必须与当前捆绑协议线相同**（如 MCP `2.4.x`） |
| **PATCH** | 文档勘误等，不改机器契约时偶发 | **独立演进**（依赖、CVE、工具 bug、镜像修） |
| 捆绑声明 | 制品自身版本 | `mcp/package.json` → `schemaUiProtocol.artifactVersion` + 镜像 label |

规则摘要：

1. **MCP 的 MAJOR.MINOR === 捆绑协议的 `protocolVersion`（及制品 MAJOR.MINOR）。** 由 `npm run release:check:mcp` 强制。
2. **协议 MINOR/MAJOR 发布后，必须跟发至少一版 MCP**（通常 `X.Y.0` 或当前线上第一版），把 `schemaUiProtocol` 指到已发布协议制品并重建 GHCR 镜像；否则客户端仍可能拿到过时的内置协议。
3. **协议 PATCH**：可选重建 MCP；若重建，可只升 MCP PATCH 并更新捆绑声明。
4. **仅 MCP 程序变更**：只升 MCP PATCH（如 `2.4.0` → `2.4.1`），协议 tag 不动；捆绑协议版本可保持不变。
5. **禁止** MCP `2.4.x` 捆绑 `2.3.*` 或 `2.5.*` 等跨线协议。
6. **运行时不自动拉取**远程协议更新；镜像内置制品。需要更新则发新 MCP 镜像，或由运维设置 `SCHEMA_UI_PROTOCOL_ROOT` 指向自建制品。

示例：

```text
协议制品  2.4.0     MCP  2.4.0   # 首次跟上 2.4 线
协议制品  2.4.0     MCP  2.4.1   # 仅 MCP 程序修复
协议制品  2.5.0     MCP  2.5.0   # 协议新 MINOR → 新开 MCP 2.5 线
```

## 3. Tag 约定

| Tag 模式 | 版本来源 | 工作流文件 | 产物 |
|---|---|---|---|
| `v<artifactVersion>` 如 `v2.4.0` | 根 `package.json` / `protocol-manifest.json` | `.github/workflows/protocol-release.yml` | GitHub Release：`schema-ui-protocol-*.tar.gz` + `.sha256` |
| `mcp-v<mcpVersion>` 如 `mcp-v2.4.0` | `mcp/package.json` | `.github/workflows/mcp-cd.yml` | GHCR：`ghcr.io/<owner>/schema-ui-mcp` |

- 两套 tag **仍独立推送**（协议 tag 不触发 MCP CD，反之亦然）。
- 发 `mcp-v*` 前，`schemaUiProtocol.artifactVersion` 应指向 **GitHub Releases 中已存在**（或本 commit 可构建）的协议制品，且 MAJOR.MINOR 对齐。
- 预发布：协议可用 `v2.4.0-rc.1` 等（以 `release:check:tag` 规则为准）；MCP 预发布 tag 只推完整版本与 commit SHA 镜像，**不**更新 `latest` / minor 别名。

## 4. 协议发布清单（人工 + CI）

1. `main` 已绿；`CHANGELOG` 首节与版本一致。
2. 本地：`npm run release:check`、`npm run verify:protocol-artifact`、`npm run test:conformance:all`。
3. 在目标 commit 上：
   ```bash
   git tag v2.4.0
   git push origin v2.4.0
   ```
4. 等待 **Protocol Release** 工作流：校验 → 构建 → 创建/更新 GitHub Release 资产。
5. 消费者 pin：`v2.4.0` 或 tar 的 SHA-256。
6. **若本版本为协议 MINOR/MAJOR：** 在协议 Release 完成后，按第 5 节跟发 MCP（同一产品线 `X.Y.*`）。

## 5. MCP 发布清单（人工 + CI）

1. 确认捆绑协议版本已在 GitHub Releases 中存在（或源码可构建出该制品）。
2. `mcp/package.json`：
   - `version` 的 **MAJOR.MINOR** 与 `schemaUiProtocol.protocolVersion` 一致；
   - `schemaUiProtocol.artifactVersion` 指向目标协议制品；
   - lockfile 版本同步。
3. `npm run release:check:mcp` 通过（含线对齐门禁）。
4. 在目标 commit 上：
   ```bash
   git tag mcp-v2.4.0
   git push origin mcp-v2.4.0
   ```
5. 等待 **MCP Release** 工作流推送 GHCR 并远端 smoke；核对镜像 label  
   `io.schema-ui.protocol.artifact-version` 与声明一致。
6. **首次**发布后：在 GitHub → Packages → `schema-ui-mcp` → Package settings 将可见性设为 **Public**（否则匿名 `docker pull` 需要 token）。
7. 客户端 pin：**完整 MCP 版本** tag 或镜像 digest，并知悉捆绑协议版本；**不要**在生产配置中只写 `latest`。

### 5.1 GHCR 镜像与 tag

```text
ghcr.io/<github-owner-lowercase>/schema-ui-mcp:<mcp-version>   # 如 2.4.0
ghcr.io/<github-owner-lowercase>/schema-ui-mcp:<major.minor> # 稳定版更新，如 2.4（= 协议线）
ghcr.io/<github-owner-lowercase>/schema-ui-mcp:latest        # 仅稳定版更新
ghcr.io/<github-owner-lowercase>/schema-ui-mcp:<git-sha>     # 单次构建
```

拉取与运行示例见仓库源码 `docs/mcp/README.md`（不在协议 tar 内）。

## 6. 资产范围（摘要）

| 发布 | 资产 | 非资产 |
|---|---|---|
| 协议 `v*` | tar.gz、sha256、Release notes | MCP 镜像、业务页面 |
| MCP `mcp-v*` | GHCR 容器镜像（**内置**协议制品快照） | 协议 tar 的二次发布 |
| merge `main` | CI 日志 | 任何正式 Release 资产 |

协议制品内容由 [`protocol-manifest.json`](../protocol-manifest.json) 与章程权威层级定义；`mcp/`、`scripts/`、reference 实现不进入协议 tar。MCP 在 **构建镜像时** bake-in `dist/protocol`；运行时不远程刷新协议。

## 7. 相关工作流（源码树路径）

| 文件 | 触发 |
|---|---|
| `.github/workflows/protocol-ci.yml` | PR / push `main`（协议路径） |
| `.github/workflows/mcp-ci.yml` | PR / push `main`（MCP 路径） |
| `.github/workflows/validator-ci.yml` | 校验器相关变更 |
| `.github/workflows/protocol-release.yml` | tag `v*` |
| `.github/workflows/mcp-cd.yml` | tag `mcp-v*` |
