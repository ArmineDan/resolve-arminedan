import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket, TicketPriority, TicketStatus } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { TicketTag } from './ticket-tag.entity';
import { CannedResponsesService } from '../canned-responses/canned-responses.service';
import { newId } from '../common/ids';

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];
const MAX_TAGS_PER_TICKET = 10;

export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['open'],
  open: ['in_progress'],
  in_progress: ['waiting_customer', 'resolved'],
  waiting_customer: ['in_progress'],
  resolved: ['closed'],
  closed: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class TicketsService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly audit: AuditService,
    @Optional() private readonly cannedResponses?: CannedResponsesService,
  ) {}

  async create(
    actor: string,
    input: {
      subject?: string;
      description?: string;
      customerEmail?: string;
      priority?: string;
    },
  ): Promise<Ticket> {
    if (!input.subject?.trim()) {
      throw new BadRequestException('subject must be a non-empty string');
    }
    if (!input.description?.trim()) {
      throw new BadRequestException('description must be a non-empty string');
    }
    if (!input.customerEmail || !EMAIL_RE.test(input.customerEmail)) {
      throw new BadRequestException('customerEmail must be a valid email address');
    }
    if (!PRIORITIES.includes(input.priority as TicketPriority)) {
      throw new BadRequestException(
        `priority must be one of: ${PRIORITIES.join(', ')}`,
      );
    }
    const now = new Date().toISOString();
    const ticket = new Ticket();
    ticket.id = newId('tkt');
    ticket.subject = input.subject.trim();
    ticket.description = input.description.trim();
    ticket.customerEmail = input.customerEmail;
    ticket.priority = input.priority as TicketPriority;
    ticket.status = 'new';
    ticket.comments = [];
    ticket.tags = [];
    ticket.createdAt = now;
    ticket.updatedAt = now;
    ticket.resolvedAt = null;

    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.created', ticket.id, {
      subject: ticket.subject,
      priority: ticket.priority,
    });
    return ticket;
  }

  async changeStatus(actor: string, id: string, to?: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!to || !allowed.includes(to as TicketStatus)) {
      throw new BadRequestException(
        `cannot move ticket from '${ticket.status}' to '${to}'; allowed: ${
          allowed.length ? allowed.join(', ') : '(none — terminal state)'
        }`,
      );
    }
    const from = ticket.status;
    ticket.status = to as TicketStatus;
    if (ticket.status === 'resolved') {
      ticket.resolvedAt = new Date().toISOString();
    }
    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.status_changed', ticket.id, {
      from,
      to,
    });
    return ticket;
  }

  async addComment(
    actor: string,
    id: string,
    input: {
      author?: string;
      body?: string;
      internal?: boolean;
      cannedResponseId?: string;
    },
  ): Promise<TicketComment> {
    const ticket = await this.findById(id);
    if (!input.author?.trim()) {
      throw new BadRequestException('author must be a non-empty string');
    }
    let body = input.body;
    if (input.cannedResponseId) {
      const canned = await this.cannedResponses?.findById(input.cannedResponseId);
      if (!canned) {
        throw new BadRequestException(
          `cannedResponseId '${input.cannedResponseId}' does not match an existing canned response`,
        );
      }
      body = canned.body;
    }
    if (!body?.trim()) {
      throw new BadRequestException('body must be a non-empty string');
    }
    const comment = new TicketComment();
    comment.id = newId('cmt');
    comment.author = input.author.trim();
    comment.body = body.trim();
    comment.internal = input.internal === true;
    comment.at = new Date().toISOString();

    ticket.comments.push(comment);
    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.commented', ticket.id, {
      commentId: comment.id,
      internal: comment.internal,
      ...(input.cannedResponseId
        ? { cannedResponseId: input.cannedResponseId }
        : {}),
    });
    return comment;
  }

  async addTag(actor: string, id: string, name?: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new BadRequestException('name must be a non-empty string');
    }
    if (ticket.tags.length >= MAX_TAGS_PER_TICKET) {
      throw new BadRequestException(
        `a ticket cannot have more than ${MAX_TAGS_PER_TICKET} tags`,
      );
    }
    if (
      ticket.tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      throw new BadRequestException(
        `name '${trimmed}' is already attached to this ticket`,
      );
    }
    const tag = new TicketTag();
    tag.id = newId('tag');
    tag.name = trimmed;
    tag.ticketId = ticket.id;
    await this.tickets.addTagRow(tag);
    ticket.tags.push(tag);
    await this.audit.record(actor, 'ticket.tag_added', ticket.id, {
      tag: trimmed,
    });
    return ticket;
  }

  async removeTag(actor: string, id: string, name?: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    const trimmed = name?.trim() ?? '';
    const index = ticket.tags.findIndex(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (index === -1) {
      throw new NotFoundException(`ticket ${id} has no tag '${name}'`);
    }
    const [removed] = ticket.tags.splice(index, 1);
    await this.tickets.removeTagRow(removed.id);
    await this.audit.record(actor, 'ticket.tag_removed', ticket.id, {
      tag: removed.name,
    });
    return ticket;
  }

  async findAllTagNames(): Promise<string[]> {
    return this.tickets.findAllTagNames();
  }

  async findAll(
    filter: { status?: TicketStatus; priority?: TicketPriority } = {},
  ): Promise<Ticket[]> {
    return this.tickets.findAll(filter);
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException(`ticket ${id} not found`);
    return ticket;
  }
}
