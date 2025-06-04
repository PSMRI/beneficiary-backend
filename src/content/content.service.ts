import { HttpStatus, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { HasuraService } from 'src/services/hasura/hasura.service';
import { ProxyService } from 'src/services/proxy/proxy.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateOrderDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCache } from 'src/entity/response.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { SuccessResponse } from 'src/common/responses/success-response';
import { ErrorResponse } from 'src/common/responses/error-response';
import { HttpService } from '@nestjs/axios';
import { UserService } from '../modules/users/users.service';
const crypto = require('crypto');

@Injectable()
export class ContentService {
	private readonly domain = process.env.DOMAIN;
	private readonly bap_id = process.env.BAP_ID;
	private readonly bap_uri = process.env.BAP_URI;
	private readonly bpp_id = process.env.BPP_ID;
	private readonly bpp_uri = process.env.BPP_URI;
	private readonly response_cache_db = process.env.RESPONSE_CACHE_DB;
	private readonly telemetry_db = process.env.TELEMETRY_DB;
	private readonly eligibility_base_uri = process.env.ELIGIBILITY_API_URL;

	constructor(
		private readonly hasuraService: HasuraService,
		private readonly proxyService: ProxyService,
		private readonly logger: LoggerService,
		private readonly encrypt: EncryptionService,
		private readonly httpService: HttpService,
		@InjectRepository(ResponseCache)
		private readonly responseCacheRepository: Repository<ResponseCache>,
		private readonly userService: UserService,
	) {}

	async getJobs(body, req) {
		try {
			const page = body.page ?? 1;
			const limit = body.limit ?? 100;
			const userId = req?.mw_userid;

			// Fetch jobs from Hasura
			const filteredData = await this.hasuraService.findJobsCache(body);

			let filteredJobs: any[] = [];
			if (
				!(filteredData instanceof ErrorResponse) &&
				typeof filteredData.data === 'object' &&
				filteredData.data !== null &&
				'ubi_network_cache' in filteredData.data
			) {
				filteredJobs = (filteredData.data as any).ubi_network_cache ?? [];
			}

			// Get user info if userId is present
			let userInfo = null;
			if (userId) {
				const request = { user: { keycloak_id: userId } };
				const response = await this.userService.findOne(request, true);
				let user = null;
				if (!(response instanceof ErrorResponse) && response?.data) {
					user = response.data;
				}
				if (user) {
					userInfo = Object.fromEntries(
						Object.entries(user).map(([key, value]) => [
							key,
							value !== null && value !== undefined ? String(value) : '',
						]),
					);
				}
			}

			// Eligibility filtering if userInfo is present
			if (userInfo) {
				try {
					const strictCheck = body?.strictCheck ?? false; // check if strictCheck is provided in the request body
					const benefitsList =
						this.getFormattedEligibilityCriteriaFromBenefits(filteredJobs); // format the benefits list from the filteredJobs data as per eligibility API requirements
					const eligibilityData = await this.checkBenefitsEligibility(
						userInfo,
						benefitsList,
						strictCheck,
					);
					const eligibleList = eligibilityData?.eligible ?? []; // get the eligible list from the eligibility API response
					const eligibleJobIds = eligibleList.map((e) => e?.schemaId); // extract job IDs from the eligible list
					filteredJobs = filteredJobs.filter((scheme) =>
						eligibleJobIds.includes(scheme?.id),
					); // filter the jobs based on eligibility
				} catch (err) {
					console.error('Error in eligibility filtering:', err);
				}
			}

			// Pagination
			const total = filteredJobs.length;
			const start = (page - 1) * limit;
			const end = start + limit;
			const paginatedJobs = filteredJobs.slice(start, end);

			return {
				statusCode: 200,
				message: 'Ok.',
				data: {
					ubi_network_cache: paginatedJobs,
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (err) {
			return new ErrorResponse({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				errorMessage: err.message,
			});
		}
	}

	async encryption(data) {
		return this.encrypt.encrypt(data);
	}

	async decryption(data) {
		return this.encrypt.decrypt(data);
	}

	async createOrder(createOrderDto: CreateOrderDto) {
		const createUserDto = {
			name: createOrderDto.name,
			gender: createOrderDto.gender,
			phone: createOrderDto.phone,
			email: createOrderDto.email,
		};
		const findUser = await this.hasuraService.findSeekerUser(
			createUserDto.email,
		);
		if (findUser) {
			console.log('findUser', findUser);
			const createOrder = {
				seeker_id: findUser.id,
				content_id: createOrderDto.content_id,
				order_id: createOrderDto.order_id,
			};
			return this.hasuraService.createOrder(createOrder);
		}
		const user = await this.hasuraService.createSeekerUser(createUserDto);
		console.log('user', user.id);
		if (user) {
			const createOrder = {
				seeker_id: user.id,
				content_id: createOrderDto.content_id,
				order_id: createOrderDto.order_id,
			};
			return this.hasuraService.createOrder(createOrder);
		}
	}

	searchOrderByOrderId(OredrId) {
		return this.hasuraService.searchOrderByOrderId(OredrId);
	}

	async jobsApiCall() {
		this.logger.log('create jobs api calling');
		const data = {
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
						descriptor: {
							name: '',
						},
					},
				},
			},
		};

		try {
			const response = await this.proxyService.bapCLientApi2('search', data);
			console.log(JSON.stringify(response), '================');
			if (response) {
				const arrayOfObjects = [];
				//  console.log(response.responses.length())
				for (const responses of response.responses) {
					if (responses.message.catalog.providers) {
						for (const provider of responses.message.catalog.providers) {
							for (const [index, item] of provider.items.entries()) {
								const obj = {
									unique_id: this.generateFixedId(
										item.id,
										item.descriptor.name,
										responses.context.bpp_id,
									),
									item_id: item.id,
									title: item?.descriptor?.name ? item.descriptor.name : '',
									description: item?.descriptor?.long_desc
										? item.descriptor.long_desc
										: '',
									provider_id: provider.id ? provider.id : '',
									provider_name: provider.descriptor.name
										? provider.descriptor.name
										: '',
									bpp_id: responses.context.bpp_id
										? responses.context.bpp_id
										: '',
									bpp_uri: responses.context.bpp_uri
										? responses.context.bpp_uri
										: '',
									item: item,
									descriptor: provider.descriptor,
									categories: provider.categories,
									fulfillments: provider.fulfillments,
								};
								arrayOfObjects.push(obj);
							}
						}
					}
				}
				console.log('arrayOfObjects', arrayOfObjects);
				console.log('arrayOfObjects length', arrayOfObjects.length);
				const uniqueObjects = Array.from(
					new Set(arrayOfObjects.map((obj) => obj.unique_id)),
				).map((id) => {
					return arrayOfObjects.find((obj) => obj.unique_id === id);
				});
				console.log('uniqueObjects length', uniqueObjects.length);
				//return uniqueObjects
				const insertionResponse =
					await this.hasuraService.insertCacheData(uniqueObjects);

				// Collect all returned items from the response (flatten the result)
				const returnedItems = insertionResponse.flatMap(
					(res) => res.data.insert_ubi_network_cache.returning,
				);

				// Create the success response in the desired format
				return new SuccessResponse({
					statusCode: HttpStatus.OK,
					message: 'Data inserted successfully',
					data: returnedItems, // Attach the data in the "data" field
				});
			}
		} catch (error) {
			return new ErrorResponse({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				errorMessage: error.message,
				// Attach the data in the "data" field
			});
		}
	}

	async searchResponse(body) {
		return this.hasuraService.searchResponse(body);
	}

	generateFixedId(...strings) {
		const combinedString = strings.join('-'); // Combine strings using a separator
		const hash = crypto
			.createHash('sha256')
			.update(combinedString)
			.digest('hex');
		return hash;
	}

	//  async some(name: any, li: any) {
	//    const promises = li.map(async (element) => {
	//       const n = element?.descriptor?.name;
	//       console.log(element?.descriptor)
	//       if (n && name == n) {
	//         console.log("n2 " + n );
	//         return element.value;
	//       }
	//     });

	//     // Wait for all promises to complete
	//     const results = await Promise.all(promises);

	//     // Find the first non-null result (or provide a default value if all are null)
	//     const result = results.find((value) => value !== undefined) || "";

	//     return result;
	//  };

	async getState() {
		return this.hasuraService.getState();
	}

	async getCity(state: string) {
		return this.hasuraService.getCity(state);
	}

	async getTitle() {
		return this.hasuraService.getTitle();
	}

	async deleteResponse() {
		return this.hasuraService.deleteResponse();
	}

	async deleteJobs() {
		return this.hasuraService.deleteJobs();
	}

	async addTelemetry(data) {
		const promises = [];
		data.events.map((event) => {
			promises.push(
				this.hasuraService.addTelemetry({
					id: data.id,
					ver: data.ver,
					events: event,
				}),
			);
			//return {id: data.id, ver: data.ver, events: event}
		});

		//return this.hasuraService.addTelemetry(telemetry_data)
		return Promise.all(promises);
	}

	async analytics(body) {
		// let response = await  this.hasuraService.searchResponse({"action": "on_confirm"});
		// console.log("response", response.data.response_cache_dev)
		// let analytics =  response.data[`${this.response_cache_db}`]
		//let analytics =  response.data[`${this.response_cache_db}`]

		const response = await this.selectResponseCache(body);

		//console.log("response", response)
		//return response

		const analytics = response;

		const arrayOfObj = [];

		analytics.map((item) => {
			if (!item.response.error) {
				const obj = {
					order_id: item.response.message.order.id,
					action: item.action,
					transaction_id: item.transaction_id,
					bpp_id: item.response.context.bpp_id,
					bpp_uri: item.response.context.bpp_uri,
					customer_email:
						item.response.message.order.fulfillments[0].customer.contact.email,
					customer_phone:
						item.response.message.order.fulfillments[0].customer.contact.phone,
					customer_name:
						item.response.message.order.fulfillments[0].customer.person.name,
					customer_gender:
						item.response.message.order.fulfillments[0].customer.person.gender,
					provider_name: item.response.message.order?.provider?.descriptor?.name
						? item.response.message.order.provider.descriptor.name
						: '',
					scholarship_id: item.response.message.order?.items[0]?.id
						? item.response.message.order.items[0].id
						: '',
					scholarship_name: item.response.message.order?.items[0]?.descriptor
						?.name
						? item.response.message.order.items[0].descriptor.name
						: '',
					//scholarship_location: item.response.message.order?.items[0]?.descriptor?.name ? item.response.message.order.items[0].descriptor.name : "",
					//content_creater_name: item.response.message.order?.items[0]?.creator?.descriptor?.name ? item.response.message.order.items[0].creator.descriptor.name : "",
					//distributor_name: item.response.message.order.fulfillments[0].customer.person.tags.find((tag) => tag.code === 'distributor-details').list[0]?.value ? item.response.message.order.fulfillments[0].customer.person.tags.find((tag) => tag.code === 'distributor-details').list[0].value : "",
					//agent_id: item.response.message.order.fulfillments[0].customer.person.tags.find((tag) => tag.code === 'distributor-details').list[1]?.value ? item.response.message.order.fulfillments[0].customer.person.tags.find((tag) => tag.code === 'distributor-details').list[1].value : "",
					agent_name:
						item.response.message.order.fulfillments[0].agent.person.name,
					created_at: this.formatTimestamp(item.created_at),
				};
				//return obj
				arrayOfObj.push(obj);
			}
		});

		//console.log("arrayOfObj", arrayOfObj)

		//return arrayOfObj;

		const uniqueObjects = Array.from(
			new Set(arrayOfObj.map((obj) => obj.order_id)),
		).map((id) => {
			return arrayOfObj.find((obj) => obj.order_id === id);
		});

		if (body.fields) {
			console.log('body.fields', body.fields);
			const keysToKeep = body.fields;

			const result = uniqueObjects.map((obj) => {
				const newObj = {};
				keysToKeep.forEach((key) => {
					if (obj.hasOwnProperty(key)) {
						newObj[key] = obj[key];
					}
				});
				return newObj;
			});
			return result;
		}

		return uniqueObjects;
	}

	async telemetryAnalytics(body) {
		let query = `SELECT
       events->'edata'->>'pageurl' AS unique_pageurl,
       COUNT(*) AS data_count
       FROM
       ${this.telemetry_db}
       GROUP BY
       unique_pageurl;`;

		if (body.agent) {
			query = `SELECT
       events->'edata'->>'pageurl' AS unique_pageurl,
       COUNT(*) AS data_count
       FROM
       ${this.telemetry_db}
       WHERE
           events->'edata'->>'pageurl' LIKE '%${body.agent}%'
       GROUP BY
       unique_pageurl;`;
		}

		if (body.date) {
			const fromDate = Date.parse(body.date.from);
			const toDate = Date.parse(body.date.to);

			query = `SELECT
       events->'edata'->>'pageurl' AS unique_pageurl,
       COUNT(*) AS data_count
       FROM
       ${this.telemetry_db}
       WHERE events->>'ets'>='${fromDate}'
       AND events->>'ets'<'${toDate}'
       GROUP BY
       unique_pageurl;`;

			if (body.agent) {
				query = `SELECT
           events->'edata'->>'pageurl' AS unique_pageurl,
           COUNT(*) AS data_count
           FROM
           ${this.telemetry_db}
           WHERE
               events->'edata'->>'pageurl' LIKE '%${body.agent}%'
               AND events->>'ets'>='${fromDate}'
               AND events->>'ets'<'${toDate}'
           GROUP BY
           unique_pageurl;`;
			}
		}

		const data = await this.responseCacheRepository.query(query);

		function calculateTotalDataCount(data) {
			let totalDataCount = 0;
			for (const entry of data) {
				totalDataCount += parseInt(entry['data_count']);
			}
			return totalDataCount;
		}

		const totalDataCount = calculateTotalDataCount(data);
		console.log('Total sum of data_count:', totalDataCount);

		return {
			agent: body.agent,
			transactionCount: totalDataCount,
			transactions: data,
		};
	}

	async telemetryAnalytics1(body) {
		let query = `SELECT *
       FROM
       ${this.telemetry_db}
       ;`;

		if (body.agent) {
			query = `SELECT *
       FROM
       ${this.telemetry_db}
       WHERE
           events->'edata'->>'pageurl' LIKE '%${body.agent}%'
       ;`;
		}

		if (body.date) {
			const fromDate = Date.parse(body.date.from);
			const toDate = Date.parse(body.date.to);

			query = `SELECT *
       FROM
       ${this.telemetry_db}
       WHERE events->>'ets'>='${fromDate}'
       AND events->>'ets'<'${toDate}'
       ;`;

			if (body.agent) {
				query = `SELECT *
           FROM
           ${this.telemetry_db}
           WHERE
               events->'edata'->>'pageurl' LIKE '%${body.agent}%'
               AND events->>'ets'>='${fromDate}'
               AND events->>'ets'<'${toDate}'
          ;`;
			}
		}

		const data = await this.responseCacheRepository.query(query);

		//const totalDataCount = calculateTotalDataCount(data);

		const totalDataCount = data.length;
		console.log('Total sum of data_count:', totalDataCount);

		const transactionsData = data.map((item) => {
			item.events.ets = this.convertEts(item.events.ets);
			return item;
		});

		return {
			agent: body.agent,
			transactionCount: totalDataCount,
			transactions: transactionsData,
		};
	}

	convertToUTC(dateStr) {
		// Parse the date string
		const parts = dateStr.split('-');
		const year = parseInt(parts[0]);
		const month = parseInt(parts[1]) - 1; // Months are 0-based in JavaScript
		const day = parseInt(parts[2]);

		// Create a Date object with the parsed date
		const date = new Date(Date.UTC(year, month, day));

		console.log('date', date);
		console.log('date.toISOString()', date.toISOString());

		//return date.toISOString()

		return date.toISOString().split('T')[0]; // Convert to UTC and return as string
	}

	formatTimestamp(timestamp) {
		// Create a new Date object using the timestamp
		const date = new Date(timestamp);

		// Extract date components
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because month is zero-based
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		// Construct the formatted string
		const formattedTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

		return formattedTimestamp;
	}

	convertEts(timestamp) {
		//const timestamp = 1709530559681; // Example timestamp in milliseconds
		const date = new Date(timestamp);
		const formattedDate = date.toISOString().replace(/[TZ]/g, ' ').trim(); // Convert to UTC ISO string and format

		//console.log(formattedDate); // Output: '2024-12-23 03:22:39'
		return formattedDate;
	}

	async selectResponseCache(filters) {
		console.log('filters', filters);

		const query1 = `
      SELECT *
      FROM response_cache_dev
      WHERE response->'context'->>'action'='on_confirm';
      `;

		const query2 = `
      SELECT *
      FROM response_cache_dev
      CROSS JOIN LATERAL json_array_elements(response->'message'->'order'->'fulfillments') AS fulfillment
      WHERE fulfillment->'customer'->'person'->>'gender' = 'Female'
      AND response->'context'->>'action'='on_confirm'
      `;

		const query3 = `
      SELECT *
      FROM response_cache_dev
      CROSS JOIN LATERAL json_array_elements(response->'message'->'order'->'fulfillments') AS fulfillment
      WHERE fulfillment->'customer'->'person'->>'gender' = 'Female'
      AND response->'context'->>'action'='on_confirm'
      AND response->'message'->'order'->'provider'->'descriptor'->>'name' = 'tibil'
      `;

		const query4 = `
      WITH confirm_actions AS (
          SELECT *
          FROM response_cache_dev
          WHERE response->'context'->>'action' = 'on_confirm'
      )
      SELECT *
      FROM confirm_actions
      CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
      WHERE fulfillment->'customer'->'person'->>'gender' = 'Female'
      AND confirm_actions.response->'message'->'order'->'provider'->'descriptor'->>'name' = 'tibil';        
      `;

		const query5 = `
      WITH confirm_actions AS (
          SELECT *
          FROM response_cache_dev
          WHERE response->'context'->>'action' = 'on_confirm'
          AND response->'message'->'order'->'provider'->'descriptor'->>'name' = 'tibil'
          AND createdat BETWEEN '2024-01-01' AND '2024-02-29'
      )
      SELECT *
      FROM confirm_actions
      CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
      WHERE fulfillment->'customer'->'person'->>'gender' = 'Female'       
      `;

		const query6 = `
      WITH confirm_actions AS (
          SELECT *
          FROM response_cache_dev
          WHERE response->'context'->>'action' = 'on_confirm'
          AND response->'message'->'order'->'provider'->'descriptor'->>'name' = 'tibil'
          AND createdat BETWEEN '2024-01-01' AND '2024-02-29'
      )
      SELECT *
      FROM confirm_actions
      CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
      WHERE fulfillment->'customer'->'person'->>'gender' = 'female'
      AND fulfillment->'customer'->'contact'->>'phone' = '9822334455'
      AND fulfillment->'customer'->'contact'->>'email' = 'alice@gmail.com'
      `;

		const generatedQuery = this.generateQuery(filters);
		console.log(generatedQuery);

		return await this.responseCacheRepository.query(generatedQuery);
	}

	generateQuery(filters) {
		let query = `
          SELECT *
          FROM ${this.response_cache_db}`;

		if (filters.action) {
			query += `
          WHERE response->'context'->>'action' = '${filters.action}'`;
		}

		if (filters.order_id) {
			query += `
          AND response->'message'->'order'->>'id' = '${filters.order_id}'`;
		}

		if (filters.provider_name) {
			query += `
          AND response->'message'->'order'->'provider'->'descriptor'->>'name' = '${filters.provider_name}'`;
		}

		if (filters.date) {
			// let fromDate = this.convertToUTC(filters.date.from)
			// let toDate = this.convertToUTC(filters.date.to)
			const fromDate = filters.date.from;
			const toDate = filters.date.to;
			query += `
          AND created_at >= '${fromDate}' 
          AND created_at <'${toDate}' 
          `;
		}

		if (filters.customer_gender) {
			if (this.hasWhereKeyword(query)) {
				query += `
              AND fulfillment->'customer'->'person'->>'gender' = '${filters.customer_gender}'
              `;
			}
			query = `
          WITH confirm_actions AS (
              ${query}
          )
          SELECT *
          FROM confirm_actions
          CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
          WHERE fulfillment->'customer'->'person'->>'gender' = '${filters.customer_gender}'
          `;
		}

		if (filters.customer_name) {
			if (this.hasWhereKeyword(query)) {
				query += `
              AND fulfillment->'customer'->'person'->>'name' = '${filters.customer_name}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE fulfillment->'customer'->'person'->>'name' = '${filters.customer_name}'
              `;
			}
		}

		if (filters.customer_phone) {
			if (this.hasWhereKeyword(query)) {
				query += `
              AND fulfillment->'customer'->'contact'->>'phone' = '${filters.customer_phone}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE fulfillment->'customer'->'contact'->>'phone' = '${filters.customer_phone}'
              `;
			}
		}

		if (filters.customer_email) {
			if (this.hasWhereKeyword(query)) {
				query += `
              AND fulfillment->'customer'->'contact'->>'email' = '${filters.customer_email}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE fulfillment->'customer'->'contact'->>'email' = '${filters.customer_email}'
              `;
			}
		}

		if (filters.distributor_name) {
			if (this.hasListKeyword(query)) {
				query += `
              AND list->>'value'='${filters.distributor_name}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE list->>'value'='${filters.distributor_name}'
              `;
			}
		}

		if (filters.agent_id) {
			if (this.hasListKeyword(query)) {
				query += `
              AND list->>'value'='${filters.agent_id}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE list->>'value'='${filters.agent_id}'
              `;
			}
		}

		if (filters.agent_name) {
			if (this.hasListKeyword(query)) {
				query += `
            AND fulfillment->'agent'->'person'->>'name' = '${filters.agent_name}'
              `;
			} else {
				query = `
              WITH confirm_actions AS (
                  ${query}
              )
              SELECT *
              FROM confirm_actions
              CROSS JOIN LATERAL json_array_elements(confirm_actions.response->'message'->'order'->'fulfillments') AS fulfillment
              WHERE fulfillment->'agent'->'person'->>'name' = '${filters.agent_name}'
              `;
			}
		}

		return query;
	}

	hasWhereKeyword(queryString) {
		return queryString.toLowerCase().includes('fulfillment');
	}

	hasListKeyword(queryString) {
		return queryString.toLowerCase().includes('tags');
	}

	getFormattedEligibilityCriteriaFromBenefits(jobs: any[]): any[] {
		return jobs
			.map((job) => {
				const eligibilityTag = job.item?.tags?.find(
					(tag) => tag.descriptor?.code === 'eligibility',
				);
				if (!eligibilityTag) return null;

				const eligibility = eligibilityTag.list.map((item) => {
					let valueObj;
					try {
						valueObj = JSON.parse(item.value);
					} catch {
						valueObj = {};
					}
					let criteria = valueObj.criteria;
					if (Array.isArray(criteria)) {
						criteria = criteria[0];
					}
					return {
						id: valueObj.id,
						type: 'userProfile',
						description: valueObj.description,
						criteria: criteria
							? {
									name: criteria.name,
									documentKey: criteria.documentKey,
									condition: criteria.condition,
									conditionValues: criteria.conditionValues,
								}
							: undefined,
					};
				});

				return {
					id: job.id,
					eligibility,
					eligibilityEvaluationLogic: '',
				};
			})
			.filter(Boolean);
	}

	async checkBenefitsEligibility(
		userInfo: object,
		eligibilityData: Array<any>,
		strictCheck: boolean,
	): Promise<any> {
		try {
			let eligibilityApiEnd = 'check-eligibility';
			if (strictCheck) {
				eligibilityApiEnd = 'check-eligibility?strictChecking=true';
			}
			const eligibilityApiUrl = `${this.eligibility_base_uri}/${eligibilityApiEnd}`;
			const sdkResponse = await this.httpService.axiosRef.post(
				eligibilityApiUrl,
				{
					userProfile: userInfo,
					benefitsList: eligibilityData,
				},
				{
					headers: {
						'Content-Type': 'application/json',
					},
				},
			);
			return sdkResponse.data;
		} catch (error) {
			throw new Error(`Error checking benefits eligibility: ${error.message}`);
		}
	}
}
