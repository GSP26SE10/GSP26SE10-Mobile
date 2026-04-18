module.exports = ({ config }) => {
  const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON;

  return {
    ...config,
    android: {
      ...config.android,
      // Prefer EAS file env var path on cloud builds; fallback keeps local dev working.
      googleServicesFile:
        googleServicesFromEnv || config.android?.googleServicesFile,
    },
  };
};
