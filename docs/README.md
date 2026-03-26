# AI Interview Coach - Use Case Diagrams

This directory contains comprehensive use case diagrams and documentation for the AI Interview Coach system.

## Files

1. **use-case-diagram.puml** - Complete use case diagram showing all actors and use cases
2. **system-flow-diagram.puml** - Detailed sequence diagram showing system flow
3. **DETAILED_USE_CASES.md** - Comprehensive documentation with detailed flows

## How to View Diagrams

### Option 1: Online PlantUML Viewer (Easiest)

1. Go to [PlantUML Web Server](http://www.plantuml.com/plantuml/uml/)
2. Copy the content from `use-case-diagram.puml` or `system-flow-diagram.puml`
3. Paste it into the text area
4. Click "Submit" to see the rendered diagram
5. Download as PNG/SVG using the links provided

### Option 2: VS Code Extension

1. Install the **PlantUML** extension in VS Code:
   - Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
   - Search for "PlantUML"
   - Install the extension by jebbs

2. Open any `.puml` file in this directory

3. Press `Alt+D` to preview the diagram in VS Code

4. Right-click the preview and select "Export" to save as PNG/SVG

### Option 3: Command Line (Requires Java)

1. Download PlantUML JAR:
   ```powershell
   # Download PlantUML
   Invoke-WebRequest -Uri "https://github.com/plantuml/plantuml/releases/download/v1.2024.3/plantuml-1.2024.3.jar" -OutFile "plantuml.jar"
   ```

2. Generate diagrams:
   ```powershell
   # Generate PNG images
   java -jar plantuml.jar use-case-diagram.puml
   java -jar plantuml.jar system-flow-diagram.puml

   # Generate SVG (scalable)
   java -jar plantuml.jar -tsvg use-case-diagram.puml
   java -jar plantuml.jar -tsvg system-flow-diagram.puml
   ```

3. Open the generated `.png` or `.svg` files

### Option 4: Quick HTML Viewer (Included)

Open `diagram-viewer.html` in your browser to view both diagrams using the PlantUML web service.

## Diagram Overview

### Use Case Diagram
Shows all actors (Candidate, AI System, Backend Services) and their interactions with the system through various use cases grouped into:
- User Management
- Interview Session Management
- Interview Execution
- Real-time AI Analysis
- Feedback & Analytics
- Technical Operations

### System Flow Diagram
Detailed sequence diagram showing the complete flow of an interview session:
1. Authentication & Setup
2. Session Creation
3. Interview Initiation
4. Question & Answer Flow
5. Real-time Analysis
6. Answer Submission
7. Session Completion
8. Post-Session Analytics

## Key Use Cases

| Use Case | Description |
|----------|-------------|
| UC7: Start Interview | Initialize camera, microphone, and WebSocket connection |
| UC12: Answer Question | Real-time speech recognition, video/audio analysis |
| UC17: Analyze Video | Face detection, eye tracking, expression analysis |
| UC18: Analyze Audio | Speech rate, filler words, tone analysis |
| UC21: Generate Interventions | Real-time feedback on communication issues |
| UC22: Generate Feedback | Comprehensive session evaluation using LLM |

## Actor Descriptions

- **Candidate/Interviewee**: End user practicing interview skills
- **AI Coach/System**: Backend AI services analyzing performance
- **Backend Services**: Infrastructure handling media processing and data storage

## Technologies Mapped to Use Cases

| Technology | Related Use Cases |
|------------|-------------------|
| Web Speech API | UC12, UC19 (Speech Recognition) |
| MediaRecorder API | UC27, UC28 (Video/Audio Capture) |
| WebSocket | UC29 (Real-time Communication) |
| Google Gemini | UC22, UC31 (LLM for Q&A) |
| MediaPipe/OpenCV | UC17 (Video Analysis) |
| PostgreSQL | UC30 (Data Storage) |

## Quick Reference

### Main User Journey
1. Register/Login → 2. Create Session → 3. Grant Permissions → 4. Start Interview → 5. Answer Questions → 6. Receive Feedback → 7. View Analytics

### Real-time Processing Pipeline
User speaks → Speech Recognition → Transcript
             ↓
Camera feed → Video Frames → Face Analysis → Interventions
             ↓
Microphone → Audio Chunks → Voice Analysis → Interventions

### Feedback Generation
All Answers + Video Metrics + Audio Metrics → LLM Evaluation → Comprehensive Report

## For More Details

See `DETAILED_USE_CASES.md` for:
- Complete use case specifications
- Main flows and alternative flows
- Preconditions and postconditions
- Technical architecture
- Data flow diagrams
- File structure reference

## Updating Diagrams

To modify the diagrams:

1. Edit the `.puml` files using any text editor
2. The PlantUML syntax is straightforward:
   - `actor` defines actors
   - `usecase` defines use cases
   - `-->` creates associations
   - `..>` creates include/extend relationships
   - `package` groups related use cases

3. Preview changes using one of the viewing methods above

## Export for Presentations

For high-quality exports suitable for documentation or presentations:

1. Use VS Code extension: Export as SVG (vector, scalable)
2. Use command line with `-tsvg` flag
3. Import SVG into PowerPoint, Google Slides, or LaTeX documents

## License

Part of the AI Interview Coach project. See main project README for license information.
