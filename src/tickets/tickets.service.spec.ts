import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { AuditEntry } from '../audit/audit-entry.entity';

describe('TicketsService', () => {
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
          entities: [Ticket, TicketComment, AuditEntry],
        }),
        TypeOrmModule.forFeature([Ticket, TicketComment, AuditEntry]),
      ],
      providers: [TicketsService, TicketsRepository, AuditService],
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

  describe('validation', () => {
    it('creates a valid ticket in status new', async () => {
      const ticket = await service.create('test', valid);
      expect(ticket.status).toBe('new');
      expect(ticket.priority).toBe('high');
      expect(ticket.resolvedAt).toBeNull();
    });

    it.each([
      [{ ...valid, subject: '  ' }, 'subject'],
      [{ ...valid, description: '' }, 'description'],
      [{ ...valid, customerEmail: 'not-an-email' }, 'customerEmail'],
      [{ ...valid, priority: 'critical' }, 'priority'],
    ])('rejects invalid input naming the field', async (input, field) => {
      await expect(service.create('test', input)).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining(field) }),
      );
    });
  });

  describe('status machine', () => {
    it('walks the full happy path', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      const final = await service.findById(t.id);
      expect(final.status).toBe('closed');
      expect(final.resolvedAt).not.toBeNull();
    });

    it('supports the waiting_customer loop', async () => {
      const t = await service.create('test', valid);
      await service.changeStatus('test', t.id, 'open');
      await service.changeStatus('test', t.id, 'in_progress');
      await service.changeStatus('test', t.id, 'waiting_customer');
      await service.changeStatus('test', t.id, 'in_progress');
      expect((await service.findById(t.id)).status).toBe('in_progress');
    });

    it('rejects new → resolved (no skipping)', async () => {
      const t = await service.create('test', valid);
      await expect(
        service.changeStatus('test', t.id, 'resolved'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reopening a closed ticket', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      await expect(service.changeStatus('test', t.id, 'open')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('names the allowed next states in the error', async () => {
      const t = await service.create('test', valid);
      await expect(service.changeStatus('test', t.id, 'closed')).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining('open') }),
      );
    });
  });

  describe('comments', () => {
    it('adds public and internal comments in order', async () => {
      const t = await service.create('test', valid);
      await service.addComment('agent-1', t.id, {
        author: 'agent-1',
        body: 'Looking into it',
        internal: true,
      });
      await service.addComment('ani', t.id, {
        author: 'ani',
        body: 'Any update?',
        internal: false,
      });
      const ticket = await service.findById(t.id);
      expect(ticket.comments).toHaveLength(2);
      expect(ticket.comments[0].internal).toBe(true);
      expect(ticket.comments[1].author).toBe('ani');
    });

    it('rejects empty bodies', async () => {
      const t = await service.create('test', valid);
      await expect(
        service.addComment('x', t.id, { author: 'x', body: ' ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('audit trail', () => {
    it('records creation, status changes, and comments with actors', async () => {
      const t = await service.create('narek', valid);
      await service.changeStatus('narek', t.id, 'open');
      await service.addComment('agent-1', t.id, { author: 'agent-1', body: 'hi' });

      const entries = await audit.list(t.id);
      expect(entries.map((e) => e.action)).toEqual([
        'ticket.created',
        'ticket.status_changed',
        'ticket.commented',
      ]);
      expect(entries[0].actor).toBe('narek');
      expect(entries[1].details).toEqual({ from: 'new', to: 'open' });
      expect(entries[2].actor).toBe('agent-1');
    });
  });

  it('404s on unknown tickets', async () => {
    await expect(service.findById('tkt_missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await service.create('test', { ...valid, subject: `Ticket ${i}` });
        // createdAt has millisecond resolution; space out creation so
        // order is deterministic for the ordering assertions below.
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    });

    it('defaults to limit 50, offset 0', async () => {
      const page = await service.findAll();
      expect(page.data).toHaveLength(5);
      expect(page.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 5,
        hasMore: false,
      });
    });

    it('applies limit and offset, preserving createdAt order', async () => {
      const page = await service.findAll({ limit: '2', offset: '1' });
      expect(page.data).toHaveLength(2);
      expect(page.data.map((t) => t.subject)).toEqual(['Ticket 1', 'Ticket 2']);
      expect(page.pagination).toEqual({
        limit: 2,
        offset: 1,
        total: 5,
        hasMore: true,
      });
    });

    it('reports total against the filtered set, not the whole table', async () => {
      await service.create('test', { ...valid, priority: 'urgent' });
      const page = await service.findAll({ priority: 'urgent' });
      expect(page.pagination.total).toBe(1);
      expect(page.data).toHaveLength(1);
    });

    it('applies offset after filtering', async () => {
      await service.create('test', { ...valid, priority: 'urgent' });
      await service.create('test', { ...valid, priority: 'urgent' });
      const page = await service.findAll({ priority: 'urgent', offset: '1' });
      expect(page.data).toHaveLength(1);
      expect(page.pagination.total).toBe(2);
    });

    it('clamps limit above the max to 200', async () => {
      const page = await service.findAll({ limit: '9999' });
      expect(page.pagination.limit).toBe(200);
    });

    it('rejects a non-integer limit', async () => {
      await expect(service.findAll({ limit: 'abc' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a limit below 1', async () => {
      await expect(service.findAll({ limit: '0' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative offset', async () => {
      await expect(service.findAll({ offset: '-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns an empty page past the end without error', async () => {
      const page = await service.findAll({ offset: '100' });
      expect(page.data).toHaveLength(0);
      expect(page.pagination.hasMore).toBe(false);
    });
  });
});
