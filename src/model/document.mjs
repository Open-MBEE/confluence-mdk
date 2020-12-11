import {
	H_CTM_ROOT,
} from '../main/mappings.mjs';

import {
	nonorphans,
	escape_html,
} from '../util/data.mjs';


function flatten(g_src) {
	const {
		$children: a_children,
		$attrs: h_attrs,
		'#name': s_tag,
	} = g_src;

	let s_inner = '';

	// element has children
	if(a_children) {
		for(const g_child of a_children) {
			s_inner += flatten(g_child);
		}
	}
	// no children, but yes text
	else if('__text__' === s_tag) {
		return escape_html(g_src.$text);
	}

	return `<${s_tag}>${s_inner}</${s_tag}>`;
}


class Node {
	constructor(g_src) {
		this._g_src = g_src;

		this._hc2_data = {};
		this._a_collect = [];
		this._i_series = 0;
	}

	get data() {
		return this._hc2_data;
	}

	set data(hc2_assign) {
		this._hc2_data = hc2_assign || {};
	}

	get source() {
		return this._g_src;
	}

	get tag() {
		return this._g_src['#name'];
	}

	get attrs() {
		return this._g_src.$attrs || {};
	}


	merge(hc2_merge) {
		if(!hc2_merge) return;

		const hc2_data = this._hc2_data;

		for(const si_key in hc2_merge) {
			if(si_key in hc2_data) {
				const z_datum = hc2_data[si_key];
				let a_data = z_datum;
				if(!Array.isArray(z_datum)) {
					a_data = hc2_data[si_key] = [z_datum];
				}

				const z_merge = hc2_merge[si_key];
				if(Array.isArray(z_merge)) {
					a_data.push(...z_merge);
				}
				else {
					a_data.push(z_merge);
				}
			}
			else {
				hc2_data[si_key] = hc2_merge[si_key];
			}
		}
	}
}


export class Document {
	constructor(g_document) {
		this._a_stack = [];
		this._g_desc = {
			children: H_CTM_ROOT,
		};
		this._k_node = new Node(g_document);
	}


	_expected() {
		const g_desc = this._g_desc;
		const k_node = this._k_node;

		// children key
		if(g_desc.children) {
			return g_desc.children;
		}
		// series (ordered children)
		else if(g_desc.series) {
			// ref series entries
			const a_series = Object.entries(g_desc.series);

			// ref index
			const i_series = k_node._i_series;

			// ref entry pair
			const a_pair = a_series[i_series];

			// modulo
			k_node._i_series = (i_series+1) % a_series.length;

			// return expected
			return {
				[a_pair[0]]: a_pair[1],
			};
		}
		// automatic (use root context mapping)
		else if(g_desc.auto || g_desc.collect || g_desc.flatten) {
			return H_CTM_ROOT;
		}

		// nothing
		debugger;
		console.warn(`Mapping descriptor has no handler for routing child elements`);
		return {};
	}


	transform() {
		this.consume(this._k_node.source);

		return nonorphans(this._k_node._a_collect);
	}

	consume(g_element) {
		const {
			_g_desc: g_desc,
			_k_node: k_node,
		} = this;

		// raw bypass
		if(g_desc.raw) return k_node.merge(g_desc.raw(g_element));

		// destructure element
		const {
			$children: a_children,
			$attrs: h_attrs,
			'#name': s_tag,
		} = g_element;

		// descriptor has enter
		if(g_desc.enter) {
			return k_node.merge(g_desc.enter(h_attrs || {}));
		}

		// only a single text node
		let s_text_simple = null;
		if(a_children && 1 === a_children.length && '__text__' === a_children[0]['#name']) {
			s_text_simple = escape_html(a_children[0].$text);
		}

		// has simple text
		if(s_text_simple) {
			// descriptor defines text handling
			if(g_desc.text) {
				return k_node.merge(g_desc.text(s_text_simple));
			}
			// otherwise, merge
			else {
				return k_node.merge({
					':text': '"'+s_text_simple,
				});
			}
		}

		// element has children
		if(a_children) {
			// flatten
			if(g_desc.flatten) {
				let s_inner = '';
				for(const g_child of a_children) {
					s_inner += flatten(g_child);
				}

				// final text
				const s_text = g_desc.flatten(s_inner);

				// save to parent
				this._a_stack[this._a_stack.length-1].k_node.merge({
					':text': '"'+s_text,
				});

				return;
			}

			// each child
			for(let i_child=0, nl_children=a_children.length; i_child<nl_children; i_child++) {
				const g_child = a_children[i_child];

				// ref tag
				const s_tag_child = g_child['#name'];

				// normalize children map
				const h_expected = this._expected();

				// child is in map
				if(s_tag_child in h_expected) {
					// descend into child
					this.descend(h_expected[s_tag_child], g_child);

					// consume it
					this.consume(g_child);

					// ascend out
					this.ascend();
				}
				// unmapped
				else {
					console.warn(`unmapped tag '${s_tag_child}'`);
					debugger;
				}
			}
		}
	}


	descend(g_desc, g_src) {
		// push state to stack
		this._a_stack.push({
			g_desc: this._g_desc,
			k_node: this._k_node,
		});

		// descend deeper into tree, making new state
		this._g_desc = g_desc;
		this._k_node = new Node(g_src);
	}


	ascend() {
		const {
			_g_desc: g_desc,
			_k_node: k_node,
		} = this;

		// auto merge
		if(g_desc.auto) {
			// collect children
			if(k_node._a_collect.length) {
				const a_body = nonorphans(k_node._a_collect);
				if(a_body.length) k_node._hc2_data[':body'] = [a_body];
			}

			// override merge
			k_node.data = g_desc.auto(k_node.data, k_node.attrs);
		}

		// node has exit handler
		if(g_desc.exit) g_desc.exit(k_node.attrs);

		// descriptor has collector
		if(g_desc.collect) {
			k_node.data = g_desc.collect(nonorphans(k_node._a_collect));
		}

		// pop state from stack
		({
			g_desc: this._g_desc,
			k_node: this._k_node,
		} = this._a_stack.pop());

		// push node to collection
		this._k_node._a_collect.push(k_node);
	}
}
