import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('canned_responses')
export class CannedResponse {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;
}
