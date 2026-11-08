package ai.photomagic.studio;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "PhotoMagicSave")
public class PhotoMagicSavePlugin extends Plugin {
  @PluginMethod
  public void savePhoto(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      call.reject("Для сохранения в галерею нужна Android 10 или новее.");
      return;
    }
    final String rawName = call.getString("name");
    final String rawData = call.getString("data");
    final String rawMime = call.getString("mime");
    if (rawName == null || rawData == null || rawData.isEmpty()) {
      call.reject("Отсутствуют данные фотографии.");
      return;
    }
    final String mime = "image/png".equals(rawMime) ? "image/png" : "image/jpeg";
    final String normalized = rawName.replaceAll("[^a-zA-Z0-9._-]", "_");
    final String safeName = normalized.substring(0, Math.min(normalized.length(), 120));
    Uri uri = null;
    try {
      byte[] bytes = Base64.decode(rawData, Base64.DEFAULT);
      if (bytes.length == 0 || bytes.length > 70 * 1024 * 1024) {
        call.reject("Размер готового фото не поддерживается.");
        return;
      }
      ContentValues metadata = new ContentValues();
      metadata.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
      metadata.put(MediaStore.Images.Media.MIME_TYPE, mime);
      metadata.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PhotoMagicAI");
      metadata.put(MediaStore.Images.Media.IS_PENDING, 1);
      uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, metadata);
      if (uri == null) throw new IllegalStateException("MediaStore insert returned null");
      try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
        if (out == null) throw new IllegalStateException("MediaStore output stream returned null");
        out.write(bytes);
      }
      ContentValues finish = new ContentValues();
      finish.put(MediaStore.Images.Media.IS_PENDING, 0);
      getContext().getContentResolver().update(uri, finish, null, null);
      JSObject data = new JSObject();
      data.put("uri", uri.toString());
      data.put("name", safeName);
      call.resolve(data);
    } catch (Exception e) {
      if (uri != null) {
        try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
      }
      call.reject("Не удалось записать изображение в галерею.", e);
    }
  }
}
