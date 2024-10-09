
module.exports = {
  devtool: false,
  entry: './src/main_process/electron-start.ts',

  resolve: {
    extensions: [".jsx", ".js", ".json", ".ts", ".tsx"],
  },

  module: {
    rules: [
      {
        test: /\.(m?js|node)$/,
        parser: { amd: false },
        use: {
          loader: '@vercel/webpack-asset-relocator-loader',
          options: {
            outputAssetBase: 'native_modules',
          },
        },
      },
      
      {
        test: /\.json$/,
        use: 'json-loader'
      },
      {
        test: /\.m?js/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(js|jsx|tsx|ts)$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.(tsx|ts)$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true
          }
        },
      },
    ],
  },

};
