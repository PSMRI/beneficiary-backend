export interface UserServiceLoginResponse {
  statusCode: number;
  message: string;
  data: {
    id: string;
    ver: string;
    ts: string;
    params: {
      resmsgid: string;
      status: string;
      err: string | null;
      errmsg: string | null;
      successmessage: string;
    };
    responseCode: number;
    result: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_expires_in: number;
      token_type: string;
    };
  };
}