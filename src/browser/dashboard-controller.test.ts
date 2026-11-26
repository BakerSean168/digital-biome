import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardNeighbor, matchesDashboardQuery } from './dashboard-controller';

test('Dashboard search is case-insensitive, Unicode-normalized and matches every term', () => {
  const text = '常用 公益AI 中转站 Example.com 模型';
  assert.equal(matchesDashboardQuery(text, '公益 ｅｘａｍｐｌｅ'), true);
  assert.equal(matchesDashboardQuery(text, '中转 模型'), true);
  assert.equal(matchesDashboardQuery(text, 'example missing'), false);
  assert.equal(matchesDashboardQuery(text, '   '), true);
});

test('Dashboard movement follows link order horizontally and the nearest rendered row vertically', () => {
  const bounds = [
    { top: 0, left: 0, width: 100 },
    { top: 0, left: 120, width: 100 },
    { top: 0, left: 240, width: 100 },
    { top: 50, left: 0, width: 100 },
    { top: 50, left: 120, width: 100 },
    { top: 160, left: 0, width: 100 },
  ];
  assert.equal(dashboardNeighbor(bounds, -1, 'down'), 0);
  assert.equal(dashboardNeighbor(bounds, 1, 'down'), 4);
  assert.equal(dashboardNeighbor(bounds, 2, 'down'), 4);
  assert.equal(dashboardNeighbor(bounds, 4, 'up'), 1);
  assert.equal(dashboardNeighbor(bounds, 4, 'down'), 5);
  assert.equal(dashboardNeighbor(bounds, 2, 'right'), 3);
  assert.equal(dashboardNeighbor(bounds, 3, 'left'), 2);
  assert.equal(dashboardNeighbor(bounds, 0, 'up'), undefined);
  assert.equal(dashboardNeighbor(bounds, 5, 'down'), undefined);
  assert.equal(dashboardNeighbor([], -1, 'right'), undefined);
});
