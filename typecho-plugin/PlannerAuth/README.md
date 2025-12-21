# PlannerAuth Typecho Plugin

This plugin provides authentication and user data synchronization between Typecho and the Planner Web application.

## Features
- **JWT Authentication**: Secure login API for external applications.
- **Custom User Fields**: Stores additional user metadata (e.g., authorization groups) in a custom database table.
- **CORS Support**: Configurable Cross-Origin Resource Sharing settings.

## Installation
1. Upload the `PlannerAuth` folder to your Typecho `usr/plugins/` directory.
2. Log in to your Typecho Admin Panel.
3. Go to **Console > Plugins** and activate **Planner Web Integration Plugin**.
4. Click **Settings** to configure:
   - **JWT Secret**: Set a secure random string.
   - **CORS Allow Origin**: Set to your Planner Web URL (e.g., `http://localhost:5173`) or `*` for development.

## API Endpoints
Base URL: `http://your-site.com/index.php/planner/api`

### 1. Login
- **URL**: `/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "your_username",
    "password": "your_password"
  }
  ```
- **Response**: Returns JWT token and user info (including custom meta).

### 2. Get User Info
- **URL**: `/user`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <token>`

### 3. Update Custom Field
- **URL**: `/update_meta`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `Bearer <token>`
- **Body**:
  ```json
  {
    "uid": 1, // Optional, defaults to self
    "key": "planner_auth_group",
    "value": "admin"
  }
  ```
