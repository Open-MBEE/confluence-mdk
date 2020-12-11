import https from 'https';
import stream from 'stream';
import util from 'util';
import chalk from 'chalk';

const cherr = chalk.stderr;

import StreamJson from '../util/stream-json.js';
const {
	JsonStreamObject,
} = StreamJson;

// simple direct https request
export const request = (p_url, gc_request) => new Promise((fk_resolve) => {
	(https.request(p_url, gc_request, fk_resolve)).end();
});

// fetch remote JSON
export function fetch(p_url, gc_request, f_connected=null) {
	let ds_req;

	const dp_exec = new Promise((fk_resolve, fe_reject) => {
		// verbose
		if(process.env.DNG_MDK_DEBUG) {
			console.warn(cherr.blue(`HTTP ${gc_request.method || 'GET'} <${p_url}> config:`));
			const h_req_print = {...gc_request};
			delete h_req_print.agent;
			console.warn(util.inspect(h_req_print, false, 1, true));
		}

		ds_req = https.request(p_url, {
			...gc_request,
			headers: {
				...gc_request.headers,
				Accept: 'application/json',
			},
		}, async(ds_res) => {
			// verbose
			if(process.env.DNG_MDK_DEBUG) {
				console.warn(cherr.yellow(`Received ${ds_res.statusCode} from endpoint w/ response headers:`));
				console.warn('\t'+cherr.grey(JSON.stringify(ds_res.headers)));
			}

			if(f_connected) {
				[fk_resolve, fe_reject] = f_connected();
			}

			const n_status = ds_res.statusCode;

			// good
			if(n_status >= 200 && n_status < 300) {
				let g_json = {};

				// load response body
				const ds_pipe = stream.pipeline([
					ds_res,
					JsonStreamObject.withParser(),
				], (e_pipe) => {
					if(e_pipe) {
						throw new Error(`Error while streaming parsing response JSON from <${p_url}>: ${e_pipe.stack}`);
					}
					else {
						fk_resolve(g_json);
					}
				});

				// response json object
				ds_pipe.on('data', ({key:si_key, value:w_value}) => {
					g_json[si_key] = w_value;
				});
			}
			// bad
			else {
				// download response body
				let s_body = '';
				for await(const s_chunk of ds_res) {
					s_body += s_chunk;
				}

				// pbscure sensitive credentials
				const gc_request_view = {...gc_request};
				const h_headers_view = gc_request_view.headers;
				if(h_headers_view?.Authorization) {
					h_headers_view.Authorization = h_headers_view.Authorization.replace(/^(Basic\s*)?.*$/, '$1*****');
				}

				return fe_reject(new Error(`Unexpected response status ${n_status} from <${p_url}> '${ds_res.statusMessage}'; response body: '''\n${s_body}\n'''. Request metadata: ${JSON.stringify(gc_request_view, null, '\t')}`));
			}
		});
	});

	if(f_connected) {
		return ds_req;
	}
	else {
		ds_req.end();
		return dp_exec;
	}
}
