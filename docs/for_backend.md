# University Guardian: Backend API Documentation

This document describes the API endpoints required by the University Guardian frontend application.

## Base URL
The base URL for all API endpoints is `/api/v1`.

---

## Authentication

### Login
- **Method**: `POST`
- **Path**: `/auth/login/`
- **Request Body**:
  ```json
  {
    "email": "user@university.ac.tz", 
    "password": "password123"
  }
  ```
> [!IMPORTANT]
> System **only** allows login with an institutional email (must contain `.ac.tz`).

- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "access": "jwt-access-token",
      "refresh": "jwt-refresh-token",
      "user_id": 1,
      "role": "university_admin",
      "username": "255712345678"
    }
  }
  ```

### Logout
- **Method**: `POST`
- **Path**: `/auth/logout/`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**: 
  ```json
  { "refresh": "<refresh_token>" }
  ```
- **Success Response (205 Reset Content)**

### Get Profile
- **Method**: `GET`
- **Path**: `/auth/profile/`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "email": "user@university.ac.tz",
      "username": "255712345678",
      "role": "university_admin",
      "university": 1,
      "university_name": "University of Dar es Salaam"
    }
  }
  ```

---

## User Management (Staff)

### List Users
- **Method**: `GET`
- **Path**: `/management/users/`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "results": [
        {
          "id": 2,
          "email": "admin@udsm.ac.tz",
          "name": "Dr. Sarah Mwamba",
          "role": "university_admin",
          "universityId": 1,
          "createdAt": "2024-01-15T...",
          "lastLogin": "2024-12-12T..."
        }
      ]
    }
  }
  ```

### Create User
- **Method**: `POST`
- **Path**: `/management/users/`
- **Request Body**:
  ```json
  {
    "username": "new_security_staff",
    "email": "staff@udsm.ac.tz",
    "first_name": "New",
    "last_name": "User",
    "phone": "+255000000000",
    "role": "security_officer"
  }
  ```
> [!IMPORTANT]
> The `email` must belong to your university's official domain configured in the system.

---

## University Management

### List All Universities (Public)
- **Method**: `GET`
- **Path**: `/universities/`

### Update My University
- **Method**: `PATCH`
- **Path**: `/management/universities/{id}/`
- **Request Body**:
  ```json
  {
    "name": "Updated University Name",
    "active": true
  }
  ```

---

## Items (Lost & Found)

### List/Search Items
- **Method**: `GET`
- **Path**: `/items/`
- **Query Params**:
  - `item_type`: `lost` | `found`
  - `status`: `open` | `potential_match` | `claimed` | `returned`
  - `university__code`: `udsm` | `out` | etc.

### Report Lost Item
- **Method**: `POST`
- **Path**: `/items/report-lost/`
- **Request Body**: Same as Item model

### Report Found Item
- **Method**: `POST`
- **Path**: `/items/report-found/`
- **Request Body**: Same as Item model

### Item Details
- **Method**: `GET`
- **Path**: `/items/{id}/`

---

## Verifications & Matches

### List Match Requests
- **Method**: `GET`
- **Path**: `/management/matches/`

### Handle Match Request
- **Method**: `PATCH`
- **Path**: `/management/matches/{id}/handle_request/`
- **Request Body**:
  ```json
  {
    "status": "approved" | "rejected",
    "notes": "Verified ownership with student ID."
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "id": 1,
    "status": "approved",
    "reviewedBy": "admin_user",
    "reviewedAt": "2024-12-11T14:30:00Z"
  }
  ```

---

## Audit Logs

### List Audit Logs
- **Method**: `GET`
- **Path**: `/management/audit-logs/`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "results": [
        {
          "id": 1,
          "action": "MATCH_APPROVED",
          "userName": "Officer James Kimaro",
          "userRole": "security_officer",
          "targetType": "match",
          "targetId": "1",
          "details": "Handled match 1 with status approved. Notes: Verified...",
          "timestamp": "2024-12-11T14:30:00Z",
          "universityId": 1
        }
      ]
    }
  }
  ```

---

## Dashboard Stats

### Get Dashboard Summary
- **Method**: `GET`
- **Path**: `/management/dashboard/stats/`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "total_lost_items": 156,
      "total_found_items": 89,
      "pending_verifications": 12,
      "matched_items": 45,
      "returned_items": 30
    }
  }
  ```
