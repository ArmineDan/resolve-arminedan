import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketPriority, TicketStatus } from './ticket.entity';
import { TicketTag } from './ticket-tag.entity';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
    @Optional()
    @InjectRepository(TicketTag)
    private readonly tagsRepo?: Repository<TicketTag>,
  ) {}

  async findAll(
    filter: { status?: TicketStatus; priority?: TicketPriority } = {},
  ): Promise<Ticket[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    const tickets = await this.repo.find({ where, order: { createdAt: 'ASC' } });
    tickets.forEach((t) => this.sortComments(t));
    await this.attachTags(tickets);
    return tickets;
  }

  async findById(id: string): Promise<Ticket | null> {
    const ticket = await this.repo.findOne({ where: { id } });
    if (ticket) {
      this.sortComments(ticket);
      await this.attachTags([ticket]);
    }
    return ticket;
  }

  async save(ticket: Ticket): Promise<Ticket> {
    ticket.updatedAt = new Date().toISOString();
    const tags = ticket.tags;
    const saved = await this.repo.save(ticket);
    this.sortComments(saved);
    saved.tags = tags ?? [];
    return saved;
  }

  async addTagRow(tag: TicketTag): Promise<void> {
    await this.tagsRepo?.save(tag);
  }

  async removeTagRow(tagId: string): Promise<void> {
    await this.tagsRepo?.delete({ id: tagId });
  }

  async findAllTagNames(): Promise<string[]> {
    if (!this.tagsRepo) return [];
    const rows = await this.tagsRepo.find();
    const names = new Set(rows.map((t) => t.name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  private async attachTags(tickets: Ticket[]): Promise<void> {
    if (!this.tagsRepo) {
      tickets.forEach((t) => {
        t.tags = t.tags ?? [];
      });
      return;
    }
    const tagsRepo = this.tagsRepo;
    await Promise.all(
      tickets.map(async (t) => {
        t.tags = await tagsRepo.find({ where: { ticketId: t.id } });
      }),
    );
  }

  private sortComments(ticket: Ticket): void {
    ticket.comments?.sort((a, b) => a.seq - b.seq);
  }
}
