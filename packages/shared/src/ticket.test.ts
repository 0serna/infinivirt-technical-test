import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLegalStatusEdge,
  mayRecordReassignment,
  mayRecordStatusTransition,
  NEXT_TICKET_STATUS,
  nextRecordableStatus,
} from './ticket';

describe('NEXT_TICKET_STATUS', () => {
  it('maps every Status to the next legal hop including reopen', () => {
    assert.equal(NEXT_TICKET_STATUS.open, 'in_progress');
    assert.equal(NEXT_TICKET_STATUS.in_progress, 'resolved');
    assert.equal(NEXT_TICKET_STATUS.resolved, 'closed');
    assert.equal(NEXT_TICKET_STATUS.closed, 'open');
  });
});

describe('isLegalStatusEdge', () => {
  it('allows only the next hop', () => {
    assert.equal(isLegalStatusEdge('open', 'in_progress'), true);
    assert.equal(isLegalStatusEdge('open', 'resolved'), false);
    assert.equal(isLegalStatusEdge('open', 'open'), false);
    assert.equal(isLegalStatusEdge('closed', 'open'), true);
  });
});

describe('mayRecordStatusTransition', () => {
  it('allows an Assignee Agent a forward hop but not close', () => {
    assert.equal(
      mayRecordStatusTransition({
        from: 'open',
        to: 'in_progress',
        role: 'agent',
        actorId: 'a',
        assigneeId: 'a',
      }),
      true,
    );
    assert.equal(
      mayRecordStatusTransition({
        from: 'resolved',
        to: 'closed',
        role: 'agent',
        actorId: 'a',
        assigneeId: 'a',
      }),
      false,
    );
  });

  it('rejects a legal hop when the Agent is not Assignee', () => {
    assert.equal(
      mayRecordStatusTransition({
        from: 'open',
        to: 'in_progress',
        role: 'agent',
        actorId: 'a',
        assigneeId: null,
      }),
      false,
    );
  });

  it('allows an Administrator close and reopen without being Assignee', () => {
    assert.equal(
      mayRecordStatusTransition({
        from: 'resolved',
        to: 'closed',
        role: 'admin',
        actorId: 'admin',
        assigneeId: 'agent',
      }),
      true,
    );
    assert.equal(
      mayRecordStatusTransition({
        from: 'closed',
        to: 'open',
        role: 'admin',
        actorId: 'admin',
        assigneeId: null,
      }),
      true,
    );
  });
});

describe('nextRecordableStatus', () => {
  it('returns reopen for Administrator on a closed Ticket', () => {
    assert.equal(
      nextRecordableStatus({
        status: 'closed',
        role: 'admin',
        actorId: 'admin',
        assigneeId: 'agent',
      }),
      'open',
    );
  });

  it('returns null for an Agent on a resolved Ticket they are Assignee of', () => {
    assert.equal(
      nextRecordableStatus({
        status: 'resolved',
        role: 'agent',
        actorId: 'a',
        assigneeId: 'a',
      }),
      null,
    );
  });
});

describe('mayRecordReassignment', () => {
  it('allows Supervisor and Administrator but not Agent', () => {
    assert.equal(mayRecordReassignment('agent'), false);
    assert.equal(mayRecordReassignment('supervisor'), true);
    assert.equal(mayRecordReassignment('admin'), true);
  });
});
