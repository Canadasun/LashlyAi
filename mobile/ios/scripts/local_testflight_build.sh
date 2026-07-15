#!/usr/bin/env bash
#
# Build LashlyAI locally and upload straight to TestFlight, bypassing GitHub Actions
# entirely. This is the standing path while GH Actions billing stays broken (same
# reason Pulse-Mobile moved to `eas build --local`) — not a one-off workaround.
#
# What this does, in order (mirrors .github/workflows/testflight.yml step for step,
# except signing — see below):
#   1. Validate: tsc --noEmit, eslint, jest (fail fast, same as CI).
#   2. bundle exec pod install (pinned CocoaPods version, matching CI's Gemfile.lock).
#   3. Look up the highest build number already uploaded to App Store Connect for the
#      current marketing version, and bump to one past it via agvtool. TestFlight
#      rejects a re-uploaded build number outright, so this can't be static.
#   4. Archive (Release config) and export/upload via xcodebuild, authenticating the
#      upload with the ASC API key (.p8) — same as CI.
#   5. Run attach_testflight_build.rb — without this, a successfully uploaded build
#      stays invisible to testers (export compliance + beta group aren't automatic;
#      see that script's own header comment for the incident history).
#
# SIGNING — the one real difference from CI: CI signs with a certificate + profile
# that only exist as GitHub Actions secrets (IOS_DIST_CERT_P12_BASE64 etc.), which
# can't be extracted locally by design. This machine instead has its own separately
# issued "Apple Distribution: Idowu Ayeni" identity + "LashlyAI AppStore Local Build"
# profile, created once (2026-07-15) via the ASC API and stored in this Mac's login
# keychain — see `security find-identity -v -p codesigning`. Manual signing style is
# used (not automatic) because xcodebuild's automatic-signing + -allowProvisioningUpdates
# combo has a known bug: it tries to create a Development profile during archive
# instead of a Distribution one. project.pbxproj and ExportOptions.plist are committed
# pointing at CI's cert/profile names, so this script backs both up, temporarily
# repoints them at the local identity, and restores the originals in a trap on exit —
# the committed state must stay CI-compatible for whenever GH Actions billing is fixed.
#
# If the local identity/profile above are ever missing (new machine, expired profile,
# etc.), recreate them via the ASC API before running this:
#   - POST /v1/certificates with a fresh CSR (certificateType: DISTRIBUTION)
#   - POST /v1/profiles (profileType: IOS_APP_STORE) linking that cert + the
#     com.canadasun.lashlyai bundle ID
#   - Import the resulting cert+key as a .p12 into the login keychain, and drop the
#     .mobileprovision into ~/Library/MobileDevice/Provisioning Profiles/
#
# Requires: ~/Downloads/AuthKey_<ASC_KEY_ID>.p8 (or set ASC_API_KEY_PATH explicitly).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$(dirname "$IOS_DIR")"

ASC_KEY_ID="${ASC_KEY_ID:-9MBM2DMGW3}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-e9a853ee-7af8-4dac-ba65-29708aa9525d}"
ASC_API_KEY_PATH="${ASC_API_KEY_PATH:-$HOME/Downloads/AuthKey_${ASC_KEY_ID}.p8}"
APP_ID="6789339271" # com.canadasun.lashlyai, see attach_testflight_build.rb
LOCAL_PROFILE_NAME="LashlyAI AppStore Local Build"

if [ ! -f "$ASC_API_KEY_PATH" ]; then
  echo "error: ASC API key not found at $ASC_API_KEY_PATH (set ASC_API_KEY_PATH to override)" >&2
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -q "Apple Distribution: Idowu Ayeni"; then
  echo "error: no 'Apple Distribution: Idowu Ayeni' identity in the login keychain." >&2
  echo "See this script's header comment for how to recreate it." >&2
  exit 1
fi

# attach_testflight_build.rb (unlike this script) hard-codes this path, matching what
# CI's own "Set up App Store Connect API key" step writes to before running it.
mkdir -p "$HOME/private_keys"
cp "$ASC_API_KEY_PATH" "$HOME/private_keys/AuthKey_${ASC_KEY_ID}.p8"

echo "== Step 1/6: validate (tsc, eslint, jest) =="
cd "$MOBILE_DIR"
npm run build
npm run lint
npm test -- --runInBand

echo "== Step 2/6: pod install (pinned bundler version) =="
cd "$IOS_DIR"
bundle install --quiet
bundle exec pod install

echo "== Step 3/6: determine next build number from App Store Connect =="
NEXT_BUILD_NUMBER=$(python3 <<PYEOF
import jwt, time, json, urllib.request

with open("$ASC_API_KEY_PATH") as f:
    private_key = f.read()
token = jwt.encode(
    {"iss": "$ASC_ISSUER_ID", "iat": int(time.time()), "exp": int(time.time()) + 600, "aud": "appstoreconnect-v1"},
    private_key, algorithm="ES256", headers={"kid": "$ASC_KEY_ID", "typ": "JWT"},
)
headers = {"Authorization": f"Bearer {token}"}

req = urllib.request.Request(f"https://api.appstoreconnect.apple.com/v1/apps/$APP_ID/preReleaseVersions?limit=200", headers=headers)
with urllib.request.urlopen(req) as resp:
    versions = json.load(resp)

highest = 0
for v in versions["data"]:
    req2 = urllib.request.Request(
        f"https://api.appstoreconnect.apple.com/v1/preReleaseVersions/{v['id']}/builds?limit=200",
        headers=headers,
    )
    with urllib.request.urlopen(req2) as resp2:
        builds = json.load(resp2)
    for b in builds["data"]:
        highest = max(highest, int(b["attributes"]["version"]))

print(highest + 1)
PYEOF
)
echo "Next build number: $NEXT_BUILD_NUMBER"
agvtool new-version -all "$NEXT_BUILD_NUMBER"

echo "== Step 4/6: temporarily repoint signing at the local identity/profile =="
# All four of these files are git-tracked and get modified below (directly or via
# agvtool/pod install) purely for this local build — none of it belongs in a commit.
# Reverting via `git checkout` at exit (rather than a manual backup/restore) is
# correct regardless of step ordering — in particular, the build-number bump from
# Step 3 has to survive through the archive/export below, then gets reverted here
# same as everything else, in one pass, after upload finishes.
restore_signing() {
  echo "== Restoring committed signing config and build number (CI-compatible) =="
  cd "$MOBILE_DIR" && git checkout -- \
    ios/LashlyAIMobile.xcodeproj/project.pbxproj \
    ios/ExportOptions.plist \
    ios/LashlyAIMobile/Info.plist \
    ios/Podfile.lock 2>/dev/null || true
}
trap restore_signing EXIT

sed -i '' 's/PROVISIONING_PROFILE_SPECIFIER\[sdk=iphoneos\*\]" = "LashlyAI AppStore"/PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]" = "'"$LOCAL_PROFILE_NAME"'"/' \
  "$IOS_DIR/LashlyAIMobile.xcodeproj/project.pbxproj"
sed -i '' 's/<string>LashlyAI AppStore<\/string>/<string>'"$LOCAL_PROFILE_NAME"'<\/string>/' \
  "$IOS_DIR/ExportOptions.plist"

echo "== Step 5/6: archive =="
# Only remove the previous archive output — NOT ios/build/generated or DerivedData.
# Wiping DerivedData forces every script phase (including the ReactCodegen build
# phase) to re-run from a cold cache, and on a from-scratch build that phase can lose
# a race against the CompileC steps that consume its output ("Build input file cannot
# be found") — hit this once (2026-07-15). Leaving DerivedData alone lets Xcode's
# normal incremental dependency tracking do its job, same as any everyday local build.
cd "$IOS_DIR"
rm -rf "build/LashlyAIMobile.xcarchive"

archive() {
  xcodebuild archive \
    -workspace LashlyAIMobile.xcworkspace \
    -scheme LashlyAIMobile \
    -configuration Release \
    -archivePath "$PWD/build/LashlyAIMobile.xcarchive" \
    -destination "generic/platform=iOS"
}

# One retry: if the codegen/compile race above ever recurs, the codegen script phase
# will have already finished writing its output to disk by the time the archive
# fails, so a plain re-run (no cache-clearing) succeeds immediately on attempt 2.
if ! archive; then
  echo "First archive attempt failed — retrying once (see comment above)."
  rm -rf "build/LashlyAIMobile.xcarchive"
  archive
fi

echo "== Step 6/6: export, upload, and attach to TestFlight testers =="
xcodebuild -exportArchive \
  -archivePath "$PWD/build/LashlyAIMobile.xcarchive" \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath "$PWD/build" \
  -authenticationKeyPath "$ASC_API_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

ASC_KEY_ID="$ASC_KEY_ID" ASC_ISSUER_ID="$ASC_ISSUER_ID" BUILD_NUMBER="$NEXT_BUILD_NUMBER" \
  bundle exec ruby scripts/attach_testflight_build.rb

echo "== Done: build $NEXT_BUILD_NUMBER uploaded and attached to Internal Testers =="
