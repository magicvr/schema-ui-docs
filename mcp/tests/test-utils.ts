import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL_ROOT } from '../src/core/paths.js';

export function extractFirstYamlFence(relativePath: string): string {
  const markdown = fs.readFileSync(path.join(PROTOCOL_ROOT, relativePath), 'utf8');
  const match = markdown.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error(`No yaml fence found in ${relativePath}`);
  return match[1];
}

export const missingRowScopeYaml = `
meta:
  pageId: bad_row_scope
  title: Bad Row Scope
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
        visibleWhen:
          when: "$row.id == '1'"
  data:
    source: api
    url: /api/items
`;

export const missingUploadCapabilityYaml = `
meta:
  pageId: upload_page
  title: Upload Page
  protocolVersion: "0.2"
body:
  type: upload
  props:
    label: Attachment
    actionRef: uploadAttachment
actions:
  uploadAttachment:
    type: upload
    method: POST
    url: /api/upload
`;

export const missingRowRequestCapabilityYaml = `
meta:
  pageId: row_request_page
  title: Row Request Page
  protocolVersion: "0.2"
actions:
  approveOrder:
    type: request
    method: POST
    url: /api/orders/{orderId}/approve
body:
  type: table
  props:
    rowKey: orderId
    pagination:
      mode: server
    columns:
      - field: orderId
        label: Order ID
    actions:
      - key: approve
        label: Approve
        actionRef: approveOrder
        requestMapping:
          path:
            orderId: $row.orderId
  data:
    source: api
    url: /api/orders
`;

export const tableVisibleWhenMissingWhenYaml = `
meta:
  pageId: table_visiblewhen_missing_when
  title: Table VisibleWhen Missing When
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
        visibleWhen:
          scope: row
          dependencies: [id]
  data:
    source: api
    url: /api/items
`;

export const tableRowReactionForbiddenStateYaml = `
meta:
  pageId: table_row_reaction_forbidden_state
  title: Table Row Reaction Forbidden State
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
        reactions:
          - scope: row
            dependencies: [id]
            when: "$row.id == '1'"
            fulfill:
              required: true
  data:
    source: api
    url: /api/items
`;

export const tableRefResponseMappingMissingListYaml = `
meta:
  pageId: table_ref_response_mapping_missing_list
  title: Table Ref ResponseMapping Missing List
  protocolVersion: "0.2"
datasources:
  orders:
    source: api
    url: /api/orders
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
  data:
    source: ref
    ref: orders
    responseMapping:
      total: result.total
`;

export const tableActionPermissionSelfYaml = `
meta:
  pageId: table_action_permission_self
  title: Table Action Permission Self
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: none
    columns:
      - field: id
        label: ID
    actions:
      - key: approve
        label: Approve
        permissions:
          view: "$self == true"
  data:
    source: static
    value: []
`;

export const nodePermissionSelfYaml = `
meta:
  pageId: node_permission_self
  title: Node Permission Self
  protocolVersion: "0.2"
body:
  type: input
  props:
    field: title
    label: Title
  permissions:
    view: "$self == true"
`;

export const unknownContextNamespaceYaml = `
meta:
  pageId: unknown_context_namespace
  title: Unknown Context Namespace
  protocolVersion: "0.2"
body:
  type: input
  props:
    field: title
    label: Title
  permissions:
    view: "$context.tenant.id == 't1'"
`;

export const missingSubmitActionTargetYaml = `
meta:
  pageId: missing_submit_action
  title: Missing SubmitAction Target
  protocolVersion: "0.2"
actions:
  someAction:
    type: request
    method: POST
    url: /api/submit
body:
  type: form
  props:
    title: Missing Target
    submitAction: nonExistentAction
  children:
    - type: input
      props:
        field: name
        label: Name
`;

export const uploadActionRefWrongTypeYaml = `
meta:
  pageId: upload_wrong_type
  title: Upload Wrong ActionRef Type
  protocolVersion: "0.2"
  requiredCapabilities:
    - actions.upload
actions:
  myUpload:
    type: request
    method: POST
    url: /api/upload
body:
  type: upload
  props:
    label: Attachment
    actionRef: myUpload
`;

export const danglingDataRefYaml = `
meta:
  pageId: dangling_data_ref
  title: Dangling Data Ref
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: none
    columns:
      - field: id
        label: ID
  data:
    source: ref
    ref: nonExistentDatasource
`;

export const invalidTargetTableYaml = `
meta:
  pageId: invalid_target_table
  title: Invalid TargetTable
  protocolVersion: "0.2"
body:
  type: form
  props:
    title: Search Form
    mode: search
    targetTable: missingTableId
  children:
    - type: input
      props:
        field: keyword
        label: Keyword
`;

export const validAllReferencesYaml = `
meta:
  pageId: valid_all_refs
  title: Valid All References
  protocolVersion: "0.2"
  requiredCapabilities:
    - actions.upload
datasources:
  orders:
    source: api
    url: /api/orders
actions:
  submitOrder:
    type: request
    method: POST
    url: /api/orders
  uploadAttach:
    type: upload
    method: POST
    url: /api/upload
body:
  type: grid
  props:
    columns: 2
  children:
    - type: form
      id: searchForm
      props:
        title: Search
        mode: search
        targetTable: orderTable
      children:
        - type: input
          props:
            field: keyword
            label: Keyword
    - type: table
      id: orderTable
      props:
        rowKey: id
        pagination:
          mode: server
        columns:
          - field: id
            label: ID
      data:
        source: ref
        ref: orders
`;

export const tableRefResponseMappingInheritedMissingListYaml = `
meta:
  pageId: table_ref_inherited_missing_list
  title: Table Ref Inherited Missing List
  protocolVersion: "0.2"
datasources:
  orders:
    source: api
    url: /api/orders
    responseMapping:
      total: result.total
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
  data:
    source: ref
    ref: orders
`;

export const chartRefResponseMappingInheritedMissingListYaml = `
meta:
  pageId: chart_ref_inherited_missing_list
  title: Chart Ref Inherited Missing List
  protocolVersion: "0.2"
datasources:
  sales:
    source: api
    url: /api/sales
    responseMapping:
      total: result.total
body:
  type: chart
  props:
    chartType: bar
    xField: date
    yField: amount
  data:
    source: ref
    ref: sales
`;

export const tableRefResponseMappingInheritedCompleteYaml = `
meta:
  pageId: table_ref_inherited_complete
  title: Table Ref Inherited Complete
  protocolVersion: "0.2"
datasources:
  orders:
    source: api
    url: /api/orders
    responseMapping:
      list: result.records
      total: result.total
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
  data:
    source: ref
    ref: orders
`;

export const chartRefResponseMappingLocalOverrideOkYaml = `
meta:
  pageId: chart_ref_local_override_ok
  title: Chart Ref Local Override OK
  protocolVersion: "0.2"
datasources:
  sales:
    source: api
    url: /api/sales
    responseMapping:
      total: result.total
body:
  type: chart
  props:
    chartType: bar
    xField: date
    yField: amount
  data:
    source: ref
    ref: sales
    responseMapping:
      list: result.items
`;

