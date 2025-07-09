// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   CreateDateColumn,
//   UpdateDateColumn,
// } from 'typeorm';

// @Entity('user_info')
// export class UserInfo {
//   @PrimaryGeneratedColumn('uuid')
//   user_id: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   fatherName: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   samagraId: string;

//   @Column({ type: 'varchar', length: 150, nullable: true })
//   currentSchoolName: string;

//   @Column({ type: 'text', nullable: true })
//   currentSchoolAddress: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   currentSchoolDistrict: string;

//   @Column({ type: 'int', nullable: true })
//   class: number;

//   @Column({ type: 'varchar', nullable: true })
//   previousYearMarks: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   studentType: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   aadhaar: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   caste: string;

//   @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
//   annualIncome: number;

//   @Column({ type: 'varchar', length: 10, nullable: true })
//   gender: string;

//   @Column({ type: 'int', nullable: true })
//   age: number;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   disabilityStatus: string;

//   @Column({ type: 'varchar', length: 10, nullable: true })
//   status: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   motherName: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   dob: string;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   state: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   bankAccountHolderName: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   bankName: string;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   bankAccountNumber: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   bankIfscCode: string;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   bankAddress: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   branchCode: string;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   udid: string;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   disabilityType: string;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   disabilityRange: string;

//   @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
//   created_at: Date;

//   @Column({ type: 'varchar', length: 255, nullable: true })
//   nspOtr: string;

//   @Column({ type: 'int', nullable: true })
//   tuitionAndAdminFeePaid: number;

//   @Column({ type: 'int', nullable: true })
//   miscFeePaid: number;

//   @UpdateDateColumn({
//     type: 'timestamptz',
//     default: () => 'CURRENT_TIMESTAMP',
//     onUpdate: 'CURRENT_TIMESTAMP',
//   })
//   updated_at: Date;
//   ifscCode: any;
// }
