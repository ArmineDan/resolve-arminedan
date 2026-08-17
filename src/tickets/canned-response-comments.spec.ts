import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { TicketTag } from './ticket-tag.entity';
import { AuditEntry } from '../audit/audit-entry.entity';
import { CannedResponse } from '../canned-responses/canned-response.entity';
import { CannedResponsesService } from '../canned-responses/canned-responses.service';

describe('TicketsService — comments from canned responses', () => {
  let moduleRef: TestingModule;
  let service: TicketsService;
  let audit: AuditService;
  let cannedResponses: CannedResponsesService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          entities: [Ticket, TicketComment, TicketTag, AuditEntry, CannedResponse],
        }),
        TypeOrmModule.forFeature([
          Ticket,
          TicketComment,
          TicketTag,
          AuditEntry,
          CannedResponse,
        ]),
      ],
      providers: [
        TicketsService,
        TicketsRepository,
        AuditService,
        CannedResponsesService,
      ],
    }).compile();

    service = moduleRef.get(TicketsService);
    audit = moduleRef.get(AuditService);
    cannedResponses = moduleRef.get(CannedResponsesService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const valid = {
    subject: 'Cannot log in',
    description: 'Password reset email never arrives',
    customerEmail: 'ani@example.am',
    priority: 'high',
  };

  it('AC-9: uses the canned response body when cannedResponseId is provided', async () => {
    const canned = await cannedResponses.create({
      title: 'Password reset',
      body: 'Please check your inbox for the reset link.',
    });
    const t = await service.create('test', valid);
    const comment = await service.addComment('agent-1', t.id, {
      author: 'agent-1',
      cannedResponseId: canned.id,
    });
    expect(comment.body).toBe(canned.body);
  });

  it('AC-9: ignores the request body field when cannedResponseId is provided', async () => {
    const canned = await cannedResponses.create({
      title: 'Password reset',
      body: 'Please check your inbox for the reset link.',
    });
    const t = await service.create('test', valid);
    const comment = await service.addComment('agent-1', t.id, {
      author: 'agent-1',
      body: 'this text should be ignored',
      cannedResponseId: canned.id,
    });
    expect(comment.body).toBe(canned.body);
  });

  it('AC-9: rejects an unknown cannedResponseId, naming the field', async () => {
    const t = await service.create('test', valid);
    await expect(
      service.addComment('agent-1', t.id, {
        author: 'agent-1',
        cannedResponseId: 'cnd_missing',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('cannedResponseId'),
      }),
    );
    await expect(
      service.addComment('agent-1', t.id, {
        author: 'agent-1',
        cannedResponseId: 'cnd_missing',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('AC-10: records cannedResponseId in the audit details when a canned response is used', async () => {
    const canned = await cannedResponses.create({
      title: 'Password reset',
      body: 'Please check your inbox for the reset link.',
    });
    const t = await service.create('narek', valid);
    await service.addComment('agent-1', t.id, {
      author: 'agent-1',
      cannedResponseId: canned.id,
    });

    const entries = await audit.list(t.id);
    const commentEntry = entries.find((e) => e.action === 'ticket.commented');
    expect(commentEntry).toBeDefined();
    expect(commentEntry!.details).toEqual(
      expect.objectContaining({ cannedResponseId: canned.id }),
    );
  });

  it('AC-10: omits cannedResponseId from audit details for comments not using one', async () => {
    const t = await service.create('narek', valid);
    await service.addComment('agent-1', t.id, {
      author: 'agent-1',
      body: 'hi',
    });

    const entries = await audit.list(t.id);
    const commentEntry = entries.find((e) => e.action === 'ticket.commented');
    expect(commentEntry).toBeDefined();
    expect(commentEntry!.details).not.toHaveProperty('cannedResponseId');
  });

  it('AC-11: keeps the comment body unchanged after the canned response it came from is deleted', async () => {
    const canned = await cannedResponses.create({
      title: 'Password reset',
      body: 'Please check your inbox for the reset link.',
    });
    const t = await service.create('test', valid);
    const comment = await service.addComment('agent-1', t.id, {
      author: 'agent-1',
      cannedResponseId: canned.id,
    });

    await cannedResponses.remove(canned.id);

    const ticket = await service.findById(t.id);
    const persisted = ticket.comments.find((c) => c.id === comment.id);
    expect(persisted).toBeDefined();
    expect(persisted!.body).toBe(canned.body);
  });
});
