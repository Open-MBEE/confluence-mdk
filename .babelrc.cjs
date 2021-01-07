module.exports = {
	plugins: [
		'@babel/plugin-transform-modules-commonjs',
		'transform-import-meta',
		['module-extension', {
			mjs: 'js',
		}],
	],
};
