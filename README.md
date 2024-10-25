# CNC G-code Drip Feeder

A web-based application that allows you to upload G-code files and send them to your CNC machine via serial communication (COM port) using a drip-feed method. The application provides a user-friendly interface to select COM ports, test baud rates, monitor progress, and manage G-code file transfers efficiently.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Starting the Server](#starting-the-server)
  - [Accessing the Web Interface](#accessing-the-web-interface)
  - [Uploading and Sending G-code](#uploading-and-sending-g-code)
- [Security Considerations](#security-considerations)
- [File Management](#file-management)
- [Known Issues](#known-issues)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Features

- **Web Interface**: User-friendly web interface built with HTML, Tailwind CSS, and JavaScript.
- **COM Port Detection**: Automatically fetches available COM ports on the server.
- **Baud Rate Testing**: Allows users to test the connection at different baud rates.
- **G-code File Upload**: Supports uploading `.gcode` and `.nc` files securely.
- **Drip-Feeding**: Sends G-code to the CNC machine line by line via serial communication.
- **Progress Tracking**: Real-time progress bar and percentage display.
- **Output Console**: Displays the G-code lines being sent in real-time.
- **Error Handling**: Provides informative error messages for troubleshooting.
- **Automatic File Cleanup**: Automatically deletes uploaded files older than 30 days to manage disk space.

## Prerequisites

- **Operating System**: Linux, macOS, or Windows.
- **Node.js**: Version 14 or higher.
- **npm**: Node Package Manager (comes with Node.js).
- **CNC Machine**: Connected via a serial COM port.
- **Internet Browser**: Modern browser like Chrome, Firefox, or Edge.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/cnc-gcode-drip-feeder.git
   cd cnc-gcode-drip-feeder
   ```

2. **Install Dependencies**

   ```bash
   npm install

This will install all the required packages listed in package.json, including:

- express
- multer
- socket.io
- serialport
- node-cron

## Configuration
No additional configuration is necessary for basic usage. The server listens on port 3000 by default. If you wish to change the port, you can set the PORT environment variable:

   ```bash
   export PORT=8080
   ```
## Usage

Starting the Server
Run the following command to start the server:

   ```bash
   node server.js
   ```
You should see an output indicating the server is running:

```bash
Server is running on http://localhost:3000 
```
### Accessing the Web Interface
Open your web browser and navigate to:

```arduino 
http://localhost:3000
```

### Uploading and Sending G-code
1. Select COM Port and Baud Rate

The COM port dropdown will automatically populate with available COM ports.
Select the appropriate COM port connected to your CNC machine.
Enter the baud rate that matches your CNC machine's configuration.
2. Test Connection

Click on the Test Connection button to verify the serial communication.
A success or error message will appear, indicating the connection status.
3. Upload G-code File

Click on the Choose G-code File button and select a .gcode or .nc file from your computer.
4. Start Drip Feed

Click on the Start Drip Feed button.
The application will begin sending the G-code to your CNC machine.
Monitor the Output section to see the G-code lines being sent.
The Progress bar will update in real-time to show the completion percentage.

## Security Considerations
- File Validation: Only .gcode and .nc files are accepted for upload to prevent unauthorized file types.
- Input Sanitization: User inputs for baud rate and COM port are validated to prevent injection attacks.
- File Storage: Uploaded files are stored with sanitized filenames to prevent directory traversal attacks.
- Automatic File Cleanup: Files older than 30 days are automatically deleted to manage disk space and reduce risk.

## File Management
- Uploads Directory: Uploaded G-code files are stored in the uploads directory.
- Automatic Deletion: A scheduled task runs daily at midnight to delete files older than 30 days from the uploads directory.
- Manual Cleanup: You can manually delete files from the uploads directory if needed.
## Known Issues
- COM Port Detection on Windows: The application filters COM ports starting with /dev/tty, which is suitable for Linux/macOS. Windows users may need to adjust the code to detect COM ports like COM3, COM4, etc.

- **Adjustment for Windows Users:**

In server.js, modify the COM port filtering logic:

```javascript
// Original code
const linuxPorts = ports.filter((port) => port.path.startsWith('/dev/tty'));

// Modified code for cross-platform support
const availablePorts = ports.filter((port) => {
  return (
    port.path.startsWith('/dev/tty') || // For Linux/macOS
    port.path.startsWith('COM') // For Windows
  );
});
```
- **Serial Communication Errors:** If you encounter errors during serial communication, ensure that no other application is using the COM port and that the baud rate matches your CNC machine's settings.

Contributing
Contributions are welcome! Please follow these steps:

1. Fork the Repository
Click the "Fork" button at the top right of the repository page.

2. Create a Branch
```bash
git checkout -b feature/your-feature-name
```
3. Commit Your Changes

```bash
git commit -m "Description of your changes"
```

4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```
5. Submit a Pull Request

Go to your fork on GitHub and open a pull request to the main repository.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

Acknowledgments
- Node.js: For providing the server-side JavaScript runtime environment.
- Express: For the web framework used to build the server.
- Socket.IO: For enabling real-time bidirectional communication between the server and clients.
- Tailwind CSS: For providing the utility-first CSS framework for styling.
- Font Awesome: For the icons used in the web interface.
