## Change class

- [ ] Protocol semantics
- [ ] Machine contract (Schema / component DSL)
- [ ] Behavioral contract (conformance fixture)
- [ ] Informative docs / migration
- [ ] Auxiliary validator / reference
- [ ] MCP / Docker / CI
- [ ] Audit-only process record

## Authority and version

- Normative clause or ADR:
- Protocol SemVer impact: none / PATCH / MINOR / MAJOR
- Protocol artifact version:
- MCP or validator version impact:

## Consumer impact

- Frontend Renderer impact:
- Backend producer impact:
- Frontend consumer evidence:
- Backend consumer evidence:

## Boundary checks

- [ ] No validator/reference/MCP rule exists without a normative clause or conformance case.
- [ ] Tool-only changes leave the protocol `contentDigest` unchanged.
- [ ] Protocol changes update Schema, fixtures, migration and CHANGELOG where applicable.
- [ ] `docs/audit/**`, `docs/mcp/**`, `scripts/**` and `mcp/**` remain outside the protocol artifact.
- [ ] Protocol and MCP release tags remain independent (`v*` vs `mcp-v*`).
- [ ] Merge to main does not publish release assets (assets only after manual tags).

## Verification

List the commands and external consumer runs completed for this change.
