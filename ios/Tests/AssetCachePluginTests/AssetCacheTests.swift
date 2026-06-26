import XCTest
@testable import AssetCachePlugin

class AssetCacheTests: XCTestCase {
    func testGetPluginVersion() {
        let implementation = AssetCache()
        let result = implementation.getPluginVersion()

        XCTAssertEqual("native", result)
    }
}
