# SolarSaver

SolarSaver is a web application that helps homeowners and organizations save money by comparing their estimated solar production against their logged energy consumption. It provides a recommended daily window to run high-draw appliances based on free public weather data (Open-Meteo).

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM with SQLite (local) / PostgreSQL (production)
- **Authentication:** Custom JWT-based auth with bcrypt
- **Charts:** Recharts

## Local Setup

1. **Clone the repository** (if applicable) and navigate to the project directory:
   ```bash
   cd solarsaver
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Set a secure `JWT_SECRET` for local development.
   ```bash
   cp .env.example .env
   ```

4. **Initialize the Database:**
   ```bash
   npx prisma db push
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. **Push your code to GitHub.**
2. **Create a new project on Vercel** and link your GitHub repository.
3. **Provision a PostgreSQL Database:**
   - You can use Vercel Postgres, Supabase, Neon, or any other provider.
   - Obtain the connection string (e.g., `postgresql://user:password@host:port/db`).
4. **Set Environment Variables in Vercel:**
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET`: A strong, randomly generated string.
5. **Deploy:** Vercel will automatically run `npm run build` and start your application. Since Prisma is configured, it should automatically detect the Prisma schema and run queries against your Postgres instance seamlessly (SQLite and Postgres are both compatible with this schema).

## Features
- **User Authentication:** Secure signup/login with hashed passwords.
- **Solar System Profiles:** Add multiple solar systems with specific capacity (kW), coordinates, and electricity rates.
- **Consumption Logging:** Daily tracking of kWh consumed.
- **Solar Forecasting:** Automatic hourly solar irradiance fetching via Open-Meteo.
- **Savings Dashboard:** Visualizes production vs. consumption and highlights the best 3-hour window to run appliances.
