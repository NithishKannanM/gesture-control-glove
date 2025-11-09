import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, Square, Download, Upload, Trash2, BarChart3 } from 'lucide-react';

const GestureTrainer = ({ sensorData, onTrainingComplete, classifier }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentGesture, setCurrentGesture] = useState(0);
  const [samples, setSamples] = useState({});
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [stats, setStats] = useState(null);
  const recordingIntervalRef = useRef(null);

  const gestureNames = [
    'IDLE', 'FIST', 'OPEN_HAND', 'WAVE_LEFT', 'WAVE_RIGHT',
    'TILT_UP', 'TILT_DOWN', 'TILT_RIGHT', 'TILT_LEFT'
  ];

  useEffect(() => {
    if (classifier) {
      updateStats();
    }
  }, [classifier]);

  const updateStats = () => {
    if (classifier) {
      setStats(classifier.getTrainingStats());
    }
  };

  const startRecording = () => {
    if (!sensorData || Object.values(sensorData).every(v => v === 0)) {
      alert('No sensor data available. Connect to ESP32 first.');
      return;
    }

    setIsRecording(true);
    const gestureName = gestureNames[currentGesture];
    
    // Record samples every 100ms
    recordingIntervalRef.current = setInterval(() => {
      if (classifier && sensorData) {
        classifier.addSample(sensorData, currentGesture);
        setSamples(prev => ({
          ...prev,
          [currentGesture]: (prev[currentGesture] || 0) + 1
        }));
        updateStats();
      }
    }, 100);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const trainModel = async () => {
    if (!classifier) {
      alert('Classifier not initialized');
      return;
    }

    setIsTraining(true);
    setTrainingProgress({ epoch: 0, loss: '0', accuracy: '0' });

    try {
      await classifier.train((progress) => {
        setTrainingProgress(progress);
      });

      alert('Training completed successfully!');
      if (onTrainingComplete) {
        onTrainingComplete();
      }
    } catch (err) {
      alert(`Training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
      setTrainingProgress(null);
    }
  };

  const clearData = () => {
    if (classifier) {
      classifier.clearTrainingData();
      setSamples({});
      updateStats();
    }
  };

  const exportData = () => {
    if (classifier && stats) {
      const data = {
        stats: stats,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gesture-training-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5" />
        ML Training
      </h3>

      {/* Gesture Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Gesture to Record:</label>
        <select
          value={currentGesture}
          onChange={(e) => setCurrentGesture(parseInt(e.target.value))}
          disabled={isRecording || isTraining}
          className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
        >
          {gestureNames.map((name, idx) => (
            <option key={idx} value={idx}>
              {idx}: {name}
            </option>
          ))}
        </select>
      </div>

      {/* Recording Controls */}
      <div className="flex gap-2 mb-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isTraining}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        )}
      </div>

      {/* Training Stats */}
      {stats && (
        <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="font-semibold">Training Data:</span>
          </div>
          <div className="text-sm space-y-1">
            <div>Total Samples: <span className="font-mono">{stats.totalSamples}</span></div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(stats.samplesPerClass || {}).map(([gestureId, count]) => (
                <div key={gestureId}>
                  {gestureNames[gestureId]}: <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Training Progress */}
      {isTraining && trainingProgress && (
        <div className="mb-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500/50">
          <div className="text-sm space-y-1">
            <div>Epoch: {trainingProgress.epoch}/50</div>
            <div>Loss: {trainingProgress.loss}</div>
            <div>Accuracy: {trainingProgress.accuracy}</div>
            {trainingProgress.valLoss && (
              <>
                <div>Val Loss: {trainingProgress.valLoss}</div>
                <div>Val Accuracy: {trainingProgress.valAccuracy}</div>
              </>
            )}
          </div>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(trainingProgress.epoch / 50) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={trainModel}
          disabled={!stats || stats.totalSamples < 10 || isTraining || isRecording}
          className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Brain className="w-4 h-4" />
          Train Model
        </button>
        <button
          onClick={clearData}
          disabled={isTraining || isRecording || !stats || stats.totalSamples === 0}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={exportData}
          disabled={!stats || stats.totalSamples === 0}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {isRecording && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-red-400 animate-pulse">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Recording {gestureNames[currentGesture]}...
          </span>
        </div>
      )}
    </div>
  );
};

export default GestureTrainer;

