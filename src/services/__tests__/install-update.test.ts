import * as expoFileSystem from "expo-file-system"
import * as IntentLauncher from "expo-intent-launcher"
import {
  APK_FILE_NAME,
  FLAG_GRANT_READ_URI_PERMISSION,
  INSTALL_PACKAGE_ACTION,
  downloadUpdateApk,
  installApk,
  supportsInAppInstall,
} from "@/services/install-update"

jest.mock("expo-file-system", () => ({
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: class File {
    name: string
    constructor(...uris: unknown[]) {
      this.name = String(uris[uris.length - 1])
    }
    static downloadFileAsync = jest.fn()
  },
  Paths: { cache: { uri: "file:///data/cache" } },
}))

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(),
}))

const mockDownloadFileAsync = expoFileSystem.File.downloadFileAsync as jest.MockedFunction<
  typeof expoFileSystem.File.downloadFileAsync
>
const mockCreate = jest.fn()
;(expoFileSystem.Directory as unknown as jest.Mock).mockImplementation(() => ({
  create: mockCreate,
}))
const mockStartActivityAsync = IntentLauncher.startActivityAsync as jest.MockedFunction<
  typeof IntentLauncher.startActivityAsync
>

describe("supportsInAppInstall", () => {
  it("allows in-app install only on Android", () => {
    expect(supportsInAppInstall("android")).toBe(true)
    expect(supportsInAppInstall("ios")).toBe(false)
    expect(supportsInAppInstall("web")).toBe(false)
  })
})

describe("downloadUpdateApk", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDownloadFileAsync.mockResolvedValue({
      uri: "file:///data/cache/updates/" + APK_FILE_NAME,
    } as never)
  })

  it("downloads into the cache updates folder, overwriting leftovers", async () => {
    const onProgress = jest.fn()
    await downloadUpdateApk("https://example.com/app.apk", onProgress)

    expect(mockCreate).toHaveBeenCalledWith({ intermediates: true, idempotent: true })
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1)
    const [, target, options] = mockDownloadFileAsync.mock.calls[0]
    expect(target.name).toBe(APK_FILE_NAME)
    expect(options?.idempotent).toBe(true)
    expect(options?.onProgress).toBe(onProgress)
  })
})

describe("installApk", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("hands the APK content URI to the system package installer", async () => {
    const contentUri =
      "content://com.personal.dietinator.FileSystemFileProvider/cached_expo_files/updates/" +
      APK_FILE_NAME

    await installApk({ contentUri } as never)

    expect(mockStartActivityAsync).toHaveBeenCalledWith(INSTALL_PACKAGE_ACTION, {
      data: contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    })
  })

  it("throws when the file cannot be shared as a content URI", async () => {
    await expect(installApk({ contentUri: null } as never)).rejects.toThrow(/not shareable/)
    expect(mockStartActivityAsync).not.toHaveBeenCalled()
  })
})
