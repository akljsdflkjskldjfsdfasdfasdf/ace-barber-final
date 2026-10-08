/// <reference path="../pb_data/types.d.ts" />

// Dodaje polje "device_ids" na kolekciju blocked_clients.
//
// Drži oznake uređaja sa kojih je blokiran klijent pokušavao da zakaže,
// razdvojene novim redom (najviše 10 — vidi MAX_DEVICES u lib_blocked.js).
// Server ih sam dopisuje kada odbije nekoga po telefonu ili mejlu, pa ga
// posle pogodi i kad se vrati sa drugim brojem sa istog uređaja.
//
// Oznake stoje SAMO ovde. Kolekcija blocked_clients je admin-only, a u
// termine (appointments) se oznaka nikad ne upisuje — javni booking može
// da lista termine, pa tamo ne sme da bude ničega što prati mušteriju.
//
// Prazno na svim postojećim zapisima — izmena je unazad kompatibilna.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("blocked_clients");

    collection.fields.addAt(
      collection.fields.length,
      new TextField({
        id: "text_device_ids",
        name: "device_ids",
        max: 0,
        min: 0,
        pattern: "",
        autogeneratePattern: "",
        hidden: false,
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
      }),
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("blocked_clients");
    collection.fields.removeById("text_device_ids");
    return app.save(collection);
  },
);
