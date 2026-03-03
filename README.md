<div align="center">

# Neural Network Driving Simulation

Browser-based self-driving car simulation built with vanilla JavaScript, HTML, and CSS.

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Custom-1572B6?logo=css3&logoColor=white)
![No Libraries](https://img.shields.io/badge/Dependencies-None-2D2D2D)

</div>

## Overview

This project simulates autonomous cars learning to drive on a multi-lane road without using external AI or game libraries. Each car uses a hand-built neural network, a custom sensor system, and simple vehicle physics to decide when to steer, accelerate, and avoid traffic.

The simulation runs directly in the browser and includes a live network visualizer, generation tracking, and save/reset controls for the best-performing brain.

## Highlights

| Area | What was built |
| --- | --- |
| Simulation | Custom road rendering, vehicle movement, friction, steering, and collision detection |
| AI | Hand-written feed-forward neural network and mutation-based improvement loop |
| Sensing | 7-ray sensor system with road-border and traffic intersection detection |
| Training | 100 cars simulated at once with generation scoring and best-brain persistence |
| Visualization | Real-time canvas view of both the road scene and the active neural network |

## How It Works

1. The app spawns a population of AI cars on a three-lane road with simulated traffic.
2. Each car casts sensor rays forward to detect borders and nearby vehicles.
3. Sensor readings are converted into inputs for a small neural network.
4. The network outputs steering and speed decisions in real time.
5. After each generation, the strongest cars are used to seed the next run with mutations.

## Technical Details

- Built with plain JavaScript, HTML, and CSS
- Uses the HTML Canvas API for rendering
- Simulates `100` AI cars per generation
- Uses a `7 -> 8 -> 4` neural network layout
- Tracks fitness based on overtaking progress, not just staying alive
- Saves the best-performing model to `localStorage`

## Why This Project Stands Out

- No external AI libraries were used; the network, sensors, and training loop were implemented from scratch.
- The project combines frontend rendering, geometry, simulation logic, and AI behavior in one cohesive system.
- The live visualizer makes the model's decisions inspectable instead of treating the AI as a black box.

## Running Locally

This project does not require a build step.

1. Clone the repository.
2. Open `index.html` in a browser.

If you prefer, you can also run it with a simple local server such as VS Code Live Server.

## Project Structure

- `main.js` - simulation loop, generations, scoring, and persistence
- `car.js` - vehicle physics, controls, fitness state, and collision handling
- `sensor.js` - ray casting and environment sensing
- `network.js` - neural network and mutation logic
- `visualizer.js` - real-time network rendering
- `road.js` - lane geometry and road drawing
- `utils.js` - math helpers and intersection logic

## Notes

This project is intended as a hands-on demonstration of core machine learning and simulation concepts in the browser. It is especially useful for showing how neural-network-driven behavior can emerge from simple rules, feedback, and repeated variation.
