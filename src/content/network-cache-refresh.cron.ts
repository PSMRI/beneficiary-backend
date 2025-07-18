import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { ProxyService } from 'src/services/proxy/proxy.service';
import { HasuraService } from 'src/services/hasura/hasura.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NetworkCacheRefreshCron {
  private readonly logger = new Logger(NetworkCacheRefreshCron.name);
  private readonly domain = process.env.DOMAIN;
  private readonly bap_id = process.env.BAP_ID;
  private readonly bap_uri = process.env.BAP_URI;
  private readonly bpp_id = process.env.BPP_ID;
  private readonly bpp_uri = process.env.BPP_URI;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly hasuraService: HasuraService,
    private readonly configService: ConfigService,
  ) {
    this.validateEnvironmentVariables();
  }

  private validateEnvironmentVariables(): void {
    const requiredEnvVars = ['DOMAIN', 'BAP_ID', 'BAP_URI', 'BPP_ID', 'BPP_URI'];
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.logger.warn(`${envVar} is not defined in environment variables`);
      }
    });
  }

  private generateFixedId(...strings: string[]): string {
    const crypto = require('crypto');
    const combinedString = strings.join('-');
    return crypto.createHash('sha256').update(combinedString).digest('hex');
  }

  private createSearchApiPayload(): any {
    return {
      context: {
        domain: this.domain,
        action: 'search',
        version: '1.1.0',
        bap_id: this.bap_id,
        bap_uri: this.bap_uri,
        bpp_id: this.bpp_id,
        bpp_uri: this.bpp_uri,
        transaction_id: uuidv4(),
        message_id: uuidv4(),
        timestamp: new Date().toISOString(),
      },
      message: {
        intent: {
          item: {
            descriptor: { name: '' },
          },
        },
      },
    };
  }

  private async callSearchApi() {
    this.logger.log('Calling search API to fetch latest data');
    
    try {
      const data = this.createSearchApiPayload();
      const response = await this.proxyService.bapCLientApi2('search', data);
      this.logger.log('Search API response received');
      return response;
    } catch (error) {
      console.log('error', error);
      this.logger.error('Error calling search API:', error);
      throw error;
    }
  }

  private createItemObject(item: any, provider: any, bpp_id: string, bpp_uri: string): any {
    return {
      unique_id: this.generateFixedId(item.id, item.descriptor?.name || '', bpp_id),
      item_id: item.id,
      title: item?.descriptor?.name ?? '',
      description: item?.descriptor?.long_desc ?? '',
      provider_id: provider.id ?? '',
      provider_name: provider.descriptor?.name ?? '',
      bpp_id: bpp_id ?? '',
      bpp_uri: bpp_uri ?? '',
      item,
      descriptor: provider.descriptor,
      categories: provider.categories,
      fulfillments: provider.fulfillments,
    };
  }

  private processProviderItems(provider: any, bpp_id: string, bpp_uri: string): any[] {
    if (!provider.items) return [];
    
    return provider.items.map(item => this.createItemObject(item, provider, bpp_id, bpp_uri));
  }

  private processResponseMessage(message: any, bpp_id: string, bpp_uri: string): any[] {
    if (!message?.catalog?.providers) return [];
    
    return message.catalog.providers.flatMap(provider => 
      this.processProviderItems(provider, bpp_id, bpp_uri)
    );
  }

  private removeDuplicates(arrayOfObjects: any[]): any[] {
    const uniqueIds = new Set(arrayOfObjects.map(obj => obj.unique_id));
    return Array.from(uniqueIds).map(id => 
      arrayOfObjects.find(obj => obj.unique_id === id)
    );
  }

  private async processSearchResponse(response: any): Promise<any[]> {
    if (!response?.responses) {
      this.logger.warn('No valid response data received from search API');
      return [];
    }

    const arrayOfObjects = response.responses.flatMap(responses => {
      const bpp_id = responses.context.bpp_id ?? '';
      const bpp_uri = responses.context.bpp_uri ?? '';
      return this.processResponseMessage(responses.message, bpp_id, bpp_uri);
    });

    const uniqueObjects = this.removeDuplicates(arrayOfObjects);
    this.logger.log(`Processed ${uniqueObjects.length} unique items from search response`);
    return uniqueObjects;
  }

  private async processSingleItem(item: any): Promise<{ deleted: boolean; inserted: boolean }> {
    // Delete existing item
    const deleteResult = await this.hasuraService.deleteItemByItemId(item.item_id);
    const deleted = deleteResult?.data?.delete_ubi_network_cache?.affected_rows > 0;
    
    if (deleted) {
      this.logger.log(`Deleted existing item with item_id: ${item.item_id}`);
    } else {
      this.logger.debug(`No existing item found for item_id: ${item.item_id}`);
    }

    // Insert new item
    const insertResult = await this.hasuraService.insertCacheData([item]);
    const inserted = insertResult?.[0]?.data?.insert_ubi_network_cache?.returning?.length > 0;
    
    if (inserted) {
      this.logger.log(`Inserted new item with item_id: ${item.item_id}`);
    }

    return { deleted, inserted };
  }

  private async processItemsOneByOne(newData: any[]): Promise<void> {
    if (!newData?.length) {
      this.logger.warn('No data to process');
      return;
    }

    this.logger.log(`Processing ${newData.length} items one by one...`);
    
    let processedCount = 0;
    let deletedCount = 0;
    let insertedCount = 0;

    for (const item of newData) {
      try {
        const { deleted, inserted } = await this.processSingleItem(item);
        if (deleted) deletedCount++;
        if (inserted) insertedCount++;
        processedCount++;
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`Error processing item ${item.item_id}:`, error);
      }
    }

    this.logger.log(`One-by-one processing completed: ${processedCount} items processed, ${deletedCount} deleted, ${insertedCount} inserted`);
  }

  @Cron(process.env.NETWORK_CACHE_REFRESH_CRON_TIME ?? '*/10 * * * *')
  async refreshNetworkCache() {
    try {
      this.logger.log('Network Cache Refresh CRON started at ' + new Date().toISOString());
      
      // Call search API with error handling
      let searchResponse;
      try {
        searchResponse = await this.callSearchApi();
        console.log('searchResponse', JSON.stringify(searchResponse?.responses));
        this.logger.log('Search API response received successfully');
      } catch (apiError) {
        this.logger.error('Search API is unavailable (502 Bad Gateway), skipping cache refresh:', apiError.message);
        this.logger.log('Will retry in next cron cycle');
        return;
      }
      
      // Process the response
      const processedData = await this.processSearchResponse(searchResponse);
      
      if (processedData?.length) {
        await this.processItemsOneByOne(processedData);
        this.logger.log(`Network Cache Refresh CRON completed successfully. Processed ${processedData.length} records at ` + new Date().toISOString());
      } else {
        this.logger.warn('No valid data received from search API, keeping existing cache data');
      }
    } catch (error) {
      this.logger.error('Error in Network Cache Refresh CRON:', error);
    }
  }
} 