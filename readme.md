# 🌱 ECO — Carbon Footprint Calculator

### Measure Your Impact. Make Every Choice Count.

**ECO** is a web-based environmental sustainability platform developed as part of the **CHE110 Environmental Studies project**. It helps individuals understand, calculate, and reduce their personal carbon footprint through an interactive and user-friendly experience.

The platform estimates annual CO₂-equivalent emissions based on everyday activities such as transportation, food consumption, household electricity usage, and waste generation. It presents the results through visual dashboards, emission breakdowns, personalized recommendations, and sustainability challenges.

🌐 **Live Website:** [https://eco.amnrd.com](https://eco.amnrd.com)

---

## 📑 Table of Contents

1. [About the Project](#-about-the-project)
2. [Project Objectives](#-project-objectives)
3. [Key Features](#-key-features)
4. [Carbon Footprint Calculation](#-carbon-footprint-calculation)
5. [Technology Stack](#️-technology-stack)
6. [Project Structure](#-project-structure)
7. [Installation and Setup](#-installation-and-setup)
8. [Supabase Configuration](#️-supabase-configuration)
9. [Database and Security](#️-database-and-security)
10. [Testing](#-testing)
11. [Future Improvements](#-future-improvements)
12. [Project Limitations](#️-project-limitations)
13. [Project Team and Contributions](#-project-team-and-contributions)
14. [Our Vision](#-our-vision)

---

## 🌍 About the Project

Climate change and global warming are among the most significant environmental challenges facing the world today.

Everyday human activities contribute to greenhouse gas emissions, often without individuals realizing the extent of their environmental impact.

ECO aims to make environmental awareness more accessible by providing a platform where users can estimate their carbon footprint and understand how their daily lifestyle choices affect the environment.

The application transforms user-provided lifestyle information into understandable emission estimates and encourages practical steps towards a more sustainable lifestyle.

By combining web technology, environmental awareness, and interactive visualizations, ECO makes understanding personal carbon emissions easier and more engaging.

---

## 🎯 Project Objectives

The primary objectives of ECO are:

- Help individuals understand their personal carbon footprint.
- Estimate annual greenhouse gas emissions from everyday activities.
- Identify the major sources of personal carbon emissions.
- Provide personalized suggestions for reducing environmental impact.
- Encourage sustainable lifestyle habits through interactive challenges.
- Present environmental data through charts and visual dashboards.
- Promote environmental awareness and responsible consumption.
- Encourage individuals to take small but meaningful steps towards sustainability.

---

## ✨ Key Features

### 1. 🌱 Carbon Footprint Calculator

An interactive, multi-step calculator that collects lifestyle information and estimates annual carbon emissions.

The calculator considers:

- Transportation habits
- Food and dietary choices
- Household electricity consumption
- Waste generation and disposal

### 2. 📊 Results Dashboard

Provides an overview of the estimated carbon footprint through visual representations and emission breakdowns.

Users can understand which lifestyle activities contribute most to their overall emissions.

### 3. 💡 Personalized Recommendations

Provides suggestions to help users reduce their environmental impact through practical changes in everyday habits.

### 4. 🔐 User Authentication

Supports user account functionality through Supabase authentication.

### 5. 👤 User Dashboard and Profile

Provides a personalized space to view account information and relevant sustainability activity.

### 6. 🏆 Leaderboard

Encourages participation by displaying user rankings based on submitted carbon footprint results.

### 7. 🌳 Sustainability Challenges

Encourages users to participate in activities that promote environmentally responsible habits.

### 8. 📜 Certificates

Includes certificate functionality associated with the platform's sustainability experience.

### 9. 📚 Environmental Methodology

Provides information about the calculation approach, emission factors, assumptions, and methodology.

### 10. 🔒 Privacy Information

Includes information about data handling and privacy practices.

---

## 🧮 Carbon Footprint Calculation

ECO estimates carbon emissions using an activity-based calculation approach.

The general calculation formula is:

**Carbon Emissions = Activity Data × Emission Factor**

The calculator considers four major categories:

| Category | Activities Considered |
|---|---|
| 🚗 Transportation | Personal vehicles, public transport, and flights |
| 🍃 Food | Dietary preferences and consumption patterns |
| ⚡ Electricity | Household electricity consumption |
| ♻️ Waste | Waste generation and disposal habits |

The emissions from individual categories are combined to estimate the user's overall annual carbon footprint.

### Total Carbon Footprint

```text
Total CO₂e =
Transportation Emissions
+ Food Emissions
+ Electricity Emissions
+ Waste Emissions
```

**Measurement unit:** Tonnes of carbon dioxide equivalent per year (tCO₂e/year).

The results are estimates based on predefined emission factors and modelling assumptions. Actual emissions may vary depending on location, energy sources, consumption patterns, and other circumstances.

---

## 🛠️ Technology Stack

### Frontend Development

| Technology | Purpose |
|---|---|
| HTML5 | Website structure |
| CSS3 | Styling and responsive layouts |
| JavaScript | Application functionality and calculations |
| Tailwind CSS | Utility-based styling |
| Chart.js | Data visualization and charts |

### Backend and Database

| Technology | Purpose |
|---|---|
| Supabase | Backend infrastructure |
| PostgreSQL | Database management |
| Supabase Authentication | User authentication |
| Row Level Security (RLS) | Database access control |
| Supabase RPC | Database functions and operations |

### Development and Deployment

- Visual Studio Code
- Git
- GitHub
- Web hosting and deployment
- Service Worker
- Browser Local Storage

---

## 📂 Project Structure

The project follows a modular structure that separates individual pages, styling, JavaScript functionality, and database configuration.

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
├── README.md
└── ...
```

*Note: The structure above represents the main project files. Some supporting files and assets have been omitted for readability.*

---

## 🚀 Installation and Setup

### Prerequisites

Before running the project locally, make sure you have:

- A modern web browser.
- Visual Studio Code or another code editor.
- Git (optional).
- A Supabase account for backend functionality.

### Step 1: Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
```

### Step 2: Open the Project Folder

```bash
cd ECO
```

Open the project folder in Visual Studio Code.

### Step 3: Configure Supabase

Create a Supabase project and configure the application using your project URL and public anon/publishable key.

Check the relevant configuration files:

```text
js/supabase-config.js
js/config.js
```

Make sure the configuration matches your Supabase project.

### Step 4: Configure the Database

1. Open your Supabase project.
2. Navigate to the SQL Editor.
3. Review the provided `schema.sql`.
4. Execute the required database setup.
5. Configure and verify the necessary Row Level Security policies.

If using additional SQL patches, review them for compatibility with the existing database before execution.

### Step 5: Run the Application

You can use the Live Server extension in Visual Studio Code or another local static web server.

Open the local website in your browser.

---

## ⚙️ Supabase Configuration

ECO uses Supabase for backend services and data management.

The integration supports features such as:

- User authentication
- User profile management
- Carbon footprint result storage
- Leaderboard functionality
- Database operations

### Configuration Requirements

You need:

- Supabase Project URL
- Supabase public anon/publishable key
- Configured database tables
- Required database functions
- Appropriate Row Level Security policies

**Security note:** Never expose a Supabase service-role key in frontend JavaScript or commit private credentials to a public GitHub repository.

---

## 🔐 Database and Security

The application uses Supabase and PostgreSQL for database functionality.

The database supports user-related information and sustainability activity.

Security measures include:

- Row Level Security (RLS) policies.
- User-specific access restrictions.
- Controlled database operations.
- Public and private data access separation.
- Authentication-based database access.

Database policies and RPC functions should be tested with authenticated and unauthenticated accounts before production deployment.

---

## 🧪 Testing

The project can be evaluated through functional, technical, and usability testing.

### Testing Areas

| Testing Area | Description |
|---|---|
| Calculator | Verify emission calculations and input handling |
| Authentication | Test registration and login |
| Dashboard | Verify result display and visualizations |
| Profile | Test profile information and updates |
| Leaderboard | Verify ranking and data retrieval |
| Challenges | Check challenge functionality |
| Certificates | Verify certificate generation |
| Responsiveness | Test different screen sizes |
| Security | Review database permissions and access policies |

Source-level validation and basic calculator smoke tests have been performed during the code review.

Full production testing is still necessary for backend integration, security policies, and all user workflows.

---

## 🔮 Future Improvements

ECO can be expanded with additional features and improvements.

Potential future developments include:

1. Location-specific electricity emission factors.
2. More accurate transportation calculations.
3. Detailed monthly and yearly carbon footprint tracking.
4. Historical comparison of carbon emissions.
5. Improved data visualization.
6. Additional sustainability challenges.
7. Enhanced mobile responsiveness.
8. Improved offline functionality and PWA support.
9. More comprehensive environmental methodology documentation.
10. Automated testing and improved application security.

---

## ⚠️ Project Limitations

- Carbon footprint values are estimates based on predefined emission factors.
- Actual emissions may differ depending on location, lifestyle, energy sources, and individual circumstances.
- Some calculations use simplified assumptions.
- User-submitted leaderboard values are not independently verified measurements.
- The platform is designed for educational and environmental awareness purposes rather than professional carbon accounting.

---

## 👥 Project Team and Contributions

ECO — Carbon Footprint Calculator was developed through collaborative teamwork. Each team member contributed to different aspects of the project, including web development, technical implementation, deployment, media production, and project documentation.

### Team Members

| Team Member | Role | Contributions |
|---|---|---|
| **Ameen Reshed** | Web Development & Deployment | Website design and development, frontend implementation, application functionality, technical integration, website hosting, deployment, maintenance, and improvements. |
| **Ankith** | Video Production & Media | Project demonstration video, screen recordings, video editing, and visual media preparation. |
| **Shreya** | Project Documentation & Report | Project report preparation, documentation, organizing project information, and presenting project objectives, methodology, implementation, and outcomes. |

### Detailed Contribution Breakdown

| Project Activity | Responsible Member |
|---|---|
| Website Design and Development | Ameen Reshed |
| Frontend Development | Ameen Reshed |
| Application Functionality | Ameen Reshed |
| Carbon Calculator Implementation | Ameen Reshed |
| Database and Backend Integration | Ameen Reshed |
| Website Hosting and Deployment | Ameen Reshed |
| Technical Maintenance and Improvements | Ameen Reshed |
| Project Demonstration Video | Ankith |
| Video Recording and Editing | Ankith |
| Media Preparation | Ankith |
| Project Report Preparation | Shreya |
| Project Documentation | Shreya |

### 🤝 Team Collaboration

The project represents a collaborative effort to combine technology, environmental awareness, and effective communication.

Through the contributions of each team member, the project brings together a functional web application, a visual demonstration, and structured academic documentation.

---

## 🌱 Our Vision

> **Small Choices. Big Impact.**

Understand your footprint. Change your habits. Build a greener future.

**ECO — Measure Your Impact. Make Every Choice Count.**

---

<div align="center">

### 🌍 ECO — Carbon Footprint Calculator

**Developed as part of the CHE110 Environmental Studies Project.**

[Visit Website](https://eco.amnrd.com) · [Project Repository](https://github.com/ameenreshed/CHE110-Carbon-Footprint-Calculator)

*Making environmental awareness simple, interactive, and accessible.*

</div>
