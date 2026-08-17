import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { TicketComment } from './ticket-comment.entity';
import { TicketTag } from './ticket-tag.entity';

export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

// dates are ISO strings: keeps pg (runtime) and sqlite (tests) identical
@Entity('tickets')
export class Ticket {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  customerEmail: string;

  @Column({ type: 'varchar' })
  priority: TicketPriority;

  @Column({ type: 'varchar' })
  status: TicketStatus;

  @OneToMany(() => TicketComment, (c) => c.ticket, {
    cascade: true,
    eager: true,
  })
  comments: TicketComment[];

  // not a TypeORM relation — populated by TicketsRepository from the
  // standalone ticket_tags table, so entities relying on this class don't
  // need to register TicketTag to build their schema
  tags: TicketTag[];

  @Column({ type: 'varchar' })
  createdAt: string;

  @Column({ type: 'varchar' })
  updatedAt: string;

  @Column({ type: 'varchar', nullable: true })
  resolvedAt: string | null;
}
