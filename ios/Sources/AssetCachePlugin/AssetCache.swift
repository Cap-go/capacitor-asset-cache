import CryptoKit
import Foundation

private enum AssetCacheError: LocalizedError {
    case missingIdentifier
    case invalidUrl
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .missingIdentifier:
            return "key or url is required"
        case .invalidUrl:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid HTTP response"
        case .httpStatus(let status):
            return "Failed to fetch asset: HTTP \(status)"
        }
    }
}

private struct StoredAsset: Codable {
    var key: String
    var url: String
    var fileName: String
    var mimeType: String?
    var etag: String?
    var lastModified: String?
    var size: Int64
    var updatedAt: Int64
    var checkedAt: Int64
}

@objc public class AssetCache: NSObject {
    private let rootName = "CapgoAssetCache"

    func get(url urlString: String, key rawKey: String?, headers: [String: String], revalidate: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: urlString), let scheme = url.scheme, ["http", "https"].contains(scheme.lowercased()) else {
            throw AssetCacheError.invalidUrl
        }

        try ensureDirectories()

        let key = try resolveKey(rawKey, urlString)
        let strategy = revalidate["strategy"] as? String ?? "never"
        let metadata = try readMetadata(key)

        if let metadata, fileExists(metadata), isFresh(metadata, strategy: strategy, maxAgeSeconds: revalidate["maxAgeSeconds"] as? Int) {
            return result(metadata, fromCache: true, status: "hit")
        }

        var request = URLRequest(url: url)
        for (header, value) in headers {
            request.setValue(value, forHTTPHeaderField: header)
        }
        if let metadata {
            applyValidators(metadata, to: &request, strategy: strategy)
        }

        let (temporaryURL, response) = try await URLSession.shared.download(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AssetCacheError.invalidResponse
        }

        let now = timestamp()
        if httpResponse.statusCode == 304, var metadata {
            metadata.checkedAt = now
            try writeMetadata(metadata)
            return result(metadata, fromCache: true, status: "notModified")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw AssetCacheError.httpStatus(httpResponse.statusCode)
        }

        let fileName = metadata?.fileName ?? fileName(for: key, url: url)
        let destination = filesDirectory().appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporaryURL, to: destination)

        let size = try fileSize(destination)
        let next = StoredAsset(
            key: key,
            url: urlString,
            fileName: fileName,
            mimeType: normalizeMimeType(httpResponse.value(forHTTPHeaderField: "Content-Type")),
            etag: httpResponse.value(forHTTPHeaderField: "ETag"),
            lastModified: httpResponse.value(forHTTPHeaderField: "Last-Modified"),
            size: size,
            updatedAt: now,
            checkedAt: now
        )
        try writeMetadata(next)
        return result(next, fromCache: false, status: "downloaded")
    }

    func remove(key rawKey: String?, url urlString: String?) throws -> [String: Any] {
        let key = try resolveKey(rawKey, urlString)
        guard let metadata = try readMetadata(key) else {
            return ["removed": false]
        }

        var removed = false
        let fileURL = fileURL(for: metadata)
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
            removed = true
        }
        let metadataURL = metadataURL(for: key)
        if FileManager.default.fileExists(atPath: metadataURL.path) {
            try FileManager.default.removeItem(at: metadataURL)
            removed = true
        }
        return ["removed": removed]
    }

    func clear() throws -> [String: Any] {
        let removed = try storedAssets().count
        let root = rootDirectory()
        if FileManager.default.fileExists(atPath: root.path) {
            try FileManager.default.removeItem(at: root)
        }
        try ensureDirectories()
        return ["removed": removed]
    }

    func list() throws -> [String: Any] {
        let assets = try storedAssets().map { result($0, fromCache: true, status: "hit") }
        return ["assets": assets]
    }

    func getCacheSize() throws -> [String: Any] {
        let size = try storedAssets().reduce(Int64(0)) { total, asset in
            total + (try fileSize(fileURL(for: asset)))
        }
        return ["size": size]
    }

    @objc public func getPluginVersion() -> String {
        return "native"
    }

    private func resolveKey(_ key: String?, _ url: String?) throws -> String {
        if let key, !key.isEmpty {
            return sanitize(key)
        }
        guard let url, !url.isEmpty else {
            throw AssetCacheError.missingIdentifier
        }
        return sha256(url)
    }

    private func isFresh(_ asset: StoredAsset, strategy: String, maxAgeSeconds: Int?) -> Bool {
        switch strategy {
        case "never":
            return true
        case "ttl":
            let ttl = Int64(max(0, maxAgeSeconds ?? 0)) * 1000
            return ttl > 0 && timestamp() - asset.updatedAt < ttl
        default:
            return false
        }
    }

    private func applyValidators(_ asset: StoredAsset, to request: inout URLRequest, strategy: String) {
        if (strategy == "always" || strategy == "etag") && request.value(forHTTPHeaderField: "If-None-Match") == nil {
            request.setValue(asset.etag, forHTTPHeaderField: "If-None-Match")
        }
        if (strategy == "always" || strategy == "last-modified") && request.value(forHTTPHeaderField: "If-Modified-Since") == nil {
            request.setValue(asset.lastModified, forHTTPHeaderField: "If-Modified-Since")
        }
        if strategy == "ttl" {
            if request.value(forHTTPHeaderField: "If-None-Match") == nil {
                request.setValue(asset.etag, forHTTPHeaderField: "If-None-Match")
            }
            if request.value(forHTTPHeaderField: "If-Modified-Since") == nil {
                request.setValue(asset.lastModified, forHTTPHeaderField: "If-Modified-Since")
            }
        }
    }

    private func result(_ asset: StoredAsset, fromCache: Bool, status: String) -> [String: Any] {
        let file = fileURL(for: asset)
        var data: [String: Any] = [
            "key": asset.key,
            "url": asset.url,
            "path": file.path,
            "uri": file.absoluteString,
            "size": asset.size,
            "updatedAt": asset.updatedAt,
            "checkedAt": asset.checkedAt,
            "fromCache": fromCache,
            "status": status
        ]
        data["mimeType"] = asset.mimeType
        data["etag"] = asset.etag
        data["lastModified"] = asset.lastModified
        return data
    }

    private func storedAssets() throws -> [StoredAsset] {
        let directory = metadataDirectory()
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return []
        }

        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        return files.compactMap { file in
            guard file.pathExtension == "json",
                  let data = try? Data(contentsOf: file),
                  let asset = try? JSONDecoder().decode(StoredAsset.self, from: data),
                  fileExists(asset) else {
                return nil
            }
            return asset
        }
    }

    private func readMetadata(_ key: String) throws -> StoredAsset? {
        let url = metadataURL(for: key)
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(StoredAsset.self, from: data)
    }

    private func writeMetadata(_ asset: StoredAsset) throws {
        let data = try JSONEncoder().encode(asset)
        try data.write(to: metadataURL(for: asset.key), options: .atomic)
    }

    private func fileExists(_ asset: StoredAsset) -> Bool {
        return FileManager.default.fileExists(atPath: fileURL(for: asset).path)
    }

    private func fileURL(for asset: StoredAsset) -> URL {
        return filesDirectory().appendingPathComponent(asset.fileName, isDirectory: false)
    }

    private func metadataURL(for key: String) -> URL {
        return metadataDirectory().appendingPathComponent("\(key).json", isDirectory: false)
    }

    private func ensureDirectories() throws {
        let directories = [rootDirectory(), filesDirectory(), metadataDirectory()]
        for directory in directories where !FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        var root = rootDirectory()
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try root.setResourceValues(values)
    }

    private func rootDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent(rootName, isDirectory: true)
    }

    private func filesDirectory() -> URL {
        return rootDirectory().appendingPathComponent("files", isDirectory: true)
    }

    private func metadataDirectory() -> URL {
        return rootDirectory().appendingPathComponent("metadata", isDirectory: true)
    }

    private func fileName(for key: String, url: URL) -> String {
        if key.contains(".") {
            return key
        }
        let pathExtension = url.pathExtension
        return pathExtension.isEmpty ? key : "\(key).\(pathExtension)"
    }

    private func fileSize(_ url: URL) throws -> Int64 {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        return attributes[.size] as? Int64 ?? 0
    }

    private func normalizeMimeType(_ value: String?) -> String? {
        return value?.split(separator: ";").first.map { String($0) }
    }

    private func sanitize(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        return String(value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
    }

    private func sha256(_ value: String) -> String {
        let data = Data(value.utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func timestamp() -> Int64 {
        return Int64(Date().timeIntervalSince1970 * 1000)
    }
}
