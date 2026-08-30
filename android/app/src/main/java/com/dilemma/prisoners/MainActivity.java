package com.dilemma.prisoners;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Комната по Wi-Fi живёт в собственном плагине приложения.
        registerPlugin(LanPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
