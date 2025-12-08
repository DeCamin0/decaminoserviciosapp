import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * User Entity
 * Maps to the DatosEmpleados table in the database
 */
@Entity('DatosEmpleados')
export class User {
  @PrimaryColumn({ name: 'CODIGO', type: 'varchar' })
  CODIGO: string;

  @Column({ name: 'NOMBRE / APELLIDOS', type: 'varchar', nullable: true })
  'NOMBRE / APELLIDOS': string;

  @Column({ name: 'CORREO ELECTRONICO', type: 'varchar', nullable: true, unique: true })
  'CORREO ELECTRONICO': string;

  @Column({ name: 'D.N.I. / NIE', type: 'varchar', nullable: true })
  'D.N.I. / NIE': string;

  @Column({ name: 'ESTADO', type: 'varchar', nullable: true })
  ESTADO: string;

  @Column({ name: 'GRUPO', type: 'varchar', nullable: true })
  GRUPO: string;

  @Column({ name: 'NACIONALIDAD', type: 'varchar', nullable: true })
  NACIONALIDAD?: string;

  @Column({ name: 'DIRECCION', type: 'varchar', nullable: true })
  DIRECCION?: string;

  @Column({ name: 'SEG. SOCIAL', type: 'varchar', nullable: true })
  'SEG. SOCIAL'?: string;

  @Column({ name: 'Nº Cuenta', type: 'varchar', nullable: true })
  'Nº Cuenta'?: string;

  @Column({ name: 'TELEFONO', type: 'varchar', nullable: true })
  TELEFONO?: string;

  @Column({ name: 'FECHA NACIMIENTO', type: 'varchar', nullable: true })
  'FECHA NACIMIENTO'?: string;

  @Column({ name: 'FECHA DE ALTA', type: 'varchar', nullable: true })
  'FECHA DE ALTA'?: string;

  @Column({ name: 'CENTRO TRABAJO', type: 'varchar', nullable: true })
  'CENTRO TRABAJO'?: string;

  @Column({ name: 'TIPO DE CONTRATO', type: 'varchar', nullable: true })
  'TIPO DE CONTRATO'?: string;

  @Column({ name: 'SUELDO BRUTO MENSUAL', type: 'varchar', nullable: true })
  'SUELDO BRUTO MENSUAL'?: string;

  @Column({ name: 'HORAS DE CONTRATO', type: 'varchar', nullable: true })
  'HORAS DE CONTRATO'?: string;

  @Column({ name: 'EMPRESA', type: 'varchar', nullable: true })
  EMPRESA?: string;

  @Column({ name: 'FECHA BAJA', type: 'varchar', nullable: true })
  'FECHA BAJA'?: string;

  @Column({ name: 'Fecha Antigüedad', type: 'varchar', nullable: true })
  'Fecha Antigüedad'?: string;

  @Column({ name: 'Antigüedad', type: 'varchar', nullable: true })
  'Antigüedad'?: string;

  @Column({ name: 'Contraseña', type: 'varchar', nullable: true })
  'Contraseña'?: string;

  @Column({ name: 'DerechoPedidos', type: 'varchar', nullable: true })
  'DerechoPedidos'?: string;

  @Column({ name: 'TrabajaFestivos', type: 'varchar', nullable: true })
  'TrabajaFestivos'?: string;
}
