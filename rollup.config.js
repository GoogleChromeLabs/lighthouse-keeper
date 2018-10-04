import includePaths from 'rollup-plugin-includepaths';
import {terser} from 'rollup-plugin-terser';

export default [{
  input: './public/app.js',
  output: {
    file: 'app.min.js',
    dir: './public',
    format: 'es',
  },
  inlineDynamicImports: true,
  plugins: [
    includePaths({
      paths: ['node_modules'],
      extensions: ['.js'],
    }),
    terser(),
  ]
}];
