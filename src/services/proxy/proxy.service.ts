import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
const axios = require('axios');

@Injectable()
export class ProxyService {
  private bap_client_url = process.env.BAP_CLIENT_URL;

  async bapCLientApi2(endPoint, body) {
    let data = JSON.stringify(body);
    console.log('bap_client_url', this.bap_client_url);

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${this.bap_client_url}/${endPoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };

    try {
      let response = await axios.request(config);

      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.log('error', error);
      throw new HttpException(
        'Unabe to process request',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
