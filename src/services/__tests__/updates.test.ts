import {
  fetchLatestRelease,
  fetchLatestReleaseViaRedirect,
  getApkAsset,
  isNewerThan,
  parseRelease,
  parseTagFromRedirectUrl,
  parseVersion,
} from "@/services/updates"

function responseOf(overrides: Partial<Response>): Response {
  return { ok: true, status: 200, url: "", json: async () => ({}), ...overrides } as Response
}

describe("parseVersion", () => {
  it("parses plain and v-prefixed semver tags", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3])
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3])
    expect(parseVersion("1.2.3-rc.1")).toEqual([1, 2, 3])
    expect(parseVersion("garbage")).toBeNull()
  })
})

describe("isNewerThan", () => {
  it("compares release tags against the installed version", () => {
    expect(isNewerThan("v1.1.0", "1.0.0")).toBe(true)
    expect(isNewerThan("v1.0.1", "1.0.0")).toBe(true)
    expect(isNewerThan("v1.0.0", "1.0.0")).toBe(false)
    expect(isNewerThan("v0.9.0", "1.0.0")).toBe(false)
    expect(isNewerThan("junk", "1.0.0")).toBe(false)
  })
})

describe("parseRelease", () => {
  it("maps a GitHub releases/latest payload", () => {
    const release = parseRelease({
      tag_name: "v1.1.0",
      name: "Dietinator v1.1.0",
      body: "## What's new",
      published_at: "2026-08-09T10:00:00Z",
      prerelease: false,
      assets: [
        {
          name: "Dietinator-Android.apk",
          browser_download_url: "https://example.com/apk",
          size: 1234,
        },
        { name: "other.txt", browser_download_url: "https://example.com/other" },
      ],
    })
    expect(release.tag).toBe("v1.1.0")
    expect(release.assets).toHaveLength(2)
    expect(getApkAsset(release)?.downloadUrl).toBe("https://example.com/apk")
  })

  it("tolerates malformed payloads", () => {
    expect(parseRelease(null).tag).toBe("")
    expect(parseRelease({}).assets).toEqual([])
  })
})

describe("parseTagFromRedirectUrl", () => {
  it("extracts the tag from a latest-redirect target", () => {
    expect(
      parseTagFromRedirectUrl("https://github.com/kadato/Dietinator/releases/tag/v1.1.0"),
    ).toBe("v1.1.0")
    expect(parseTagFromRedirectUrl("https://github.com/other/releases/tag/v2.0.0?x=1")).toBe(
      "v2.0.0",
    )
    expect(
      parseTagFromRedirectUrl("https://github.com/kadato/Dietinator/releases/latest"),
    ).toBeNull()
    expect(parseTagFromRedirectUrl("")).toBeNull()
  })
})

describe("fetchLatestReleaseViaRedirect", () => {
  const latestUrl = "https://github.com/kadato/Dietinator/releases/latest"

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("builds a release from the redirect target when the API is rate-limited", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("GitHub responded (403)"))
      .mockResolvedValueOnce(
        responseOf({
          url: "https://github.com/kadato/Dietinator/releases/tag/v1.1.0",
        }),
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const release = await fetchLatestRelease()
    expect(release?.tag).toBe("v1.1.0")
    expect(release?.assets[0].name).toBe("Dietinator-Android.apk")
    expect(release?.assets[0].downloadUrl).toBe(
      "https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk",
    )
  })

  it("returns null when the redirect does not resolve to a tag", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(responseOf({ url: latestUrl })) as unknown as typeof fetch
    expect(await fetchLatestReleaseViaRedirect()).toBeNull()
  })

  it("returns null when the repo has no releases", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(responseOf({ ok: false, status: 404 })) as unknown as typeof fetch
    expect(await fetchLatestReleaseViaRedirect()).toBeNull()
  })

  it("returns null when the API reports no releases without hitting the fallback", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(responseOf({ ok: false, status: 404 })) as unknown as typeof fetch
    globalThis.fetch = fetchMock
    expect(await fetchLatestRelease()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
