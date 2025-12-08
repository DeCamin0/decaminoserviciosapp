import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Notification Entity
 * Stochează notificările utilizatorilor în baza de date
 */
@Entity('notifications')
@Index(['senderId']) // Index pentru căutări după remitent
@Index(['userId', 'read']) // Index pentru query-uri rapide
@Index(['userId', 'createdAt']) // Index pentru sortare
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 50, nullable: true })
  @Index()
  senderId: string; // CODIGO al utilizatorului care trimite notificarea

  @Column({ name: 'user_id', type: 'varchar', length: 50 })
  @Index()
  userId: string; // CODIGO al utilizatorului căruia i se trimite (recipient)

  @Column({ name: 'type', type: 'varchar', length: 20, default: 'info' })
  type: 'success' | 'error' | 'warning' | 'info';

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'read', type: 'boolean', default: false })
  @Index()
  read: boolean;

  @Column({
    name: 'data',
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: any) => {
        // Dacă vine deja ca string JSON, folosește-l direct
        if (typeof value === 'string') {
          return value;
        }
        // Dacă e null/undefined, returnează string JSON gol
        if (value === null || value === undefined) {
          return '{}';
        }
        // Altfel, serializează
        return JSON.stringify(value);
      },
      from: (value: string) => {
        // Parsează JSON-ul când se citește
        if (value === null || value === undefined || value === '') {
          return {}; // Returnează obiect gol dacă e null/gol
        }
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          // Dacă nu poate fi parsat, returnează obiect gol
          return {};
        }
      },
    },
  })
  data: any; // Date suplimentare (ex: link către resursă, ID-uri, etc.)

  @Column({ name: 'grupo', type: 'varchar', length: 100, nullable: true })
  grupo: string; // Grupul căruia i-a fost trimisă (dacă e notificare de grup)

  @Column({ name: 'centro', type: 'varchar', length: 100, nullable: true })
  centro: string; // Centrul căruia i-a fost trimisă (dacă e notificare de centru)

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;
}
