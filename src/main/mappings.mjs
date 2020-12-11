import factory from '@graphy/core.data.factory';
import {
	nonempty,
	flat_reduce,
	escape_html,
} from '../util/data.mjs';

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

	p: {
		auto: (hc2_content, h_attrs) => nonempty(hc2_content, {
			a: ':Paragraph',
			...hc2_content,
		}),
	},

	a: {
		auto: (hc2_content, h_attrs) => ({
			a: ':ExternalLink',
			':href': '^xsd:anyURI"'+(h_attrs.href || ''),
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
					':ref': '"'+h_attrs['ri:content-title'],
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
};
