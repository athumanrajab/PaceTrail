"use strict";

// Cache the page controls used by workout entry, sorting, and feedback.
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const workoutsToolbar = document.querySelector(".workouts__toolbar");
const clearWorkoutsButton = document.querySelector(".workouts__clear");
const sortField = document.querySelector(".workouts__sort");
const sortDirection = document.querySelector(".workouts__sort-direction");
const appFeedback = document.querySelector(".app-feedback");
const formError = document.querySelector(".form__error");
const submitButton = document.querySelector(".form__btn");
const cancelButton = document.querySelector(".form__cancel");
const inputType = document.querySelector(".form__input--type");
let inputDistance = document.querySelector(".form__input--distance");
let inputDuration = document.querySelector(".form__input--duration");
let inputCadence = document.querySelector(".form__input--cadence");
let inputElevation = document.querySelector(".form__input--elevation");
const welcomeDialog = document.querySelector(".welcome-dialog");

// Leaflet map state and the coordinates of the latest map click.
let map, mapEvent;

// Shared data and date-based description for every workout type.
class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  setDescription() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

// Running workouts add cadence and calculate pace in minutes per kilometer.
class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this.setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
// Cycling workouts add elevation gain and calculate speed in kilometers per hour.
class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this.setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// Coordinates the map, workout collection, persistence, and user interactions.
class App {
  // Keep application state private so updates go through the app's methods.
  #map;
  #mapEvent;
  #workoutsArr = [];
  #markers = new Map();
  #editingWorkoutId = null;
  #mapZoomLevel = 13;
  #feedbackTimeoutId;
  #formErrorTimeoutId;

  constructor() {
    this.#getLocalStorage();

    // Bind handlers so they retain access to this instance and its private state.
    form.addEventListener("submit", this.#newWorkout.bind(this));

    inputType.addEventListener("change", () => {
      this.#toggleElevationField();
      this.#clearFormError();
    });

    containerWorkouts.addEventListener("click", this.#moveToPopup.bind(this));
    containerWorkouts.addEventListener(
      "click",
      this.#handleWorkoutAction.bind(this),
    );
    clearWorkoutsButton.addEventListener(
      "click",
      this.#deleteAllWorkouts.bind(this),
    );
    sortField.addEventListener("change", this.#renderWorkouts.bind(this));
    sortDirection.addEventListener("change", this.#renderWorkouts.bind(this));
    cancelButton.addEventListener("click", this.#hideForm.bind(this));
    form.addEventListener("input", this.#clearFormError.bind(this));
    this.#showWelcome();
  }

  // Show the usage guide once, then request location after it is dismissed.
  #showWelcome() {
    if (localStorage.getItem("pacetrail-welcome-seen")) {
      this.#getPosition();
      return;
    }

    welcomeDialog.addEventListener(
      "close",
      () => {
        localStorage.setItem("pacetrail-welcome-seen", "true");
        this.#getPosition();
      },
      { once: true },
    );
    welcomeDialog.showModal();
  }

  // Ask the browser for the user's position before creating the map.
  #getPosition() {
    navigator.geolocation.getCurrentPosition(
      this.#loadMap.bind(this),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location access is blocked. Allow location access in your browser settings to use the map."
            : error.code === error.TIMEOUT
              ? "Your location request timed out. Please try again."
              : "Your location is unavailable right now. Check your device location settings and try again.";
        this.#showFeedback(message, true);
      },
    );
  }

  // Initialize the map, layer selector, click handler, and saved workout markers.
  #loadMap(position) {
    const { latitude, longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);

    this.#setupMapLayers();

    this.#map.on("click", this.#showForm.bind(this));

    this.#workoutsArr.forEach((work) => {
      this.#renderWorkoutMarker(work);
    });
  }

  // Open a fresh workout form at the map location the user selected.
  #showForm(mapE) {
    this.#mapEvent = mapE;
    this.#editingWorkoutId = null;
    this.#clearFormError();
    submitButton.textContent = "Save workout";
    inputType.value = "running";
    this.#toggleElevationField();
    form.classList.remove("hidden");

    inputDistance.focus();
  }

  // Reset the form and hide it after saving, cancelling, or clearing workouts.
  #hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

    this.#editingWorkoutId = null;
    this.#clearFormError();
    submitButton.textContent = "Save workout";
    inputType.value = "running";
    this.#toggleElevationField();
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  // Display only the workout-specific measurement field.
  #toggleElevationField() {
    inputElevation
      .closest(".form__row")
      .classList.toggle("form__row--hidden", inputType.value === "running");
    inputCadence
      .closest(".form__row")
      .classList.toggle("form__row--hidden", inputType.value === "cycling");
  }

  // Show a status message and replace any pending dismissal timer.
  #showFeedback(message, isError = false) {
    // Restart the timer so a newer message stays visible for its full duration.
    clearTimeout(this.#feedbackTimeoutId);
    appFeedback.textContent = message;
    appFeedback.classList.toggle("app-feedback--error", isError);
    appFeedback.hidden = false;
    this.#feedbackTimeoutId = setTimeout(() => {
      appFeedback.hidden = true;
      appFeedback.textContent = "";
    }, 5000);
  }

  // Remove validation feedback and invalid styling when the user retries.
  #clearFormError() {
    clearTimeout(this.#formErrorTimeoutId);
    formError.textContent = "";
    formError.hidden = true;
    [inputDistance, inputDuration, inputCadence, inputElevation].forEach(
      (input) => input.removeAttribute("aria-invalid"),
    );
  }

  // Show a timed field error and focus the input that needs correction.
  #showFormError(message, input) {
    formError.textContent = message;
    formError.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    clearTimeout(this.#formErrorTimeoutId);
    this.#formErrorTimeoutId = setTimeout(() => {
      this.#clearFormError();
    }, 5000);
  }

  // Validate form values, then create/update the workout and sync its views.
  #newWorkout(e) {
    e.preventDefault();
    this.#clearFormError();
    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // Validate fields separately to give specific, actionable error messages.
    if (
      !inputDistance.value.trim() ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      return this.#showFormError(
        "Enter a distance greater than 0 km.",
        inputDistance,
      );
    }

    if (
      !inputDuration.value.trim() ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return this.#showFormError(
        "Enter a duration greater than 0 minutes.",
        inputDuration,
      );
    }

    if (type === "running") {
      const cadence = Number(inputCadence.value);
      if (
        !inputCadence.value.trim() ||
        !Number.isFinite(cadence) ||
        cadence <= 0
      ) {
        return this.#showFormError(
          "Enter a cadence greater than 0 steps per minute.",
          inputCadence,
        );
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === "cycling") {
      const elevationGain = Number(inputElevation.value);
      if (
        !inputElevation.value.trim() ||
        !Number.isFinite(elevationGain) ||
        elevationGain < 0
      ) {
        return this.#showFormError(
          "Enter an elevation gain of 0 meters or more.",
          inputElevation,
        );
      }
      workout = new Cycling([lat, lng], distance, duration, elevationGain);
    }

    if (this.#editingWorkoutId) {
      const index = this.#workoutsArr.findIndex(
        (item) => item.id === this.#editingWorkoutId,
      );
      if (index === -1) {
        return this.#showFormError(
          "This workout is no longer in your list. Close the form and try again.",
          inputDistance,
        );
      }

      const previousWorkout = this.#workoutsArr[index];
      // Preserve the workout identity and date when updating its measurements.
      workout.id = previousWorkout.id;
      workout.date = previousWorkout.date;
      workout.setDescription();
      this.#workoutsArr[index] = workout;
      this.#markers.get(workout.id)?.remove();
    } else {
      this.#workoutsArr.push(workout);
    }

    const wasEditing = Boolean(this.#editingWorkoutId);
    this.#renderWorkoutMarker(workout);
    this.#renderWorkouts();
    this.#hideForm();
    this.#setLocalStorage();
    this.#showFeedback(
      wasEditing
        ? "Workout updated successfully."
        : "Workout saved successfully.",
    );
  }

  // Add a marker with a popup and retain it for later edits or deletion.
  #renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        }),
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`,
      )
      .openPopup();
    this.#markers.set(workout.id, marker);
  }

  // Rebuild the visible list in the selected order without reordering stored data.
  #renderWorkouts() {
    containerWorkouts
      .querySelectorAll(".workout")
      .forEach((item) => item.remove());
    workoutsToolbar.hidden = this.#workoutsArr.length === 0;

    const direction = sortDirection.value === "asc" ? 1 : -1;
    const sortedWorkouts = [...this.#workoutsArr].sort((a, b) => {
      // Dates need timestamp comparison; other fields use their stored values.
      const aValue =
        sortField.value === "date"
          ? new Date(a.date).getTime()
          : a[sortField.value];
      const bValue =
        sortField.value === "date"
          ? new Date(b.date).getTime()
          : b[sortField.value];
      const comparison =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue)
          : aValue - bValue;

      return comparison === 0
        ? a.id.localeCompare(b.id) * direction
        : comparison * direction;
    });

    sortedWorkouts.forEach((workout) => this.#renderWorkoutList(workout));
  }

  // Create one workout card with its measurements and edit/delete controls.
  #renderWorkoutList(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === "running") {
      html += ` 
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        `;
    }

    if (workout.type === "cycling") {
      html += `
         <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        `;
    }

    html += `
          <div class="workout__actions">
            <button class="workout__action" type="button" data-action="edit">Edit</button>
            <button class="workout__action workout__action--delete" type="button" data-action="delete">Delete</button>
          </div>
        </li>`;

    containerWorkouts.insertAdjacentHTML("beforeend", html);
  }

  // Handle card action buttons through a single delegated list listener.
  #handleWorkoutAction(e) {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const workoutElement = button.closest(".workout");
    const workout = this.#workoutsArr.find(
      (item) => item.id === workoutElement.dataset.id,
    );
    if (!workout) return;

    if (button.dataset.action === "edit") {
      this.#editingWorkoutId = workout.id;
      this.#clearFormError();
      this.#mapEvent = {
        latlng: { lat: workout.coords[0], lng: workout.coords[1] },
      };
      inputType.value = workout.type;
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      inputCadence.value = workout.type === "running" ? workout.cadence : "";
      inputElevation.value =
        workout.type === "cycling" ? workout.elevationGain : "";
      this.#toggleElevationField();
      submitButton.textContent = "Update workout";
      form.classList.remove("hidden");
      inputDistance.focus();
      return;
    }

    if (button.dataset.action === "delete") {
      this.#removeWorkout(workout);
    }
  }

  // Center the map on a workout card unless the user clicked an action button.
  #moveToPopup(e) {
    if (e.target.closest("button")) return;

    const workoutElement = e.target.closest(".workout");

    if (!workoutElement) return;

    const workout = this.#workoutsArr.find(
      (work) => work.id === workoutElement.dataset.id,
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // Confirm and remove one workout from the collection, map, list, and storage.
  #removeWorkout(workout) {
    if (
      !confirm(
        `Delete "${workout.description}"? Its details and map marker will be permanently removed.`,
      )
    ) {
      return;
    }

    this.#workoutsArr = this.#workoutsArr.filter(
      (item) => item.id !== workout.id,
    );
    containerWorkouts
      .querySelector(`[data-id="${workout.id}"]`)
      ?.remove();
    this.#markers.get(workout.id)?.remove();
    this.#markers.delete(workout.id);
    workoutsToolbar.hidden = this.#workoutsArr.length === 0;
    this.#setLocalStorage();

    if (this.#editingWorkoutId === workout.id) this.#hideForm();
    this.#showFeedback(`"${workout.description}" was deleted.`);
  }

  // Confirm and clear all workout data and markers.
  #deleteAllWorkouts() {
    if (this.#workoutsArr.length === 0) return;
    const workoutCount = this.#workoutsArr.length;
    if (
      !confirm(
        `Permanently delete all ${workoutCount} saved workout${workoutCount === 1 ? "" : "s"} and remove their map markers? This action cannot be undone.`,
      )
    ) {
      return;
    }

    this.#markers.forEach((marker) => marker.remove());
    this.#markers.clear();
    this.#workoutsArr = [];
    containerWorkouts
      .querySelectorAll(".workout")
      .forEach((item) => item.remove());
    workoutsToolbar.hidden = true;
    this.#hideForm();
    this.#setLocalStorage();
    this.#showFeedback(
      `${workoutCount} workout${workoutCount === 1 ? "" : "s"} deleted.`,
    );
  }

  // Persist the workout collection as JSON in browser local storage.
  #setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workoutsArr));
  }

  // Restore saved data and revive date strings before rendering the list.
  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;

    this.#workoutsArr = data.map((work) => ({
      ...work,
      date: new Date(work.date),
    }));

    this.#renderWorkouts();
  }

  // Development helper for clearing saved data and reloading the page.
  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }

  // Register the available map styles and add Leaflet's layer selector.
  #setupMapLayers() {
    const standard = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );

    const humanitarian = L.tileLayer(
      "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
      },
    );

    const openTopo = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        attribution:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
      },
    );

    standard.addTo(this.#map);

    const baseMaps = {
      "Standard OSM": standard,
      Humanitarian: humanitarian,
      Topographic: openTopo,
    };

    L.control.layers(baseMaps).addTo(this.#map);
  }
}

// Initialize the app once the deferred script has loaded.
const app = new App();
