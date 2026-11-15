package com.komayomimobile

import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.File

/**
 * Copies a SAF tree (the folder picked with `pickDirectory`) into the app's
 * document directory. Reference-mode projects store only relative image paths,
 * so the picked folder has to be materialized once before the picker grant expires.
 */
class KomaFilesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  override fun getName() = "KomaFiles"

  @ReactMethod
  fun copyDirectory(uriString: String, destination: String, promise: Promise) {
    try {
      val tree = DocumentFile.fromTreeUri(context, Uri.parse(uriString))
        ?: throw IllegalArgumentException("The picked folder is not readable.")
      val root = File(destination)
      root.mkdirs()
      val copied = Arguments.createArray()
      copyChildren(tree, root, "", copied)
      promise.resolve(copied)
    } catch (error: Exception) {
      promise.reject("copy_failed", error)
    }
  }

  private fun copyChildren(directory: DocumentFile, target: File, prefix: String, out: WritableArray) {
    for (child in directory.listFiles()) {
      val name = child.name ?: continue
      val relativePath = if (prefix.isEmpty()) name else "$prefix/$name"
      if (child.isDirectory) {
        copyChildren(child, File(target, name), relativePath, out)
        continue
      }
      if (!IMAGE_EXTENSIONS.containsMatchIn(name)) continue
      val output = File(target, relativePath)
      output.parentFile?.mkdirs()
      context.contentResolver.openInputStream(child.uri)?.use { input ->
        output.outputStream().use { stream -> input.copyTo(stream) }
      } ?: continue
      val entry = Arguments.createMap()
      entry.putString("relativePath", relativePath)
      entry.putString("name", name)
      entry.putDouble("size", output.length().toDouble())
      out.pushMap(entry)
    }
  }

  private companion object {
    val IMAGE_EXTENSIONS = Regex("\\.(png|jpe?g|webp|gif|avif|bmp)$", RegexOption.IGNORE_CASE)
  }
}
