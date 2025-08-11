# Sales Call Management Tool

A full-stack web application designed to help sales agents track and manage call records, schedule callbacks, and monitor sales performance. This internal tool features role-based access for agents and administrators.

---
## Features

* **User Authentication:** Secure login system using JWT (JSON Web Tokens).
* **Role-Based Access Control:**
    * **Agents:** Can create, view, and manage their own call records. Phone numbers on existing records are masked and read-only for security.
    * **Admins:** Have full access to manage all users and view performance statistics for the entire team.
* **Call Record Management:** A complete CRUD (Create, Read, Update, Delete) interface for sales call records.
* **Callback Scheduler:** Users can schedule callbacks for specific dates and times.
* **Browser Notifications:** The application sends a desktop notification to the user when a callback is due, even if the browser is in another tab or minimized.
* **Admin Dashboard:** A user management panel that displays statistics for each user, including their total number of records and total completed sales.
* **Secure Phone Number Display:** Customer phone numbers are automatically masked in list views to protect sensitive data.

---
## Tech Stack

This project is a monorepo-style application with a separate frontend and backend.

#### Frontend

* **Library:** React 18
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Icons:** Lucide React

#### Backend

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL
* **Authentication:** JWT (JSON Web Tokens), bcrypt for password handling
* **ORM/Driver:** `pg` (node-postgres)

---
## Project Structure

The project is organized into a single repository containing two main packages:

sales-call/
├── backend/        # Node.js + Express API
│   ├── server.js
│   ├── package.json
│   └── .env        # (local environment variables)
└── frontend/       # React + Vite Client Application
├── src/
│   └── App.jsx
└── package.json


---
## Setup and Running the Project

Follow these steps to get the full-stack application running locally.

### 1. Prerequisites

* Node.js (v18 or later recommended)
* `npm` or a similar package manager
* A running PostgreSQL database instance

### 2. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd sales-call/backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create the environment file:** Create a file named `.env` in the `backend` folder and add your configuration variables.
    ```env
    # PostgreSQL connection URL
    DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/sales_call_db
    
    # JWT Secret Key
    JWT_SECRET=your_super_secret_key_here
    ```
4.  Ensure your database and tables are created according to your `schema.sql`.

### 3. Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd sales-call/frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### 4. Running Both Servers

To run both the frontend and backend servers concurrently for development, use the custom script from the **frontend** directory.

```bash
# From inside the sales-call/frontend/ directory
npm run dev:fullstack
