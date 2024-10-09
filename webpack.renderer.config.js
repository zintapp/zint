const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const deps = require("./package.json").dependencies;
module.exports = {
  devtool: false,

  /*output: {
    publicPath: "http://localhost:3000/",
  },*/
  resolve: {
    extensions: [".jsx", ".js", ".json", ".ts", ".tsx", ".css"],
  },

  module: {
    rules: [
      {
        test: /\.m?js/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
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
  plugins: [
    new ModuleFederationPlugin({
      name: "zint",
      filename: "remoteEntry.js",
      remotes: {},
      exposes: {},
      shared: {
        ...deps,
        react: {
          singleton: true,
          requiredVersion: deps.react,
        },
        "react-dom": {
          singleton: true,
          requiredVersion: deps["react-dom"],
        },
      },
    }),
  ]

};
