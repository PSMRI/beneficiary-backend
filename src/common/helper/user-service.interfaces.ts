export interface IUser {
  userId?: string;
  username?: string;
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'transgender';
  enrollmentId?: string;
  dob?: Date;
  email?: string;
  address?: string;
  pincode?: string;
  createdAt?: Date;
  updatedAt?: Date;
  mobile?: number;
  deviceId?: string[];
  temporaryPassword?: boolean;
  createdBy?: string;
  updatedBy?: string;
  status?: 'active' | 'inactive' | 'archived';
  reason?: string;
}