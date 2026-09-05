const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Registers a BOOT_COMPLETED receiver in the generated AndroidManifest.xml.
// It only posts a notification (see android-native/BootReceiver.kt) — it
// never tries to directly restart the location foreground service, since
// Android forbids that from a background broadcast-receiver context.
function withBootReceiverManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const alreadyAdded = mainApplication.receiver.some(
      (r) => r["$"] && r["$"]["android:name"] === ".BootReceiver"
    );

    if (!alreadyAdded) {
      mainApplication.receiver.push({
        $: {
          "android:name": ".BootReceiver",
          "android:enabled": "true",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.intent.action.BOOT_COMPLETED",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

// Copies the native Kotlin source into the generated Android project. This
// runs on every prebuild (including EAS Build's cloud prebuild step), so the
// file in android-native/ is the single source of truth — never hand-edit
// the generated copy under android/.
function withBootReceiverSource(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const packageName = config.android.package;
      const packagePath = packageName.split(".").join("/");
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java",
        packagePath
      );
      fs.mkdirSync(destDir, { recursive: true });

      const sourceFile = path.join(
        config.modRequest.projectRoot,
        "android-native/BootReceiver.kt"
      );
      const destFile = path.join(destDir, "BootReceiver.kt");
      fs.copyFileSync(sourceFile, destFile);

      return config;
    },
  ]);
}

module.exports = function withBootReceiver(config) {
  config = withBootReceiverManifest(config);
  config = withBootReceiverSource(config);
  return config;
};
