package com.jogoburro.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Plugin nativo que transforma o celular do ANFITRIÃO em periférico BLE:
 *  - anuncia a partida (advertising) com o UUID do serviço do jogo;
 *  - abre um GATT server com duas características:
 *      RX (write)  → convidados escrevem mensagens para o anfitrião;
 *      TX (notify) → anfitrião envia mensagens para UM convidado específico.
 *
 * O @capacitor-community/bluetooth-le cobre só o papel de central (usado pelos convidados).
 * Interface JS: src/transport/ble/peripheralPlugin.ts
 */
@SuppressLint("MissingPermission")
@CapacitorPlugin(
    name = "BurroPeripheral",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = { Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT }
        )
    }
)
public class BurroPeripheralPlugin extends Plugin {

    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final long TIMEOUT_NOTIFICACAO_MS = 3000;

    private BluetoothManager manager;
    private BluetoothGattServer servidor;
    private BluetoothLeAdvertiser anunciante;
    private BluetoothGattCharacteristic tx;
    private UUID uuidServico;
    private UUID uuidRx;
    private UUID uuidTx;
    private int companyId;
    private byte[] dadosAnuncio = new byte[0];
    private boolean anunciando = false;

    private final Map<String, BluetoothDevice> dispositivos = new ConcurrentHashMap<>();
    private final Map<String, ByteArrayOutputStream> escritasPreparadas = new ConcurrentHashMap<>();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private PluginCall chamadaIniciar;
    private PluginCall chamadaNotificar;
    private Runnable timeoutNotificar;

    // ------------------------------------------------------------------ permissões

    private boolean precisaPermissaoNova() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    private boolean temPermissoes() {
        return !precisaPermissaoNova() || getPermissionState("bluetooth") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void garantirPermissoes(PluginCall call) {
        if (temPermissoes()) {
            JSObject ret = new JSObject();
            ret.put("concedidas", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("bluetooth", call, "aoResponderPermissoes");
    }

    @PermissionCallback
    private void aoResponderPermissoes(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("concedidas", temPermissoes());
        call.resolve(ret);
    }

    // ------------------------------------------------------------------ suporte

    private BluetoothAdapter adaptador() {
        if (manager == null) manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    @PluginMethod
    public void suportado(PluginCall call) {
        JSObject ret = new JSObject();
        BluetoothAdapter a = adaptador();
        if (a == null) {
            ret.put("suportado", false);
            ret.put("motivo", "Este aparelho não possui Bluetooth.");
        } else if (!a.isEnabled()) {
            ret.put("suportado", false);
            ret.put("motivo", "O Bluetooth está desligado.");
        } else if (!a.isMultipleAdvertisementSupported() || a.getBluetoothLeAdvertiser() == null) {
            ret.put("suportado", false);
            ret.put("motivo", "Este aparelho não consegue anunciar partidas (modo periférico BLE). Peça para outro jogador criar a partida.");
        } else {
            ret.put("suportado", true);
        }
        call.resolve(ret);
    }

    // ------------------------------------------------------------------ iniciar / parar

    @PluginMethod
    public void iniciar(PluginCall call) {
        if (!temPermissoes()) {
            call.reject("Permissão de Bluetooth negada");
            return;
        }
        BluetoothAdapter a = adaptador();
        if (a == null || !a.isEnabled()) {
            call.reject("Bluetooth desligado");
            return;
        }
        try {
            uuidServico = UUID.fromString(call.getString("serviceUuid"));
            uuidRx = UUID.fromString(call.getString("rxUuid"));
            uuidTx = UUID.fromString(call.getString("txUuid"));
            companyId = call.getInt("companyId", 0xFFFF);
            dadosAnuncio = Base64.decode(call.getString("dadosAnuncio", ""), Base64.DEFAULT);
        } catch (Exception e) {
            call.reject("Parâmetros inválidos: " + e.getMessage());
            return;
        }

        pararTudo();
        anunciante = a.getBluetoothLeAdvertiser();
        servidor = manager.openGattServer(getContext(), callbackServidor);
        if (servidor == null || anunciante == null) {
            call.reject("Não foi possível abrir o servidor Bluetooth");
            return;
        }

        BluetoothGattService servico = new BluetoothGattService(uuidServico, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic rx = new BluetoothGattCharacteristic(
            uuidRx,
            BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        tx = new BluetoothGattCharacteristic(
            uuidTx,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ
        );
        tx.addDescriptor(
            new BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE)
        );
        servico.addCharacteristic(rx);
        servico.addCharacteristic(tx);

        chamadaIniciar = call;
        // O anúncio começa em onServiceAdded, quando o serviço já está registrado.
        if (!servidor.addService(servico)) {
            chamadaIniciar = null;
            call.reject("Não foi possível registrar o serviço do jogo");
        }
    }

    @PluginMethod
    public void atualizarAnuncio(PluginCall call) {
        dadosAnuncio = Base64.decode(call.getString("dadosAnuncio", ""), Base64.DEFAULT);
        if (anunciante != null && anunciando) {
            anunciante.stopAdvertising(callbackAnuncio);
            anunciando = false;
            comecarAnuncio();
        }
        call.resolve();
    }

    @PluginMethod
    public void parar(PluginCall call) {
        pararTudo();
        call.resolve();
    }

    private void pararTudo() {
        if (anunciante != null && anunciando) {
            try {
                anunciante.stopAdvertising(callbackAnuncio);
            } catch (Exception ignored) {}
        }
        anunciando = false;
        if (servidor != null) {
            for (BluetoothDevice d : dispositivos.values()) {
                try {
                    servidor.cancelConnection(d);
                } catch (Exception ignored) {}
            }
            try {
                servidor.close();
            } catch (Exception ignored) {}
        }
        servidor = null;
        dispositivos.clear();
        escritasPreparadas.clear();
        concluirNotificacao(false, "Servidor encerrado");
    }

    @Override
    protected void handleOnDestroy() {
        pararTudo();
        super.handleOnDestroy();
    }

    private void comecarAnuncio() {
        if (anunciante == null) return;
        AdvertiseSettings config = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build();
        // Pacote principal: só o UUID de 128 bits (cabe nos 31 bytes).
        AdvertiseData dados = new AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(new ParcelUuid(uuidServico))
            .build();
        // Scan response: nome do anfitrião e nº de jogadores (dados de fabricante).
        AdvertiseData resposta = new AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addManufacturerData(companyId, dadosAnuncio)
            .build();
        anunciante.startAdvertising(config, dados, resposta, callbackAnuncio);
    }

    private final AdvertiseCallback callbackAnuncio = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            anunciando = true;
            if (chamadaIniciar != null) {
                chamadaIniciar.resolve();
                chamadaIniciar = null;
            }
        }

        @Override
        public void onStartFailure(int errorCode) {
            anunciando = false;
            if (chamadaIniciar != null) {
                chamadaIniciar.reject("Falha ao anunciar a partida (código " + errorCode + ")");
                chamadaIniciar = null;
            }
        }
    };

    // ------------------------------------------------------------------ envio

    @PluginMethod
    public void notificar(PluginCall call) {
        String id = call.getString("deviceId");
        BluetoothDevice device = id == null ? null : dispositivos.get(id);
        if (servidor == null || tx == null || device == null) {
            call.reject("Dispositivo não conectado");
            return;
        }
        if (chamadaNotificar != null) {
            call.reject("Outra notificação em andamento");
            return;
        }
        byte[] valor = Base64.decode(call.getString("valor", ""), Base64.DEFAULT);
        chamadaNotificar = call;
        timeoutNotificar = () -> concluirNotificacao(false, "Tempo esgotado ao enviar");
        handler.postDelayed(timeoutNotificar, TIMEOUT_NOTIFICACAO_MS);

        boolean enviado;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            enviado = servidor.notifyCharacteristicChanged(device, tx, false, valor) == BluetoothGatt.GATT_SUCCESS;
        } else {
            tx.setValue(valor);
            enviado = servidor.notifyCharacteristicChanged(device, tx, false);
        }
        if (!enviado) concluirNotificacao(false, "Falha ao enviar notificação");
    }

    private synchronized void concluirNotificacao(boolean ok, String erro) {
        if (timeoutNotificar != null) handler.removeCallbacks(timeoutNotificar);
        timeoutNotificar = null;
        PluginCall c = chamadaNotificar;
        chamadaNotificar = null;
        if (c == null) return;
        if (ok) c.resolve();
        else c.reject(erro);
    }

    @PluginMethod
    public void desconectar(PluginCall call) {
        String id = call.getString("deviceId");
        BluetoothDevice device = id == null ? null : dispositivos.get(id);
        if (servidor != null && device != null) servidor.cancelConnection(device);
        call.resolve();
    }

    // ------------------------------------------------------------------ eventos do GATT server

    private void emitir(String evento, JSObject dados) {
        notifyListeners(evento, dados);
    }

    private final BluetoothGattServerCallback callbackServidor = new BluetoothGattServerCallback() {
        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                handler.post(BurroPeripheralPlugin.this::comecarAnuncio);
            } else if (chamadaIniciar != null) {
                chamadaIniciar.reject("Falha ao registrar o serviço (status " + status + ")");
                chamadaIniciar = null;
            }
        }

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            String id = device.getAddress();
            JSObject e = new JSObject();
            e.put("deviceId", id);
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                dispositivos.put(id, device);
                e.put("conectado", true);
                emitir("conexao", e);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                dispositivos.remove(id);
                escritasPreparadas.remove(id);
                e.put("conectado", false);
                emitir("conexao", e);
            }
        }

        @Override
        public void onMtuChanged(BluetoothDevice device, int mtu) {
            JSObject e = new JSObject();
            e.put("deviceId", device.getAddress());
            e.put("mtu", mtu);
            emitir("mtu", e);
        }

        @Override
        public void onCharacteristicWriteRequest(
            BluetoothDevice device,
            int requestId,
            BluetoothGattCharacteristic characteristic,
            boolean preparedWrite,
            boolean responseNeeded,
            int offset,
            byte[] value
        ) {
            boolean ehRx = characteristic.getUuid().equals(uuidRx);
            if (ehRx && value != null) {
                if (preparedWrite) {
                    // Escrita longa: acumula até onExecuteWrite.
                    ByteArrayOutputStream buf = escritasPreparadas.get(device.getAddress());
                    if (buf == null) {
                        buf = new ByteArrayOutputStream();
                        escritasPreparadas.put(device.getAddress(), buf);
                    }
                    buf.write(value, 0, value.length);
                } else {
                    emitirEscrita(device, value);
                }
            }
            if (responseNeeded && servidor != null) {
                servidor.sendResponse(
                    device,
                    requestId,
                    ehRx ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_WRITE_NOT_PERMITTED,
                    offset,
                    value
                );
            }
        }

        @Override
        public void onExecuteWrite(BluetoothDevice device, int requestId, boolean execute) {
            ByteArrayOutputStream buf = escritasPreparadas.remove(device.getAddress());
            if (execute && buf != null) emitirEscrita(device, buf.toByteArray());
            if (servidor != null) servidor.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
        }

        @Override
        public void onDescriptorWriteRequest(
            BluetoothDevice device,
            int requestId,
            BluetoothGattDescriptor descriptor,
            boolean preparedWrite,
            boolean responseNeeded,
            int offset,
            byte[] value
        ) {
            if (descriptor.getUuid().equals(CCCD)) {
                boolean ativa =
                    Arrays.equals(value, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) ||
                    Arrays.equals(value, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
                JSObject e = new JSObject();
                e.put("deviceId", device.getAddress());
                e.put("ativa", ativa);
                emitir("inscricao", e);
            }
            if (responseNeeded && servidor != null) {
                servidor.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }

        @Override
        public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattDescriptor descriptor) {
            if (servidor != null) {
                servidor.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    0,
                    BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
                );
            }
        }

        @Override
        public void onCharacteristicReadRequest(
            BluetoothDevice device,
            int requestId,
            int offset,
            BluetoothGattCharacteristic characteristic
        ) {
            if (servidor != null) servidor.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, new byte[0]);
        }

        @Override
        public void onNotificationSent(BluetoothDevice device, int status) {
            concluirNotificacao(status == BluetoothGatt.GATT_SUCCESS, "Falha ao entregar notificação (status " + status + ")");
        }
    };

    private void emitirEscrita(BluetoothDevice device, byte[] valor) {
        JSObject e = new JSObject();
        e.put("deviceId", device.getAddress());
        e.put("valor", Base64.encodeToString(valor, Base64.NO_WRAP));
        emitir("escrita", e);
    }
}
