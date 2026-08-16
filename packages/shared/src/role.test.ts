import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasMinimumRole } from './role';

describe('hasMinimumRole', () => {
  it('allows an Agent when the minimum role is Agent', () => {
    assert.equal(hasMinimumRole('agent', 'agent'), true);
  });

  it('allows a Supervisor when the minimum role is Agent', () => {
    assert.equal(hasMinimumRole('supervisor', 'agent'), true);
  });

  it('allows an Administrator when the minimum role is Agent', () => {
    assert.equal(hasMinimumRole('admin', 'agent'), true);
  });

  it('rejects an Agent when the minimum role is Supervisor', () => {
    assert.equal(hasMinimumRole('agent', 'supervisor'), false);
  });

  it('allows a Supervisor when the minimum role is Supervisor', () => {
    assert.equal(hasMinimumRole('supervisor', 'supervisor'), true);
  });

  it('allows an Administrator when the minimum role is Supervisor', () => {
    assert.equal(hasMinimumRole('admin', 'supervisor'), true);
  });

  it('rejects an Agent when the minimum role is Administrator', () => {
    assert.equal(hasMinimumRole('agent', 'admin'), false);
  });

  it('rejects a Supervisor when the minimum role is Administrator', () => {
    assert.equal(hasMinimumRole('supervisor', 'admin'), false);
  });

  it('allows an Administrator when the minimum role is Administrator', () => {
    assert.equal(hasMinimumRole('admin', 'admin'), true);
  });
});
