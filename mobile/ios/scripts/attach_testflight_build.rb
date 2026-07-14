# frozen_string_literal: true

# Runs right after "Export & upload to TestFlight" in the GitHub Actions workflow.
#
# A successful `xcodebuild -exportArchive` upload is NOT the end of the story: Apple
# still needs to (1) finish processing the build (starts in PROCESSING, becomes VALID
# or INVALID/FAILED), then (2) have export compliance declared, then (3) have at least
# one beta group attached — none of which happen automatically. Skipping any of these
# leaves a build that "uploaded fine" but is invisible/uninstallable in TestFlight,
# which is exactly what happened silently across builds #22-26 before this script
# existed. This only handles internal testing (no additional Apple review needed);
# external-tester groups additionally need a fresh Beta App Review submission per
# build, which is deliberately NOT automated here since that's a real App Review
# submission, not something to fire off unattended.
#
# BUG FIXED 2026-07-14 (round 1): the builds lookup used to be `?limit=1` with no
# filter or sort, trusting the API to return the just-uploaded build first. It
# doesn't — every run from #27 onward silently re-attached an old, already-compliant
# build (proof: a 409 "already declared" on the compliance PATCH, and a build
# reaching VALID 2-3 seconds after upload finished, which is not how long Apple
# processing actually takes). The real new build never got compliance/group set, so
# it stayed invisible — testers kept seeing whatever build was current before this
# script was introduced, silently, across every push since.
#
# BUG FIXED 2026-07-14 (round 2): the round-1 fix filtered
# `/v1/preReleaseVersions/{id}/builds?filter[version]=...`, which isn't a supported
# filter on that nested relationship endpoint — Apple returned an error body with no
# "data" key, and the script had no status-code check, so it crashed with a bare
# `KeyError` instead of a useful message (build #29). Fixed by querying the top-level
# `/v1/builds` resource instead, which does document `filter[app]`/`filter[version]`
# (the same pattern Fastlane and most CI integrations use), and by checking the HTTP
# status before touching the response body so a future API surprise fails with the
# actual error instead of a cryptic exception.

require "jwt"
require "net/http"
require "uri"
require "json"
require "openssl"

APP_ID = "6789339271"
INTERNAL_TESTERS_GROUP_ID = "0be3cb17-d8a4-47fc-bbd0-9b7105781640"
MAX_POLL_ATTEMPTS = 40
POLL_INTERVAL_SECONDS = 15

def api(method, token, path, body: nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request_class = { get: Net::HTTP::Get, patch: Net::HTTP::Patch, post: Net::HTTP::Post }.fetch(method)
  request = request_class.new(uri)
  request["Authorization"] = "Bearer #{token}"
  if body
    request["Content-Type"] = "application/json"
    request.body = body.to_json
  end
  response = http.request(request)
  [response.code.to_i, response.body]
end

key_id = ENV.fetch("ASC_KEY_ID")
issuer_id = ENV.fetch("ASC_ISSUER_ID")
build_number = ENV.fetch("BUILD_NUMBER")
private_key = OpenSSL::PKey::EC.new(File.read(File.expand_path("~/private_keys/AuthKey_#{key_id}.p8")))

token = JWT.encode(
  { iss: issuer_id, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1" },
  private_key,
  "ES256",
  { kid: key_id, typ: "JWT" },
)

build_id = nil
state = nil

MAX_POLL_ATTEMPTS.times do |attempt|
  status, builds_body = api(
    :get,
    token,
    "/v1/builds?filter[app]=#{APP_ID}&filter[version]=#{build_number}&limit=1",
  )
  if status != 200
    puts "[attach_testflight_build] attempt #{attempt + 1}/#{MAX_POLL_ATTEMPTS}: " \
         "builds lookup failed with HTTP #{status}: #{builds_body}"
    sleep POLL_INTERVAL_SECONDS
    next
  end

  data = JSON.parse(builds_body)["data"] || []
  if data.empty?
    puts "[attach_testflight_build] attempt #{attempt + 1}/#{MAX_POLL_ATTEMPTS}: " \
         "build #{build_number} not visible in App Store Connect yet"
    sleep POLL_INTERVAL_SECONDS
    next
  end

  build = data.fetch(0)
  build_id = build["id"]
  state = build.dig("attributes", "processingState")
  puts "[attach_testflight_build] attempt #{attempt + 1}/#{MAX_POLL_ATTEMPTS}: " \
       "build #{build_number} (id #{build_id}) processingState=#{state}"
  break if %w[VALID INVALID FAILED].include?(state)

  sleep POLL_INTERVAL_SECONDS
end

if state != "VALID"
  puts "[attach_testflight_build] Build did not reach VALID in time (last state: #{state}) — " \
       "leaving export compliance/beta group unset. Check App Store Connect manually."
  exit 0
end

# A fresh build returns 200 here. A 409 ENTITY_ERROR.ATTRIBUTE.INVALID
# ("You cannot update when the value is already set") is benign — it only happens if
# this step somehow runs twice against the same build (e.g. a manual re-run), since
# Apple treats the compliance declaration as write-once per build.
compliance_status, = api(
  :patch,
  token,
  "/v1/builds/#{build_id}",
  body: { data: { type: "builds", id: build_id, attributes: { usesNonExemptEncryption: false } } },
)
puts "[attach_testflight_build] export compliance PATCH status=#{compliance_status}"

group_status, = api(
  :post,
  token,
  "/v1/builds/#{build_id}/relationships/betaGroups",
  body: { data: [{ type: "betaGroups", id: INTERNAL_TESTERS_GROUP_ID }] },
)
puts "[attach_testflight_build] beta group attach POST status=#{group_status}"
