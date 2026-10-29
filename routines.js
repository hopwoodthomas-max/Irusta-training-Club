// Biblioteca de rutinas, armada con las rutinas reales que manda Juan.
// v1: vive en el código. Próximo paso: que Juan las edite desde la app.

export const ABS = [
  { n: "Abs A", items: ["Doble contracción 15", "Toco talones 15", "Plancha lateral · 15 elev. de cadera por lado"] },
  { n: "Abs B", items: ["Ruedita 10", "Bisagra 12", "Elevaciones de cadera 15 por lado"] },
  { n: "Abs C", items: ["Cortitos 15", "Toco talones 15", "Plancha spider · 10 rodilla a codo"] },
  { n: "Abs D", items: ["Bisagra alternada cruzada 10 c/pierna", "Cruzo pedaleo 10", "Espinales 15"] },
];

// bw: peso corporal (se anotan repeticiones, no kilos)
export const LIB = {
  "Piernas y hombros": [
    { n: "Sentadilla con barra", s: "12 · 10 · 8 · 8" },
    { n: "Sentadilla húngara", s: "10 × 4" },
    { n: "Estocadas", s: "8 c/pierna × 4" },
    { n: "Press militar mancuernas", s: "10 · 10 · 8 · 8" },
    { n: "Vuelos laterales 10 + sissy 12", s: "superserie × 3" },
  ],
  "Espalda y bíceps": [
    { n: "Dominada horizontal prono", s: "8 × 4", bw: true },
    { n: "Remo supino con barra", s: "12 · 10 · 8 · 8" },
    { n: "Remo 1 brazo 10 + pullover 12", s: "superserie × 3" },
    { n: "Bíceps parado barra W", s: "10 · 10 · 8 · 8" },
    { n: "Martillo alternado", s: "8 c/brazo × 3" },
  ],
  "Pecho y tríceps": [
    { n: "Press plano con barra", s: "12 · 10 · 8 · 8" },
    { n: "Inclinado manc. 8 + aperturas 12", s: "superserie × 3" },
    { n: "Flexiones al fallo", s: "× 3", bw: true },
    { n: "Francés con mancuerna", s: "10 · 10 · 8 · 8" },
    { n: "Romano manc. 10 + fondos en banco 15", s: "superserie × 3" },
  ],
  "Pecho, espalda y brazos": [
    { n: "Press plano con barra", s: "12 · 10 · 8 · 8" },
    { n: "Remo supino con barra", s: "12 · 10 · 8 · 8" },
    { n: "Francés con mancuerna", s: "10 · 10 · 8 · 8" },
    { n: "Bíceps parado barra W", s: "10 · 10 · 8 · 8" },
  ],
  "Cuerpo completo": [
    { n: "Sentadilla con barra", s: "12 · 10 · 8 · 8" },
    { n: "Press plano con barra", s: "12 · 10 · 8 · 8" },
    { n: "Remo 1 brazo 10 + pullover 12", s: "superserie × 3" },
    { n: "Press militar mancuernas", s: "10 · 10 · 8 · 8" },
  ],
};

export const SPLIT = {
  1: ["Cuerpo completo"],
  2: ["Piernas y hombros", "Pecho, espalda y brazos"],
  3: ["Piernas y hombros", "Espalda y bíceps", "Pecho y tríceps"],
  4: ["Piernas y hombros", "Espalda y bíceps", "Pecho y tríceps", "Cuerpo completo"],
  5: ["Piernas y hombros", "Espalda y bíceps", "Pecho y tríceps", "Piernas y hombros", "Pecho, espalda y brazos"],
};

export const CARDIO = "6 min de sprints en el pasto o soga";
export const GROUPS = Object.keys(LIB);
export const exercisesFor = (group) => LIB[group] || LIB["Cuerpo completo"];
