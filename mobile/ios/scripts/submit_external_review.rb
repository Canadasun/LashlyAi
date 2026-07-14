# frozen_string_literal: true

# Manually triggered (see .github/workflows/submit-external-review.yml,
# workflow_dispatch only) — this is a real submission to Apple's Beta App Review
# queue, deliberately not something that fires automatically on every push the way
# internal-tester attachment does (see attach_testflight_build.rb).
#
# Does four things against a single build, identified by its build number
# (CFBundleVersion, same value `attach_testflight_build.rb` uses):
#   1. Attaches the build to the "External Testers" beta group (internal attach never
#      touches external groups, so this hasn't happened yet for any build).
#   2. Sets the app-level demo account credentials + review notes
#      (betaAppReviewDetail) — only the demo-account/notes fields, so it doesn't
#      clobber contact name/email/phone if those are already set correctly.
#   3. Sets this build's "What to Test" text (betaBuildLocalization).
#   4. Creates the betaAppReviewSubmission itself, which is what actually queues the
#      build for Apple's review.

require "jwt"
require "net/http"
require "uri"
require "json"
require "openssl"

APP_ID = "6789339271"
EXTERNAL_GROUP_NAME = "External Testers"

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

def fetch_json!(status, body, step)
  raise "#{step} failed with HTTP #{status}: #{body}" unless status.between?(200, 299)

  JSON.parse(body)
end

key_id = ENV.fetch("ASC_KEY_ID")
issuer_id = ENV.fetch("ASC_ISSUER_ID")
build_number = ENV.fetch("BUILD_NUMBER")
demo_email = ENV.fetch("REVIEW_DEMO_EMAIL")
demo_password = ENV.fetch("REVIEW_DEMO_PASSWORD")
private_key = OpenSSL::PKey::EC.new(File.read(File.expand_path("~/private_keys/AuthKey_#{key_id}.p8")))

token = JWT.encode(
  { iss: issuer_id, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1" },
  private_key,
  "ES256",
  { kid: key_id, typ: "JWT" },
)

# 1. Find the build (same filter[app]+filter[version] pattern as the internal script).
status, body = api(:get, token, "/v1/builds?filter[app]=#{APP_ID}&filter[version]=#{build_number}&limit=1")
builds = fetch_json!(status, body, "find build ##{build_number}").fetch("data")
raise "Build #{build_number} not found in App Store Connect — has it finished uploading/processing?" if builds.empty?

build_id = builds.fetch(0).fetch("id")
puts "[submit_external_review] build ##{build_number} -> id #{build_id}"

# 2. Find the External Testers group and attach the build to it.
status, body = api(:get, token, "/v1/apps/#{APP_ID}/betaGroups?limit=50")
groups = fetch_json!(status, body, "list beta groups").fetch("data")
external_group = groups.find { |g| g.dig("attributes", "name") == EXTERNAL_GROUP_NAME }
raise "No beta group named #{EXTERNAL_GROUP_NAME.inspect} found" unless external_group

group_status, group_body = api(
  :post,
  token,
  "/v1/builds/#{build_id}/relationships/betaGroups",
  body: { data: [{ type: "betaGroups", id: external_group.fetch("id") }] },
)
# A 409 here just means the build is already in the group (e.g. a re-run) — benign.
puts "[submit_external_review] attach to #{EXTERNAL_GROUP_NAME} status=#{group_status} #{group_status == 409 ? '(already attached, fine)' : ''}"
raise "attach to external group failed: #{group_body}" unless group_status.between?(200, 299) || group_status == 409

# 3. Update the app-level review detail — only the demo-account/notes fields, leaving
# contact name/email/phone (set once, elsewhere) untouched.
status, body = api(:get, token, "/v1/apps/#{APP_ID}/betaAppReviewDetail")
review_detail_id = fetch_json!(status, body, "fetch betaAppReviewDetail").dig("data", "id")

notes = <<~NOTES.strip
  LashlyAI helps lash artists photograph a client's eye, get an AI-generated lash
  map, and save it to the client's profile. Sign in with the demo account below —
  this is a real account with normal email/password authentication, no bypass.

  Suggested test path: sign in -> tap "+ New Client" -> enter a name -> tap
  "New Eye Photo + Lash Map" -> take or choose a photo -> review the generated eye
  analysis and lash map -> tap "Ask AI Lash Coach" for a troubleshooting example.
NOTES

review_status, review_body = api(
  :patch,
  token,
  "/v1/betaAppReviewDetails/#{review_detail_id}",
  body: {
    data: {
      type: "betaAppReviewDetails",
      id: review_detail_id,
      attributes: {
        demoAccountName: demo_email,
        demoAccountPassword: demo_password,
        demoAccountRequired: true,
        notes: notes,
      },
    },
  },
)
puts "[submit_external_review] betaAppReviewDetail PATCH status=#{review_status}"
raise "betaAppReviewDetail update failed: #{review_body}" unless review_status.between?(200, 299)

# 4. Set this build's "What to Test" text (create if this build has none yet, else
# patch the existing one).
status, body = api(:get, token, "/v1/builds/#{build_id}/betaBuildLocalizations")
localizations = fetch_json!(status, body, "list betaBuildLocalizations").fetch("data")

what_to_test = <<~WHATSNEW.strip
  Replaced the Glue Check tool with an AI-powered Photo Editor, including real AI
  skin retouching. Redesigned the client list with search. Session storage moved to
  the device Keychain for better security. Fixed an accidental-sign-out bug on the
  profile avatar.
WHATSNEW

if localizations.empty?
  loc_status, loc_body = api(
    :post,
    token,
    "/v1/betaBuildLocalizations",
    body: {
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale: "en-US", whatsNew: what_to_test },
        relationships: { build: { data: { type: "builds", id: build_id } } },
      },
    },
  )
else
  loc_id = localizations.fetch(0).fetch("id")
  loc_status, loc_body = api(
    :patch,
    token,
    "/v1/betaBuildLocalizations/#{loc_id}",
    body: { data: { type: "betaBuildLocalizations", id: loc_id, attributes: { whatsNew: what_to_test } } },
  )
end
puts "[submit_external_review] betaBuildLocalization #{localizations.empty? ? 'POST' : 'PATCH'} status=#{loc_status}"
raise "betaBuildLocalization update failed: #{loc_body}" unless loc_status.between?(200, 299)

# 5. Submit for Beta App Review. This is the step that actually queues the build with
# Apple — everything above just prepares the metadata Apple's reviewer will see.
submit_status, submit_body = api(
  :post,
  token,
  "/v1/betaAppReviewSubmissions",
  body: { data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build_id } } } } },
)
puts "[submit_external_review] betaAppReviewSubmission POST status=#{submit_status} body=#{submit_body}"
raise "Beta App Review submission failed: #{submit_body}" unless submit_status.between?(200, 299)

puts "[submit_external_review] Build ##{build_number} submitted for External Beta Review."
