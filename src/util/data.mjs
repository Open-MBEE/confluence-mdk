
export const nonempty = (h_test, w_out) => !Object.keys(h_test).length? null: w_out;

export const nonorphans = a => a.map(k => k.data).filter(h => !!Object.keys(h).length);

export const flat_reduce = a => a.reduce((hc2_out, hc2_in) => ({
	...hc2_out,
	...hc2_in,
}), {});

export const escape_html = s => s.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');
