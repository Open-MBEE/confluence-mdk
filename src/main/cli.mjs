#!/usr/bin/env node
/* eslint-disable no-console, quote-props */
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import {
	xhtml_rdf,
} from '../main/xhtml-rdf.mjs';

import {
	S3,
	NeptuneLoader,
} from '../util/neptune.mjs';

// intercept yargs error handling
function wrap_handler(f_handler) {
	return async(...a_args) => {
		try {
			await f_handler(...a_args);
		}
		catch(e_run) {
			console.error(e_run);
			process.exit(1);
		}
	};
}


function exit(s_msg, nc_exit=1) {
	console.error(s_msg);
	process.exit(nc_exit);
}

const H_ENV = process.env;

// parse CLI args
let y_yargs = yargs(hideBin(process.argv))
	.usage('confluence-mdk <command>');

// 'export' command
y_yargs = y_yargs.command({
	command: 'export <ROOT_CONFLUENCE_WIKI_PAGE>',
	describe: 'Export a set of wiki pages from Confluence as RDF',
	builder: _yargs => _yargs
		.usage('confluence-mdk export ROOT_CONFLUENCE_WIKI_PAGE [OPTIONS...] > output_file.ttl')
		.positional('ROOT_CONFLUENCE_WIKI_PAGE', {
			type: 'string',
			describe: 'URL of the top root page to export; or its page id; or "space/title" of page',
		})
		.options({
			server: {
				type: 'string',
				describe: 'URL to Confluence server; or use environment variable CONFLUENCE_SERVER',
			},
		})
		.help().version(false),
	handler: wrap_handler(async(g_argv) => {
		const s_root_page = g_argv.ROOT_CONFLUENCE_WIKI_PAGE;

		let p_server = g_argv.server || H_ENV.CONFLUENCE_SERVER;
		if(!p_server) {
			if(/^https?:\/\//.test(s_root_page)) {
				const d_root_page = new URL(s_root_page);
				p_server = d_root_page.origin;
			}
			else {
				exit('Must provide a URL to the Confluence server as environment variable CONFLUENCE_SERVER or using --server option.');
			}
		}

		if(!H_ENV.CONFLUENCE_USER || !H_ENV.CONFLUENCE_PASS) {
			exit('Both CONFLUENCE_USER and CONFLUENCE_PASS environment variables must be set so that confluence-mdk can authenticate with the server.');
		}

		await xhtml_rdf({
			page: s_root_page,
			server: p_server,
			user: H_ENV.CONFLUENCE_USER,
			pass: H_ENV.CONFLUENCE_PASS,
		});
	}),
});


// `entail` command
y_yargs = y_yargs.command({
	command: 'entail',
	describe: 'Generate entailments for a given dataset using the OpenMBEE confluence-mdk ontology',
	builder: _yargs => _yargs
		.usage('confluence-mdk entail [OPTIONS...] < input_file.ttl')
		.options({

		})
		.help(),
	handler: wrap_handler(async(g_argv) => {
		
	}),
});


// `neptune` command
y_yargs = y_yargs.command({
	command: 'neptune',
	describe: 'Control a remote AWS Neptune triplestore',
	builder: _yargs => _yargs
		.usage('confluence-mdk neptune <subcommand>')
		// .command({
		// 	command: 'clear',
		// 	describe: 'Clear the default graph',
		// 	builder: __yargs => __yargs
		// 		.usage('confluence-mdk neptune clear')
		// 		.help(),
		// 	handler: wrap_handler(async(g_argv) => {
		// 		console.log('neptune clear');
		// 	}),
		// })
		// .command({
		// 	command: 'upload',
		// 	describe: 'Uploads the Turtle file on stdin to the configured S3 bucket',
		// 	builder: __yargs => __yargs
		// 		.usage('confluence-mdk neptune upload')
		// 		.help(),
		// 	handler: wrap_handler(async(g_argv) => {
		// 		console.log('neptune upload');
		// 	}),
		// })
		// .command({
		// 	command: 'upsert',
		// 	describe: 'Upserts the Turtle files uploaded to the configured S3 bucket into the Neptune instance',
		// 	builder: __yargs => __yargs
		// 		.usage('confluence-mdk neptune upload')
		// 		.help(),
		// 	handler: wrap_handler(async(g_argv) => {
		// 		console.log('neptune upload');
		// 	}),
		// })
		.command({
			command: 'import',
			describe: 'Uploads the ontology and the Turtle file on stdin to the configured S3 bucket (overwriting existing objects), clears the default graph, then bulk loads the data from S3 into the default graph',
			build: __yargs => __yargs
				.usage('confluence-mdk neptune import')
				.options({
					prefix: {
						type: 'string',
						describe: 'S3 object key prefix, e.g., "confluence/rdf/"',
					},
					graph: {
						type: 'string',
						describe: 'IRI for the named graph to load into. leave empty to load into the default graph',
					},
				})
				.help(),
			handler: wrap_handler(async(g_argv) => {
				const s_s3_prefix = g_argv.prefix || '';

				const k_s3 = new S3();

				await k_s3.upload_stdin(s_s3_prefix);

				const k_neptune = new NeptuneLoader();

				const g_clear = await k_neptune.clear(g_argv.graph);

				console.dir(g_clear);

				const g_load = await k_neptune.load_from_s3({
					prefix: s_s3_prefix,
					graph: g_argv.graph,
				});

				console.dir(g_load);
			}),
		})
		.epilog(`Environment Variables:
			SPARQL_ENDPOINT          URL to Neptune SPARQL endpoint
			SPARQL_PROXY             URL to use for proxying requests to SPARQL endpoint, e.g., socks5://127.0.0.1:3032
			NEPTUNE_REGION           AWS region the instance exists in, e.g., us-gov-west-1
			NEPTUNE_S3_BUCKET_URL    AWS URL to the S3 bucket to use for bulk loading into Neptune, e.g., s3://bucket-name
			NEPTUNE_S3_IAM_ROLE_ARN  AWS IAM role associated with loading data into Neptune from S3 (NeptuneLoadFromS3)
			AWS_ACCESS_KEY_ID        AWS access key ID
			AWS_SECRET_ACCESS_KEY    AWS secret access key
		`.replace(/\n[ \t]+/g, '\n  '))
		.help().version(false),
	// handler: wrap_handler(async(g_argv) => {
		
	// }),
});


y_yargs.demandCommand(1, 1)  // eslint-disable-line no-unused-expressions
	.help()
	.epilog(`Environment Variables:
		CONFLUENCE_SERVER      URL for Confluence server
		CONFLUENCE_USER        Username for Confluence auth
		CONFLUENCE_PASS        Password for Confluence auth
	`.replace(/\n[ \t]+/g, '\n  '))
	.argv;
