# ESP32 Gesture Visualizer

A React web application that connects to an ESP32 device via Web Bluetooth to visualize real-time gesture and sensor data.

## Features

- **Web Bluetooth Connection**: Connect directly to ESP32_Gesture device from your browser
- **Real-time Sensor Visualization**:
  - Flex sensors (Flex 1 & Flex 2) with progress bars
  - MPU6050 Accelerometer (X, Y, Z axes)
  - MPU6050 Gyroscope (X, Y, Z axes)
- **Gesture Recognition**: Displays current gesture with visual indicators
- **Gesture History**: Shows the last 10 detected gestures with timestamps
- **Modern UI**: Beautiful gradient-based interface with smooth animations

## Prerequisites

- Node.js (v16 or higher)
- Chrome/Edge browser (Web Bluetooth support required)
- ESP32 device running the gesture broadcaster code

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

3. Make sure your ESP32 is powered on and advertising as "ESP32_Gesture"

4. Click "Connect to ESP32" button in the web app

5. Select your ESP32 device from the Bluetooth pairing dialog

## Browser Compatibility

Web Bluetooth API is supported in:
- Chrome/Edge (Desktop & Android)
- Opera (Desktop & Android)

**Note**: Web Bluetooth requires HTTPS in production. For local development, `localhost` is allowed over HTTP.

## Data Format

The ESP32 sends data in the format:
```
id:name|f1,f2,ax,ay,az,gx,gy,gz
```

Where:
- `id`: Gesture ID (0-6)
- `name`: Gesture name (IDLE, FIST, OPEN_HAND, etc.)
- `f1, f2`: Flex sensor values
- `ax, ay, az`: Accelerometer values
- `gx, gy, gz`: Gyroscope values

## Gesture Types

- **0**: IDLE
- **1**: FIST
- **2**: OPEN_HAND
- **3**: WAVE_LEFT
- **4**: WAVE_RIGHT
- **5**: TILT_UP
- **6**: TILT_DOWN

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Git Setup & Deployment

### Initial Git Setup

If you haven't initialized git yet:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: ESP32 Gesture Visualizer"

# Add remote repository (replace with your GitHub/GitLab URL)
git remote add origin https://github.com/yourusername/esp32-gesture-visualizer.git

# Push to main branch
git branch -M main
git push -u origin main
```

### Subsequent Pushes

```bash
# Add changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to remote
git push
```

### Deploy to Vercel

#### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. For production deployment:
```bash
vercel --prod
```

#### Option 2: Using Vercel Dashboard (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket

2. Go to [vercel.com](https://vercel.com) and sign in

3. Click "Add New Project"

4. Import your repository

5. Vercel will auto-detect Vite settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. Click "Deploy"

7. Your app will be live at `https://your-project.vercel.app`

**Important**: Web Bluetooth requires HTTPS, which Vercel provides automatically. Your deployed app will work perfectly with Web Bluetooth API!

### Environment Variables

If you need any environment variables, add them in the Vercel dashboard under Project Settings → Environment Variables.

