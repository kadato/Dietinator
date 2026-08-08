import { Platform } from "react-native"
import * as Sharing from "expo-sharing"
import * as DocumentPicker from "expo-document-picker"
import { File, Paths } from "expo-file-system"
import type { BackupPayload } from "./backup"

/**
 * Save a backup payload as a .json file: browser download on web, native
 * share sheet on iOS/Android.
 */
export async function saveBackupFile(payload: BackupPayload): Promise<void> {
  const content = JSON.stringify(payload, null, 2)
  const stamp = payload.exported_at.slice(0, 10)
  const fileName = `dietinator-backup-${stamp}.json`

  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    return
  }

  const file = new File(Paths.cache, fileName)
  file.write(content)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Save backup" })
  } else {
    throw new Error("Sharing is not available on this device.")
  }
}

/**
 * Pick a backup file and return its raw content: file picker on web,
 * document picker on native. Throws when the user cancels.
 */
export async function pickBackupFile(): Promise<string> {
  if (Platform.OS === "web") {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "application/json,.json"
      input.addEventListener(
        "change",
        () => {
          const file = input.files?.[0]
          if (!file) {
            reject(new Error("No file selected."))
            return
          }
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result ?? ""))
          reader.onerror = () => reject(new Error("Could not read the selected file."))
          reader.readAsText(file)
        },
        { once: true },
      )
      input.click()
    })
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  })
  if (result.canceled || !result.assets?.[0]) {
    throw new Error("No file selected.")
  }
  const file = new File(result.assets[0].uri)
  return file.text()
}
