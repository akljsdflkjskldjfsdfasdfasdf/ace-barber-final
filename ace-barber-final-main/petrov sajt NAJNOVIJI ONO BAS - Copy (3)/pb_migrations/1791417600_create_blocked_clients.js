/// <reference path="../pb_data/types.d.ts" />

// Kolekcija "blocked_clients" — crna lista za online zakazivanje.
//
// Zakazivanje je anonimno, pa klijenta prepoznajemo samo po broju
// telefona ili mejlu. Zato dva polja za pretragu:
//   phone_norm — broj sveden na jedan oblik ("0642437639"), da se
//                "+381 64 243-7639" i "0642437639" poklope
//   email      — mala slova, bez praznina
// `phone` i `name` su samo za prikaz u adminu.
//
// Pravila: SAMO admin (users.is_admin) sme da čita i menja listu.
// Javni booking NE SME da je čita — inače bi se brojevi mušterija
// videli u mreži svakome. Server (pb_hooks/blocked.pb.js) čita preko
// $app, koji pravila kolekcije ne dotiču.

migrate(
  (app) => {
    const collection = new Collection({
      type: "base",
      name: "blocked_clients",
      listRule: "@request.auth.is_admin = true",
      viewRule: "@request.auth.is_admin = true",
      createRule: "@request.auth.is_admin = true",
      updateRule: "@request.auth.is_admin = true",
      deleteRule: "@request.auth.is_admin = true",
      fields: [
        { type: "text", name: "name", max: 120 },
        { type: "text", name: "phone", max: 40 },
        { type: "text", name: "phone_norm", max: 40 },
        { type: "text", name: "email", max: 160 },
        { type: "text", name: "reason", max: 300 },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_blocked_phone` ON `blocked_clients` (`phone_norm`)",
        "CREATE INDEX `idx_blocked_email` ON `blocked_clients` (`email`)",
      ],
    });

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("blocked_clients");
    return app.delete(collection);
  },
);
