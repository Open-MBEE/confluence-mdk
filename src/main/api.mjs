
import {
	xhtml_rdf,
	child_pages,
} from '../main/xhtml-rdf.mjs';

import {
	S3,
	NeptuneLoader,
} from '../util/neptune.mjs';

export async function wikiExport(gc_export) {
	return await xhtml_rdf(gc_export);
}

export async function wikiChildPages(gc_export) {
	return await child_pages(gc_export);
}


export async function s3UploadData(gc_import) {
	const k_s3 = new S3(gc_import);

	return await k_s3.upload_stream(gc_import.input, gc_import.prefix || '');
}

export async function s3UploadOntology(gc_import) {
	const k_s3 = new S3(gc_import);

	return await k_s3.upload_ontology(gc_import.prefix || '');
}

export async function neptuneClear(gc_import) {
	const k_neptune = new NeptuneLoader(gc_import);

	return await k_neptune.clear(gc_import.graph);
}

export async function neptuneLoad(gc_import) {
	const k_neptune = new NeptuneLoader(gc_import);

	return await k_neptune.load_from_s3({
		prefix: gc_import.prefix || '',
		graph: gc_import.graph,
	});
}

export async function neptuneLoadAsync(gc_import) {
	const k_neptune = new NeptuneLoader(gc_import);

	return await k_neptune.load_from_s3_async({
		prefix: gc_import.prefix || '',
		graph: gc_import.graph,
	});
}

export async function checkStatus(gc_import) {
	const k_neptune = new NeptuneLoader(gc_import);
	const s_job_id = gc_import.jobId || '';

	return k_neptune.check_job_status(s_job_id);
}


export async function runImport(gc_import) {
	const s_s3_prefix = gc_import.prefix || '';

	const k_s3 = new S3(gc_import);

	await Promise.all([
		k_s3.upload_ontology(s_s3_prefix),
		k_s3.upload_ontology(gc_import.input, s_s3_prefix),
	]);

	const k_neptune = new NeptuneLoader(gc_import);

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
