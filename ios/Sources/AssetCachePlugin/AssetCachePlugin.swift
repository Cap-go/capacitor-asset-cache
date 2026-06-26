import Foundation
import Capacitor

@objc(AssetCachePlugin)
public class AssetCachePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AssetCachePlugin"
    public let jsName = "AssetCache"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCacheSize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPluginVersion", returnType: CAPPluginReturnPromise)
    ]

    private let implementation = AssetCache()

    @objc func get(_ call: CAPPluginCall) {
        guard let url = call.getString("url") else {
            call.reject("url is required")
            return
        }

        let key = call.getString("key")
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        let revalidate = call.getObject("revalidate") ?? [:]

        Task {
            do {
                let result = try await implementation.get(url: url, key: key, headers: headers, revalidate: revalidate)
                resolve(call, result)
            } catch {
                reject(call, error)
            }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        Task {
            do {
                let result = try implementation.remove(key: call.getString("key"), url: call.getString("url"))
                resolve(call, result)
            } catch {
                reject(call, error)
            }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        Task {
            do {
                let result = try implementation.clear()
                resolve(call, result)
            } catch {
                reject(call, error)
            }
        }
    }

    @objc func list(_ call: CAPPluginCall) {
        Task {
            do {
                let result = try implementation.list()
                resolve(call, result)
            } catch {
                reject(call, error)
            }
        }
    }

    @objc func getCacheSize(_ call: CAPPluginCall) {
        Task {
            do {
                let result = try implementation.getCacheSize()
                resolve(call, result)
            } catch {
                reject(call, error)
            }
        }
    }

    @objc func getPluginVersion(_ call: CAPPluginCall) {
        call.resolve([
            "version": implementation.getPluginVersion()
        ])
    }

    private func resolve(_ call: CAPPluginCall, _ data: [String: Any]) {
        DispatchQueue.main.async {
            call.resolve(data)
        }
    }

    private func reject(_ call: CAPPluginCall, _ error: Error) {
        DispatchQueue.main.async {
            call.reject(error.localizedDescription)
        }
    }
}
