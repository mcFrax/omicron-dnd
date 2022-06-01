const path = require('path');

module.exports = {
  entry: './omicron-main.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'omicron-dnd.js',
    library: 'OmicronDnd',
    path: path.resolve(__dirname),
  },
  devServer: {
    inline: false,
    contentBase: __dirname,
  },
};
