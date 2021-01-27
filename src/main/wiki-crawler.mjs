import {
	URLSearchParams,
} from 'url';

import xml2js from 'xml2js';

import {
	Document,
} from '../model/document.mjs';

import {
	fetch,
} from '../util/io.mjs';

import {
	AsyncLockPool,
} from '../util/async-lock-pool.mjs';

const sleep = xt_wait => new Promise((fk_resolve) => {
	setTimeout(fk_resolve, xt_wait);
});

export default class WikiCrawler {
	static auth(gc_crawler) {
		if(gc_crawler.token || process.env.CONFLUENCE_TOKEN) {
			return `Bearer ${gc_crawler.token || process.env.CONFLUENCE_TOKEN}`;
		}
		else if(gc_crawler.user && gc_crawler.pass) {
			return `Basic ${Buffer.from(gc_crawler.user+':'+gc_crawler.pass).toString('base64')}`;
		}
		else if(process.env.CONFLUENCE_USER && process.env.CONFLUENCE_PASS) {
			return `Basic ${Buffer.from(process.env.CONFLUENCE_USER+':'+process.env.CONFLUENCE_PASS).toString('base64')}`;
		}
		else {
			throw new Error(`No credentials were supplied for Confluence`);
		}
	}

	constructor(gc_crawler, si_root) {
		this._gc_crawler = gc_crawler;
		this._p_server = gc_crawler.server;
		this._si_root = si_root;
		this._s_auth = WikiCrawler.auth(gc_crawler);
		this._gc_req_get = {
			method: 'GET',
			headers: {
				Authorization: this._s_auth,
			},
		};
		this._b_recurse = gc_crawler.recurse;

		this._hc3_out = {};
		this._k_locks = new AsyncLockPool(16);
	}

	async _fetch(...a_args) {
		const f_release = await this._k_locks.acquire();
		const w_data = (await fetch(...a_args))[0];
		f_release();
		return w_data;
	}

	async _convert(si_page) {
		console.warn(`fetching ${si_page}...`);

		// fetch page content
		const g_content = await this._fetch(`${this._p_server}/rest/api/content/${si_page}?`+(new URLSearchParams({
			expand: 'body.storage',
		})), this._gc_req_get);

		// wrap xhtml with root elemnent for parser
		const s_xml = `<page src="${si_page}">${g_content.body.storage.value}</page>`;

		// parse document
		return await new Promise((fk_resolve, fe_reject) => {
			(new xml2js.Parser({
				attrkey: '$attrs',
				charkey: '$text',
				childkey: '$children',
				normalizeTags: true,
				explicitRoot: false,
				explicitArray: true,
				explicitChildren: true,
				preserveChildrenOrder: true,
				charsAsChildren: true,
			})).parseString(s_xml, (e_parse, g_document) => {
				// escape error catching of xml library
				queueMicrotask(() => {
					// xml parsing error
					if(e_parse) {
						return fe_reject(new Error(`While trying to parse XML document...${e_parse.stack}\n Input document: '''${s_xml}'''`));
					}

					// prep transform
					const k_document = new Document(g_document);

					// apply transform
					const sv1_document = `>${this._p_server}/pages/viewpage.action?pageId=${si_page}`;
					this._hc3_out[sv1_document] = {
						a: ':Document',
						':title': '"'+g_content.title,
						'dc:title': '"'+g_content.title,
						':content': [k_document.transform()],
					};
					fk_resolve(sv1_document);
				});
			});
		});
	}

	async run() {
		if(this._b_recurse) {
			await this._recurse(this._si_root);
		}
		else {
			await this._convert(this._si_root);
		}
		return this._hc3_out;
	}

	async _children(si_parent) {
		// query for all children
		const g_search = await this._fetch(`${this._p_server}/rest/api/search?`+(new URLSearchParams({
			cql: `type=page and parent=${si_parent}`,
			limit: 1000,
		})), this._gc_req_get);

		return g_search.results.map(g => g.content.id);
	}

	async child_pages(si_parent) {
		return (await this._children(si_parent)).map(si_page => `${this._p_server}/pages/viewpage.action?pageId=${si_page}`);
	}

	async _recurse(si_parent) {
		const hc3_out = this._hc3_out;

		// convert root
		const sv1_parent = await this._convert(si_parent);

		// fetch children
		const a_children = await this._children(si_parent);

		// set child relationships
		hc3_out[sv1_parent][':childDocument'] = await Promise.all(a_children.map(async(si_child, i_result) => {
			// stagger requests
			await sleep(i_result * 50);

			// convert document
			const sv1_document = await this._recurse(si_child);

			// parent relatioonship
			hc3_out[sv1_document][':parentDocument'] = sv1_parent;

			// append document child
			return sv1_document;
		}));

		// return c3 outptut
		return sv1_parent;
	}
}
