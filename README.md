# BedRelay

### Real-Time Hospital Bed Availability & Ambulance Dispatch Coordination

BedRelay is a platform designed to improve coordination between ambulances and hospitals during emergencies. It allows ambulance dispatchers to find suitable hospitals based on location and current bed availability, send pre-arrival requests, and track the request until it is accepted, rejected, completed, cancelled, or expired.

Hospitals can maintain their available bed capacity and respond to incoming ambulance requests, while SuperAdmin provides system-wide management and oversight.

## Why BedRelay?

During an emergency, an ambulance may reach a hospital only to discover that the required bed or critical-care capacity is unavailable. This can result in delays and unnecessary hospital diversions.

BedRelay aims to reduce this problem by providing a centralized way to:

* Check current hospital bed availability.
* Find suitable hospitals based on location and required capacity.
* Send requests before an ambulance arrives.
* Allow hospitals to respond to those requests.
* Keep both sides synchronized as request information changes.

## Key Features

### Ambulance / Dispatcher

* Find nearby hospitals using current or manually selected location.
* Search by bed category and required number of beds.
* View hospital details and current availability.
* View distance from the ambulance.
* View hospitals on an interactive map.
* Get driving directions through Google Maps.
* Create and track dispatch requests.
* Modify active requests, including bed category, bed count, ETA, condition and notes.
* Switch the receiving hospital when required.
* Maintain a single active receiving-hospital request.
* View request history and status.
* Track hospital responses and request updates.
* View request-time ambulance coordinates.
* View request activity and audit information.

### Hospital Staff

* Sign in using Google authentication.
* Create or join a hospital.
* Manage hospital bed availability.
* Support multiple bed categories such as ICU, General, NICU and Critical Care.
* View incoming ambulance requests.
* Accept or reject requests.
* Review significant request modifications.
* View request history and activity.
* Manage hospital staff according to assigned roles.

### SuperAdmin

* Manage hospitals and hospital staff.
* Manage memberships and roles.
* Monitor bed availability.
* View and manage dispatch requests.
* View complete dispatch details.
* Perform administrative actions.
* View system-wide audit information.

## Request Statuses

BedRelay uses a defined request lifecycle:

| Status      | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `PENDING`   | Awaiting hospital action or required approval              |
| `ACCEPTED`  | Hospital has accepted the request                          |
| `REJECTED`  | Hospital has rejected the request                          |
| `CANCELLED` | Request was cancelled                                      |
| `COMPLETED` | Accepted request reached its completion stage              |
| `EXPIRED`   | Required approval was not received within the allowed time |

## How to Navigate

### 1. Start at the Home Page

The primary action is:

**Find Available Beds**

This opens the dispatcher workflow.

Hospital personnel can instead choose:

**Hospital Staff Sign In**

### 2. Find a Hospital

From the dispatcher interface:

1. Allow location access or select a location manually.
2. Select the required bed category.
3. Enter the required number of beds.
4. Search for suitable hospitals.
5. Compare availability and distance.
6. Select a hospital.

### 3. View Hospital & Get Directions

After selecting a hospital, the dispatcher can view its details and use **Get Directions** to open the route in Google Maps.

### 4. Send a Dispatch Request

After selecting a suitable hospital, enter the required request information and send the dispatch request.

The request can then be viewed and tracked from the dispatcher dashboard.

### 5. Manage an Active Request

While a request is active, the dispatcher can:

* View the request.
* Modify request information.
* Change bed requirements.
* Update ETA or patient information.
* Switch to another hospital.
* Cancel the request.
* Monitor hospital responses.

All meaningful changes are reflected in the request activity history.

### 6. Hospital Workflow

Hospital staff can sign in, manage their hospital's bed availability, and view incoming ambulance requests.

They can accept or reject requests and review significant changes made by the dispatcher.

### 7. SuperAdmin

SuperAdmin provides a protected administrative interface for managing hospitals, staff, beds, dispatch requests and system activity.

## Real-Time Updates

BedRelay uses background synchronization so changes to bed availability and dispatch requests can appear without requiring a full page refresh.

The application targets data synchronization within approximately **2 seconds**.

## Technology

* **Next.js**
* **TypeScript**
* **PostgreSQL**
* **Drizzle ORM**
* **Better Auth**
* **Google OAuth**
* **Leaflet**
* **OpenStreetMap**
* **Google Maps Directions**
* **REST APIs**

## Author

**Utkarsh Raj**

Sole contributor and developer of BedRelay.
