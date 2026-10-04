# Deploying AI Rank Checker to Azure

End-to-end steps to put the whole app on Azure from the browser, using this GitHub repository.

> This guide was written from the project's configuration. It has not yet been run against a live
> Azure subscription, so portal labels may differ slightly from what you see. The troubleshooting
> section at the end covers the most likely snags.

## What you will create

| # | Azure resource | Runs | Plan |
|---|---|---|---|
| 1 | Azure Database for PostgreSQL flexible server | User accounts | Burstable B1ms (covered by the free trial) |
| 2 | App Service (Web App) | Spring Boot backend in `backend/` | Free F1, or Basic B1 for better speed |
| 3 | Static Web App | React frontend in `frontend/` | Free |

Create them in this order: the backend needs the database address, and the frontend needs the backend address.

Before you start, have ready:

- Your DeepSeek API key.
- A random string of 32 or more characters to use as `JWT_SECRET` (any password generator works).

Check current prices and free-trial allowances on the Azure pricing pages before creating paid resources.

---

## Step 1: Resource group

1. In the [Azure portal](https://portal.azure.com), search for **Resource groups** and select **Create**.
2. Name it `aigeo-rg` and pick a region near your users.
3. Select **Review + create**, then **Create**.

Use this resource group and the same region for everything below.

---

## Step 2: Database

1. Search for **Azure Database for PostgreSQL flexible servers** and select **Create**.
2. Basics:
   - Resource group: `aigeo-rg`
   - Server name: for example `aigeo-db` (must be globally unique)
   - PostgreSQL version: 16
   - Workload type: **Development**
   - Compute + storage: **Burstable, B1ms**, 32 GiB storage
   - Authentication: **PostgreSQL authentication only**
   - Admin username and password: choose them and write them down
3. Networking:
   - Connectivity method: **Public access**
   - Tick **Allow public access from any Azure service within Azure to this server**
4. **Review + create**, then **Create**. This takes several minutes.
5. Open the server, go to **Databases**, select **Add**, and create a database named `rankchecker`.

You now have the three database settings for step 3:

| Setting | Value |
|---|---|
| `DATABASE_URL` | `jdbc:postgresql://<server-name>.postgres.database.azure.com:5432/rankchecker?sslmode=require` |
| `DATABASE_USERNAME` | the admin username |
| `DATABASE_PASSWORD` | the admin password |

The backend creates its `users` table automatically on first start.

---

## Step 3: Backend (App Service)

### 3a. Create the Web App

1. Search for **App Services**, select **Create**, then **Web App**.
2. Basics:
   - Resource group: `aigeo-rg`
   - Name: for example `aigeo-api`. Your backend URL will be `https://aigeo-api.azurewebsites.net`
     (newer apps may get a longer generated hostname; use whatever the Overview page shows).
   - Publish: **Code**
   - Runtime stack: **Java 17**
   - Java web server stack: **Java SE (Embedded Web Server)**
   - Operating system: **Linux**
   - Pricing plan: **Free F1** to start, or **Basic B1**
3. **Review + create**, then **Create**.

### 3b. Add the settings

Open the Web App, go to **Settings → Environment variables → App settings**, and add:

| Name | Value |
|---|---|
| `DEEPSEEK_API_KEY` | your DeepSeek key |
| `JWT_SECRET` | your 32+ character random string |
| `DATABASE_URL` | from step 2 |
| `DATABASE_USERNAME` | from step 2 |
| `DATABASE_PASSWORD` | from step 2 |
| `CORS_ORIGINS` | `http://localhost:5173` for now; you will replace it in step 5 |

Select **Apply**.

### 3c. Connect GitHub

1. In the Web App, open **Deployment → Deployment Center**.
2. Source: **GitHub**. Authorise Azure if asked.
3. Organisation: `rohanxyz305`, Repository: `aigeo`, Branch: `main`.
4. **Save**.

Azure commits a workflow file to `.github/workflows/` in the repository. Its first run will **fail**,
because it expects the Java project at the repository root and ours is in `backend/`.

### 3d. Fix the workflow

In GitHub, open the new file in `.github/workflows/` (named after your Web App) and change the build
and upload steps:

```yaml
      - name: Build with Maven
        run: mvn clean package -DskipTests
        working-directory: backend

      - name: Upload artifact for deployment job
        uses: actions/upload-artifact@v4
        with:
          name: java-app
          path: backend/target/rank-checker.jar
```

Leave the rest of the file (login and deploy steps) as Azure generated it. Commit the change; the
workflow runs again automatically. Watch it under the repository's **Actions** tab.

### 3e. Check the backend

Open `https://<your-backend-host>/api/health` in a browser. You should see:

```json
{"status":"ok"}
```

On the Free plan the first request after idle can take a minute while the app wakes up.

---

## Step 4: Frontend (Static Web App)

### 4a. Tell the build where the backend is

The frontend reads the backend address at build time, so it must be available to GitHub Actions.

1. In GitHub, open the repository's **Settings → Secrets and variables → Actions → Variables** tab.
2. Select **New repository variable**.
3. Name: `VITE_API_URL`. Value: your backend URL with no trailing slash, for example
   `https://aigeo-api.azurewebsites.net`.

### 4b. Create the Static Web App

1. In the Azure portal, search for **Static Web Apps** and select **Create**.
2. Basics:
   - Resource group: `aigeo-rg`
   - Name: for example `aigeo-web`
   - Plan type: **Free**
   - Source: **GitHub**, then `rohanxyz305` / `aigeo` / `main`
3. Build details:
   - Build presets: **Custom**
   - App location: `frontend`
   - Api location: leave empty
   - Output location: `dist`
4. **Review + create**, then **Create**.

Azure commits a second workflow file (`azure-static-web-apps-....yml`).

### 4c. Pass the backend address to the build

Edit that workflow file in GitHub. Find the step that uses `Azure/static-web-apps-deploy@v1` in the
build job and add an `env` block to it, at the same indentation as `with`:

```yaml
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        env:
          VITE_API_URL: ${{ vars.VITE_API_URL }}
        with:
          # ...leave everything Azure generated here unchanged...
```

Commit. The workflow runs again and publishes the site.

### 4d. Get the site address

Open the Static Web App's **Overview** page and copy its URL
(for example `https://something-123.azurestaticapps.net`).

---

## Step 5: Allow the frontend to call the backend

1. Go back to the backend Web App: **Settings → Environment variables**.
2. Change `CORS_ORIGINS` to the Static Web App URL from step 4d, with no trailing slash.
3. **Apply**. The backend restarts.

To allow more than one address (for example a custom domain later), separate them with commas.

---

## Step 6: Test

1. Open the Static Web App URL.
2. Select **Sign up** and create an account.
3. Sign in.
4. Enter a domain, choose 10 pages, and select **Analyse site**.
5. Confirm the six platform tabs fill in and their dots turn green.

---

## Updating the app later

Push to the `main` branch. Both workflows redeploy automatically: the backend when anything changes,
the frontend likewise. Check progress under the repository's **Actions** tab.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Backend workflow fails at "Build with Maven" | The `working-directory: backend` line is missing (step 3d). |
| Backend workflow fails at upload with "no files found" | The artifact path is not `backend/target/rank-checker.jar` (step 3d). |
| `/api/health` shows an Azure error page | The app did not start. Open **Monitoring → Log stream** on the Web App. The usual cause is a wrong `DATABASE_URL`, username or password. |
| Log shows a database connection timeout | The PostgreSQL firewall is blocking Azure. Recheck the "Allow public access from any Azure service" box (step 2). |
| Log shows `JWT_SECRET must be at least 32 characters` | Make the secret longer. |
| Site loads, but sign up says "Could not reach the server" | `VITE_API_URL` is missing or wrong (step 4a or 4c), or `CORS_ORIGINS` does not match the site URL exactly (step 5). The browser console shows which. |
| `/signin` gives a 404 after a page refresh | `frontend/public/staticwebapp.config.json` is missing from the build. It is in the repository; confirm the App location is `frontend`. |
| Reports show "DEEPSEEK_API_KEY is not set on the server" | Add the key in the Web App settings (step 3b). |
| Reports show "DeepSeek returned 402" or similar | The DeepSeek account is out of credit. |
| Backend stops responding during the day on the Free plan | F1 has a daily CPU allowance. Move the App Service plan up to B1. |
| "Quota" or "not available in region" error when creating a resource | Free-trial subscriptions are limited in some regions. Try another region for that resource. |

---

## Costs and clean-up

- The Static Web App Free plan and the App Service F1 plan have no charge.
- The PostgreSQL server is the part that will cost money once free-trial allowances end.
  Stop it (**Overview → Stop**) when you are not using the app, or delete it.
- To remove everything at once, delete the `aigeo-rg` resource group.
