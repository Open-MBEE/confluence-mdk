
import {
	xhtml_rdf,
} from '../main/xhtml-rdf.mjs';

import {
	S3,
	NeptuneLoader,
} from '../util/neptune.mjs';

export async function confluenceExport(gc_export) {
	return await xhtml_rdf(gc_export);
}

export async function neptuneImport(gc_import) {
	const s_s3_prefix = gc_import.prefix || '';

	const k_s3 = new S3();

	await Promise.all([
		k_s3.upload_ontology(s_s3_prefix),
		k_s3.upload_ontology(gc_import.input, s_s3_prefix),
	]);

	const k_neptune = new NeptuneLoader();

	const g_clear = await k_neptune.clear(gc_import.graph);

	const g_load = await k_neptune.load_from_s3({
		prefix: s_s3_prefix,
		graph: gc_import.graph,
	});

	return {
		clear: g_clear,
		load: g_load,
	};
}
