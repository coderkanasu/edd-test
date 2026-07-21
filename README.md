# EDD Engine Mock Playground

A lightweight, standalone development tool for interacting with the Estimated Delivery Date (EDD) engine using mock data.

## Features
- **Scenario Presets**: Instantly test Happy Path, Busy Warehouse, Low Stock, etc.
- **Mock Mode**: Fully functional backend mock API.
- **Dynamic Input**: Configure warehouse, service level, and custom mock scenarios.
- **Visualization**: Detailed breakdown Table, confidence scoring, and warnings.
- **History**: Calculation log persisted in local storage.

## Preview
![EDD Playground Preview](vscode-chat-response-resource://7673636f64652d636861742d73657373696f6e3a2f2f6c6f63616c2f597a63314f5745324d5459745a6d566a5a693030596a457a4c54686d596a5974593251784d4455344e325a6d59574534/tool/call_MHxZVXNnaVRpUkRBeW93ZElUaDc/0/file.jpe)

## Setup & Run
1. Install dependencies: `npm install`
2. Start the mock server: `PORT=8081 MOCK_MODE=true node src/server.js`
3. Open playground: [http://localhost:8081/playground/index.html](http://localhost:8081/playground/index.html)
