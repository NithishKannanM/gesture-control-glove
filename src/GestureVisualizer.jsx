import React, { useState, useEffect, useRef } from 'react';
import { Activity, Bluetooth, BluetoothOff, Hand, Waves, TrendingUp, TrendingDown, ArrowLeft, ArrowRight, RotateCw, RotateCcw, Brain, ToggleLeft, ToggleRight } from 'lucide-react';
import GestureClassifier from './ml/GestureClassifier';
import GestureTrainer from './components/GestureTrainer';

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
  const [useML, setUseML] = useState(false);
  const [mlConfidence, setMlConfidence] = useState(0);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [showTrainer, setShowTrainer] = useState(false);
  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);
  const classifierRef = useRef(null);

  const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  const gestureNames = [
    'IDLE', 'FIST', 'OPEN_HAND', 'WAVE_LEFT', 'WAVE_RIGHT',
    'TILT_UP', 'TILT_DOWN', 'TILT_RIGHT', 'TILT_LEFT'
  ];

  // Initialize ML classifier
  useEffect(() => {
    const initClassifier = async () => {
      classifierRef.current = new GestureClassifier();
      await classifierRef.current.initialize();
    };
    initClassifier();
  }, []);

  const gestureIcons = {
    0: <Activity className="w-12 h-12" />,
    1: <Hand className="w-12 h-12" />,
    2: <Hand className="w-12 h-12" />,
    3: <ArrowLeft className="w-12 h-12" />,
    4: <ArrowRight className="w-12 h-12" />,
    5: <TrendingUp className="w-12 h-12" />,
    6: <TrendingDown className="w-12 h-12" />,
    7: <RotateCw className="w-12 h-12" />,
    8: <RotateCcw className="w-12 h-12" />
  };

  const gestureColors = {
    0: 'from-gray-400 to-gray-600',
    1: 'from-red-500 to-orange-600',
    2: 'from-blue-500 to-cyan-600',
    3: 'from-purple-500 to-pink-600',
    4: 'from-green-500 to-emerald-600',
    5: 'from-yellow-500 to-amber-600',
    6: 'from-indigo-500 to-purple-600',
    7: 'from-teal-500 to-cyan-600',
    8: 'from-rose-500 to-pink-600'
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

  const parseData = async (data) => {
    try {
      // Format: "id:name|f1,f2,ax,ay,az,gx,gy,gz"
      const [gesturePart, sensorPart] = data.split('|');
      const [id, name] = gesturePart.split(':');
      const [f1, f2, ax, ay, az, gx, gy, gz] = sensorPart.split(',').map(Number);

      const sensorDataObj = { flex1: f1, flex2: f2, ax, ay, az, gx, gy, gz };
      setSensorData(sensorDataObj);

      let gesture = { id: parseInt(id), name };
      
      // Use ML prediction if enabled and model is available
      if (useML && classifierRef.current && classifierRef.current.model) {
        try {
          const prediction = await classifierRef.current.predict(sensorDataObj);
          if (prediction.confidence > 0.5) { // Only use ML if confidence > 50%
            gesture = {
              id: prediction.gestureId,
              name: gestureNames[prediction.gestureId] || 'UNKNOWN',
              mlPredicted: true
            };
            setMlConfidence(prediction.confidence);
            setMlPrediction(prediction);
          } else {
            // Fall back to ESP32 detection if ML confidence is low
            setMlConfidence(0);
            setMlPrediction(null);
          }
        } catch (err) {
          console.error('ML prediction error:', err);
          setMlConfidence(0);
          setMlPrediction(null);
        }
      } else {
        setMlConfidence(0);
        setMlPrediction(null);
      }

      setCurrentGesture(gesture);
      
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
          <p className="text-gray-400">Real-time ESP32 gesture visualization with ML</p>
          
          {/* ML Toggle */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className={`text-sm ${!useML ? 'text-white' : 'text-gray-400'}`}>ESP32 Detection</span>
            <button
              onClick={() => setUseML(!useML)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                useML ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  useML ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm flex items-center gap-1 ${useML ? 'text-white' : 'text-gray-400'}`}>
              <Brain className="w-4 h-4" />
              ML Prediction
            </span>
            <button
              onClick={() => setShowTrainer(!showTrainer)}
              className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <Brain className="w-4 h-4" />
              {showTrainer ? 'Hide' : 'Show'} Trainer
            </button>
          </div>
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
            {useML && mlConfidence > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Brain className="w-5 h-5" />
                  <span className="text-lg">ML Confidence: {(mlConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full max-w-xs mx-auto h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/60 transition-all duration-300"
                    style={{ width: `${mlConfidence * 100}%` }}
                  />
                </div>
              </div>
            )}
            {currentGesture.mlPredicted && (
              <p className="text-sm mt-2 opacity-70">ML Predicted</p>
            )}
          </div>
        </div>

        {/* ML Trainer */}
        {showTrainer && (
          <div className="mb-8">
            <GestureTrainer
              sensorData={sensorData}
              classifier={classifierRef.current}
              onTrainingComplete={() => {
                console.log('Training completed');
              }}
            />
          </div>
        )}

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

