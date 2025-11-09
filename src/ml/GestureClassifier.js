import * as tf from '@tensorflow/tfjs';

/**
 * Machine Learning Gesture Classifier
 * Uses TensorFlow.js to classify gestures from sensor data
 */
class GestureClassifier {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.trainingData = [];
    this.labels = [];
    this.numFeatures = 8; // flex1, flex2, ax, ay, az, gx, gy, gz
    this.numClasses = 9; // 0-8 gestures
  }

  /**
   * Initialize or load a pre-trained model
   */
  async initialize() {
    // Try to load saved model first
    const loaded = await this.loadModel();
    if (loaded) {
      return true;
    }

    // Create a new model
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.numFeatures],
          units: 64,
          activation: 'relu',
          name: 'dense1'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          name: 'dense2'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax',
          name: 'output'
        })
      ]
    });

    this.model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return false;
  }

  /**
   * Add training sample
   */
  addSample(sensorData, gestureId) {
    const features = [
      sensorData.flex1,
      sensorData.flex2,
      sensorData.ax,
      sensorData.ay,
      sensorData.az,
      sensorData.gx,
      sensorData.gy,
      sensorData.gz
    ];

    // Normalize features
    const normalized = this.normalizeFeatures(features);
    
    this.trainingData.push(normalized);
    this.labels.push(gestureId);
  }

  /**
   * Normalize sensor values to 0-1 range
   */
  normalizeFeatures(features) {
    // Normalize flex sensors (0-4095 -> 0-1)
    // Normalize accel/gyro (-32768 to 32767 -> -1 to 1)
    return [
      features[0] / 4095,  // flex1
      features[1] / 4095,  // flex2
      features[2] / 32768, // ax
      features[3] / 32768, // ay
      features[4] / 32768, // az
      features[5] / 32768, // gx
      features[6] / 32768, // gy
      features[7] / 32768  // gz
    ];
  }

  /**
   * Train the model
   */
  async train(onProgress) {
    if (this.trainingData.length < 10) {
      throw new Error('Need at least 10 samples to train');
    }

    this.isTraining = true;

    // Convert to tensors
    const xs = tf.tensor2d(this.trainingData);
    const ys = tf.oneHot(tf.tensor1d(this.labels, 'int32'), this.numClasses);

    // Train the model
    const history = await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (onProgress) {
            onProgress({
              epoch: epoch + 1,
              loss: logs.loss.toFixed(4),
              accuracy: logs.acc ? logs.acc.toFixed(4) : 'N/A',
              valLoss: logs.val_loss ? logs.val_loss.toFixed(4) : 'N/A',
              valAccuracy: logs.val_acc ? logs.val_acc.toFixed(4) : 'N/A'
            });
          }
        }
      }
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    // Save model
    await this.saveModel();

    this.isTraining = false;
    return history;
  }

  /**
   * Predict gesture from sensor data
   */
  async predict(sensorData) {
    if (!this.model) {
      await this.initialize();
    }

    const features = [
      sensorData.flex1,
      sensorData.flex2,
      sensorData.ax,
      sensorData.ay,
      sensorData.az,
      sensorData.gx,
      sensorData.gy,
      sensorData.gz
    ];

    const normalized = this.normalizeFeatures(features);
    const input = tf.tensor2d([normalized]);

    const prediction = this.model.predict(input);
    const probabilities = await prediction.data();
    const predictedClass = probabilities.indexOf(Math.max(...probabilities));
    const confidence = Math.max(...probabilities);

    input.dispose();
    prediction.dispose();

    return {
      gestureId: predictedClass,
      confidence: confidence,
      probabilities: Array.from(probabilities)
    };
  }

  /**
   * Save model to IndexedDB
   */
  async saveModel() {
    try {
      await this.model.save('indexeddb://gesture-model');
      console.log('Model saved to IndexedDB');
    } catch (err) {
      console.error('Error saving model:', err);
    }
  }

  /**
   * Load model from IndexedDB
   */
  async loadModel() {
    try {
      this.model = await tf.loadLayersModel('indexeddb://gesture-model');
      console.log('Model loaded from IndexedDB');
      return true;
    } catch (err) {
      console.log('No saved model found, will create new one');
      return false;
    }
  }

  /**
   * Clear training data
   */
  clearTrainingData() {
    this.trainingData = [];
    this.labels = [];
  }

  /**
   * Get training data statistics
   */
  getTrainingStats() {
    const stats = {};
    this.labels.forEach(label => {
      stats[label] = (stats[label] || 0) + 1;
    });
    return {
      totalSamples: this.trainingData.length,
      samplesPerClass: stats
    };
  }

  /**
   * Reset model
   */
  async reset() {
    this.model = null;
    this.trainingData = [];
    this.labels = [];
    // Clear IndexedDB
    try {
      const db = await indexedDB.deleteDatabase('gesture-model');
    } catch (err) {
      console.error('Error clearing model:', err);
    }
  }
}

export default GestureClassifier;

