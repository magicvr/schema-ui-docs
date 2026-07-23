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

/** 表格列 scope:form 下仍禁止 required/value（0044/V167） */
export const tableFormScopeReactionForbiddenStateYaml = `
meta:
  pageId: table_form_scope_reaction_forbidden_state
  title: Table Form Scope Reaction Forbidden State
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
          - dependencies: []
            when: "\$context.features.highlight == true"
            fulfill:
              value: null
              required: true
    actions:
      - key: edit
        label: 编辑
        reactions:
          - dependencies: []
            when: "\$context.user.roles contains 'admin'"
            fulfill:
              value: null
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

/** 表单内 visibleWhen 误用 $self（0045/V175） */
export const formVisibleWhenSelfYaml = `
meta:
  pageId: form_visiblewhen_self
  title: Form VisibleWhen Self
  protocolVersion: "0.2"
body:
  type: form
  props:
    submitAction: save
  children:
    - type: input
      props:
        field: name
        label: Name
      visibleWhen:
        dependencies: []
        when: "$self == true"
actions:
  save:
    type: request
    method: POST
    url: /api/save
`;

/** 表格 actions scope:form 误用 $self（0045/V176） */
export const tableActionFormScopeSelfYaml = `
meta:
  pageId: table_action_form_self
  title: Table Action Form Scope Self
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
    actions:
      - key: approve
        label: Approve
        visibleWhen:
          scope: form
          dependencies: []
          when: "$self == true"
  data:
    source: api
    url: /api/items
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
          pageSize: 20
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
      pageSize: 20
    columns:
      - field: id
        label: ID
  data:
    source: ref
    ref: orders
`;

export const nodeParamsResponseMappingYaml = `
meta:
  pageId: node_params_response_mapping
  title: Node Params ResponseMapping
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
  data:
    source: api
    url: /api/orders
    params:
      status: pending
      responseMapping:
        list: result.records
    responseMapping:
      list: result.records
`;

export const datasourceParamsResponseMappingYaml = `
meta:
  pageId: ds_params_response_mapping
  title: Datasource Params ResponseMapping
  protocolVersion: "0.2"
datasources:
  orders:
    source: api
    url: /api/orders
    params:
      status: pending
      responseMapping:
        list: result.records
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

export const nodeParamsResponseMappingOnlyYaml = `
meta:
  pageId: node_params_rm_only
  title: Node Params RM Only
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
    source: api
    url: /api/items
    params:
      responseMapping:
        list: result.records
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

/** 审计 0067 V303：2.3 + recordView → PROTOCOL_VERSION_TOO_LOW */
export const recordViewOn23Yaml = `
meta:
  pageId: audit_0067_recordview_on_23
  title: bad recordView on 2.3
  protocolVersion: "2.3"
  requiredCapabilities:
    - record.view.load
body:
  type: recordView
  props:
    title: 订单详情
    recordSource:
      method: GET
      url: /api/orders/{orderId}
      path:
        orderId: $context.route.query.orderId
      responseMapping:
        orderId: orderId
        status: status
    fields:
      - key: orderId
        label: 单号
      - key: status
        label: 状态
`;

/** 审计 0067 V303：2.4 + recordView 缺 record.view.load */
export const recordViewMissingCapabilityYaml = `
meta:
  pageId: audit_0067_recordview_missing_cap
  title: bad recordView without capability
  protocolVersion: "2.4"
body:
  type: recordView
  props:
    title: 订单详情
    recordSource:
      method: GET
      url: /api/orders/{orderId}
      path:
        orderId: $context.route.query.orderId
      responseMapping:
        orderId: orderId
        status: status
    fields:
      - key: orderId
        label: 单号
      - key: status
        label: 状态
`;

/** 审计 0067 V306：fields[].key 不在 responseMapping */
export const recordViewKeyNotInMappingYaml = `
meta:
  pageId: audit_0067_recordview_key_not_in_mapping
  title: bad field key outside mapping
  protocolVersion: "2.4"
  requiredCapabilities:
    - record.view.load
body:
  type: recordView
  props:
    title: 订单详情
    recordSource:
      method: GET
      url: /api/orders/{orderId}
      path:
        orderId: $context.route.query.orderId
      responseMapping:
        orderId: orderId
    fields:
      - key: orderId
        label: 单号
      - key: missingFromMapping
        label: 不存在于 mapping
`;

/** 审计 0067 V302：缺 recordSource 仍 fail-closed */
export const recordViewMissingRecordSourceYaml = `
meta:
  pageId: audit_0067_recordview_missing_record_source
  title: bad recordView without recordSource
  protocolVersion: "2.4"
  requiredCapabilities:
    - record.view.load
body:
  type: recordView
  props:
    title: 订单详情
    fields:
      - key: orderId
        label: 单号
`;

