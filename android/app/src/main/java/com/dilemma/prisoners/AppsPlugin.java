package com.dilemma.prisoners;

import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Мостик к соседним играм: проверить, установлена ли игра, открыть её
 * или отправить пользователя на страницу со сборками.
 *
 * Видимость чужих пакетов на Android 11+ ограничена, поэтому имена
 * наших игр перечислены в manifest внутри блока queries.
 */
@CapacitorPlugin(name = "Apps")
public class AppsPlugin extends Plugin {

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String packageId = call.getString("packageId");
        JSObject result = new JSObject();

        if (packageId == null || packageId.isEmpty()) {
            result.put("installed", false);
            call.resolve(result);
            return;
        }

        boolean installed;
        try {
            getContext().getPackageManager().getPackageInfo(packageId, 0);
            installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }

        result.put("installed", installed);
        call.resolve(result);
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String packageId = call.getString("packageId");
        if (packageId == null || packageId.isEmpty()) {
            call.reject("Не указан идентификатор приложения");
            return;
        }

        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageId);
        if (intent == null) {
            call.reject("Приложение не установлено");
            return;
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Не указана ссылка");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
