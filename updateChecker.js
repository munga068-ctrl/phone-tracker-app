// Since this app is sideloaded (no Play Store), there's no built-in update
// mechanism. This checks the GitHub Releases API for this repo and compares
// the latest published tag against the version baked into this build
// (app.json's "version", read at runtime via expo-constants).
//
// For this to actually find anything, every new build needs a matching
// GitHub Release: tag it "vX.Y.Z" (matching the "version" you bump in
// app.json) and attach the built .apk as a release asset. See README.md.
import Constants from "expo-constants";

const REPO = "munga068-ctrl/phone-tracker-app";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

function getInstalledVersion() {
  return Constants.expoConfig?.version || "0.0.0";
}

// Simple numeric semver-style compare — good enough for "X.Y.Z" tags.
// Returns true if `latest` is strictly newer than `current`.
function isNewer(latest, current) {
  const a = latest.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

// Returns null if no update is available (or the check failed — e.g. no
// network, or no release has been published yet), otherwise
// { latestVersion, downloadUrl, releaseUrl }.
export async function checkForUpdate() {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null; // e.g. 404 if no releases exist yet — not an error worth surfacing
    const release = await res.json();

    const latestVersion = release.tag_name;
    if (!latestVersion) return null;

    const installed = getInstalledVersion();
    if (!isNewer(latestVersion, installed)) return null;

    const apkAsset = (release.assets || []).find((a) => a.name.endsWith(".apk"));
    const downloadUrl = apkAsset ? apkAsset.browser_download_url : release.html_url;

    return {
      latestVersion,
      downloadUrl,
      releaseUrl: release.html_url,
    };
  } catch (e) {
    return null; // offline, rate-limited, etc. — silently skip, try again next launch
  }
}

export { getInstalledVersion };
