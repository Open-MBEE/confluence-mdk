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
		this._k_locks = new AsyncLockPool(gc_crawler.concurrency || 16);
	}

	async _fetch(...a_args) {
		const f_release = await this._k_locks.acquire();
		const w_data = (await fetch(...a_args))[0];
		f_release();
		return w_data;
	}

	_url(si_page) {
		return `>${this._p_server}/pages/viewpage.action?pageId=${si_page}`;
	}

	async _convert(si_page) {
		console.warn(`fetching ${si_page}...`);

		const hc3_out = this._hc3_out;

		const sv1_document = this._url(si_page);

		// fetch children
		const a_children = await this._children(si_page);

		// fetch page content
		const g_content = await this._fetch(`${this._p_server}/rest/api/content/${si_page}?`+(new URLSearchParams({
			expand: 'body.storage',
		})), this._gc_req_get);

		// wrap xhtml with root elemnent for parser
		const s_xml = `<page src="${si_page}">${g_content.body.storage.value}</page>`;

		// parse document
		await new Promise((fk_resolve, fe_reject) => {
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

					// webui link
					const sr_webui = g_content._links.webui;

					// present
					let sv1_webui = '';
					if(sr_webui) {
						sv1_webui = `>${this._p_server}${sr_webui}`;
						hc3_out[sv1_webui] = {
							'owl:sameAs': sv1_document,
						};
					}

					// apply transform
					hc3_out[sv1_document] = {
						a: ':Document',
						':spaceKey': '"'+this._gc_crawler.space_key,
						':pageId': '"'+si_page,
						':title': '"'+g_content.title,
						'dc:title': '"'+g_content.title,
						...(sr_webui
							? {'owl:sameAs': sv1_webui}
							: {}),
						':content': [k_document.transform()],
					};

					// resolve promise
					fk_resolve();
				});
			});
		});

		// set child relationships
		hc3_out[sv1_document][':childDocument'] = a_children.map((si_child) => {
			const sv1_child = this._url(si_child);

			// parent relatioonship
			hc3_out[sv1_child] = {
				':parentDocument': sv1_document,
			};

			// append document child
			return sv1_child;
		});


		// struct
		return {
			v1_iri: sv1_document,
			children: a_children,
		};
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

	async child_pages(si_parent, b_as_urls=false) {
		const a_children = (await this._children(si_parent));
		if(b_as_urls) return a_children.map(si_page => `${this._p_server}/pages/viewpage.action?pageId=${si_page}`);
		return a_children;
	}

	async _recurse(si_parent) {
		// convert root
		const {
			v1_iri: sv1_parent,
			children: a_children,
		} = await this._convert(si_parent);

		// recurse on children
		await Promise.all(a_children.map(async(si_child, i_result) => {
			// stagger requests
			await sleep(i_result * 50);

			// convert document
			await this._recurse(si_child);
		}));

		// return c3 outptut
		return sv1_parent;
	}
}
