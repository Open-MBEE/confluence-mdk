import factory from '@graphy/core.data.factory';
import {
	nonempty,
	flat_reduce,
	escape_html,
} from '../util/data.mjs';


const things = (h_data, h_mapping, f_map) => {
	const h_out = {};
	for(const [sc1_pred, si_key] of Object.entries(h_mapping)) {
		if(si_key in h_data) {
			h_out[sc1_pred] = f_map(h_data[si_key]);
		}
	}
	return h_out;
};

const literals = (h_data, h_mapping) => things(h_data, h_mapping, s => '"'+s);

const attrs_to_c2 = h_attrs => Object.entries(h_attrs)
	.reduce((hc2_out, [si_key, s_value]) => ({
		...hc2_out,
		[si_key]: '"'+s_value,
	}), {});

const H_CTM_FORMATTING = {
	b: {
		flatten: s => `<b>${s}</b>`,
	},
	i: {
		flatten: s => `<i>${s}</i>`,
	},
	em: {
		flatten: s => `<em>${s}</em>`,
	},
	strong: {
		flatten: s => `<strong>${s}</strong>`,
	},
	sup: {
		flatten: s => `<sup>${s}</sup>`,
	},
	sub: {
		flatten: s => `<sub>${s}</sub>`,
	},
	br: {
		flatten: () => `<br/>`,
	},

	span: {
		flatten: s => s,
	},
};

const H_CONTENT_TAGS = {
	h1: 'Heading1',
	h2: 'Heading2',
	h3: 'Heading3',
	h4: 'Heading4',
	h5: 'Heading5',
	h6: 'Heading6',
	li: 'ListItem',
	blockquote: 'BlockQuote',
};

export const H_CTM_ROOT = {
	...H_CTM_FORMATTING,

	...Object.entries(H_CONTENT_TAGS).reduce((h_out, [si_key, s_name]) => ({
		...h_out,
		[si_key]: {
			auto: hc2_content => ({
				a: ':'+s_name,
				...hc2_content,
			}),
		},
	}), {}),

	__text__: {
		raw: g_element => ({
			a: ':TextNode',
			':text': '"'+g_element.$text,
		}),
	},

	p: {
		auto: (hc2_content, h_attrs) => nonempty(hc2_content, {
			a: ':Paragraph',
			...hc2_content,
		}),
	},

	div: {
		auto: (hc2_content, h_attrs) => nonempty(hc2_content, {
			a: ':Container',
			...hc2_content,
		}),
	},

	a: {
		auto: (hc2_content, h_attrs) => ({
			a: ':ExternalLink',
			':href': '^xsd:anyURI"'+(h_attrs.href || ''),
			...(h_attrs.href && !h_attrs.href.includes(' ')? {':hrefLinked':'>'+h_attrs.href}: {}),
			...hc2_content,
		}),
	},

	ul: {
		collect: a_items => ({
			a: ':UnorderedList',
			':items': [a_items],
		}),
	},

	table: {
		children: {
			colgroup: {
				raw: y_elmt => ({
					':columnLength': y_elmt.$children.length,
				}),
			},
			tbody: {
				children: {
					tr: {
						children: {
							th: {
								auto: hc2_content => ({
									a: ':HeaderCell',
									...hc2_content,
								}),
							},

							td: {
								auto: hc2_content => ({
									a: ':DataCell',
									...hc2_content,
								}),
							},
						},

						collect: a_tds => ({
							a: ':Row',
							':cells': [a_tds],
						}),
					},
				},

				collect: a_rows => ({
					':rowLength': a_rows.length,
					':rows': [a_rows],
				}),
			},
		},

		collect: a_table => ({
			a: ':Table',
			...flat_reduce(a_table),
		}),
	},

	time: {
		enter: h_attrs => ({
			a: ':Time',
			':datetime': '^xsd:date"'+h_attrs.datetime,
		}),
	},

	'ac:task-list': {
		children: {
			'ac:task': {
				series: {
					'ac:task-id': {
						text: s_id => ({
							':taskId': factory.integer(+s_id),
						}),
					},
					'ac:task-status': {
						text: s_status => ({
							':taskStatus': '_TaskStatus.'+s_status,
						}),
					},
					'ac:task-body': {
						auto: hc2_content => ({
							':taskBody': hc2_content,
						}),
					},
				},

				collect: a_task => ({
					a: ':Task',
					...a_task[0],
				}),
			},
		},

		collect: a_tasks => ({
			a: ':TaskList',
			':tasks': [a_tasks],
		}),
	},

	'ac:link': {
		children: {
			'ri:page': {
				enter: h_attrs => ({
					a: ':PageReference',
					...literals(h_attrs, {
						':ref': 'ri:content-title',
						':spaceKey': 'ri:space-key',
					}),
				}),
			},
			'ac:plain-text-link-body': {
				text: s_text => ({
					':text': '"'+escape_html(s_text),
				}),
			},
		},

		collect: flat_reduce,
	},

	'ac:structured-macro': {
		enter: h_attrs => ({
			a: ':Macro',
			...attrs_to_c2(h_attrs),
		}),

		children: {
			'ac:parameter': {
				enter: h_attrs => ({
					a: ':Parameter',
					...attrs_to_c2(h_attrs),
				}),

				text: s_text => ({
					':value': '"'+s_text,
				}),
			},

			'ac:rich-text-body': {
				auto: (hc2_content, h_attrs) => ({
					...hc2_content,
					...attrs_to_c2(h_attrs),
				}),

				text: s_text => ({
					':text': '"'+s_text,
				}),
			},

			'ac:plain-text-body': {
				text: s_text => ({
					':text': '"'+s_text,
				}),
			},
		},

		collect: (a_children) => {
			const a_params = a_children.filter(hc2 => ':Parameter' === hc2.a);
			return {
				...(a_params.length? {':parameter': a_params}: {}),
				...a_children.filter(hc2 => ':text' in hc2 || ':body' in hc2)[0],
			};
		},
	},
};
