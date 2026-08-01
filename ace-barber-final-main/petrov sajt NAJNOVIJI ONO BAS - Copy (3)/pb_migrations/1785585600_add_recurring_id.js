/// <reference path="../pb_data/types.d.ts" />

// Dodaje polje "recurring_id" na kolekciju appointments.
//
// Fiksni termin (npr. "svaki ponedeljak u 11h") se u bazi upisuje kao
// obične rezervacije — jedan zapis po nedelji. Zahvaljujući tome sve
// postojeće provere zauzetosti rade bez ikakve izmene.
// recurring_id povezuje te zapise u JEDNU seriju, da bi admin mogao
// da otkaže celu seriju odjednom i da cron zna koju seriju da produži.
//
// Prazno na svim starim zapisima — izmena je unazad kompatibilna.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("pbc_1037645436");

    collection.fields.addAt(
      collection.fields.length,
      new TextField({
        id: "text_recurring_id",
        name: "recurring_id",
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
    const collection = app.findCollectionByNameOrId("pbc_1037645436");
    collection.fields.removeById("text_recurring_id");
    return app.save(collection);
  },
);
