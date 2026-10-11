# PaceTrail

PaceTrail is an interactive workout tracking application built with HTML, CSS, and vanilla JavaScript. It allows users to record running and cycling workouts on an interactive map, track performance metrics, manage workout history, and save their data locally in the browser.

## Features

- Interactive map powered by Leaflet
- Automatic location detection using the browser Geolocation API
- Log running and cycling workouts by selecting locations on the map
- Automatically calculate running pace and cycling speed
- Track distance, duration, cadence, and elevation gain
- Display workout locations with interactive map markers
- View and sort workout history by different metrics
- Edit existing workouts
- Delete individual workouts or clear all saved workouts
- Automatically save workout data using browser local storage
- Form validation with helpful error messages
- Multiple map layers, including standard, humanitarian, and topographic maps
- Confirmation prompts for destructive actions

## Project Structure

```text
PaceTrail/
├── index.html      # Main application structure
├── style.css       # Application styling
└── script.js       # Workout management and map functionality
```

## Run Locally

Install [Node.js](https://nodejs.org/) and `live-server` globally:

```bash
npm install -g live-server
```

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/athumanrajab/PaceTrail.git
cd PaceTrail
live-server
```

Open the local URL provided by the server, usually:

```text
http://127.0.0.1:8080
```

**Note:** Allow location access in your browser to initialize the map. An internet connection is required to load map tiles.

## How to Use

1. Open PaceTrail and allow access to your location.
2. Click a location on the map to open the workout form.
3. Select **Running** or **Cycling**.
4. Enter the distance, duration, and required workout-specific measurements.
5. Save the workout to display it in your workout list and on the map.
6. Select a workout to locate it on the map.
7. Edit, sort, or delete workouts whenever needed.

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- JavaScript Classes and Private Class Fields
- Leaflet.js
- OpenStreetMap
- Browser Geolocation API
- Browser Local Storage
- DOM Manipulation and Event Delegation

## Visit the Website

[https://athumanrajab.github.io/PaceTrail/](https://athumanrajab.github.io/PaceTrail/)

## Contact

Email: [athumanrajab0903@gmail.com](mailto:athumanrajab0903@gmail.com)  
Phone: +255 795 077 000
