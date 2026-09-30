package com.jogoburro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin nativo local (anfitrião como periférico BLE). Precisa ser registrado antes do super.onCreate.
        registerPlugin(BurroPeripheralPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
