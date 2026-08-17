import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { TicketTag } from './ticket-tag.entity';
import { AuditEntry } from '../audit/audit-entry.entity';
import { CannedResponse } from '../canned-responses/canned-response.entity';
import { CannedResponsesService } from '../canned-responses/canned-responses.service';

describe('TicketsService — tags', () => {
  let moduleRef: TestingModule;
  let service: TicketsService;
  let audit: AuditService;

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

  it('AC-1: attaches a tag and returns the ticket with it in the tags list', async () => {
    const t = await service.create('test', valid);
    const updated = await service.addTag('test', t.id, 'billing');
    expect(updated.tags.map((tag) => tag.name)).toEqual(['billing']);
  });

  it('AC-2: rejects attaching a tag that already exists on the ticket (case-insensitive), naming the field', async () => {
    const t = await service.create('test', valid);
    await service.addTag('test', t.id, 'Billing');
    await expect(service.addTag('test', t.id, 'billing')).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining('name') }),
    );
  });

  it('AC-2: leaves the tag set unchanged after a rejected duplicate attach', async () => {
    const t = await service.create('test', valid);
    await service.addTag('test', t.id, 'Billing');
    await expect(
      service.addTag('test', t.id, 'billing'),
    ).rejects.toThrow(BadRequestException);
    const ticket = await service.findById(t.id);
    expect(ticket.tags).toHaveLength(1);
  });

  it('AC-12: rejects attaching an 11th tag to a ticket', async () => {
    const t = await service.create('test', valid);
    for (let i = 0; i < 10; i++) {
      await service.addTag('test', t.id, `tag-${i}`);
    }
    await expect(service.addTag('test', t.id, 'tag-10')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('AC-12: leaves the tag set at 10 after a rejected 11th attach', async () => {
    const t = await service.create('test', valid);
    for (let i = 0; i < 10; i++) {
      await service.addTag('test', t.id, `tag-${i}`);
    }
    await expect(
      service.addTag('test', t.id, 'tag-10'),
    ).rejects.toThrow(BadRequestException);
    const ticket = await service.findById(t.id);
    expect(ticket.tags).toHaveLength(10);
  });

  it('AC-3: removes a tag from a ticket', async () => {
    const t = await service.create('test', valid);
    await service.addTag('test', t.id, 'billing');
    const updated = await service.removeTag('test', t.id, 'billing');
    expect(updated.tags).toHaveLength(0);
  });

  it('AC-3: matches the tag to remove case-insensitively', async () => {
    const t = await service.create('test', valid);
    await service.addTag('test', t.id, 'billing');
    const updated = await service.removeTag('test', t.id, 'BILLING');
    expect(updated.tags).toHaveLength(0);
  });

  it('AC-3: 404s removing a tag the ticket does not have', async () => {
    const t = await service.create('test', valid);
    await expect(service.removeTag('test', t.id, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('AC-4: lists distinct tag names attached to at least one ticket, sorted alphabetically', async () => {
    const a = await service.create('test', valid);
    const b = await service.create('test', valid);
    await service.addTag('test', a.id, 'urgent');
    await service.addTag('test', a.id, 'billing');
    await service.addTag('test', b.id, 'billing');
    expect(await service.findAllTagNames()).toEqual(['billing', 'urgent']);
  });

  it('AC-4: excludes tags that are attached to no ticket', async () => {
    expect(await service.findAllTagNames()).toEqual([]);
  });

  it('AC-5: records a ticket.tag_added audit entry with the tag name', async () => {
    const t = await service.create('narek', valid);
    await service.addTag('narek', t.id, 'billing');

    const entries = await audit.list(t.id);
    expect(entries.map((e) => e.action)).toEqual([
      'ticket.created',
      'ticket.tag_added',
    ]);
    expect(entries[1].actor).toBe('narek');
    expect(entries[1].details).toEqual({ tag: 'billing' });
  });

  it('AC-5: records a ticket.tag_removed audit entry with the tag name', async () => {
    const t = await service.create('narek', valid);
    await service.addTag('narek', t.id, 'billing');
    await service.removeTag('narek', t.id, 'billing');

    const entries = await audit.list(t.id);
    expect(entries.map((e) => e.action)).toEqual([
      'ticket.created',
      'ticket.tag_added',
      'ticket.tag_removed',
    ]);
    expect(entries[2].details).toEqual({ tag: 'billing' });
  });
});
