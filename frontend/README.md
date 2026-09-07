# Secure Organ Donation Matching & Tamper Detection - Frontend Integration

This frontend project is built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**. It is integrated with **TanStack Router** and **TanStack Query** for state and query routing.

## Connecting to the Live Backend

### 1. Endpoint Realtime Conversion

By default, the application is set up with client-side mock HTTP controllers to run as a standalone mockup. To connect it to the real FastAPI backend, modify `src/services/api.ts`:

1. Remove the imports to local client-side mock database structures:
   ```typescript
   // Remove these imports
   // import { mockHttp } from "./mock/http";
   // import "./mock/handlers";
   ```
2. Set up a standard Axios instance mapping request routing:
   ```typescript
   import axios from "axios";

   const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

   export const httpClient = axios.create({
     baseURL: API_BASE_URL,
     headers: {
       "Content-Type": "application/json",
     },
   });

   // Add interceptors to automatically attach JWT authorization headers:
   httpClient.interceptors.request.use((config) => {
     const session = localStorage.getItem("organmatch_session");
     if (session) {
       const parsed = JSON.parse(session);
       if (parsed.token) {
         config.headers.Authorization = `Bearer ${parsed.token}`;
       }
     }
     return config;
   });
   ```

3. Replace all `mockHttp` calls in the API service dictionary with `httpClient` calls:
   ```diff
   - listDonors: (params) => mockHttp.get(`/donors${qs(params)}`),
   + listDonors: (params) => httpClient.get(`/donors${qs(params)}`).then(r => r.data),
   ```

---

## Running Locally

### Development Server
Run the local build script:
```bash
npm run dev
```

### Production Build
To create a production build for Nginx deployment:
```bash
npm run build
```
This outputs compiled assets into `dist/`, which is copied into the Nginx container static asset root.
