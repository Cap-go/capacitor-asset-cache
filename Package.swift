// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapgoCapacitorAssetCache",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapgoCapacitorAssetCache",
            targets: ["AssetCachePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "AssetCachePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/AssetCachePlugin"),
        .testTarget(
            name: "AssetCachePluginTests",
            dependencies: ["AssetCachePlugin"],
            path: "ios/Tests/AssetCachePluginTests")
    ]
)
