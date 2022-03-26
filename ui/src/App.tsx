import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import LogLevel from "./components/Table/LogLevel";
import Table from "./components/Table/Table";
import { Entry } from "./domain/models";
import api from "./service/api";

import "./index.css";
import { useLocation, useNavigate } from "react-router-dom";
import QueryString from "qs";
import DateText from "./components/DateText";
import SettingsContext, { Settings, SettingsHandler } from "./contexts/Settings";
import SettingsWindow from "./SettingsWindow";

const columns = [
  // {
  //   Header: "",
  //   accessor: "level",
  //   maxWidth: 1,
  //   Cell: ({ cell: { value } }: any) => (
  //     <LogLevel className="-ml-1 -mr-3" level={value} />
  //   ),
  // },
  {
    Header: "Timestamp",
    accessor: "timestamp",
    width: 30,
    className: "bg-red-500",
    Cell: ({ row, cell: { value } }: any) => {
      return (
      <div className="flex">
        <LogLevel level={row.original.level} />
        <DateText className="ml-2" value={value} />
      </div>
    )},
  },
  {
    Header: "Message",
    accessor: "message",
    width: 0,
  },
];

function App() {
  const [logs, setLogs] = React.useState<Entry[]>([]);
  const [logsCount, setLogsCount] = React.useState(0);

  const navigateTo = useNavigate();

  const { search: searchStr } = useLocation();
  const qs = useMemo(
    () => QueryString.parse(searchStr.substring(1)),
    [searchStr]
  );

  useEffect(() => {
    (async () => {
      const r = await api.getLogs({});
      setLogs(r.entries!);
      setLogsCount(r.count);
    })();
  }, []);

  const recordSelected = useMemo(
    () => logs.find((o) => o.$id === qs.$id),
    [qs.$id, logs]
  );

  const onSelectHandler = useCallback(
    (e, row) => {
      navigateTo({
        search: QueryString.stringify({ ...qs, $id: row?.$id }),
      });
    },
    [qs, navigateTo]
  );

  const [settings, setSettings] = useState<Settings>({
    timezone: "local",
  })

  const settingsValue = useMemo<SettingsHandler>(() => ({
    settings: settings,
    updateSettings: setSettings,
  }), [settings]);

  return (
    <SettingsContext.Provider value={settingsValue}>
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Header />
        <main className="p-4">
          {/* <div className="bg-gray-100 dark:bg-black/50 rounded-t-lg border-b-2 border-b-sky-500  px-4 mb-4 h-[80px]"></div> */}
          <div className="shadow overflow-hidden bg-transparency-1 border border-transparent border-b-gray-200 dark:border dark:border-transparent rounded-lg">
            <Table
              columns={columns}
              data={logs}
              count={logsCount}
              onSelectRecord={onSelectHandler}
              selected={recordSelected?.$id}
            />
          </div>
        </main>
      </div>
      <SettingsWindow />
    </SettingsContext.Provider>
  );
}

export default App;
