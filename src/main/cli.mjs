#!/usr/bin/env node
/* eslint-disable no-console, quote-props */
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import {
	xhtml_rdf,
	child_pages,
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

const epilog_sub = s_cmd => `Run \`confluence-mdk ${s_cmd} --help\` to see environment variables`;

// parse CLI args
let y_yargs = yargs(hideBin(process.argv))
	.usage('confluence-mdk <command>');

const wiki_subcommand = (_yargs, g_opt={}) => _yargs
	.positional('PAGE', {
		type: 'string',
		describe: 'URL of the page to export; or its page id; or "space/title" of page',
	})
	.options({
		server: {
			type: 'string',
			describe: 'URL to Confluence server if not using URL for PAGE; or use environment variable `CONFLUENCE_SERVER`',
		},
		...g_opt,
	})
	.epilog(epilog_sub('wiki'))
	.help();

function normalize_wiki_args(g_argv) {
	const s_root_page = g_argv.PAGE;

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

	if(!H_ENV.CONFLUENCE_TOKEN && (!H_ENV.CONFLUENCE_USER || !H_ENV.CONFLUENCE_PASS)) {
		exit('CONFLUENCE_TOKEN or (CONFLUENCE_USER, CONFLUENCE_PASS) environment variables must be set so that confluence-mdk can authenticate with the server.');
	}

	return [p_server, s_root_page];
}

// 'wiki' command
y_yargs = y_yargs.command({
	command: 'wiki <subcommand>',
	describe: 'Manipulate the Confluence Wiki',
	builder: _yargs => _yargs
		.usage('confluence-mdk wiki <subcommand>')
		.command({
			command: 'export <PAGE> [OPTIONS...]',
			describe: 'Export a set of wiki pages from Confluence as RDF',
			builder: __yargs => wiki_subcommand(__yargs
				.usage('confluence-mdk wiki export PAGE [OPTIONS...] > output_file.ttl'), {/* eslint-disable indent */
					recurse: {
						type: 'boolean',
						alias: 'r',
						describe: 'recursively export the children of this page',
					},
					concurrency: {
						type: 'number',
						alias: 'c',
						describe: 'HTTP request concurrency',
					},
				}),  /* eslint-enable indent */
			handler: wrap_handler(async(g_argv) => {
				const [p_server, s_root_page] = normalize_wiki_args(g_argv);

				await xhtml_rdf({
					page: s_root_page,
					server: p_server,
					recurse: g_argv.recurse,
					concurrency: g_argv.concurrency || 0,
				});
			}),
		})
		.command({
			command: 'child-pages <PAGE> [OPTIONS...]',
			describe: 'Print a line-delimited list of page IDs of the target\'s child pages',
			builder: __yargs => wiki_subcommand(__yargs
				.usage('confluence-mdk wiki child-pages PAGE [OPTIONS...]'), {/* eslint-disable indent */
					json: {
						type: 'boolean',
						describe: 'print the results as a JSON array',
					},
					urls: {
						type: 'boolean',
						describe: 'return the URL of each page instead of its ID',
					},
				}),  /* eslint-enable indent */
			handler: wrap_handler(async(g_argv) => {
				const [p_server, s_root_page] = normalize_wiki_args(g_argv);

				const a_pages = await child_pages({
					page: s_root_page,
					server: p_server,
					as_urls: g_argv.urls,
				});

				if(g_argv.json) {
					process.stdout.write(JSON.stringify(a_pages, null, '\t')+'\n');
				}
				else {
					process.stdout.write(a_pages.join('\n')+'\n');
				}
			}),
		})
		.epilog(`Environment variables:
			CONFLUENCE_SERVER      URL for Confluence server
			CONFLUENCE_TOKEN       Personal access token to use instead of user/pass
			CONFLUENCE_USER        Username for Confluence auth
			CONFLUENCE_PASS        Password for Confluence auth
		`.replace(/\n[ \t]+/g, '\n  '))
		.help().version(false),
});


const G_OPTIONS_IMPORT = {
	prefix: {
		type: 'string',
		describe: 'S3 object key prefix, e.g., "confluence/rdf/"',
	},
	graph: {
		type: 'string',
		describe: 'IRI for the named graph to load into. leave empty to load into the default graph',
	},
	region: {
		type: 'string',
		describe: 'AWS region of the S3 bucket and Neptune cluster (they must be in the same region). defaults to `AWS_REGION` env var otherwise',
	},
	bucket: {
		type: 'string',
		describe: 'the AWS `s3://...` bucket URI. defaults to `NEPTUNE_S3_BUCKET_URL` env var otherwise',
	},
	'sparql-endpoint': {
		type: 'string',
		describe: 'the public URL to the SPARQL endpoint exposed by the Neptune cluster. defaults to `SPARQL_ENDPOINT` env var otherwise',
	},
	'neptune-s3-iam-role-arn': {
		type: 'string',
		describe: 'the ARN for an IAM role to be assumed by Neptune instance for access to S3 bucket. defaults to `NEPTUNE_S3_IAM_ROLE_ARN` env var otherwise',
	},
};

const S_EPILOG_IMPORT = `Environment variables:
	SPARQL_ENDPOINT          URL to Neptune SPARQL endpoint
	SPARQL_PROXY             URL to use for proxying requests to SPARQL endpoint, e.g., socks5://127.0.0.1:3032
	NEPTUNE_S3_BUCKET_URL    AWS URL to the S3 bucket to use for bulk loading into Neptune, e.g., s3://bucket-name
	NEPTUNE_S3_IAM_ROLE_ARN  AWS IAM role associated with loading data into Neptune from S3 (NeptuneLoadFromS3)
	AWS_REGION               AWS region the instance exists in, e.g., us-gov-west-1
	AWS_ACCESS_KEY_ID        AWS access key ID
	AWS_SECRET_ACCESS_KEY    AWS secret access key
`.replace(/\n[ \t]+/g, '\n  ');


// `s3` command
y_yargs = y_yargs.command({
	command: 's3 <subcommand>',
	describe: 'Control a remote S3 Bucket',
	builder: _yargs => _yargs
		.usage('confluence-mdk s3 <subcommand>')
		.command({
			command: 'upload-data',
			describe: 'Uploads the Turtle file on stdin to the configured S3 bucket (overwriting the existing object)',
			builder: __yargs => __yargs
				.usage('confluence-mdk s3 upload-data [OPTIONS...]')
				.options(G_OPTIONS_IMPORT)
				.help().epilog(epilog_sub('s3')),
			handler: wrap_handler(async(g_argv) => {
				const k_s3 = new S3(g_argv);

				const g_upload = await k_s3.upload_stream(process.stdin, g_argv.prefix || '');

				console.dir(g_upload);
			}),
		})
		.command({
			command: 'upload-ontology',
			describe: 'Uploads the static (prebuilt) ontology to the configured S3 bucket (overwriting the existing object)',
			builder: __yargs => __yargs
				.usage('confluence-mdk s3 upload-ontology [OPTIONS...]')
				.options(G_OPTIONS_IMPORT)
				.help().epilog(epilog_sub('s3')),
			handler: wrap_handler(async(g_argv) => {
				const k_s3 = new S3(g_argv);

				const g_upload = await k_s3.upload_ontology(g_argv.prefix || '');

				console.dir(g_upload);
			}),
		})
		.epilog(S_EPILOG_IMPORT)
		.help().version(false),
});


function normalize_neptune_args(g_argv) {
	if(g_argv.sparqlEndpoint) g_argv.sparql_endpoint = g_argv.sparqlEndpoint;
	if(g_argv.neptuneS3IamRoleArn) g_argv.neptune_s3_iam_role_arn = g_argv.g_argv.neptuneS3IamRoleArn;
}

// `neptune` command
y_yargs = y_yargs.command({
	command: 'neptune <subcommand>',
	describe: 'Control a remote AWS Neptune triplestore',
	builder: _yargs => _yargs
		.usage('confluence-mdk neptune <subcommand>')
		.command({
			command: 'clear',
			describe: 'Clears the given named graph',
			builder: __yargs => __yargs
				.usage('confluence-mdk neptune clear [OPTIONS...]')
				.options(G_OPTIONS_IMPORT)
				.help().epilog(epilog_sub('neptune')),
			handler: wrap_handler(async(g_argv) => {
				normalize_neptune_args(g_argv);

				const k_neptune = new NeptuneLoader(g_argv);

				const g_clear = await k_neptune.clear(g_argv.graph);

				console.dir(g_clear);
			}),
		})
		.command({
			command: 'load',
			describe: 'Bulk loads the ontology and data from S3 into the given named graph',
			builder: __yargs => __yargs
				.usage('confluence-mdk neptune load [OPTIONS...]')
				.options(G_OPTIONS_IMPORT)
				.help().epilog(epilog_sub('neptune')),
			handler: wrap_handler(async(g_argv) => {
				normalize_neptune_args(g_argv);

				const k_neptune = new NeptuneLoader(g_argv);

				const g_load = await k_neptune.load_from_s3({
					prefix: g_argv.prefix || '',
					graph: g_argv.graph,
				});

				console.dir(g_load);
			}),
		})
		.epilog(S_EPILOG_IMPORT)
		.help().version(false),
});


// `neptune` command
y_yargs = y_yargs.command({
	command: 'import',
	describe: 'Import an exported dataset into a Neptune database (composition of `s3` and `neptune` commands above)',
	builder: _yargs => _yargs
		.command({
			command: 'import',
			describe: 'Uploads the ontology and the Turtle file on stdin to the configured S3 bucket (overwriting existing objects), clears the given named graph, then bulk loads the data from S3 into the default graph',
			builder: __yargs => __yargs
				.usage('confluence-mdk neptune import [OPTIONS...]')
				.options(G_OPTIONS_IMPORT)
				.help(),
			handler: wrap_handler(async(g_argv) => {
				if(g_argv.sparqlEndpoint) g_argv.sparql_endpoint = g_argv.sparqlEndpoint;
				if(g_argv.neptuneS3IamRoleArn) g_argv.neptune_s3_iam_role_arn = g_argv.g_argv.neptuneS3IamRoleArn;

				const s_s3_prefix = g_argv.prefix || '';

				const k_s3 = new S3(g_argv);

				await Promise.all([
					k_s3.upload_ontology(s_s3_prefix),
					k_s3.upload_stream(process.stdin, s_s3_prefix),
				]);

				const k_neptune = new NeptuneLoader(g_argv);

				const g_clear = await k_neptune.clear(g_argv.graph);

				console.dir(g_clear);

				const g_load = await k_neptune.load_from_s3({
					prefix: s_s3_prefix,
					graph: g_argv.graph,
				});

				console.dir(g_load);
			}),
		})
		.epilog(S_EPILOG_IMPORT)
		.help().version(false),
});


y_yargs.demandCommand(1, 1)  // eslint-disable-line no-unused-expressions
	.help()
	.argv;
