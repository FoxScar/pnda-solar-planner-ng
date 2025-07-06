
// Type definitions for admin functionality
export interface AdminRPCResponse {
  success?: boolean;
  message?: string;
  error?: string;
  user_id?: string;
  admin_count?: number;
}
