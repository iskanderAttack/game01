package com.dilemma.seabattle;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Комната по Wi-Fi живёт в собственном плагине приложения.
        registerPlugin(LanPlugin.class);
        // Переходы к соседним играм.
        registerPlugin(AppsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
