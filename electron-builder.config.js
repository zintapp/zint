module.exports = async function () {

  const arch = process.env.BUILD_ARCH

  return {
    appId: "app.zint.Zint",
    extraMetadata: {
      main: ".webpack/main/index.js",
    },
    mac: {
      target: [
        {
          target: "default",
          arch: [arch],
        },
      ],
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