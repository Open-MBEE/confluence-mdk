import fs from 'fs';
import url from 'url';
import https from 'https';
import path from 'path';

import aws from 'aws-sdk';
import SocksProxyAgent from 'socks-proxy-agent';

import {
	env,
	fetch,
	upload,
} from '../util/io.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export class S3 {
	constructor(gc_aws) {
		this._gc_aws = gc_aws;

		this._y_s3 = new aws.S3({
			apiVersion: '2006-03-01',
			region: gc_aws.region || env('AWS_REGION', 'NEPTUNE_REGION'),
			accessKeyId: env('AWS_ACCESS_KEY_ID'),
			secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
		});
	}

	_upload(ds_upload, s_label) {
		return this._y_s3.upload({
			Bucket: url.parse(this._gc_aws.bucket || env('NEPTUNE_S3_BUCKET_URL')).hostname,
			Key: s_label,
			Body: ds_upload,
		}).promise();
	}

	upload_ontology(s_prefix='') {
		return this._upload(fs.createReadStream(path.join(__dirname, '../asset/ontology.ttl')), `${s_prefix}ontology.ttl`);
	}

	upload_stream(ds_upload, s_prefix='') {
		return this._upload(ds_upload, `${s_prefix}data.ttl`);
	}
}

export class NeptuneLoader {
	constructor(gc_aws) {
		this._gc_aws = gc_aws;
		this._p_endpoint = (gc_aws.sparql_endpoint || env('SPARQL_ENDPOINT')).replace(/\/$/, '');
		this._s_region = gc_aws.region || env('AWS_REGION', 'NEPTUNE_REGION');

		const p_proxy = process.env.SPARQL_PROXY;
		this._d_agent = p_proxy? new SocksProxyAgent(p_proxy): https.globalAgent;
	}

	async clear(p_graph='') {
		const s_query = `clear silent ${p_graph
			? `graph <${p_graph}>`
			: 'all'
		}`;

		console.warn(`Submitting SPARQL query: '''\n${s_query}\n''' to <${this._p_endpoint}>`);

		return await upload(new URLSearchParams({
			update: s_query,
		})+'', `${this._p_endpoint}/sparql`, {
			method: 'POST',
			agent: this._d_agent,
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
			},
		});
	}


	async check_job_status(si_job) {
		let a_body = await fetch(`${this._p_endpoint}/loader/${si_job}?${new URLSearchParams({
			details: true,
			errors: true,
		})}`, {
			method: 'GET',
			agent: this._d_agent,
		});

		// depending on the status string
		let s_status = a_body[0].payload.overallStatus.status;
		switch(s_status) {
			// loading hasn't started or is still in progress
			case 'LOAD_NOT_STARTED':
			case 'LOAD_IN_PROGRESS': {
				console.warn(`${s_status}...`);

				// check again
				return await new Promise((fk_checked) => {
					setTimeout(async() => {
						fk_checked(await this.check_job_status(si_job));
					}, 500);
				});
			}

			// load successfully completed
			case 'LOAD_COMPLETED': {
				return a_body[0].payload;
			}

			default: {
				debugger;
				throw new Error(`Neptune reported an error while trying to load data from the S3 bucket: ${s_status};\n${JSON.stringify(g_body)}`);
			}
		}
	}

	async load_from_s3({
		prefix: s_prefix,
		graph: p_graph=null,
	}) {
		const p_source = `${(this._gc_aws.bucket || env('NEPTUNE_S3_BUCKET_URL')).replace(/\/$/, '')}/${s_prefix}`;

		// 
		console.warn(`initiating neptune load from s3 bucket...`);

		// instruct Neptune instance to load all files from the S3 bucket
		let a_body = await upload({
			source: p_source,
			format: 'turtle',  // AWS should really change this to the correct MIME type: text/turtle
			iamRoleArn: this._gc_aws.neptune_s3_iam_role_arn || env('NEPTUNE_S3_IAM_ROLE_ARN'),
			region: this._s_region,
			failOnError: 'TRUE',
			...(p_graph
				? {
					parserConfiguration: {
						namedGraphUri: p_graph,
					},
				}
				: {}),
		}, `${this._p_endpoint}/loader`, {
			method: 'POST',
			agent: this._d_agent,
			headers: {
				'content-type': 'application/json',
			},
		});

		//
		console.warn(`loading '${p_source}' from s3 bucket${p_graph? ` into ${p_graph}`: ''}...`);

		// fetch job id
		let si_job = a_body[0].payload.loadId;

		// start polling job
		return await this.check_job_status(si_job);
	}
}
