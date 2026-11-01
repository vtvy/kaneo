const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            def keystore = System.getenv("KANEO_ANDROID_KEYSTORE")
            if (keystore) {
                storeFile file(keystore)
                storePassword System.getenv("KANEO_ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("KANEO_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("KANEO_ANDROID_KEY_PASSWORD")
            }
        }`;

function addReleaseSigning(gradle) {
  if (gradle.includes("KANEO_ANDROID_KEYSTORE")) return gradle;
  const withConfig = gradle.replace(
    /(signingConfigs \{\r?\n\s*debug \{[^}]*\})/,
    `$1${RELEASE_CONFIG}`,
  );
  if (withConfig === gradle) return gradle;
  return withConfig.replace(
    /(release \{\r?\n(?:\s*\/\/[^\n]*\r?\n)*\s*)signingConfig signingConfigs\.debug/,
    '$1signingConfig System.getenv("KANEO_ANDROID_KEYSTORE") ? signingConfigs.release : signingConfigs.debug',
  );
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
