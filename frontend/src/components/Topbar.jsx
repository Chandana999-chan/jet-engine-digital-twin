import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Search,
  Wifi,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

import { api } from "../services/api";

export default function Topbar() {
  const [engines, setEngines] = useState([]);
  const [selectedEngine, setSelectedEngine] =
    useState(api.getSelectedEngineId());

  const [search, setSearch] = useState("");

  const [notifications, setNotifications] =
    useState([]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [showEngineMenu, setShowEngineMenu] =
    useState(false);

  const [showSearchResults, setShowSearchResults] =
    useState(false);

  const [loadingEngines, setLoadingEngines] =
    useState(true);

  const topbarRef = useRef(null);

  /* =====================================================
     LOAD ENGINES
  ===================================================== */

  useEffect(() => {
    const loadEngines = async () => {
      try {
        const result = await api.getEngines();

        let engineList = [];

        if (Array.isArray(result)) {
          engineList = result;
        } else if (Array.isArray(result?.engines)) {
          engineList = result.engines;
        } else if (Array.isArray(result?.data)) {
          engineList = result.data;
        }

        const normalized = engineList
          .map((engine, index) => {
            if (
              typeof engine === "number" ||
              typeof engine === "string"
            ) {
              const id = Number(engine);

              return {
                id,
                label: `ENG-${String(id).padStart(
                  3,
                  "0"
                )}`,
                name: "Turbofan Engine",
              };
            }

            const id = Number(
              engine?.engine_id ??
                engine?.id ??
                engine?.engineId ??
                index + 1
            );

            return {
              id,
              label:
                engine?.label ||
                `ENG-${String(id).padStart(
                  3,
                  "0"
                )}`,
              name:
                engine?.name ||
                engine?.type ||
                "Turbofan Engine",
            };
          })
          .filter(
            (engine) =>
              Number.isFinite(engine.id) &&
              engine.id > 0
          );

        setEngines(normalized);

        /*
          If backend returned engines, make sure the
          selected engine actually exists.
        */

        const storedId =
          api.getSelectedEngineId();

        const exists = normalized.some(
          (engine) => engine.id === storedId
        );

        if (!exists && normalized.length > 0) {
          api.setSelectedEngineId(
            normalized[0].id
          );

          setSelectedEngine(
            normalized[0].id
          );
        }
      } catch (error) {
        console.error(
          "Failed to load engines:",
          error
        );

        /*
          Safe fallback.
        The backend is still the source of truth
          whenever /engines is available.
        */

        const fallbackId =
          api.getSelectedEngineId();

        setEngines([
          {
            id: fallbackId,
            label: `ENG-${String(
              fallbackId
            ).padStart(3, "0")}`,
            name: "Turbofan Engine",
          },
        ]);
      } finally {
        setLoadingEngines(false);
      }
    };

    loadEngines();
  }, []);

  /* =====================================================
     KEEP TOPBAR SYNCHRONIZED
  ===================================================== */

  useEffect(() => {
    const unsubscribe =
      api.onEngineChange((engineId) => {
        setSelectedEngine(engineId);
      });

    return unsubscribe;
  }, []);

  /* =====================================================
     LOAD NOTIFICATIONS
  ===================================================== */

  const loadNotifications = async () => {
    try {
      const alerts =
        await api.getAlerts();

      setNotifications(
        Array.isArray(alerts)
          ? alerts
          : []
      );
    } catch (error) {
      console.error(
        "Notification error:",
        error
      );

      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(
      loadNotifications,
      5000
    );

    return () =>
      clearInterval(interval);
  }, [selectedEngine]);

  /* =====================================================
     ENGINE SELECTION
  ===================================================== */

  const handleEngineChange = (engineId) => {
    const id = Number(engineId);

    api.setSelectedEngineId(id);

    setSelectedEngine(id);
    setShowEngineMenu(false);

    /*
      Pages listening to engine-selection-changed
      will reload their backend data.
    */
  };

  /* =====================================================
     SEARCH
  ===================================================== */

  const filteredEngines = engines.filter(
    (engine) => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return false;
      }

      return (
        engine.label
          .toLowerCase()
          .includes(query) ||
        engine.name
          .toLowerCase()
          .includes(query) ||
        String(engine.id).includes(query)
      );
    }
  );

  const handleSearchKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      filteredEngines.length > 0
    ) {
      handleEngineChange(
        filteredEngines[0].id
      );

      setSearch("");
      setShowSearchResults(false);
    }

    if (event.key === "Escape") {
      setSearch("");
      setShowSearchResults(false);
    }
  };

  /* =====================================================
     CLICK OUTSIDE
  ===================================================== */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        topbarRef.current &&
        !topbarRef.current.contains(
          event.target
        )
      ) {
        setShowNotifications(false);
        setShowEngineMenu(false);
        setShowSearchResults(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =====================================================
     CURRENT ENGINE
  ===================================================== */

  const currentEngine =
    engines.find(
      (engine) =>
        engine.id === selectedEngine
    ) || {
      id: selectedEngine,
      label: `ENG-${String(
        selectedEngine
      ).padStart(3, "0")}`,
      name: "Turbofan Engine",
    };

  return (
    <header
      className="topbar"
      ref={topbarRef}
    >
      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="topbar-left">
        <div className="search-container">
          <div className="search-box">
            <Search size={17} />

            <input
              value={search}
              placeholder="Search engine data..."
              onFocus={() =>
                setShowSearchResults(
                  search.length > 0
                )
              }
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                setShowSearchResults(
                  event.target.value
                    .trim()
                    .length > 0
                );
              }}
              onKeyDown={
                handleSearchKeyDown
              }
            />

            {search && (
              <button
                className="search-clear"
                onClick={() => {
                  setSearch("");
                  setShowSearchResults(
                    false
                  );
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {showSearchResults &&
            search &&
            filteredEngines.length > 0 && (
              <div className="search-results">
                <div className="search-results-title">
                  ENGINE RESULTS
                </div>

                {filteredEngines
                  .slice(0, 8)
                  .map((engine) => (
                    <button
                      key={engine.id}
                      className="search-result-item"
                      onClick={() => {
                        handleEngineChange(
                          engine.id
                        );

                        setSearch("");
                        setShowSearchResults(
                          false
                        );
                      }}
                    >
                      <span className="engine-status-dot" />

                      <span>
                        <strong>
                          {engine.label}
                        </strong>

                        <small>
                          {engine.name}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            )}

          {showSearchResults &&
            search &&
            filteredEngines.length === 0 && (
              <div className="search-results">
                <div className="search-no-result">
                  No matching engine found.
                </div>
              </div>
            )}
        </div>
      </div>

      {/* =================================================
          RIGHT SIDE
      ================================================= */}

      <div className="topbar-right">
        {/* LIVE */}

        <div className="system-live">
          <Wifi size={16} />
          LIVE
        </div>

        {/* =================================================
            NOTIFICATIONS
        ================================================= */}

        <div className="topbar-dropdown">
          <button
            className="icon-button"
            onClick={() => {
              setShowNotifications(
                (previous) => !previous
              );

              setShowEngineMenu(false);
            }}
            title="Notifications"
          >
            <Bell size={19} />

            {notifications.length > 0 && (
              <span className="notification-dot" />
            )}
          </button>

          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-header">
                <div>
                  <strong>
                    Notifications
                  </strong>

                  <small>
                    {currentEngine.label}
                  </small>
                </div>

                <button
                  className="notification-close"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                >
                  <X size={14} />
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <CheckCircle2 size={20} />

                  <span>
                    No notifications
                  </span>

                  <small>
                    No monitoring information is currently available.
                  </small>
                </div>
              ) : (
                <div className="notification-list">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${
                        notification.severity === "critical"
                          ? "critical"
                          : notification.severity === "warning"
                          ? "warning"
                          : "info"
                      }`}
                    >
                      {notification.severity === "critical" ? (
                        <AlertTriangle size={18} />
                      ) : notification.severity === "warning" ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}

                      <div>
                        <strong>
                          {notification.title}
                        </strong>

                        <p>
                          {notification.message}
                        </p>

                        <small>
                          {notification.time}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =================================================
            ENGINE SELECTOR
        ================================================= */}

        <div className="engine-selector-wrapper">
          <button
            className="engine-selector"
            onClick={() => {
              setShowEngineMenu(
                (previous) => !previous
              );

              setShowNotifications(false);
            }}
          >
            <span className="engine-status-dot" />

            <div>
              <strong>
                {currentEngine.label}
              </strong>

              <small>
                {currentEngine.name}
              </small>
            </div>

            <ChevronDown
              size={14}
              className={
                showEngineMenu
                  ? "engine-chevron open"
                  : "engine-chevron"
              }
            />
          </button>

          {showEngineMenu && (
            <div className="engine-menu">
              <div className="engine-menu-title">
                SELECT ENGINE
              </div>

              {loadingEngines ? (
                <div className="engine-menu-loading">
                  Loading engines...
                </div>
              ) : engines.length === 0 ? (
                <div className="engine-menu-loading">
                  No engines available.
                </div>
              ) : (
                engines.map((engine) => (
                  <button
                    key={engine.id}
                    className={`engine-option ${
                      engine.id ===
                      selectedEngine
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      handleEngineChange(
                        engine.id
                      )
                    }
                  >
                    <span className="engine-status-dot" />

                    <span className="engine-option-text">
                      <strong>
                        {engine.label}
                      </strong>

                      <small>
                        {engine.name}
                      </small>
                    </span>

                    {engine.id ===
                      selectedEngine && (
                      <CheckCircle2
                        size={15}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}