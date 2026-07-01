import { UserRole } from '../../users/schemas/user.schema';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}
