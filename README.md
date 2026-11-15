# SaaS Master

## Run frontend and backend

Use Node.js and npm. Run each command in a separate PowerShell terminal from the project root.

### Backend (Terminal 1)

```powershell
cd .\server
npm run dev
```

### Frontend (Terminal 2)

```powershell
cd .\client
npm run dev
```

Open the frontend at `http://localhost:3000`. Check the API at `http://localhost:8000/ping`.

On first run, install dependencies in each folder before starting its server:

```powershell
cd .\server
npm install
```

```powershell
cd .\client
npm install
```

Configure `server/.env` with `DB_URL`, `REDIS_URL`, `ACCESS_TOKEN`, and `REFRESH_TOKEN`. Keep secrets out of source control. Ensure MongoDB and Redis URLs point to reachable services; routes that use them fail otherwise.

Configure `client/.env` with the frontend's API and socket URLs if they differ from your local backend.

Press `Ctrl+C` in each terminal to stop its server.
