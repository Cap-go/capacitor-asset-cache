package app.capgo.asset_cache;

import android.content.Context;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Iterator;
import java.util.Locale;
import org.json.JSONObject;

public class AssetCache {

    private static final String ROOT_DIR = "capgo_asset_cache";
    private static final String FILES_DIR = "files";
    private static final String METADATA_DIR = "metadata";
    private final Context context;

    public AssetCache(Context context) {
        this.context = context;
    }

    public JSObject get(String url, String rawKey, JSObject headers, JSObject revalidate) throws Exception {
        if (url == null || url.isEmpty()) {
            throw new IllegalArgumentException("url is required");
        }

        URL remoteUrl = new URL(url);
        String protocol = remoteUrl.getProtocol().toLowerCase(Locale.ROOT);
        if (!"http".equals(protocol) && !"https".equals(protocol)) {
            throw new IllegalArgumentException("Invalid URL");
        }

        ensureDirectories();
        String key = resolveKey(rawKey, url);
        String strategy = revalidate.optString("strategy", "never");
        StoredAsset metadata = readMetadata(key);

        if (metadata != null && fileExists(metadata) && isFresh(metadata, strategy, revalidate.optLong("maxAgeSeconds", 0))) {
            return toResult(metadata, true, "hit");
        }

        HttpURLConnection connection = (HttpURLConnection) remoteUrl.openConnection();
        connection.setConnectTimeout(30000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(true);
        applyHeaders(connection, headers);
        if (metadata != null) {
            applyValidators(connection, metadata, strategy);
        }

        try {
            int status = connection.getResponseCode();
            long now = timestamp();
            if (status == HttpURLConnection.HTTP_NOT_MODIFIED && metadata != null) {
                metadata.checkedAt = now;
                writeMetadata(metadata);
                return toResult(metadata, true, "notModified");
            }
            if (status < 200 || status > 299) {
                throw new IOException("Failed to fetch asset: HTTP " + status);
            }

            String fileName = metadata != null ? metadata.fileName : fileName(key, remoteUrl);
            File destination = new File(filesDirectory(), fileName);
            File temp = File.createTempFile("asset-cache-", ".tmp", rootDirectory());
            try (
                InputStream input = new BufferedInputStream(connection.getInputStream());
                FileOutputStream output = new FileOutputStream(temp)
            ) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
            }

            if (destination.exists() && !destination.delete()) {
                throw new IOException("Unable to replace cached asset");
            }
            if (!temp.renameTo(destination)) {
                copyFile(temp, destination);
                if (!temp.delete()) {
                    temp.deleteOnExit();
                }
            }

            StoredAsset next = new StoredAsset();
            next.key = key;
            next.url = url;
            next.fileName = fileName;
            next.mimeType = normalizeMimeType(connection.getHeaderField("Content-Type"));
            next.etag = connection.getHeaderField("ETag");
            next.lastModified = connection.getHeaderField("Last-Modified");
            next.size = destination.length();
            next.updatedAt = now;
            next.checkedAt = now;
            writeMetadata(next);
            return toResult(next, false, "downloaded");
        } finally {
            connection.disconnect();
        }
    }

    public JSObject remove(String rawKey, String url) throws Exception {
        String key = resolveKey(rawKey, url);
        StoredAsset metadata = readMetadata(key);
        boolean removed = false;

        if (metadata != null) {
            File file = fileFor(metadata);
            if (file.exists()) {
                removed = file.delete();
            }
        }

        File metadataFile = metadataFile(key);
        if (metadataFile.exists()) {
            removed = metadataFile.delete() || removed;
        }

        return new JSObject().put("removed", removed);
    }

    public JSObject clear() throws Exception {
        int removed = storedAssets().length();
        deleteRecursively(rootDirectory());
        ensureDirectories();
        return new JSObject().put("removed", removed);
    }

    public JSObject list() throws Exception {
        return new JSObject().put("assets", storedAssets());
    }

    public JSObject getCacheSize() throws Exception {
        long total = 0;
        File[] files = filesDirectory().listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile()) {
                    total += file.length();
                }
            }
        }
        return new JSObject().put("size", total);
    }

    public String getPluginVersion() {
        return "native";
    }

    private JSArray storedAssets() throws Exception {
        JSArray assets = new JSArray();
        File[] files = metadataDirectory().listFiles((dir, name) -> name.endsWith(".json"));
        if (files == null) {
            return assets;
        }

        for (File file : files) {
            StoredAsset asset = readMetadataFile(file);
            if (asset != null && fileExists(asset)) {
                assets.put(toResult(asset, true, "hit"));
            }
        }
        return assets;
    }

    private boolean isFresh(StoredAsset asset, String strategy, long maxAgeSeconds) {
        if ("never".equals(strategy)) {
            return true;
        }
        if ("ttl".equals(strategy)) {
            long ttl = Math.max(0, maxAgeSeconds) * 1000L;
            return ttl > 0 && timestamp() - asset.updatedAt < ttl;
        }
        return false;
    }

    private void applyHeaders(HttpURLConnection connection, JSObject headers) {
        for (Iterator<String> iterator = headers.keys(); iterator.hasNext(); ) {
            String header = iterator.next();
            String value = headers.optString(header, null);
            if (value != null && !value.isEmpty()) {
                connection.setRequestProperty(header, value);
            }
        }
    }

    private void applyValidators(HttpURLConnection connection, StoredAsset asset, String strategy) {
        if (("always".equals(strategy) || "etag".equals(strategy) || "ttl".equals(strategy)) && asset.etag != null) {
            connection.setRequestProperty("If-None-Match", asset.etag);
        }
        if (("always".equals(strategy) || "last-modified".equals(strategy) || "ttl".equals(strategy)) && asset.lastModified != null) {
            connection.setRequestProperty("If-Modified-Since", asset.lastModified);
        }
    }

    private JSObject toResult(StoredAsset asset, boolean fromCache, String status) {
        JSObject result = new JSObject();
        File file = fileFor(asset);
        result.put("key", asset.key);
        result.put("url", asset.url);
        result.put("path", file.getAbsolutePath());
        result.put("uri", Uri.fromFile(file).toString());
        result.put("mimeType", asset.mimeType);
        result.put("etag", asset.etag);
        result.put("lastModified", asset.lastModified);
        result.put("size", asset.size);
        result.put("updatedAt", asset.updatedAt);
        result.put("checkedAt", asset.checkedAt);
        result.put("fromCache", fromCache);
        result.put("status", status);
        return result;
    }

    private StoredAsset readMetadata(String key) throws Exception {
        File file = metadataFile(key);
        if (!file.exists()) {
            return null;
        }
        return readMetadataFile(file);
    }

    private StoredAsset readMetadataFile(File file) throws Exception {
        String raw;
        try (InputStream input = new FileInputStream(file)) {
            raw = readString(input);
        }
        JSONObject json = new JSONObject(raw);
        StoredAsset asset = new StoredAsset();
        asset.key = json.getString("key");
        asset.url = json.getString("url");
        asset.fileName = json.getString("fileName");
        asset.mimeType = optionalString(json, "mimeType");
        asset.etag = optionalString(json, "etag");
        asset.lastModified = optionalString(json, "lastModified");
        asset.size = json.optLong("size", 0);
        asset.updatedAt = json.optLong("updatedAt", 0);
        asset.checkedAt = json.optLong("checkedAt", 0);
        return asset;
    }

    private String optionalString(JSONObject json, String key) {
        return json.isNull(key) ? null : json.optString(key, null);
    }

    private String readString(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private void writeMetadata(StoredAsset asset) throws Exception {
        JSONObject json = new JSONObject();
        json.put("key", asset.key);
        json.put("url", asset.url);
        json.put("fileName", asset.fileName);
        json.put("mimeType", asset.mimeType);
        json.put("etag", asset.etag);
        json.put("lastModified", asset.lastModified);
        json.put("size", asset.size);
        json.put("updatedAt", asset.updatedAt);
        json.put("checkedAt", asset.checkedAt);
        try (FileOutputStream output = new FileOutputStream(metadataFile(asset.key))) {
            output.write(json.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private String resolveKey(String rawKey, String url) throws Exception {
        if (rawKey != null && !rawKey.isEmpty()) {
            return sanitize(rawKey);
        }
        if (url == null || url.isEmpty()) {
            throw new IllegalArgumentException("key or url is required");
        }
        return sha256(url);
    }

    private String sanitize(String value) {
        String sanitized = value.replaceAll("[^a-zA-Z0-9._-]", "_");
        return sanitized.isEmpty() ? "asset" : sanitized;
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        for (byte item : hash) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    private String fileName(String key, URL url) {
        if (key.contains(".")) {
            return key;
        }
        String path = url.getPath();
        int dotIndex = path.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < path.length() - 1) {
            return key + path.substring(dotIndex);
        }
        return key;
    }

    private boolean fileExists(StoredAsset asset) {
        return fileFor(asset).exists();
    }

    private File fileFor(StoredAsset asset) {
        return new File(filesDirectory(), asset.fileName);
    }

    private File metadataFile(String key) {
        return new File(metadataDirectory(), key + ".json");
    }

    private File rootDirectory() {
        return new File(context.getFilesDir(), ROOT_DIR);
    }

    private File filesDirectory() {
        return new File(rootDirectory(), FILES_DIR);
    }

    private File metadataDirectory() {
        return new File(rootDirectory(), METADATA_DIR);
    }

    private void ensureDirectories() throws IOException {
        if (!filesDirectory().exists() && !filesDirectory().mkdirs()) {
            throw new IOException("Unable to create asset cache files directory");
        }
        if (!metadataDirectory().exists() && !metadataDirectory().mkdirs()) {
            throw new IOException("Unable to create asset cache metadata directory");
        }
    }

    private void copyFile(File source, File destination) throws IOException {
        try (InputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }
    }

    private void deleteRecursively(File file) {
        if (!file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        file.delete();
    }

    private String normalizeMimeType(String value) {
        if (value == null) {
            return null;
        }
        int separator = value.indexOf(';');
        return separator == -1 ? value : value.substring(0, separator);
    }

    private long timestamp() {
        return System.currentTimeMillis();
    }

    private static class StoredAsset {

        String key;
        String url;
        String fileName;
        String mimeType;
        String etag;
        String lastModified;
        long size;
        long updatedAt;
        long checkedAt;
    }
}
