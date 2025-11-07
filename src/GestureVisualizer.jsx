import React, { useState, useEffect, useRef } from 'react';
import { Activity, Bluetooth, BluetoothOff, Hand, Waves, TrendingUp, TrendingDown, ArrowLeft, ArrowRight } from 'lucide-react';

const GestureVisualizer = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentGesture, setCurrentGesture] = useState({ id: 0, name: 'IDLE' });
  const [sensorData, setSensorData] = useState({
    flex1: 0, flex2: 0,
    ax: 0, ay: 0, az: 0,
    gx: 0, gy: 0, gz: 0
  });
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);

  const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  const gestureIcons = {
    0: <Activity className="w-12 h-12" />,
    1: <Hand className="w-12 h-12" />,
    2: <Hand className="w-12 h-12" />,
    3: <ArrowLeft className="w-12 h-12" />,
    4: <ArrowRight className="w-12 h-12" />,
    5: <TrendingUp className="w-12 h-12" />,
    6: <TrendingDown className="w-12 h-12" />
  };

  const gestureColors = {
    0: 'from-gray-400 to-gray-600',
    1: 'from-red-500 to-orange-600',
    2: 'from-blue-500 to-cyan-600',
    3: 'from-purple-500 to-pink-600',
    4: 'from-green-500 to-emerald-600',
    5: 'from-yellow-500 to-amber-600',
    6: 'from-indigo-500 to-purple-600'
  };

  const connectBLE = async () => {
    try {
      setError('');
      
      if (!navigator.bluetooth) {
        setError('Web Bluetooth not supported. Use Chrome/Edge on desktop or Android.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ESP32_Gesture' }],
        optionalServices: [SERVICE_UUID]
      });

      deviceRef.current = device;
      device.addEventListener('gattserverdisconnected', handleDisconnect);

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHAR_UUID);
      
      characteristicRef.current = characteristic;
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', handleDataReceived);
      
      setIsConnected(true);
    } catch (err) {
      setError(`Connection failed: ${err.message}`);
      console.error(err);
    }
  };

  const handleDataReceived = (event) => {
    const value = new TextDecoder().decode(event.target.value);
    parseData(value);
  };

  const parseData = (data) => {
    try {
      // Format: "id:name|f1,f2,ax,ay,az,gx,gy,gz"
      const [gesturePart, sensorPart] = data.split('|');
      const [id, name] = gesturePart.split(':');
      const [f1, f2, ax, ay, az, gx, gy, gz] = sensorPart.split(',').map(Number);

      const gesture = { id: parseInt(id), name };
      setCurrentGesture(gesture);
      setSensorData({ flex1: f1, flex2: f2, ax, ay, az, gx, gy, gz });
      
      setHistory(prev => {
        const newHistory = [{ ...gesture, timestamp: Date.now() }, ...prev];
        return newHistory.slice(0, 10);
      });
    } catch (err) {
      console.error('Parse error:', err);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setCurrentGesture({ id: 0, name: 'IDLE' });
    setError('Device disconnected');
  };

  const disconnect = () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      deviceRef.current.gatt.disconnect();
    }
    setIsConnected(false);
  };

  const normalizeValue = (value, min, max) => {
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Gesture Control
          </h1>
          <p className="text-gray-400">Real-time ESP32 gesture visualization</p>
        </div>

        {/* Connection Button */}
        <div className="flex justify-center mb-8">
          {!isConnected ? (
            <button
              onClick={connectBLE}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-4 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-all"
            >
              <Bluetooth className="w-6 h-6" />
              Connect to ESP32
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-8 py-4 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-all"
            >
              <BluetoothOff className="w-6 h-6" />
              Disconnect
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 text-center">
            {error}
          </div>
        )}

        {/* Main Gesture Display */}
        <div className={`bg-gradient-to-br ${gestureColors[currentGesture.id]} rounded-3xl p-12 mb-8 shadow-2xl transform transition-all duration-300 ${isConnected ? 'scale-100' : 'scale-95 opacity-50'}`}>
          <div className="text-center">
            <div className="flex justify-center mb-6 text-white animate-pulse">
              {gestureIcons[currentGesture.id]}
            </div>
            <h2 className="text-6xl font-bold mb-2">{currentGesture.name}</h2>
            <p className="text-2xl opacity-80">Gesture ID: {currentGesture.id}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Flex Sensors */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Hand className="w-5 h-5" />
              Flex Sensors
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Flex 1</span>
                  <span className="font-mono">{sensorData.flex1}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${normalizeValue(sensorData.flex1, 1000, 3000)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Flex 2</span>
                  <span className="font-mono">{sensorData.flex2}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${normalizeValue(sensorData.flex2, 1000, 3000)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Accelerometer */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Accelerometer
            </h3>
            
            <div className="space-y-3">
              {['X', 'Y', 'Z'].map((axis, i) => {
                const value = [sensorData.ax, sensorData.ay, sensorData.az][i];
                const colors = ['from-red-500 to-orange-500', 'from-green-500 to-emerald-500', 'from-blue-500 to-cyan-500'];
                return (
                  <div key={axis} className="flex items-center gap-3">
                    <span className="w-6 font-semibold">{axis}:</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full relative overflow-hidden">
                      <div 
                        className={`absolute h-full bg-gradient-to-r ${colors[i]} transition-all duration-300`}
                        style={{ 
                          left: value < 0 ? `${50 + (value / 32768) * 50}%` : '50%',
                          right: value > 0 ? `${50 - (value / 32768) * 50}%` : '50%'
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-sm">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gyroscope */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Waves className="w-5 h-5" />
              Gyroscope
            </h3>
            
            <div className="space-y-3">
              {['X', 'Y', 'Z'].map((axis, i) => {
                const value = [sensorData.gx, sensorData.gy, sensorData.gz][i];
                const colors = ['from-yellow-500 to-amber-500', 'from-purple-500 to-pink-500', 'from-indigo-500 to-blue-500'];
                return (
                  <div key={axis} className="flex items-center gap-3">
                    <span className="w-6 font-semibold">{axis}:</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full relative overflow-hidden">
                      <div 
                        className={`absolute h-full bg-gradient-to-r ${colors[i]} transition-all duration-300`}
                        style={{ 
                          left: value < 0 ? `${50 + (value / 32768) * 50}%` : '50%',
                          right: value > 0 ? `${50 - (value / 32768) * 50}%` : '50%'
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-sm">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4">Recent Gestures</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No gestures yet</p>
              ) : (
                history.map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400">
                        {gestureIcons[item.id]}
                      </div>
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="text-center text-gray-500 text-sm">
          {isConnected ? (
            <p className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected to ESP32_Gesture
            </p>
          ) : (
            <p>Click "Connect to ESP32" to start</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestureVisualizer;

