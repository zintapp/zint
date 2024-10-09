const packagerConfig = {
  icon: "zinticon.icns",
  appBundleId: "app.zint.Zint",
  appCategoryType: "public.app-category.developer-tools",
  appCopyright: "Copyright © Guillaume de Cagny"
}

if (process.env.FORGE_NOTARIZE) {
  packagerConfig.osxSign = {
    "identity": process.env["APPLE_DEVELOPER_IDENTITY"],
    "gatekeeper-assess": false,
    "hardened-runtime": true,
    "entitlements": "entitlements.plist",
    "entitlements-inherit": "entitlements.plist",
    "signature-flags": "library"
  }
  packagerConfig.osxNotarize = {
        "appleId": process.env["APPLE_ID"],
        "appleIdPassword": process.env["APPLE_ID_PASSWORD"],
  }
}

module.exports = {
    packagerConfig,
    makers: [],
    hooks: {
      afterExtract: ['./build/copyExtraResources.js']
    },
    plugins: [
      {
        name: "@electron-forge/plugin-webpack",
        config: {
          devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; frame-src *; script-src * 'self' 'unsafe-eval' 'unsafe-inline' data:",
          mainConfig: "./webpack.main.config.js",
          renderer: {
            config: "./webpack.renderer.config.js",
            entryPoints: [
              {
                html: "./src/index.html",
                js: "./src/index.js",
                name: "main_window",
                preload: {
                  js: "./src/renderer/preloadcontextbridge.js"
                }
              },
              {
                html: "./src/index.html",
                js: "./src/iframe.js",
                name: "iframe"
              }
            ]
          }
        }
      }
    ]
  }