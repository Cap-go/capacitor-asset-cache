package app.capgo.asset_cache;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AssetCache")
public class AssetCachePlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AssetCache implementation;

    @Override
    public void load() {
        implementation = new AssetCache(getContext().getApplicationContext());
    }

    @PluginMethod
    public void get(PluginCall call) {
        run(call, () ->
            implementation.get(
                call.getString("url"),
                call.getString("key"),
                call.getObject("headers", new JSObject()),
                call.getObject("revalidate", new JSObject())
            )
        );
    }

    @PluginMethod
    public void remove(PluginCall call) {
        run(call, () -> implementation.remove(call.getString("key"), call.getString("url")));
    }

    @PluginMethod
    public void clear(PluginCall call) {
        run(call, () -> implementation.clear());
    }

    @PluginMethod
    public void list(PluginCall call) {
        run(call, () -> implementation.list());
    }

    @PluginMethod
    public void getCacheSize(PluginCall call) {
        run(call, () -> implementation.getCacheSize());
    }

    @PluginMethod
    public void getPluginVersion(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("version", implementation.getPluginVersion());
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void run(PluginCall call, Action action) {
        executor.execute(() -> {
            try {
                call.resolve(action.run());
            } catch (Exception exception) {
                call.reject(exception.getMessage());
            }
        });
    }

    private interface Action {
        JSObject run() throws Exception;
    }
}
