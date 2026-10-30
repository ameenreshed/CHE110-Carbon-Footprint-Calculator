#  Carbo-Track: Carbon Footprint Calculator

### Measure Your Impact. Make Every Choice Count.

**ECO (Carbon Footprint Calculator)** is a web-based environmental sustainability platform designed to help individuals understand, calculate, and reduce their personal carbon footprint.

The platform estimates annual CO₂-equivalent emissions based on everyday activities such as transportation, food consumption, electricity usage, and waste generation. It presents the results through visual dashboards, personalized insights, and sustainability challenges.

 **Live Website:** https://eco.amnrd.com

---

##  Table of Contents

- About the Project
- Objectives
- Key Features
- Carbon Footprint Calculation
- Technology Stack
- Project Structure
- Installation and Setup
- Supabase Configuration
- Database and Security
- Testing
- Future Improvements
- Project Limitations
- Disclaimer
- Author

---

##  About the Project

Climate change and global warming are among the major environmental challenges facing the world.

Everyday activities contribute to greenhouse gas emissions, often without individuals realizing their environmental impact.

ECO aims to make environmental awareness more accessible by providing a platform where users can estimate their carbon footprint and understand how their daily choices affect the environment.

The application transforms user-provided lifestyle information into understandable emission estimates and encourages practical steps towards a more sustainable lifestyle.

---

##  Project Objectives

1. Help individuals understand their personal carbon footprint.
2. Estimate annual greenhouse gas emissions from everyday activities.
3. Identify major sources of personal emissions.
4. Provide personalized suggestions for reducing environmental impact.
5. Encourage sustainable lifestyle habits through challenges.
6. Present environmental data through interactive visualizations.
7. Promote environmental awareness and responsible consumption.

---

##  Key Features

### 1. Carbon Footprint Calculator

A multi-step calculator that collects lifestyle information and estimates annual carbon emissions.

The calculator considers:

- Transportation habits
- Food and dietary choices
- Household electricity consumption
- Waste generation and disposal

### 2. Results Dashboard

Provides an overview of the estimated carbon footprint with visual representations and emission breakdowns.

Users can understand which activities contribute most to their overall emissions.

### 3. Personalized Recommendations

Offers suggestions to help users reduce their environmental impact through changes in everyday habits.

### 4. User Authentication

Supports user account functionality through Supabase authentication.

### 5. User Dashboard and Profile

Provides a personalized space to view account information and relevant sustainability activity.

### 6. Leaderboard

Encourages participation by displaying user rankings based on submitted carbon footprint results.

### 7. Sustainability Challenges

Encourages users to participate in activities that promote environmentally responsible habits.

### 8. Certificates

Provides certificate functionality associated with the platform's sustainability experience.

### 9. Environmental Methodology

Includes information about the calculation approach, emission factors, assumptions, and methodology.

### 10. Privacy Information

Provides information about data handling and privacy practices.

---

##  Carbon Footprint Calculation

ECO estimates carbon emissions using activity-based emission factors.

The general calculation approach is:

**Carbon Emissions = Activity Data × Emission Factor**

The calculator considers four major categories:

| Category | Examples |
|---|---|
| Transportation | Personal vehicles, public transport and flights |
| Food | Dietary preferences and consumption patterns |
| Electricity | Household electricity usage |
| Waste | Waste generation and disposal habits |

The emissions from individual categories are combined to estimate the user's overall annual carbon footprint.

**Total Carbon Footprint:**

`Total CO₂e = Transport + Food + Electricity + Waste`

Results are expressed in tonnes of carbon dioxide equivalent (tCO₂e/year).

The calculation engine uses predefined emission factors and modelling assumptions. These estimates should not be interpreted as direct measurements.

---

##  Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Tailwind CSS
- Chart.js

### Backend and Database

- Supabase
- PostgreSQL
- Supabase Authentication
- Row Level Security (RLS)
- Supabase RPC functions

### Other Technologies

- Git and GitHub
- Service Worker
- Responsive web design
- Browser Local Storage

---

##  Project Structure

```text
ECO/
│
├── index.html
├── about.html
├── calculator.html
├── dashboard.html
├── results.html
├── methodology.html
├── privacy.html
├── profile.html
├── leaderboard.html
├── challenge.html
├── certificate.html
├── story.html
│
├── css/
│   ├── base.css
│   ├── theme.css
│   ├── layout.css
│   ├── components.css
│   ├── auth.css
│   ├── dashboard.css
│   ├── profile.css
│   ├── pages.css
│   ├── stats.css
│   ├── notifications.css
│   └── certificate.css
│
├── js/
│   ├── app.js
│   ├── engine.js
│   ├── calculator.js
│   ├── results.js
│   ├── dashboard.js
│   ├── profile.js
│   ├── leaderboard.js
│   ├── challenge.js
│   ├── certificate.js
│   ├── charts.js
│   ├── stats.js
│   ├── auth.js
│   ├── storage.js
│   ├── theme.js
│   ├── config.js
│   ├── supabase-client.js
│   ├── supabase-config.js
│   ├── supabase-auth.js
│   ├── supabase-leaderboard.js
│   └── ...
│
├── img/
│   └── bg/
│
├── schema.sql
├── schema-patch-leaderboard.sql
├── sw.js
│
├── AUDIT_REPORT.md
├── PROMO_VIDEO_PLAN.md
└── README.md
```

---

##  Installation and Setup

### Prerequisites

- A modern web browser
- A code editor such as Visual Studio Code
- Git (optional)
- A Supabase account for backend functionality

### Step 1: Clone the Repository

```bash
git clone https://github.com/ameenreshed/CHE110-Carbon-Footprint-Calculator
```

### Step 2: Open the Project

```bash
cd ECO
```

Open the project folder in Visual Studio Code.

### Step 3: Configure Supabase

Create a Supabase project and configure the frontend using your project's URL and public anon key.

Check the configuration files:

- `js/supabase-config.js`
- `js/config.js`

Never place a Supabase service-role key in frontend JavaScript.

### Step 4: Configure the Database

Review `schema.sql` and execute the required database setup in the Supabase SQL Editor.

If using the reviewed repository, inspect `schema-patch-leaderboard.sql` and apply it after confirming compatibility with the existing schema.

Test database changes in a staging project before applying them to production.

### Step 5: Run the Application

You can use the VS Code Live Server extension or another local static web server.

Open the local website in your browser.

---

##  Database and Security

ECO uses Supabase for authentication and database functionality.

The database supports features such as:

- User profiles
- Carbon footprint results
- Leaderboard functionality
- Sustainability activity

Row Level Security (RLS) policies help restrict access to user-specific records.

The reviewed repository also includes SQL changes intended to limit direct access to private profile and carbon-result records.

Database policies and RPC functions should be tested with both authenticated and unauthenticated accounts before deployment.

---

##  Testing

The reviewed source repository has undergone the following checks:

- JavaScript syntax validation
- Calculator calculation smoke tests
- Negative-input handling
- Zero-waste input handling
- Local HTML resource and reference checks

Additional testing is required for:

- User registration and login
- Profile editing
- Carbon-result submission
- Leaderboard functionality
- Challenge synchronization
- Certificate generation
- Mobile responsiveness
- Accessibility
- Production database security

Passing source-level checks does not guarantee that every production feature works correctly.

---

##  Future Improvements

Potential improvements include:

1. More accurate, location-specific electricity emission factors.
2. Improved transportation calculations using actual travel distances.
3. Better documentation of emission-factor sources and editions.
4. Historical carbon footprint tracking.
5. Monthly and yearly comparison charts.
6. Additional sustainability challenges.
7. Improved mobile experience.
8. Offline support and complete PWA installation functionality.
9. Enhanced accessibility.
10. More comprehensive automated testing.

---

##  Project Limitations

Carbon footprint values are estimates based on predefined emission factors.

Actual emissions may differ depending on location, lifestyle, energy sources, and individual circumstances.

Some calculations use simplified assumptions.

User-submitted leaderboard values should not be treated as independently verified measurements.

The application is an educational sustainability tool, not a certified carbon accounting system.

 Disclaimer

ECO is developed as an educational and environmental awareness project.

The calculated carbon footprint represents an approximate estimate based on the information entered by users and the assumptions used by the calculation model.

The application does not provide official environmental certification, professional carbon auditing, or verified greenhouse gas accounting.

 Author

Ameen Reshed

B.Tech Computer Science and Engineering Student

Interested in software development, web technologies, environmental sustainability, and innovative technology solutions.

Website: https://eco.amnrd.com

Portfolio: https://amnrd.com

GitHub: https://github.com/ameenreshed

LinkedIn: https://www.linkedin.com/in/ameenreshed/

 Our Vision

Small choices. Big impact.

Understand your footprint. Change your habits. Build a greener future.

ECO — Measure Your Impact. Make Every Choice Count.
