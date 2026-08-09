import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// standalone table (ticketId plain column, no relation) — mirrors AuditEntry's style
@Entity('ticket_tags')
export class TicketTag {
  @PrimaryGeneratedColumn()
  seq: number;

  @Column({ type: 'varchar', unique: true })
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  ticketId: string;
}
