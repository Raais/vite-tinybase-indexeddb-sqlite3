import { StrictMode, useState } from "react";
import {
  createNewStore,
  useIndexedDB,
  useSqlite3,
  exportDb,
  _clearData,
  resetPersistentStorage,
} from "./lib/db/DB";
import { SqliteWasmPersister } from "tinybase/persisters/persister-sqlite-wasm";
import { IndexedDbPersister } from "tinybase/persisters/persister-indexed-db";
import { PersisterProvider } from "./context/PersisterContext";
import { Sqlite3Static } from "@sqlite.org/sqlite-wasm";

import {
  Provider as StoreProvider,
  useCreateStore,
} from "tinybase/debug/ui-react";
import {
  SortedTableInHtmlTable,
  StoreInspector,
  ValuesInHtmlTable,
} from "tinybase/debug/ui-react-dom";
import { Buttons } from "./Buttons";

import { Button, Upload } from "antd";


export const App = () => {
  const [indexedDBPersister, setIndexedDBPersister] =
    useState<IndexedDbPersister | null>(null);
  const [sqlite3Persister, setSqlite3Persister] =
    useState<SqliteWasmPersister | null>(null);
  const [sqlite3Instance, setSqlite3Instance] = useState<Sqlite3Static | null>(
    null
  );

  /*
  DATA LAYERS:
    Memory: [STORE] - TinyBase Store
    TinyBase Persisters: 
      [IndexedDB] - browser storage that persists data locally
      [SQLite3] - in-memory db for export/import data as SQLite db file

    Order:
      page load
      [STORE] empty
      [IndexedDB] load/init data -> [STORE]

      [STORE] changes -> [IndexedDB] // auto save
      [STORE] <- changes [IndexedDB] // auto load - polling 1 second

      manual import
      [file.db] load -> [SQLite3] overwrite data -> [STORE]
      [STORE] changes -> [IndexedDB] // auto save

      manual import > merge
      [file.db] load -> [SQLite3] merge data -> [STORE]
      [STORE] changes -> [IndexedDB] // auto save

      manual export
      [STORE] -> [SQLite3] -> [file.db]
  */

  const store = useCreateStore(() => {
    const store = createNewStore();
    useIndexedDB(indexedDBPersister, setIndexedDBPersister, store);
    return store;
  });

  if (!store) {
    return <div>Loading...</div>;
  }

  return (
    <StrictMode>
      <StoreProvider store={store}>
        <PersisterProvider
          value={{ sqlite3Persister, indexedDBPersister, sqlite3Instance }}
        >
          <StoreInspector />
          <Buttons />
          <div>
            <h2>Values</h2>
            <ValuesInHtmlTable />
          </div>
          <div>
            <h2>Species Table</h2>
            <SortedTableInHtmlTable
              tableId="species"
              cellId="price"
              descending={true}
              sortOnClick={true}
              className="sortedTable"
            />
            <h2>Pets Table</h2>
            <SortedTableInHtmlTable
              tableId="pets"
              cellId="name"
              limit={5}
              sortOnClick={true}
              className="sortedTable"
              paginator={true}
            />

            <button
              onClick={() => {
                _clearData(store);
              }}
            >
              Clear All Data
            </button>

            <button
              onClick={() => {
                resetPersistentStorage(
                  store,
                  indexedDBPersister,
                  setIndexedDBPersister
                );
              }}
            >
              Reset Persistent Storage
            </button>

            <button
              onClick={() => {
                if (!sqlite3Persister || !sqlite3Instance) {
                  useSqlite3(
                    sqlite3Persister,
                    setSqlite3Persister,
                    sqlite3Instance,
                    setSqlite3Instance,
                    store
                  ).then(({ persister, sqlite3 }) =>
                    exportDb(persister, sqlite3)
                  );
                } else {
                  exportDb(sqlite3Persister, sqlite3Instance);
                }
              }}
            >
              Export SQLite DB
            </button>

            <Upload
              accept=".db .DB .sqlite .sqlite3"
              showUploadList={false}
              beforeUpload={(file) => {
                if (!indexedDBPersister) return false;
                const reader = new FileReader();
                reader.readAsArrayBuffer(file);
                reader.onload = async (e) => {
                  const buffer = e.target?.result as ArrayBuffer;
                  await useSqlite3(
                    sqlite3Persister,
                    setSqlite3Persister,
                    sqlite3Instance,
                    setSqlite3Instance,
                    store,
                    buffer,
                    indexedDBPersister
                  );
                };

                return false;
              }}
            >
              <Button>Import SQLite DB</Button>
            </Upload>
          </div>
          <StoreInspector />
        </PersisterProvider>
      </StoreProvider>
    </StrictMode>
  );
};
