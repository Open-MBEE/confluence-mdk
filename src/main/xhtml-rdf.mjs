import {
	URLSearchParams,
	URL,
} from 'url';

import TurtleWriter from '@graphy/content.ttl.write';
import WikiCrawler from '../main/wiki-crawler.mjs';

import {
	H_PREFIXES,
} from '../asset/prefixes.mjs';

import {
	fetch,
} from '../util/io.mjs';

export async function xhtml_rdf(g_convert) {
	const {
		page: s_root_page,
		server: p_server_url,
		user: si_user,
		pass: s_pass,
		output: ds_out=process.stdout,
	} = g_convert;

	let p_server;
	if(!p_server_url) {
		if(/^https?:\/\//.test(s_root_page)) {
			const d_root_page = new URL(s_root_page);
			p_server = d_root_page.origin;
		}
		else {
			throw new Error('Must provide a URL to the Confluence server using the `server` option.');
		}
	}
	else {
		p_server = (new URL(p_server_url)).origin;
	}

	const p_endpoint = `${p_server}/rest/api`;

	// resolve page id using search API
	async function resolve_page_id(s_space, s_title) {
		const a_search = await fetch(`${p_endpoint}/search?`+(new URLSearchParams({
			cql: `type=page and space="${s_space}" and title="${s_title}"`,
		})), {
			method: 'GET',
			headers: {
				Authorization: `Basic ${Buffer.from(si_user+':'+s_pass).toString('base64')}`,
			},
		});

		const a_results = a_search[0].results;
		if(!a_results.length) {
			throw new Error(`No such wiki page found in space "${s_space}" with title "${s_title}"`);
		}
		else if(a_results.length > 2) {
			throw new Error(`Unable to disambiguate, multiple wiki pages returned in space "${s_space}" with title "${s_title}"`);
		}

		// set page id
		return a_results[0].content.id;
	}

	// prep page id
	let si_root;

	// page id provided
	if(/^\d+$/.test(s_root_page)) {
		si_root = s_root_page;
	}
	// full page URL
	else if(/^https?:\/\//.test(s_root_page)) {
		const d_root_page = new URL(s_root_page);
		const s_path = d_root_page.pathname;

		// viewpage
		if('/pages/viewpage.action' === s_path) {
			si_root = d_root_page.searchParams.get('pageId');
		}
		// display
		else if(s_path.startsWith('/display/')) {
			const [, s_space, s_title] = /^\/display\/([^/]+)\/(.+)$/.exec(s_path);

			si_root = await resolve_page_id(s_space, s_title);
		}
		// unknown
		else {
			throw new Error(`Unhandled URL case, not sure what to do with <${s_root_page}>`);
		}
	}
	// space/title
	else {
		const m_space_title = /^([^/]+)\/(.+)$/.exec(s_root_page);
		if(!m_space_title) {
			throw new Error(`Invalid root page qualifier '${s_root_page}'`);
		}

		const [, s_space, s_title] = m_space_title;

		si_root = await resolve_page_id(s_space, s_title);
	}

	// create crawler
	const k_crawler = new WikiCrawler({
		server: p_server,
		user: si_user,
		pass: s_pass,
	}, si_root);

	// prep serializer
	const ds_writer = new TurtleWriter({
		prefixes: H_PREFIXES,
	});

	// stdout
	ds_writer.pipe(ds_out);

	// run crawler
	const hc3_out = await k_crawler.run();

	// write result
	ds_writer.write({
		type: 'c3',
		value: hc3_out,
	});
}

