#!/usr/bin/env node
/* eslint-disable no-console, quote-props */
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import {
	xhtml_rdf,
} from '../main/xhtml-rdf.mjs';


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

// 'sync' command
y_yargs = y_yargs.command({
	command: 'export <ROOT_CONFLUENCE_WIKI_PAGE>',
	describe: 'Export a set of wiki pages from Confluence as RDF',
	builder: _yargs => _yargs
		.usage('confluence-mdk export ROOT_CONFLUENCE_WIKI_PAGE OPTIONS... > output_file.ttl')
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

y_yargs.demandCommand(1, 1)  // eslint-disable-line no-unused-expressions
	.help()
	.epilog(`Environment Variables:
		CONFLUENCE_SERVER      URL for Confluence server
		CONFLUENCE_USER        Username for Confluence auth
		CONFLUENCE_PASS        Password for Confluence auth
	`.replace(/\n[ \t]+/g, '\n  '))
	.argv;
