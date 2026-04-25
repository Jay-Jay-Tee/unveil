# 🚀 UnbiasedAI - Startup Scripts

## Quick Start - Choose Your Platform

### 🪟 Windows

#### Option 1: PowerShell (Recommended)
```powershell
.\start.ps1
```

**If you get an execution policy error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\start.ps1
```

#### Option 2: Command Prompt (.bat)
```cmd
start.bat
```

---

### 🍎 macOS / 🐧 Linux

```bash
chmod +x start.sh
./start.sh
```

Or with bash explicitly:
```bash
bash start.sh
```

---

### 🖥️ Any Platform (Manual)
```bash
npm run start
```

---

## What Each Script Does

All three scripts do the **exact same thing**:

1. ✅ Check if `node_modules` exists (installs if missing)
2. ✅ Verify Node.js is installed
3. ✅ Verify Python 3.8+ is installed
4. ✅ Start **Frontend** (React/Vite) on `http://localhost:5173`
5. ✅ Start **Backend** (FastAPI) on `http://localhost:8001`
6. ✅ Display helpful info and status

---

## Script Comparison

| Feature | `start.ps1` | `start.bat` | `start.sh` |
|---------|-----------|-----------|----------|
| Platform | Windows (PowerShell) | Windows (CMD) | macOS/Linux |
| Colors | ✅ Yes | ❌ Limited | ✅ Yes |
| Error Handling | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Dependency Check | ✅ Thorough | ✅ Basic | ✅ Thorough |
| Recommended | 🥇 Best | 🥈 Good | 🥇 Best |

---

## What Happens When You Run

```
✓ Node.js found: v18.16.0
✓ Python found: Python 3.10.8

====================================
Starting all services...
====================================

Frontend will start at: http://localhost:5173
Backend will start at:  http://localhost:8001

Press Ctrl+C to stop all processes

> unbiased-ai@0.0.0 start
> concurrently "npm run frontend" "npm run backend"

[0] 
[0] > unbiased-ai@0.0.0 frontend
[0] > vite
[0] 
[0]   VITE v8.0.4  ready in 234 ms
[0] 
[0]   ➜  Local:   http://localhost:5173/
[0]   ➜  press h to show help
[0]
[1] 
[1] > unbiased-ai@0.0.0 backend
[1] > python backend/api.py
[1]
[1] INFO:     Uvicorn running on http://0.0.0.0:8001
[1] INFO:     Application startup complete
```

✅ **Ready to go!** Open http://localhost:5173 in your browser

---

## Stopping the App

Press `Ctrl+C` in the terminal. You should see:

```
^C
[0] terminated with code 0
[1] terminated with code 0
```

Both services will stop gracefully.

---

## Troubleshooting

### "Cannot find path" / "No such file or directory"
**Make sure you're in the project root directory:**
```bash
cd /path/to/unbiased-ai-decisions
./start.sh  # or start.ps1 or start.bat
```

### PowerShell Error: "cannot be loaded because running scripts is disabled"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then try again:
```powershell
.\start.ps1
```

### "Node.js not found"
Install Node.js 16+: https://nodejs.org

### "Python3 not found"
Install Python 3.8+: https://python.org

### "Port 5173 already in use"
Another app is using that port. Either:
- Stop the other app
- Or run with different port: `npm run frontend -- --port 3000`

### "Port 8001 already in use"
Edit `backend/api.py` and change the port number in the last line.

---

## Manual Alternative

If the scripts don't work, run manually in **two separate terminals:**

**Terminal 1 (Frontend):**
```bash
npm run frontend
```

**Terminal 2 (Backend):**
```bash
npm run backend
```

Both should show they're running, then open http://localhost:5173

---

## Development Tips

### Hot Reload
- Frontend: Edit files in `src/` → auto-reloads at http://localhost:5173
- Backend: Edit files in `backend/` → auto-reloads

### View Backend API Docs
Open http://localhost:8001/docs in your browser

### Check Backend Health
```bash
curl http://localhost:8001/health
```

### Build for Production
```bash
npm run build
```

Output goes to `dist/` folder

---

## Environment Variables

Create `.env` file in project root if needed:

```env
GEMINI_API_KEY=your_key_here
VITE_API_URL=http://localhost:8001
VITE_REQUIRE_AUTH_FOR_ANALYSIS=true
AUTH_REQUIRED=true
NODE_ENV=development
```

For local demo mode without Firebase auth enforcement, set both `VITE_REQUIRE_AUTH_FOR_ANALYSIS=false` and `AUTH_REQUIRED=false`.

---

## macOS / Linux Permissions

If you get "Permission denied" on first run:

```bash
chmod +x start.sh
./start.sh
```

The `start.sh` file already has execute permissions set.

---

## Next Steps

1. ✅ Run one of the startup scripts
2. 🌐 Open http://localhost:5173 in your browser
3. 📁 Upload a dataset
4. 📊 Run the bias audit
5. 📋 Generate compliance report

---

## Which Script Should I Use?

- **Windows + PowerShell**: `.\start.ps1` ⭐ Recommended
- **Windows + Command Prompt**: `start.bat`
- **macOS / Linux**: `./start.sh` ⭐ Recommended
- **Any platform**: `npm run start`

All do the same thing, just pick the one for your OS!

Happy auditing! 🚀
