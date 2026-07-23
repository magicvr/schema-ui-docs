import { describe, expect, it } from 'vitest';
import { getComponent, listComponents } from '../src/core/component-registry.js';

describe('component registry tools', () => {
  it('lists expected component types with categories', () => {
    const components = listComponents().components;
    expect(components.map(component => component.type)).toEqual(expect.arrayContaining(['table', 'form', 'upload']));
    expect(components.find(component => component.type === 'table')).toMatchObject({
      category: '数据',
      supportsData: true,
      supportsStates: true,
    });
  });

  it('returns table contract without dropping raw DSL constraints', () => {
    const table = getComponent('table');
    expect(table.requiredProps).toEqual(expect.arrayContaining(['rowKey', 'pagination', 'columns']));
    expect(table.optionalProps).toEqual(expect.arrayContaining(['title', 'actions', 'span']));
    expect(table.props).toHaveProperty('columns');
    expect((table.props as Record<string, unknown>).columns).toHaveProperty('items');
  });

  it('exposes recordView recordSource/fields as required props (0067/V302)', () => {
    const recordView = getComponent('recordView');
    expect(recordView).toMatchObject({
      category: '数据',
      supportsData: false,
      supportsStates: true,
    });
    expect(recordView.requiredProps).toEqual(expect.arrayContaining(['recordSource', 'fields']));
    expect(recordView.optionalProps).toEqual(expect.arrayContaining(['title', 'span']));
    // 字段级 required 必须是布尔 true，不得被嵌套 required 数组覆盖
    expect((recordView.props as Record<string, { required?: unknown }>).recordSource.required).toBe(true);
  });
});
