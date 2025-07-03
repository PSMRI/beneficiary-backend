export interface UserServiceResponse {
  result: {
    userData: {
      userId: string;
      username: string;
      firstName: string;
      middleName: string | null;
      lastName: string;
      gender: string;
      email: string | null;
      mobile: string | null;
      createdBy: string;
      dob: string | null;
      address: string | null;
      pincode: string | null;
      deviceId: string | null;
      updatedBy: string | null;
      reason: string | null;
      createdAt: string;
      updatedAt: string;
      temporaryPassword: boolean;
      status: string;
      customFields: any[];
      createFailures: any[];
    };
  };
} 