module.exports = async function () {

  const arch = process.env.BUILD_ARCH

  return {
    appId: "app.zint.Zint",
    extraMetadata: {
      main: ".webpack/main/index.js",
    },
    extraResources: [
      {
        from: "extraResources",
        to: "extraResources"
      }
    ],
    files: [
      ".webpack/**/*",
      "!node_modules",
      "!**/node_modules",
      "package.json"
    ],
    directories: {
      "buildResources": "assets"
    },
    asar: true,
    asarUnpack: [
      "node_modules/node-pty/**/*"
    ],
    mac: {
      icon: "zinticon.icns",
      category: "public.app-category.developer-tools",
      target: ["dmg", "zip"],
      publish: [
        {
          provider: "s3",
          bucket: process.env.EB_S3_BUCKET,
          region: process.env.EB_S3_REGION,
          path: `app/updated/osx-notarized/${arch}`,
          endpoint: process.env.EB_S3_ENDPOINT,
        },
      ],
    },
  };
};